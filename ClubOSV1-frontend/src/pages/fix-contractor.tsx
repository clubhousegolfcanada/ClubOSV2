import { useState } from 'react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

export default function FixContractor() {
  const [loading, setLoading] = useState(false);
  const [fixed, setFixed] = useState(false);
  const router = useRouter();
  const { user } = useAuthState();

  const runFix = async () => {
    setLoading(true);
    try {
      const response = await http.post('/fix-contractor/fix');
      if (response.data.success) {
        toast.success('Contractor role fixed successfully!');
        setFixed(true);
        setTimeout(() => {
          router.push('/operations');
        }, 2000);
      } else {
        toast.error('Failed to fix: ' + response.data.error);
      }
    } catch (error: any) {
      toast.error('Failed to fix contractor role: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Only</h1>
          <p className="text-gray-600 mt-2">This page is only accessible to admins.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Fix Contractor Role - ClubOS</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Fix Contractor Role</h1>
          
          {fixed ? (
            <div className="text-center">
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <p className="text-lg text-gray-700">Fixed successfully!</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting to Operations Center...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                This will fix the database constraint to allow contractor role creation.
              </p>
              
              <button
                onClick={runFix}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Fixing...' : 'Fix Contractor Role'}
              </button>
              
              <p className="text-xs text-gray-500 mt-4">
                This will update the users table constraint to include 'contractor' as a valid role.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}