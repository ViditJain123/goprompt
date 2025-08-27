'use client';

import { useState, useEffect } from 'react';
import { IPreset } from '@/models/Preset';
import { usePresets, ButtonConfig } from '@/hooks/usePresets';
import { 
  Palette, 
  Plus, 
  Trash2, 
  Edit3, 
  Search,
  Sparkles,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

interface PresetSelectorProps {
  onSelectPreset: (config: ButtonConfig) => void;
  currentConfig: ButtonConfig;
  onSavePreset?: (config: ButtonConfig) => void;
}

interface SavePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  loading: boolean;
}

function SavePresetModal({ isOpen, onClose, onSave, loading }: SavePresetModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Preset</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preset Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Awesome Button"
                required
                maxLength={100}
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface PresetCardProps {
  preset: IPreset;
  onSelect: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  isSelected: boolean;
}

function PresetCard({ preset, onSelect, onDelete, canDelete, isSelected }: PresetCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showDeleteConfirm) {
      onDelete?.();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div
      className={clsx(
        "relative group bg-white border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected
          ? "border-blue-500 shadow-md ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      )}
      onClick={onSelect}
    >
      {/* Preview - Full size like live preview */}
      <div className="mb-3 flex justify-center">
        <div
          className="inline-block font-medium transition-transform group-hover:scale-105"
          style={{
            backgroundColor: preset.backgroundColor,
            color: preset.textColor,
            fontSize: `${preset.fontSize}px`,
            padding: `${preset.padding}px ${preset.padding * 2}px`,
            borderRadius: `${preset.borderRadius}px`,
            border: preset.borderWidth > 0 ? `${preset.borderWidth}px solid ${preset.borderColor}` : 'none',
            boxShadow: `${preset.shadowOffsetX}px ${preset.shadowOffsetY}px ${preset.shadowBlur}px ${preset.shadowColor}`,
            fontFamily: 'Arial, sans-serif',
            textDecoration: 'none',
          }}
        >
          {preset.text}
        </div>
      </div>

      {/* Name below the button */}
      <div className="text-center">
        <h4 className="text-sm font-medium text-gray-900 truncate">{preset.name}</h4>
      </div>

      {/* Actions */}
      {canDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDelete}
            className={clsx(
              "p-1.5 rounded-full text-xs transition-colors",
              showDeleteConfirm
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
            )}
            title={showDeleteConfirm ? "Click again to confirm" : "Delete preset"}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PresetSelector({ onSelectPreset, currentConfig, onSavePreset }: PresetSelectorProps) {
  const {
    presets,
    loading,
    error,
    pagination,
    fetchPresets,
    createPreset,
    deletePreset,
    applyPreset,
  } = usePresets();

  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when changing tabs
    fetchPresets(activeTab, 1);
  }, [activeTab, fetchPresets]);

  useEffect(() => {
    fetchPresets(activeTab, currentPage);
  }, [currentPage, fetchPresets, activeTab]);

  const filteredPresets = presets.filter(preset =>
    preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    preset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    preset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectPreset = (preset: IPreset) => {
    const config = applyPreset(preset);
    onSelectPreset(config);
    setSelectedPresetId(preset._id as string);
  };

  const handleSavePreset = async (name: string) => {
    setSavingPreset(true);
    try {
      const preset = await createPreset(currentConfig, {
        name,
        description: '', // No description
        isPublic: false, // Always private
        tags: [], // Could be enhanced to extract tags from name or allow manual input
      });
      
      if (preset) {
        setShowSaveModal(false);
        if (activeTab === 'custom') {
          fetchPresets('custom'); // Refresh custom presets
        }
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    const success = await deletePreset(presetId);
    if (success && selectedPresetId === presetId) {
      setSelectedPresetId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'default':
        return <Sparkles className="w-4 h-4" />;
      case 'custom':
        return <Edit3 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'default':
        return 'Default';
      case 'custom':
        return 'My Presets';
      default:
        return category;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5 text-blue-600" />
          Button Presets
        </h3>
        
        {onSavePreset && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Save Current
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['default', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {getCategoryIcon(tab)}
            {getCategoryLabel(tab)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-2">Error loading presets</p>
            <button
              onClick={() => fetchPresets(activeTab)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Try again
            </button>
          </div>
        ) : filteredPresets.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'No presets match your search' : 'No presets available'}
            </p>
            {activeTab === 'custom' && !searchQuery && (
              <p className="text-sm text-gray-400">
                Create your first preset by clicking &quot;Save Current&quot; above
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {filteredPresets.map((preset) => (
                <PresetCard
                  key={preset._id as string}
                  preset={preset}
                  onSelect={() => handleSelectPreset(preset)}
                  onDelete={() => handleDeletePreset(preset._id as string)}
                  canDelete={preset.category === 'custom'}
                  isSelected={selectedPresetId === (preset._id as string)}
                />
              ))}
            </div>
            
            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={clsx(
                      "p-1 rounded-lg transition-colors",
                      currentPage === 1
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= pagination.pages}
                    className={clsx(
                      "p-1 rounded-lg transition-colors",
                      currentPage >= pagination.pages
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Preset Modal */}
      <SavePresetModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePreset}
        loading={savingPreset}
      />
    </div>
  );
}
