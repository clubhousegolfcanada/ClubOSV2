# ClubOSV1 User Information and Phone Number Updates

## Summary of Changes

This update adds phone number support to user accounts, enables admins to edit user information, adds a profile section for users to manage their own data, and ensures that user information (name, email, phone) is properly displayed in Slack notifications.

## Backend Changes

### 1. User Model Update
- The `User` interface in `/src/types/index.ts` already had an optional `phone?: string` field

### 2. Auth Routes (`/src/routes/auth.ts`)
- **Registration endpoint**: Added phone number validation and handling
  - Added validation for phone format using regex pattern
  - Phone number is now saved when creating new users
- **New endpoint**: `PUT /api/auth/users/:userId` for updating user profiles
  - Users can update their own profile (name, email, phone)
  - Admins can update any user's profile
  - Includes validation for phone number format
  - Prevents duplicate emails

### 3. Slack Notifications (`/src/services/slackFallback.ts`)
- **Enhanced user information display** in all Slack messages:
  - `sendDirectMessage`: Now shows user name, email, and phone number
  - `sendFallbackNotification`: Updated to include full user information
  - `sendTicketNotification`: Shows creator's name, email, and phone
- **Improved formatting**: User info displayed as "Name (email) | 📱 phone"

### 4. LLM Route (`/src/routes/llm.ts`)
- Updated to fetch full user information when processing requests
- Includes user data (name, email, phone, role) in the request object
- Passes user information to Slack fallback notifications

### 5. Tickets Route (`/src/routes/tickets.ts`)
- Updated ticket creation to include creator's phone number
- Comments now also include the commenter's phone number
- Fetches full user information from users.json

## Frontend Changes

### Operations Page (`/src/pages/operations.tsx`)
- **User creation form**: Added phone number input field
- **User list display**: Shows phone numbers for users who have them
- **Admin editing**: Admins can now edit any user's information inline
  - Click the edit icon to enter edit mode
  - Edit name, email, and phone number
  - Save or cancel changes with intuitive icons
- **Profile tab**: New tab for users to manage their own information
  - Edit personal information (name, email, phone)
  - Change password with current password verification
  - View account creation date and role
- Phone numbers displayed with 📱 emoji for visual clarity

## Utility Script

### Add Phone Numbers Script (`add-phone-numbers.js`)
- Created a utility script to update existing users with example phone numbers
- Useful for testing the new functionality
- Run with: `node add-phone-numbers.js`

## API Changes

### New Endpoints
1. `PUT /api/auth/users/:userId` - Update user profile
   - Body: `{ name?, email?, phone? }`
   - Regular users can update their own profile
   - Admins can update any user's profile

### Updated Endpoints
1. `POST /api/auth/register` - Now accepts `phone` field
2. All endpoints that create Slack notifications now include user phone information

## Testing

1. **Create a new user with phone number**:
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!",
       "name": "Test User",
       "phone": "+1 (902) 555-0123",
       "role": "operator"
     }'
   ```

2. **Update user profile**:
   ```bash
   curl -X PUT http://localhost:3001/api/auth/users/USER_ID \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "+1 (902) 555-0124"
     }'
   ```

3. **Test admin editing**:
   - Log in as an admin
   - Go to Operations → Settings → User Management
   - Click the edit icon next to any user
   - Modify their information and save

4. **Test profile management**:
   - Go to Operations → Profile
   - Update your personal information
   - Change your password

5. **Test Slack notifications** to see enhanced user information:
   - Create a ticket
   - Send a direct message to Slack
   - Trigger an LLM fallback

## Benefits

1. **Better user identification**: Staff can now see who sent a request with full contact information
2. **Improved communication**: Phone numbers enable quick callbacks for urgent issues
3. **Enhanced Slack notifications**: All notifications now show comprehensive user information
4. **Flexible updates**: Users can update their own profile information
5. **Admin control**: Admins can edit any user's information for better user management
6. **User autonomy**: Users have a dedicated profile section to manage their own data

## Notes

- Phone numbers are optional and validated with a regex pattern
- The phone validation accepts various formats including international numbers
- Existing users won't have phone numbers until they update their profiles
- All Slack notifications gracefully handle missing phone numbers
- Admin users can edit any user's information except their own role
- Users can only update their own profile unless they're an admin
- Password changes require current password verification for security
- The profile section provides a user-friendly interface for self-service updates
