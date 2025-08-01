import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="description" content="ClubOS - AI-powered golf simulator management system" />
        <meta name="theme-color" content="#0B3D3A" />
        
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ClubOS" />
        <meta name="application-name" content="ClubOS" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#0B3D3A" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/clubos-icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/clubos-icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/clubos-icon-512.png" />
        
        {/* iOS Splash Screens (optional but nice) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        
        {/* Android */}
        <meta name="theme-color" content="#0B3D3A" />
        
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
