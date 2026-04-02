-- Migration 367: Performance indexes for dashboard load optimization
-- Purpose: Add composite indexes to eliminate full table scans on app startup
-- Created: 2026-04-02 (v1.31.1)
-- Context: Dashboard fires ~10 parallel queries on load. tickets + stats queries
--          were taking 2-7 seconds each, saturating the DB connection pool.

-- Tickets: composite index for the main list query (created_by_id + createdAt DESC)
-- The existing idx_tickets_created_by_id is single-column; this covers ORDER BY too
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_created_at
ON tickets(created_by_id, "createdAt" DESC);

-- Tickets: createdAt for date-range stats queries
CREATE INDEX IF NOT EXISTS idx_tickets_created_at
ON tickets("createdAt" DESC);

-- Tickets: composite for status + createdAt (stats queries filter by date range + status)
CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at
ON tickets(status, "createdAt" DESC);

-- Bookings: createdAt for stats overview date-range queries
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
ON bookings("createdAt" DESC);

-- Bookings: composite for status + createdAt (stats filter cancelled + date range)
CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at
ON bookings(status, "createdAt" DESC);
