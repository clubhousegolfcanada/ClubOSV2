# ClubCoin API Documentation

## Overview
ClubCoins (CC) are the virtual currency system for ClubOS. Users earn CC through gameplay, challenges, and bonuses, and can spend them on wagers and future marketplace items.

## Key Features
- **100 CC Signup Bonus**: New customers automatically receive 100 CC upon registration
- **Automatic Leaderboard Entry**: New users are immediately added to seasonal leaderboards
- **Transaction Logging**: All CC movements are tracked with full history
- **Seasonal Tracking**: CC earnings and losses tracked per season
- **HubSpot Ready**: Designed for future CRM integration

## Database Schema

### Core Tables

#### `customer_profiles`
- `user_id` (UUID): Links to Users table
- `cc_balance` (DECIMAL): Current ClubCoin balance
- `total_cc_earned` (DECIMAL): Lifetime earnings
- `total_cc_spent` (DECIMAL): Lifetime spending

#### `cc_transactions`
- `id` (UUID): Transaction ID
- `user_id` (UUID): User who owns the transaction
- `type` (VARCHAR): Transaction type (initial_grant, wager_win, wager_loss, etc.)
- `amount` (DECIMAL): Transaction amount
- `balance_before` (DECIMAL): Balance before transaction
- `balance_after` (DECIMAL): Balance after transaction
- `description` (TEXT): Human-readable description
- `metadata` (JSONB): Additional transaction data
- `created_at` (TIMESTAMP): When transaction occurred

#### `seasonal_cc_earnings`
- `user_id` (UUID): User ID
- `season_id` (UUID): Season ID
- `cc_from_wins` (DECIMAL): CC earned from challenge wins
- `cc_from_bonuses` (DECIMAL): CC earned from bonuses (includes signup bonus)
- `cc_lost` (DECIMAL): CC lost in challenges
- `cc_net` (DECIMAL): Net CC for the season
- `challenges_completed` (INT): Number of challenges completed

#### `seasons`
- `id` (UUID): Season ID
- `name` (VARCHAR): Season name (e.g., "Lifetime", "Year 1 (2025-26)")
- `duration_type` (VARCHAR): Type (lifetime, annual, quarterly, monthly)
- `status` (VARCHAR): active, upcoming, completed
- `start_date` (TIMESTAMP): Season start
- `end_date` (TIMESTAMP): Season end

## API Endpoints

### Get CC Balance
```http
GET /api/challenges/cc-balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 100,
    "totalEarned": 100,
    "totalSpent": 0,
    "lastTransaction": {
      "type": "initial_grant",
      "amount": 100,
      "created_at": "2025-01-19T10:00:00Z"
    }
  }
}
```

### Get CC Transaction History
```http
GET /api/users/cc-transactions
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of transactions to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `type` (optional): Filter by transaction type

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "initial_grant",
        "amount": 100,
        "balance_before": 0,
        "balance_after": 100,
        "description": "Welcome bonus",
        "created_at": "2025-01-19T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

### Get Seasonal Leaderboard
```http
GET /api/leaderboard
Authorization: Bearer <token>
```

**Query Parameters:**
- `season_id` (optional): Specific season ID (defaults to current)
- `limit` (optional): Number of entries (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "season": {
      "id": "uuid",
      "name": "Year 1 (2025-26)",
      "status": "active"
    },
    "leaderboard": [
      {
        "rank": 1,
        "user_id": "uuid",
        "name": "John Doe",
        "cc_net": 1500,
        "cc_from_wins": 1200,
        "cc_from_bonuses": 300,
        "challenges_completed": 15
      }
    ]
  }
}
```

## Service Methods (Internal)

### ClubCoinService

#### `initializeUser(userId: string, initialBalance: number = 0)`
Creates initial CC records for a new user.

#### `getBalance(userId: string)`
Returns current balance and lifetime stats.

#### `addTransaction(userId: string, type: string, amount: number, description: string, metadata?: any)`
Records a CC transaction and updates balance.

#### `transferCC(fromUserId: string, toUserId: string, amount: number, reason: string)`
Transfers CC between users (for wagers).

#### `getTransactionHistory(userId: string, limit: number = 50, offset: number = 0)`
Returns paginated transaction history.

## Transaction Types

- `initial_grant`: Signup bonus (100 CC)
- `wager_win`: Won a challenge wager
- `wager_loss`: Lost a challenge wager
- `wager_refund`: Challenge cancelled/disputed
- `bonus`: Special bonuses or promotions
- `purchase`: Future marketplace purchases
- `admin_adjustment`: Manual adjustment by admin

## Signup Flow

1. User registers via `/api/auth/signup`
2. User record created in Users table
3. Customer profile created with 0 balance
4. ClubCoinService.initializeUser() called with 100 CC bonus
5. Transaction logged as "initial_grant"
6. User added to seasonal_cc_earnings for current season
7. User appears on leaderboard immediately

## Challenge/Wager Flow

1. User creates challenge with wager amount
2. CC reserved (not deducted yet)
3. Opponent accepts challenge
4. Both users' CC deducted
5. Challenge completed
6. Winner receives pot (2x wager minus any fees)
7. Transactions logged for both users
8. Seasonal earnings updated

## Future Integrations

### HubSpot Sync
- Export CC balance as custom property
- Track transaction history in CRM
- Trigger workflows based on CC milestones
- Segment users by CC activity

### Marketplace
- Purchase virtual goods
- Buy tournament entries
- Redeem for real-world rewards
- Transfer to friends (gift system)

## Testing

### Test Scripts
- `/scripts/test-signup-flow.ts`: Validates 100 CC bonus on signup
- `/scripts/test-friends-api-fixed.ts`: Tests friend system with CC visibility
- `/scripts/create-seasons.sql`: Sets up seasonal structure

### Test Coverage
✅ Signup bonus allocation
✅ Balance API endpoint
✅ Transaction logging
✅ Seasonal leaderboard entry
✅ Database persistence
✅ Friend CC visibility

## Best Practices

1. **Always use transactions**: Wrap CC operations in database transactions
2. **Log everything**: Every CC movement must have a transaction record
3. **Validate balances**: Check sufficient balance before deductions
4. **Handle race conditions**: Use row locks for concurrent updates
5. **Audit regularly**: Reconcile balances with transaction sums

## Error Handling

Common errors and solutions:

- **Insufficient balance**: Check balance before attempting deduction
- **User not found**: Ensure user exists and is active
- **Season not found**: Fall back to lifetime season
- **Transaction failed**: Rollback and retry with exponential backoff

## Security Considerations

1. **Authorization**: All endpoints require valid JWT
2. **Rate limiting**: Prevent abuse of CC generation
3. **Validation**: Strict input validation on amounts
4. **Audit trail**: Complete transaction history
5. **Admin controls**: Only admins can adjust balances directly