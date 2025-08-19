import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import CustomerLayout from '@/components/customer/CustomerLayout';
import { User, Mail, Phone, Save, CheckCircle, Wallet, CreditCard, TrendingUp, DollarSign, Plus, History } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function CustomerProfile() {
  const { user, setUser } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.put(
        `${API_URL}/customer-profile/users/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Update local user state
        if (user) {
          const updatedUser = { ...user, ...formData };
          setUser(updatedUser);
          localStorage.setItem('clubos_user', JSON.stringify(updatedUser));
        }
        
        setSaved(true);
        toast.success('Profile updated successfully');
        
        // Reset saved indicator after 3 seconds
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setSaved(false);
  };

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Wallet Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0B3D3A]" />
              Wallet & Credits
            </h2>
          </div>
          
          <div className="p-6">
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
              <button className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-gray-100 transition-colors">
                <Plus className="w-6 h-6 text-[#0B3D3A]" />
                <span className="text-sm font-medium">Add Funds</span>
              </button>
              <button className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-gray-100 transition-colors">
                <History className="w-6 h-6 text-[#0B3D3A]" />
                <span className="text-sm font-medium">History</span>
              </button>
            </div>

            {/* Payment Methods */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Methods
              </h3>
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No payment methods added</p>
                <button className="mt-3 text-[#0B3D3A] text-sm font-medium hover:underline">
                  Add Payment Method
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Update your personal information</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3D3A] focus:border-[#0B3D3A] transition-colors"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3D3A] focus:border-[#0B3D3A] transition-colors"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B3D3A] focus:border-[#0B3D3A] transition-colors"
                  placeholder="(902) 123-4567"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Optional - for booking confirmations</p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || saved}
                className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg font-medium transition-all ${
                  saved
                    ? 'bg-green-600 text-white'
                    : loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#0B3D3A] text-white hover:bg-[#084a45]'
                }`}
              >
                {saved ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Profile Updated
                  </>
                ) : loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Account Info Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-lg">
            <div className="text-xs text-gray-500">
              <p>Account Type: <span className="font-medium text-gray-700">Customer</span></p>
              <p className="mt-1">Member Since: <span className="font-medium text-gray-700">
                {(user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString() : 'N/A'}
              </span></p>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}