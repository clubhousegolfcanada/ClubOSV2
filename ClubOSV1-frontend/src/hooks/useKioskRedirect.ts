import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

export function useKioskRedirect() {
  const router = useRouter();
  const { user } = useAuthState();

  useEffect(() => {
    // If user is kiosk role and not on clubosboy page, redirect
    if (user?.role === 'kiosk' && router.pathname !== '/clubosboy') {
      router.replace('/clubosboy');
    }
  }, [user?.role, router.pathname, router]);
}
