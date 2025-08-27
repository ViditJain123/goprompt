'use client';

import { useState } from 'react';
import { SignInButton, SignUpButton, UserButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Crown, Zap } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

export default function Navbar() {
  const { user, refetch } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getSubscriptionBadge = () => {
    if (!user || !user.subscription) return null;
    
    const currentPlan = user.subscription.plan;
    
    switch (currentPlan) {
      case 'monthly':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-sm font-medium">
            <Zap className="w-4 h-4" />
            Monthly Plan
          </div>
        );
      case 'yearly':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Yearly Plan
          </div>
        );
      case 'lifetime':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full text-sm font-medium">
            <Crown className="w-4 h-4" />
            Lifetime Plan
          </div>
        );
      case 'free':
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
            Free Plan
          </div>
        );
    }
  };

  const shouldShowUpgradeButton = () => {
    if (!user || !user.subscription) return false;
    
    const currentPlan = user.subscription.plan;
    
    // Hide upgrade button completely for lifetime users
    // Show for all other plans: free, monthly, yearly
    return currentPlan !== 'lifetime';
  };

  const handleUpgradeModalClose = async () => {
    setShowUpgradeModal(false);
    // Refetch user data to update subscription status
    await refetch();
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image 
              src="/logo.png" 
              alt="The Prompt Button" 
              width={140} 
              height={140} 
              className="h-12 w-auto"
            />
            <span className="text-2xl font-bold text-gray-900">Go Prompt</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm hover:shadow-md">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>
          
          <SignedIn>
            <div className="flex items-center gap-4">
              {/* Subscription Badge */}
              {getSubscriptionBadge()}
              
              {/* Upgrade Button - Show based on subscription plan */}
              {shouldShowUpgradeButton() && (
                <button 
                  onClick={() => setShowUpgradeModal(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2 ${
                    user?.subscription?.plan === 'yearly' 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {user?.subscription?.plan === 'yearly' ? 'Get Lifetime' : 'Upgrade'}
                </button>
              )}
              
              {/* Remove the lifetime badge since it's redundant with the subscription badge above */}
              
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </div>
          </SignedIn>
        </div>
      </div>
      
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={handleUpgradeModalClose}
        onSuccess={refetch}
      />
    </nav>
  );
}
