import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ChallengesIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the compete page which has the challenges functionality
    router.replace('/customer/compete');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecting to challenges...</p>
      </div>
    </div>
  );
}