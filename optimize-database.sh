#!/bin/bash
# Database optimization script for ClubOS

echo "🚀 ClubOS Database Optimization Script"
echo "======================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please set it before running this script."
    exit 1
fi

# Create optimization SQL file
cat > /tmp/clubos_db_optimize.sql << 'EOF'
-- ClubOS Database Optimization
-- Generated: $(date)

-- 1. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_created ON auth_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created ON customer_interactions(created_at DESC);

-- 2. Add partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_open_urgent ON tickets(created_at DESC) 
WHERE status = 'open' AND priority = 'urgent';

CREATE INDEX IF NOT EXISTS idx_users_active ON users(email) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bookings_upcoming ON bookings(start_time) 
WHERE status = 'confirmed' AND start_time > NOW();

-- 3. Vacuum and analyze tables
VACUUM ANALYZE users;
VACUUM ANALYZE tickets;
VACUUM ANALYZE bookings;
VACUUM ANALYZE feedback;
VACUUM ANALYZE auth_logs;
VACUUM ANALYZE request_logs;

-- 4. Update table statistics
ANALYZE;

-- 5. Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS row_count
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 6. Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 7. Find missing indexes (queries without index scans)
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE WHEN seq_scan > 0 THEN 
        ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2) 
    ELSE 100 END AS idx_scan_percent
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC;

-- 8. Check for bloated tables
SELECT
    current_database() AS db,
    schemaname,
    tablename,
    ROUND(CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages/otta::numeric END,1) AS tbloat,
    CASE WHEN relpages < otta THEN '0' ELSE pg_size_pretty((bs*(sml.relpages-otta))::bigint) END AS wastedbytes
FROM (
    SELECT
        schemaname,
        tablename,
        cc.oid,
        cc.relpages,
        bs,
        CEIL((cc.reltuples*((datahdr+ma-
            (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta
    FROM (
        SELECT
            ns.nspname AS schemaname,
            cc.relname AS tablename,
            cc.oid,
            cc.relpages,
            cc.reltuples,
            COALESCE(bs,8192) AS bs,
            CEIL((cc.reltuples*avg_width)/bs) AS pages_ff,
            24 AS datahdr,
            CASE WHEN avg_width < 24 THEN 24 ELSE avg_width END AS ma
        FROM pg_class cc
        JOIN pg_namespace ns ON cc.relnamespace = ns.oid
        LEFT JOIN (
            SELECT oid, AVG(width) AS avg_width
            FROM (
                SELECT 
                    attrelid as oid,
                    avg(attlen) as width
                FROM pg_attribute
                WHERE attnum > 0
                GROUP BY attrelid
            ) AS sub
            GROUP BY oid
        ) AS att ON cc.oid = att.oid
        LEFT JOIN (SELECT current_setting('block_size')::numeric AS bs) AS bs ON true
        WHERE cc.relkind IN ('r','m')
    ) AS cc
    LEFT JOIN (
        SELECT
            oid,
            SUM((1-null_frac)*avg_width) AS nullhdr2
        FROM pg_stats
        GROUP BY oid
    ) AS null_estimate ON cc.oid = null_estimate.oid
) AS sml
WHERE sml.relpages > 10
ORDER BY wastedbytes DESC LIMIT 10;

-- 9. Connection stats
SELECT 
    datname,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_read as disk_reads,
    blks_hit as cache_hits,
    ROUND(100.0 * blks_hit / (blks_hit + blks_read), 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- 10. Long running queries
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state != 'idle'
ORDER BY duration DESC;
EOF

echo "📊 Running optimization queries..."
psql "$DATABASE_URL" -f /tmp/clubos_db_optimize.sql

# Create maintenance script
cat > /tmp/clubos_db_maintenance.sh << 'EOF'
#!/bin/bash
# Regular maintenance tasks

echo "🔧 Running maintenance tasks..."

# 1. Update statistics
psql "$DATABASE_URL" -c "ANALYZE;"

# 2. Vacuum tables
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

# 3. Reindex if needed (be careful in production)
# psql "$DATABASE_URL" -c "REINDEX DATABASE CONCURRENTLY;"

# 4. Clean up old logs (older than 30 days)
psql "$DATABASE_URL" << SQL
DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM auth_logs WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM access_logs WHERE created_at < NOW() - INTERVAL '90 days';
VACUUM ANALYZE request_logs, auth_logs, access_logs;
SQL

echo "✅ Maintenance complete"
EOF

chmod +x /tmp/clubos_db_maintenance.sh

echo ""
echo "✅ Optimization complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the output above for any issues"
echo "2. Run maintenance script regularly: /tmp/clubos_db_maintenance.sh"
echo "3. Consider setting up pg_cron for automated maintenance"
echo ""
echo "🎯 Key metrics to monitor:"
echo "- Cache hit ratio (should be >95%)"
echo "- Index usage (should be high for frequently queried tables)"
echo "- Table bloat (should be <20%)"
echo "- Long running queries (should be minimal)"
