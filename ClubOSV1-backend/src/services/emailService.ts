import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// Email transporter configuration
const createTransporter = () => {
  // Check if we have SMTP configuration
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email service not configured - emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    }
  });
};

export class EmailService {
  private transporter: nodemailer.Transporter | null;

  constructor() {
    this.transporter = createTransporter();
  }

  /**
   * Generate a secure verification token
   */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send email verification link to user
   */
  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"ClubOS" <noreply@clubhouse247golf.com>',
      to: email,
      subject: 'Verify your ClubOS account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981 0%, #14B8A6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ClubOS!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thanks for signing up! Please verify your email address to complete your registration.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">
                ${verificationUrl}
              </p>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <p>© 2025 Clubhouse 24/7. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${name},

        Thanks for signing up for ClubOS! Please verify your email address by clicking the link below:

        ${verificationUrl}

        This link will expire in 24 hours.

        If you didn't create an account, you can safely ignore this email.

        Best regards,
        The ClubOS Team
      `
    };

    try {
      if (!this.transporter) {
        // If email is not configured, log the email instead
        logger.info('Email verification link (email service not configured):', {
          to: email,
          verificationUrl
        });
        return true; // Return true so signup continues
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent:', {
        to: email,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      // Don't throw - we don't want to block signup if email fails
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"ClubOS" <noreply@clubhouse247golf.com>',
      to: email,
      subject: 'Reset your ClubOS password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981 0%, #14B8A6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">
                ${resetUrl}
              </p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <div class="footer">
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
                <p>© 2025 Clubhouse 24/7. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${name},

        We received a request to reset your password. Click the link below to create a new password:

        ${resetUrl}

        This link will expire in 1 hour.

        If you didn't request a password reset, you can safely ignore this email.

        Best regards,
        The ClubOS Team
      `
    };

    try {
      if (!this.transporter) {
        logger.info('Password reset link (email service not configured):', {
          to: email,
          resetUrl
        });
        return true;
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent:', {
        to: email,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      return false;
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"ClubOS" <noreply@clubhouse247golf.com>',
      to: email,
      subject: 'Welcome to ClubOS - Your account is ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981 0%, #14B8A6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .feature { margin: 15px 0; padding-left: 25px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ClubOS!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Your email has been verified and your account is now active!</p>
              <p>You've received <strong>100 ClubCoins</strong> as a welcome bonus! 🎉</p>

              <h3>What you can do now:</h3>
              <div class="feature">✅ Book simulators and facilities</div>
              <div class="feature">✅ Join challenges and competitions</div>
              <div class="feature">✅ Track your progress on leaderboards</div>
              <div class="feature">✅ Earn more ClubCoins through activities</div>

              <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Sign In to Your Account</a>
              </p>

              <div class="footer">
                <p>Need help? Contact us at support@clubhouse247golf.com</p>
                <p>© 2025 Clubhouse 24/7. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${name},

        Welcome to ClubOS! Your email has been verified and your account is now active.

        You've received 100 ClubCoins as a welcome bonus! 🎉

        What you can do now:
        - Book simulators and facilities
        - Join challenges and competitions
        - Track your progress on leaderboards
        - Earn more ClubCoins through activities

        Sign in to your account: ${loginUrl}

        Need help? Contact us at support@clubhouse247golf.com

        Best regards,
        The ClubOS Team
      `
    };

    try {
      if (!this.transporter) {
        logger.info('Welcome email would be sent (email service not configured):', { to: email });
        return true;
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Welcome email sent:', {
        to: email,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();