import { OAuth2Client } from 'google-auth-library';
import { config } from '../utils/envValidator';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { generateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

// Initialize Google OAuth client
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
});

// Domain restriction for Clubhouse employees
const ALLOWED_DOMAINS = ['clubhouse247golf.com', 'clubhouseathleticclub.com'];
const ALLOWED_TEST_EMAILS = process.env.GOOGLE_TEST_EMAILS?.split(',') || [];

export interface GoogleUserInfo {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  hd?: string; // Hosted domain for Google Workspace
  locale?: string;
}

/**
 * Generate Google OAuth URL for sign-in
 */
export const getGoogleAuthUrl = (userType: 'operator' | 'customer' = 'operator'): string => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
  ];

  const authOptions: any = {
    access_type: 'offline',
    scope: scopes,
    prompt: 'select_account', // Always show account selection
  };

  // Only restrict domain for operators
  if (userType === 'operator') {
    authOptions.hd = 'clubhouse247golf.com'; // Hint for Google Workspace domain
  }

  const authUrl = googleClient.generateAuthUrl(authOptions);

  return authUrl;
};

/**
 * Verify Google ID token and extract user information
 */
export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserInfo> => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID!
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: payload.email!,
      email_verified: payload.email_verified || false,
      name: payload.name || payload.email!.split('@')[0],
      picture: payload.picture,
      hd: payload.hd,
      locale: payload.locale
    };
  } catch (error) {
    logger.error('Google token verification failed:', error);
    throw new Error('Invalid Google token');
  }
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code: string) => {
  try {
    const { tokens } = await googleClient.getToken(code);
    return tokens;
  } catch (error) {
    logger.error('Failed to exchange code for tokens:', error);
    throw new Error('Failed to authenticate with Google');
  }
};

/**
 * Verify email domain is allowed
 * For operators: Restrict to Clubhouse domains
 * For customers: Allow all valid emails
 */
export const isEmailAllowed = (email: string, isCustomer: boolean = false): boolean => {
  // Customers: Allow all valid email addresses
  if (isCustomer) {
    // Basic email validation (Google already verified it)
    return email.includes('@') && email.includes('.');
  }

  // Operators: Check test emails first (for development)
  if (ALLOWED_TEST_EMAILS.includes(email)) {
    return true;
  }

  // Operators: Check domain restriction
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
};

/**
 * Find or create user from Google profile
 */
