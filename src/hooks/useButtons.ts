import { useState, useEffect, useCallback } from 'react';
import { useUser } from './useUser';

export interface ButtonData {
  id: string;
  name: string;
  text: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  enableSearch: boolean;
  customPrompt: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'left' | 'center' | 'right';
  aiProvider: 'chatgpt' | 'claude';
  htmlCode: string;
  isPublic: boolean;
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateButtonData {
  name: string;
  text: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  enableSearch?: boolean;
  customPrompt?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  position?: 'left' | 'center' | 'right';
  aiProvider?: 'chatgpt' | 'claude';
  tags?: string[];
}

export interface ButtonsResponse {
  buttons: ButtonData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useButtons() {
  const { user, isAuthenticated } = useUser();
  const [buttons, setButtons] = useState<ButtonData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchButtons = useCallback(async (page = 1, limit = 10, filters?: { tag?: string; public?: boolean }) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters?.tag) params.append('tag', filters.tag);
      if (filters?.public !== undefined) params.append('public', filters.public.toString());

      const response = await fetch(`/api/buttons?${params}`);
      
      if (response.ok) {
        const data: ButtonsResponse = await response.json();
        setButtons(data.buttons);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch buttons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching buttons:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const createButton = async (buttonData: CreateButtonData): Promise<ButtonData | null> => {
    if (!isAuthenticated) return null;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/buttons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buttonData),
      });

      if (response.ok) {
        const data = await response.json();
        const newButton = data.button;
        
        // Add the new button to the beginning of the list
        setButtons(prev => [newButton, ...prev]);
        
        // Update pagination
        setPagination(prev => ({
          ...prev,
          total: prev.total + 1,
        }));

        return newButton;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create button');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error creating button:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateButton = async (buttonId: string, updates: Partial<CreateButtonData>): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      const response = await fetch(`/api/buttons/${buttonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedButton = await response.json();
        
        // Update the button in the local state
        setButtons(prev => 
          prev.map(btn => 
            btn.id === buttonId ? { ...btn, ...updatedButton.button } : btn
          )
        );

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating button:', err);
      return false;
    }
  };

  const deleteButton = async (buttonId: string): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      const response = await fetch(`/api/buttons/${buttonId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the button from local state
        setButtons(prev => prev.filter(btn => btn.id !== buttonId));
        
        // Update pagination
        setPagination(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting button:', err);
      return false;
    }
  };

  const duplicateButton = async (buttonId: string): Promise<ButtonData | null> => {
    const buttonToDuplicate = buttons.find(btn => btn.id === buttonId);
    if (!buttonToDuplicate) return null;

    const duplicateData: CreateButtonData = {
      name: `${buttonToDuplicate.name} (Copy)`,
      text: buttonToDuplicate.text,
      backgroundColor: buttonToDuplicate.backgroundColor,
      textColor: buttonToDuplicate.textColor,
      fontSize: buttonToDuplicate.fontSize,
      padding: buttonToDuplicate.padding,
      borderRadius: buttonToDuplicate.borderRadius,
      borderWidth: buttonToDuplicate.borderWidth,
      borderColor: buttonToDuplicate.borderColor,
      enableSearch: buttonToDuplicate.enableSearch,
      customPrompt: buttonToDuplicate.customPrompt,
      shadowColor: buttonToDuplicate.shadowColor,
      shadowBlur: buttonToDuplicate.shadowBlur,
      shadowOffsetX: buttonToDuplicate.shadowOffsetX,
      shadowOffsetY: buttonToDuplicate.shadowOffsetY,
      position: buttonToDuplicate.position,
      aiProvider: buttonToDuplicate.aiProvider,
      tags: buttonToDuplicate.tags,
    };

    return await createButton(duplicateData);
  };

  // Fetch buttons when user changes or component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchButtons();
    }
  }, [isAuthenticated, user, fetchButtons]);

  return {
    buttons,
    isLoading,
    error,
    pagination,
    fetchButtons,
    createButton,
    updateButton,
    deleteButton,
    duplicateButton,
    canCreateMore: true, // Unlimited button creation
    buttonLimit: -1, // Unlimited
    currentCount: user?.buttonCount || 0,
  };
}

