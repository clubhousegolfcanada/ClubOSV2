/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Disable webpack cache to avoid cache issues
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
  
  // Security headers for iframe embedding
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Removed X-Frame-Options to allow embedding
          // Using CSP frame-ancestors instead
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.hubspot.com https://*.hs-sites.com https://*.hubspotpagebuilder.com http://localhost:* https://app.hubspot.com;"
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  },
}

module.exports = nextConfig
