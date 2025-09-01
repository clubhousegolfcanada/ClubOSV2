import React, { useEffect, useState } from 'react';
import { http } from '@/api/http';
import { useAuthState } from '@/state/useStore';
import { UserPlus, Check, X, Clock, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tokenManager } from '@/utils/tokenManager';


interface FriendRequest {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  location?: string;
  direction: 'incoming' | 'outgoing';
  message?: string;
  requested_at: string;
}

export const FriendRequests: React.FC = () => {
  const { user } = useAuthState();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      const token = tokenManager.getToken();
      const response = await http.get(`friends/pending`, {

      });
      
      if (response.data.success) {
        setRequests(response.data.data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string, userName: string) => {
    setProcessingId(requestId);
    try {
      const token = tokenManager.getToken();
      await http.put(
        `friends/${requestId}/accept`,
        {},

      );
      
      toast.success(`You are now friends with ${userName}!`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to accept friend request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const token = tokenManager.getToken();
      await http.put(
        `friends/${requestId}/reject`,
        {},

      );
      
      toast.success('Friend request declined');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject friend request');
    } finally {
      setProcessingId(null);
    }
  };

  const incomingRequests = requests.filter(r => r.direction === 'incoming');
  const outgoingRequests = requests.filter(r => r.direction === 'outgoing');

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3D3A]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Pending Friend Requests ({incomingRequests.length})
          </h3>
          <div className="space-y-2">
            {incomingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {request.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{request.name}</p>
                      <p className="text-xs text-gray-500">{request.email}</p>
                      {request.message && (
                        <p className="text-xs text-gray-600 mt-1 italic">"{request.message}"</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(request.id, request.name)}
                      disabled={processingId === request.id}
                      className="px-3 py-1.5 bg-[#0B3D3A] text-white text-xs font-medium rounded-lg hover:bg-[#084a45] transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Sent Friend Requests ({outgoingRequests.length})
          </h3>
          <div className="space-y-2">
            {outgoingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{request.name}</p>
                      <p className="text-xs text-gray-500">Waiting for response</p>
                    </div>
                  </div>
                  
                  <span className="text-xs text-gray-400">
                    Sent {new Date(request.requested_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <div className="text-center py-8">
          <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No pending friend requests</p>
        </div>
      )}
    </div>
  );
};