export const findOrCreateGoogleUser = async (googleUser: GoogleUserInfo, userType: 'operator' | 'customer' = 'operator') => {
  try {
    const isCustomer = userType === 'customer';

    // Check if email is allowed based on user type
    if (!isEmailAllowed(googleUser.email, isCustomer)) {
      if (isCustomer) {
        throw new Error('Invalid email address');
      } else {
        throw new Error(`Email domain not allowed. Only ${ALLOWED_DOMAINS.join(', ')} emails are permitted.`);
      }
    }

    // First, check if user exists with this Google ID
    let user = await db.query(
      `SELECT * FROM users WHERE google_id = $1`,
      [googleUser.id]
    );

    if (user.rows.length > 0) {
      // Update last login and any changed profile info
      await db.query(
        `UPDATE users
         SET last_login = CURRENT_TIMESTAMP,
             oauth_picture_url = $1,
             oauth_metadata = $2,
             email_verified = $3
         WHERE id = $4`,
        [
          googleUser.picture,
          JSON.stringify({
            hd: googleUser.hd,
            locale: googleUser.locale
          }),
          googleUser.email_verified,
          user.rows[0].id
        ]
      );

      return user.rows[0];
    }

    // Check if user exists with same email (for linking accounts)
    user = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [googleUser.email]
    );

    if (user.rows.length > 0) {
      // Link existing account to Google
      await db.query(
        `UPDATE users
         SET google_id = $1,
             auth_provider = 'google',
             oauth_email = $2,
             oauth_picture_url = $3,
             oauth_metadata = $4,
             email_verified = $5,
             last_login = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          googleUser.id,
          googleUser.email,
          googleUser.picture,
          JSON.stringify({
            hd: googleUser.hd,
            locale: googleUser.locale
          }),
          googleUser.email_verified,
          user.rows[0].id
        ]
      );

      logger.info('Linked existing account to Google:', {
        userId: user.rows[0].id,
        email: googleUser.email
      });

      return user.rows[0];
    }

    // Determine role based on user type and domain
    let role = 'customer'; // Default to customer
    if (!isCustomer) {
      // For operator mode, check if it's a Clubhouse domain
      const domain = googleUser.email.split('@')[1];
      role = ALLOWED_DOMAINS.includes(domain) ? 'operator' : 'customer';
    }

    // Determine auto-approval for customers
    let status = 'active'; // Default to active (auto-approved)
    if (isCustomer) {
      // Check auto-approval setting (could be from system config)
      // For now, auto-approve all Google customers (verified emails)
      status = 'active';
    }

    // Create new user
    const userId = uuidv4();
    const newUser = await db.query(
      `INSERT INTO users (
        id, email, name, google_id, auth_provider,
        oauth_email, oauth_picture_url, oauth_metadata,
        email_verified, role, is_active, status, created_at, last_login
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        userId,
        googleUser.email,
        googleUser.name,
        googleUser.id,
        'google',
        googleUser.email,
        googleUser.picture,
        JSON.stringify({
          hd: googleUser.hd,
          locale: googleUser.locale
        }),
        googleUser.email_verified,
        role,
        true,
        status
      ]
    );

    // Create customer profile if it's a customer
    if (role === 'customer') {
      try {
        await db.query(
          `INSERT INTO customer_profiles (
            id, user_id, display_name, avatar_url,
            profile_visibility, show_bookings, show_stats,
            max_friends, max_teams, cc_balance,
            credibility_score, current_rank, highest_rank_achieved,
            total_challenges_played, total_challenges_won,
            created_at, updated_at, last_active_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            uuidv4(),
            userId,
            googleUser.name, // Use Google name as display name
            googleUser.picture, // Use Google profile picture
            'friends', // Default visibility
            true, // Show bookings
            true, // Show stats
            250, // Max friends
            5, // Max teams
            0, // Starting CC balance
            100, // Starting credibility
            'house', // Starting rank
            'house', // Highest rank
            0, // Challenges played
            0 // Challenges won
          ]
        );

        logger.info('Created customer profile for Google user:', {
          userId,
          email: googleUser.email
        });
      } catch (profileError) {
        logger.error('Failed to create customer profile:', profileError);
        // Don't fail the whole signup if profile creation fails
      }
    }

    logger.info('Created new Google user:', {
      userId: newUser.rows[0].id,
      email: googleUser.email,
      domain: googleUser.hd
    });

    return newUser.rows[0];
  } catch (error) {
    logger.error('Failed to find or create Google user:', error);
    throw error;
  }
};

/**
 * Log OAuth sign-in attempt
 */
export const logOAuthAttempt = async (
  email: string,
  googleId: string,
  success: boolean,
  failureReason?: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await db.query(
      `INSERT INTO oauth_login_audit (
        user_id, email, provider, google_id, success,
        failure_reason, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        email,
        'google',
        googleId,
        success,
        failureReason || null,
        ipAddress || null,
        userAgent || null
      ]
    );
  } catch (error) {
    logger.error('Failed to log OAuth attempt:', error);
    // Don't throw - logging failure shouldn't break auth flow
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (
  code: string,
  rememberMe: boolean,
  userType: 'operator' | 'customer' = 'operator',
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.id_token) {
      throw new Error('No ID token received from Google');
    }

    // Verify token and get user info
    const googleUser = await verifyGoogleToken(tokens.id_token);

    const isCustomer = userType === 'customer';

    // Check if email is allowed
    if (!isEmailAllowed(googleUser.email, isCustomer)) {
      await logOAuthAttempt(
        googleUser.email,
        googleUser.id,
        false,
        isCustomer ? 'Invalid email' : 'Domain not allowed',
        undefined,
        ipAddress,
        userAgent
      );

      if (isCustomer) {
        throw new Error('Invalid email address');
      } else {
        throw new Error(`Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`);
      }
    }

    // Find or create user
    const user = await findOrCreateGoogleUser(googleUser, userType);

    // Store OAuth session if we have refresh token
    if (tokens.refresh_token) {
      await db.query(
        `INSERT INTO oauth_sessions (
          user_id, provider, access_token, refresh_token, token_expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          access_token = $3,
          refresh_token = $4,
          token_expires_at = $5,
          updated_at = CURRENT_TIMESTAMP,
          last_used = CURRENT_TIMESTAMP`,
        [
          user.id,
          'google',
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null
        ]
      );
    }

    // Generate JWT token
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: uuidv4(),
      name: user.name,
      phone: user.phone
    }, rememberMe);

    // Log successful attempt
    await logOAuthAttempt(
      googleUser.email,
      googleUser.id,
      true,
      undefined,
      user.id,
      ipAddress,
      userAgent
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        picture: user.oauth_picture_url
      },
      token: jwtToken
    };
  } catch (error: any) {
    logger.error('Google OAuth callback failed:', error);
    throw error;
  }
};

/**
 * Revoke Google OAuth access
 */
export const revokeGoogleAccess = async (userId: string) => {
  try {
    // Get stored tokens
    const session = await db.query(
      `SELECT * FROM oauth_sessions
       WHERE user_id = $1 AND provider = 'google'`,
      [userId]
    );

    if (session.rows.length > 0 && session.rows[0].access_token) {
      // Revoke token with Google
      await googleClient.revokeToken(session.rows[0].access_token);
    }

    // Remove OAuth session
    await db.query(
      `DELETE FROM oauth_sessions
       WHERE user_id = $1 AND provider = 'google'`,
      [userId]
    );

    // Remove Google ID from user
    await db.query(
      `UPDATE users
       SET google_id = NULL,
           auth_provider = 'local',
           oauth_email = NULL,
           oauth_picture_url = NULL,
           oauth_metadata = NULL
       WHERE id = $1`,
      [userId]
    );

    logger.info('Revoked Google access for user:', userId);
  } catch (error) {
    logger.error('Failed to revoke Google access:', error);
    throw error;
  }
};