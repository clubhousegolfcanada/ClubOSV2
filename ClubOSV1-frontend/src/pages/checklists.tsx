import { ChecklistSystem } from '@/components/ChecklistSystem';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Clipboard, BarChart3 } from 'lucide-react';
import OperatorLayout from '@/components/OperatorLayout';
import SubNavigation, { SubNavTab } from '@/components/SubNavigation';

export default function Checklists() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'checklist' | 'tracker'>('checklist');

  // SECURITY: Block customer role from accessing checklists
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Allow operator roles and contractors
      if (!['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  // Don't render until we know the user's role
  if (!user || !['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
    return null;
  }

  // Define tabs for SubNavigation
  const tabs: SubNavTab[] = [
    { id: 'checklist', label: 'Checklists', icon: Clipboard },
    { id: 'tracker', label: 'Completion Tracker', icon: BarChart3 }
  ];

  return (
    <OperatorLayout
      title="Checklists - ClubOS"
      description="Complete cleaning and tech maintenance checklists"
      subNavigation={
        <SubNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as 'checklist' | 'tracker')}
        />
      }
    >
      <ChecklistSystem activeTab={activeTab} />
    </OperatorLayout>
  );
}