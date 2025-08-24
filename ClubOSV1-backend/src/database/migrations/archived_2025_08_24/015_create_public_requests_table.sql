-- Create table for tracking public ClubOS Boy requests
CREATE TABLE IF NOT EXISTS public_requests (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    question TEXT NOT NULL,
    location VARCHAR(255),
    source VARCHAR(50) DEFAULT 'public_web',
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for analytics
CREATE INDEX idx_public_requests_created_at ON public_requests(created_at);
CREATE INDEX idx_public_requests_ip_address ON public_requests(ip_address);
CREATE INDEX idx_public_requests_source ON public_requests(source);

-- Create a view for daily analytics
CREATE OR REPLACE VIEW public_requests_daily_stats AS
SELECT 
    DATE(created_at) as request_date,
    COUNT(*) as total_requests,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(response_time_ms) as avg_response_time_ms,
    COUNT(CASE WHEN source = 'public_hubspot' THEN 1 END) as hubspot_requests,
    COUNT(CASE WHEN source = 'public_web' THEN 1 END) as web_requests
FROM public_requests
GROUP BY DATE(created_at)
ORDER BY request_date DESC;