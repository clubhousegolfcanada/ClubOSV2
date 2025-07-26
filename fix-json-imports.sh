#!/bin/bash
echo "🔧 Fixing remaining JSON import errors"
echo "====================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Fix requestLogger.ts
sed -i '' 's/import { appendToJsonArray } from.*$/\/\/ JSON logging removed - using PostgreSQL/' src/middleware/requestLogger.ts

# Fix customer.ts
sed -i '' 's/import { appendToJsonArray, readJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/customer.ts

# Fix debug.ts
sed -i '' 's/import { readJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/debug.ts

# Fix health.ts
sed -i '' 's/import { readJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/health.ts

# Fix llm.ts
sed -i '' 's/import { appendToJsonArray, readJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/llm.ts

# Fix passwordReset.ts
sed -i '' 's/import { readJsonFile, writeJsonFile, appendToJsonArray } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/passwordReset.ts

# Fix slack.ts
sed -i '' 's/import { appendToJsonArray, readJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/routes/slack.ts

# Fix createAdmin.ts
sed -i '' 's/import { writeJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/scripts/createAdmin.ts

# Fix secureGPTFunctionHandler.ts
sed -i '' 's/import { readJsonFile, writeJsonFile, appendToJsonArray } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/services/gpt/secureGPTFunctionHandler.ts

# Fix UsageTracker.ts
sed -i '' 's/import { readJsonFile, writeJsonFile, ensureFileExists } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/services/usage/UsageTracker.ts

# Fix ensureAdmin.ts
sed -i '' 's/import { readJsonFile, writeJsonFile } from.*$/\/\/ JSON operations removed - using PostgreSQL/' src/utils/ensureAdmin.ts

# Create missing rate limiter files
cat > src/middleware/rateLimiter.ts << 'EOF'
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip,
      path: req.path 
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  }
});
EOF

cat > src/middleware/authLimiter.ts << 'EOF'
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { 
      ip: req.ip,
      path: req.path 
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});
EOF

echo "✅ Fixed import errors and created missing rate limiter files"

# Build to check
npm run build

echo -e "\n✅ Import fixes complete!"