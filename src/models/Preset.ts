import mongoose, { Schema, Document } from 'mongoose';

export interface IPreset extends Document {
  name: string;
  description?: string;
  category: 'default' | 'custom';
  userId?: mongoose.Types.ObjectId; // Only for custom presets
  isPublic: boolean;
  // Button design properties
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
  // AI settings
  enableSearch: boolean;
  customPrompt: string;
  aiProvider: 'chatgpt' | 'claude';
  // Metadata
  usageCount: number;
  tags: string[];
  thumbnail?: string; // Base64 encoded thumbnail or URL
  createdAt: Date;
  updatedAt: Date;
}

const PresetSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  category: {
    type: String,
    enum: ['default', 'custom'],
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    // Required only for custom presets
    validate: {
      validator: function(this: IPreset, value: unknown) {
        if (this.category === 'custom') {
          return value != null;
        }
        return true;
      },
      message: 'userId is required for custom presets'
    }
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Button design properties
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  backgroundColor: {
    type: String,
    required: true,
    default: '#3b82f6',
  },
  textColor: {
    type: String,
    required: true,
    default: '#ffffff',
  },
  fontSize: {
    type: Number,
    required: true,
    min: 8,
    max: 48,
    default: 16,
  },
  padding: {
    type: Number,
    required: true,
    min: 4,
    max: 32,
    default: 12,
  },
  borderRadius: {
    type: Number,
    required: true,
    min: 0,
    max: 50,
    default: 6,
  },
  borderWidth: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
    default: 0,
  },
  borderColor: {
    type: String,
    required: true,
    default: '#000000',
  },
  shadowColor: {
    type: String,
    default: '#000000',
  },
  shadowBlur: {
    type: Number,
    min: 0,
    max: 50,
    default: 4,
  },
  shadowOffsetX: {
    type: Number,
    min: -20,
    max: 20,
    default: 0,
  },
  shadowOffsetY: {
    type: Number,
    min: -20,
    max: 20,
    default: 2,
  },
  position: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'center',
  },
  // AI settings
  enableSearch: {
    type: Boolean,
    default: false,
  },
  customPrompt: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  aiProvider: {
    type: String,
    enum: ['chatgpt', 'claude'],
    default: 'chatgpt',
  },
  // Metadata
  usageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  thumbnail: {
    type: String,
    maxlength: 100000, // Allow for base64 encoded thumbnails
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
PresetSchema.index({ category: 1, createdAt: -1 });
PresetSchema.index({ userId: 1, category: 1 });
PresetSchema.index({ isPublic: 1, category: 1 });
PresetSchema.index({ tags: 1 });
PresetSchema.index({ usageCount: -1 });
PresetSchema.index({ name: 'text' }); // Text search index

// Method to increment usage count
PresetSchema.methods.incrementUsage = function(): void {
  this.usageCount += 1;
};

// Method to convert to button config
PresetSchema.methods.toButtonConfig = function() {
  return {
    text: this.text,
    backgroundColor: this.backgroundColor,
    textColor: this.textColor,
    fontSize: this.fontSize,
    padding: this.padding,
    borderRadius: this.borderRadius,
    borderWidth: this.borderWidth,
    borderColor: this.borderColor,
    shadowColor: this.shadowColor,
    shadowBlur: this.shadowBlur,
    shadowOffsetX: this.shadowOffsetX,
    shadowOffsetY: this.shadowOffsetY,
    position: this.position,
    enableSearch: this.enableSearch,
    customPrompt: this.customPrompt,
    aiProvider: this.aiProvider,
  };
};

// Static method to get default presets
PresetSchema.statics.getDefaultPresets = function() {
  return this.find({ category: 'default' }).sort({ createdAt: 1 });
};

// Static method to get user's custom presets
PresetSchema.statics.getUserPresets = function(userId: mongoose.Types.ObjectId) {
  return this.find({ 
    category: 'custom', 
    userId: userId 
  }).sort({ createdAt: -1 });
};

// Static method to get public presets
PresetSchema.statics.getPublicPresets = function() {
  return this.find({ 
    isPublic: true 
  }).sort({ usageCount: -1, createdAt: -1 });
};

export default mongoose.models.Preset || mongoose.model<IPreset>('Preset', PresetSchema);
