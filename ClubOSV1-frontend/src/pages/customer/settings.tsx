import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Redirect /customer/settings to /customer/profile
export default function CustomerSettings() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/profile');
  }, [router]);

  return null;
}