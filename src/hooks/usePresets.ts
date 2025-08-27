import { useState, useEffect, useCallback } from 'react';
import { IPreset } from '@/models/Preset';

export interface ButtonConfig {
  text: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'left' | 'center' | 'right';
  enableSearch: boolean;
  customPrompt: string;
  aiProvider: 'chatgpt' | 'claude';
}

export interface CreatePresetData {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  thumbnail?: string;
}

export interface UpdatePresetData extends CreatePresetData {
  text?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  position?: 'left' | 'center' | 'right';
  enableSearch?: boolean;
  customPrompt?: string;
  aiProvider?: 'chatgpt' | 'claude';
}

export interface UsePresetsReturn {
  presets: IPreset[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
  // Actions
  fetchPresets: (category?: 'default' | 'custom' | 'all', page?: number) => Promise<void>;
  createPreset: (config: ButtonConfig, data: CreatePresetData) => Promise<IPreset | null>;
  updatePreset: (id: string, data: UpdatePresetData) => Promise<IPreset | null>;
  deletePreset: (id: string) => Promise<boolean>;
  getPreset: (id: string) => Promise<IPreset | null>;
  applyPreset: (preset: IPreset) => ButtonConfig;
  refreshPresets: () => Promise<void>;
}

export function usePresets(): UsePresetsReturn {
  const [presets, setPresets] = useState<IPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>('all');

  const fetchPresets = useCallback(async (
    category: 'default' | 'custom' | 'all' = 'all',
    page: number = 1
  ) => {
    setLoading(true);
    setError(null);
    setCurrentCategory(category);

    try {
      const params = new URLSearchParams({
        category,
        page: page.toString(),
        limit: '10',
      });

      const response = await fetch(`/api/presets?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch presets: ${response.statusText}`);
      }

      const data = await response.json();
      setPresets(data.presets);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch presets';
      setError(errorMessage);
      console.error('Error fetching presets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPreset = useCallback(async (
    config: ButtonConfig,
    data: CreatePresetData
  ): Promise<IPreset | null> => {
    setError(null);

    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ...config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create preset');
      }

      const newPreset = await response.json();
      
      // Add to current presets list if it matches current category
      if (currentCategory === 'all' || currentCategory === 'custom') {
        setPresets(prev => [newPreset, ...prev]);
      }
      
      return newPreset;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create preset';
      setError(errorMessage);
      console.error('Error creating preset:', err);
      return null;
    }
  }, [currentCategory]);

  const updatePreset = useCallback(async (
    id: string,
    data: UpdatePresetData
  ): Promise<IPreset | null> => {
    setError(null);

    try {
      const response = await fetch(`/api/presets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preset');
      }

      const updatedPreset = await response.json();
      
      // Update in current presets list
      setPresets(prev => prev.map(preset => 
        preset._id === id ? updatedPreset : preset
      ));
      
      return updatedPreset;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preset';
      setError(errorMessage);
      console.error('Error updating preset:', err);
      return null;
    }
  }, []);

  const deletePreset = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/presets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete preset');
      }

      // Remove from current presets list
      setPresets(prev => prev.filter(preset => preset._id !== id));
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete preset';
      setError(errorMessage);
      console.error('Error deleting preset:', err);
      return false;
    }
  }, []);

  const getPreset = useCallback(async (id: string): Promise<IPreset | null> => {
    setError(null);

    try {
      const response = await fetch(`/api/presets/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch preset');
      }

      const preset = await response.json();
      return preset;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch preset';
      setError(errorMessage);
      console.error('Error fetching preset:', err);
      return null;
    }
  }, []);

  const applyPreset = useCallback((preset: IPreset): ButtonConfig => {
    return {
      text: preset.text,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
      fontSize: preset.fontSize,
      padding: preset.padding,
      borderRadius: preset.borderRadius,
      borderWidth: preset.borderWidth,
      borderColor: preset.borderColor,
      shadowColor: preset.shadowColor,
      shadowBlur: preset.shadowBlur,
      shadowOffsetX: preset.shadowOffsetX,
      shadowOffsetY: preset.shadowOffsetY,
      position: preset.position,
      enableSearch: preset.enableSearch,
      customPrompt: preset.customPrompt || '',
      aiProvider: preset.aiProvider,
    };
  }, []);

  const refreshPresets = useCallback(async () => {
    await fetchPresets(currentCategory as 'default' | 'custom' | 'all', pagination?.page || 1);
  }, [fetchPresets, currentCategory, pagination?.page]);

  // Initial load
  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    loading,
    error,
    pagination,
    fetchPresets,
    createPreset,
    updatePreset,
    deletePreset,
    getPreset,
    applyPreset,
    refreshPresets,
  };
}
