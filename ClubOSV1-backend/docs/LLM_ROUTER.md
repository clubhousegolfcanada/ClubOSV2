# LLM Router Abstraction Documentation

## Overview
The LLM Router provides a flexible abstraction layer for managing multiple Language Model providers (OpenAI, Anthropic, etc.) with automatic failover, load balancing, and metrics tracking.

## Architecture

```
LLMRouter
├── Providers (Priority Queue)
│   ├── OpenAI (Priority: 100)
│   ├── Anthropic (Priority: 90)
│   └── Local (Fallback)
├── Retry Logic
├── Metrics Collection
└── Failover Management
```

## Features

### 1. Multiple Provider Support
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3 models
- **Local**: Keyword-based fallback
- Easy to add new providers

### 2. Automatic Failover
- Tries providers in priority order
- Configurable retry attempts
- Falls back to local provider if all fail

### 3. Provider Management
- Enable/disable providers at runtime
- Adjust provider priorities
- Test provider connections
- Monitor provider health

### 4. Metrics & Monitoring
- Request counts per provider
- Success/failure rates
- Average latency tracking
- Error logging

## Configuration

### Environment Variables

```bash
# OpenAI Provider
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Anthropic Provider
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-opus-20240229
```

### Router Configuration

```typescript
const router = new LLMRouter({
  fallbackToLocal: true,      // Use local provider as fallback
  retryAttempts: 2,          // Retry failed requests
  retryDelay: 1000          // Delay between retries (ms)
});
```

## API Endpoints

### Provider Management

#### Get Provider Status
```http
GET /api/llm/providers
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "providers": [
    {
      "name": "openai",
      "enabled": true,
      "configured": true,
      "priority": 100,
      "model": "gpt-4-turbo-preview",
      "connected": true,
      "metrics": {
        "totalRequests": 150,
        "successfulRequests": 145,
        "failedRequests": 5,
        "averageLatency": 850
      }
    }
  ]
}
```

#### Test All Providers
```http
POST /api/llm/providers/test
Authorization: Bearer <token>
```

#### Enable/Disable Provider
```http
PUT /api/llm/providers/{provider}/enable
PUT /api/llm/providers/{provider}/disable
Authorization: Bearer <token>
```

#### Update Provider Priority
```http
PUT /api/llm/providers/{provider}/priority
Authorization: Bearer <token>
Content-Type: application/json

{
  "priority": 150
}
```

## Adding a New Provider

### 1. Create Provider Class

```typescript
import { BaseLLMProvider } from './BaseLLMProvider';
import { LLMConfig, LLMResponse } from './types';

export class CustomProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super(config, 'custom');
  }

  async processRequest(
    description: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<LLMResponse> {
    // Implementation
  }

  // Implement other required methods
}
```

### 2. Register Provider

```typescript
// In llmService.ts
if (config.CUSTOM_API_KEY) {
  const customProvider = new CustomProvider({
    apiKey: config.CUSTOM_API_KEY
  });
  
  this.router.addProvider('custom', customProvider, 80, true);
}
```

## Usage Examples

### Basic Request
```typescript
const response = await llmService.processRequest(
  'Book a bay for tomorrow at 3pm',
  'user123'
);
```

### With Context
```typescript
const response = await llmService.processRequest(
  'Check my booking',
  'user123',
  {
    previousBookings: [...],
    userPreferences: {...}
  }
);
```

### With Preferred Provider
```typescript
const response = await router.processRequest(
  description,
  userId,
  context,
  'anthropic'  // Try Anthropic first
);
```

## Metrics and Monitoring

### Get Provider Metrics
```typescript
const metrics = llmService.getMetrics();
// Returns array of ProviderMetrics
```

### Monitor Provider Health
```typescript
const status = await llmService.getRouterStatus();
status.forEach(provider => {
  if (provider.metrics.errorRate > 0.1) {
    console.warn(`High error rate for ${provider.name}`);
  }
});
```

## Error Handling

### Non-Retryable Errors
- Invalid API key
- Quota exceeded
- Provider not configured

### Retryable Errors
- Network timeouts
- Temporary API errors
- Rate limiting (with backoff)

## Best Practices

1. **Provider Priority**: Set higher priority for more reliable/preferred providers
2. **Monitoring**: Regularly check provider metrics and health
3. **Fallback Strategy**: Always have local provider as ultimate fallback
4. **Error Handling**: Log all errors for debugging
5. **Testing**: Test providers regularly to ensure they're working

## Troubleshooting

### Provider Not Working
1. Check API key configuration
2. Test provider connection: `POST /api/llm/providers/test`
3. Check provider metrics for error patterns
4. Review logs for detailed errors

### High Latency
1. Check provider metrics
2. Consider adjusting provider priorities
3. Implement caching for common requests
4. Monitor network connectivity

### Failover Not Working
1. Ensure fallback is enabled
2. Check provider priorities
3. Verify local provider is available
4. Review retry configuration
