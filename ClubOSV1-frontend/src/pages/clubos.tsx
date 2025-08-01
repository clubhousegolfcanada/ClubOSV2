import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function ClubOSRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Simply redirect to the main ClubOS application
    window.location.href = 'https://clubos-frontend.vercel.app';
  }, []);

  return (
    <>
      <Head>
        <title>ClubOS - Redirecting...</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta httpEquiv="refresh" content="0; url=https://clubos-frontend.vercel.app" />
      </Head>
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Redirecting to ClubOS...
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Please wait while we redirect you
          </p>
          <a 
            href="https://clubos-frontend.vercel.app" 
            className="text-[var(--accent)] hover:underline"
          >
            Click here if you're not redirected automatically
          </a>
        </div>
      </div>
    </>
  );
}