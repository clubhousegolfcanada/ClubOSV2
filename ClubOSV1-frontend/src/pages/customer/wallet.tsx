import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Wallet, CreditCard, TrendingUp, DollarSign, Plus, History } from 'lucide-react';

export default function CustomerWallet() {
  const router = useRouter();
  const { user, isLoading } = useAuthState();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
    } else if (user.role !== 'customer' && user.role !== 'admin' && user.role !== 'operator') {
      router.push('/');
    }
  }, [user, router, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Wallet - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pt-14 pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-[#0B3D3A]" />
                Wallet
              </h1>
              <p className="text-sm text-gray-600 mt-1">Manage your credits and payments</p>
            </div>

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-xl p-6 text-white mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/80 text-sm mb-1">Available Balance</p>
                  <p className="text-3xl font-bold">$0.00</p>
                  <p className="text-white/60 text-xs mt-2">0 Credits</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors">
                <Plus className="w-6 h-6 text-[#0B3D3A]" />
                <span className="text-sm font-medium">Add Funds</span>
              </button>
              <button className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors">
                <History className="w-6 h-6 text-[#0B3D3A]" />
                <span className="text-sm font-medium">History</span>
              </button>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                Payment Methods
              </h2>
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No payment methods added</p>
                <button className="mt-4 text-[#0B3D3A] text-sm font-medium hover:underline">
                  Add Payment Method
                </button>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600" />
                Recent Transactions
              </h2>
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No transactions yet</p>
                <p className="text-gray-400 text-xs mt-2">Your transaction history will appear here</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}