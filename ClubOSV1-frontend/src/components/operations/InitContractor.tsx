import React, { useState } from 'react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react';

export function InitContractor() {
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const runMigration = async () => {
    if (!confirm('This will initialize contractor support in the database. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await http.post('/init-contractor/initialize');
      if (response.data.success) {
        toast.success('Contractor support initialized successfully!');
        setInitialized(true);
      } else {
        toast.error('Failed to initialize: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      toast.error('Failed to initialize contractor support: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (initialized) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Contractor Support Initialized</h3>
            <p className="text-sm text-green-700 mt-1">
              You can now create contractor users through the Operations Center.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900">Initialize Contractor Support</h3>
          <p className="text-sm text-yellow-700 mt-1 mb-4">
            The database needs to be updated to support contractor user accounts. 
            This will update the role constraint and create necessary tables.
          </p>
          
          <button
            onClick={runMigration}
            disabled={loading}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Running Migration...
              </>
            ) : (
              <>Initialize Contractor Support</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}