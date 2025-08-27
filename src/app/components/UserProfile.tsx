'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { User, Settings, Crown, Zap, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function UserProfile() {
  const { user, isLoading, error } = useUser();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Error loading profile: {error}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Please sign in to view your profile</div>
      </div>
    );
  }

  const getSubscriptionIcon = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Crown className="w-5 h-5 text-yellow-600" />;
      case 'pro':
        return <Zap className="w-5 h-5 text-purple-600" />;
      default:
        return <User className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSubscriptionColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pro':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="h-full bg-gray-50 overflow-hidden">
      <div className="h-full max-w-4xl mx-auto p-6 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.email}
                  </h1>
                  <p className="text-blue-100">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Account Overview */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={clsx(
                    'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border',
                    getSubscriptionColor(user.subscriptionTier)
                  )}>
                    {getSubscriptionIcon(user.subscriptionTier)}
                    {user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{user.buttonCount}</div>
                  <div className="text-sm text-gray-600">Buttons Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{user.maxButtons}</div>
                  <div className="text-sm text-gray-600">Button Limit</div>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      defaultValue={user.firstName || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      defaultValue={user.lastName || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <p className="text-gray-900">{user.firstName || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <p className="text-gray-900">{user.lastName || 'Not set'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Account Statistics */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-blue-600">{user.buttonCount}</div>
                  <div className="text-sm text-gray-600">Total Buttons</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((user.buttonCount / user.maxButtons) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Storage Used</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {user.maxButtons - user.buttonCount}
                  </div>
                  <div className="text-sm text-gray-600">Remaining</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}