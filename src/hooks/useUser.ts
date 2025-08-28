import { useState, useEffect } from 'react';
import { useUser as useClerkUser } from '@clerk/nextjs';

export interface SubscriptionDetails {
  plan: 'free' | 'monthly' | 'yearly' | 'lifetime';
  status: string;
  isActive: boolean;
  endDate?: string;
  daysUntilExpiry?: number | null;
  features: string[];
  maxButtons: number;
}

export interface UserData {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionStatus: string;
  subscriptionTier: string;
  subscriptionPlan: 'free' | 'monthly' | 'yearly' | 'lifetime';
  buttonCount: number;
  maxButtons: number;
  isActive: boolean;
  preferences: {
    defaultAiProvider: 'chatgpt' | 'claude';
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
  createdAt: string;
  lastLoginAt: string;
  subscription: SubscriptionDetails;
}

export function useUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useClerkUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isClerkLoaded) return;

    if (!clerkUser) {
      setUserData(null);
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Add cache busting to ensure we get fresh data
        const timestamp = Date.now();
        const response = await fetch(`/api/users?_t=${timestamp}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`useUser: Fetched user data for ${data.email} with plan: ${data.subscription?.plan}`);
          setUserData(data);
        } else if (response.status === 404) {
          // User doesn't exist in our database, create them
          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: clerkUser.emailAddresses[0]?.emailAddress,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
            }),
          });

          if (createResponse.ok) {
            const newUser = await createResponse.json();
            setUserData(newUser.user);
          } else {
            throw new Error('Failed to create user');
          }
        } else {
          throw new Error('Failed to fetch user data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching user data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [clerkUser, isClerkLoaded]);

  // Separate effect for window focus listener to refetch data when user returns from payment
  useEffect(() => {
    let lastFocusRefetch = 0;
    const REFETCH_COOLDOWN = 5000; // 5 seconds cooldown between refetches
    
    const handleWindowFocus = async () => {
      const now = Date.now();
      
      // Only refetch if user data exists (user is logged in) and cooldown has passed
      if (userData && clerkUser && (now - lastFocusRefetch) > REFETCH_COOLDOWN) {
        lastFocusRefetch = now;
        
        try {
          // Add cache busting to ensure we get fresh data
          const timestamp = Date.now();
          const response = await fetch(`/api/users?_t=${timestamp}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`useUser focus refetch: Fetched user data for ${data.email} with plan: ${data.subscription?.plan}`);
            setUserData(data);
          }
        } catch (err) {
          console.error('Error refetching user data on focus:', err);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [userData, clerkUser]);

  const updateUserPreferences = async (preferences: Partial<UserData['preferences']>) => {
    if (!userData) return false;

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUserData(updatedUser.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating user preferences:', err);
      return false;
    }
  };

  const updateUserProfile = async (updates: { firstName?: string; lastName?: string }) => {
    if (!userData) return false;

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUserData(updatedUser.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating user profile:', err);
      return false;
    }
  };

  const canCreateButton = () => {
    return true; // Unlimited button creation for all users
  };

  const getSubscriptionLimits = () => {
    if (!userData || !userData.subscription) return null;
    return userData.subscription;
  };

  const canUpgradeTo = (targetPlan: 'monthly' | 'yearly' | 'lifetime') => {
    if (!userData) return false;
    
    const planHierarchy = {
      free: 0,
      monthly: 1,
      yearly: 2,
      lifetime: 3,
    };
    
    const currentLevel = planHierarchy[userData.subscription.plan];
    const targetLevel = planHierarchy[targetPlan];
    
    return targetLevel > currentLevel;
  };

  const isSubscriptionExpiring = (warningDays: number = 7) => {
    if (!userData || !userData.subscription.daysUntilExpiry) return false;
    return userData.subscription.daysUntilExpiry <= warningDays && userData.subscription.daysUntilExpiry > 0;
  };

  const getUpgradeRecommendation = () => {
    if (!userData) return null;
    
    const currentPlan = userData.subscription.plan;
    const buttonUsagePercent = (userData.buttonCount / userData.subscription.maxButtons) * 100;
    
    if (currentPlan === 'free' && buttonUsagePercent > 80) {
      return {
        recommended: 'monthly',
        reason: 'You\'re close to your button limit. Upgrade to get more buttons and features.',
      };
    }
    
    if (currentPlan === 'monthly' && userData.subscription.daysUntilExpiry && userData.subscription.daysUntilExpiry < 30) {
      return {
        recommended: 'yearly',
        reason: 'Switch to yearly and save $101! Your monthly subscription expires soon.',
      };
    }
    
    if ((currentPlan === 'monthly' || currentPlan === 'yearly') && buttonUsagePercent > 90) {
      return {
        recommended: 'lifetime',
        reason: 'You\'re a power user! Get lifetime access and never worry about limits again.',
      };
    }
    
    return null;
  };

  return {
    user: userData,
    isLoading,
    error,
    isAuthenticated: !!clerkUser,
    updateUserPreferences,
    updateUserProfile,
    canCreateButton,
    getSubscriptionLimits,
    canUpgradeTo,
    isSubscriptionExpiring,
    getUpgradeRecommendation,
    refetch: async () => {
      if (clerkUser) {
        setIsLoading(true);
        setError(null);
        try {
          // Add cache busting to ensure we get fresh data
          const timestamp = Date.now();
          const response = await fetch(`/api/users?_t=${timestamp}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`useUser refetch: Fetched user data for ${data.email} with plan: ${data.subscription?.plan}`);
            setUserData(data);
          } else {
            throw new Error('Failed to refetch user data');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to refetch');
          console.error('Error refetching user data:', err);
        } finally {
          setIsLoading(false);
        }
      }
    },
  };
}

