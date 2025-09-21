import { useState, useEffect } from 'react';
import { useUser as useClerkUser } from '@clerk/nextjs';

export interface UserData {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  buttonCount: number;
  isActive: boolean;
  preferences: {
    defaultAiProvider: 'chatgpt' | 'claude';
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
  createdAt: string;
  lastLoginAt: string;
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
          console.log(`useUser: Fetched user data for ${data.email}`);
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

  return {
    user: userData,
    isLoading,
    error,
    isAuthenticated: !!clerkUser,
    updateUserPreferences,
    updateUserProfile,
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
            console.log(`useUser refetch: Fetched user data for ${data.email}`);
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

