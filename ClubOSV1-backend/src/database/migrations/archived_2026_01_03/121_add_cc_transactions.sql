-- Create cc_transactions table for tracking Club Coin transactions
CREATE TABLE IF NOT EXISTS cc_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'spent', 'adjustment', 'transfer')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cc_transactions_user ON cc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_transactions_created ON cc_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_transactions_type ON cc_transactions(type);