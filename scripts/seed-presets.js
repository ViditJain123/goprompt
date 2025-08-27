const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Define the Preset schema here since we can't import the TypeScript model
const PresetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
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
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
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
    maxlength: 100000,
  },
}, {
  timestamps: true,
});

const Preset = mongoose.models.Preset || mongoose.model('Preset', PresetSchema);

const defaultPresets = [
  {
    name: 'Classic Blue',
    description: 'A timeless blue button perfect for professional newsletters',
    category: 'default',
    isPublic: true,
    text: 'Ask AI',
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    fontSize: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#1e40af',
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['professional', 'blue', 'classic', 'newsletter'],
  },
  {
    name: 'Modern Gradient',
    description: 'Eye-catching gradient button for modern designs',
    category: 'default',
    isPublic: true,
    text: 'Get Prompt',
    backgroundColor: '#8b5cf6',
    textColor: '#ffffff',
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#7c3aed',
    shadowBlur: 12,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['modern', 'gradient', 'purple', 'stylish'],
  },
  {
    name: 'Success Green',
    description: 'Perfect for call-to-action buttons and success messages',
    category: 'default',
    isPublic: true,
    text: 'Try Prompt',
    backgroundColor: '#10b981',
    textColor: '#ffffff',
    fontSize: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#059669',
    shadowBlur: 6,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['success', 'green', 'cta', 'action'],
  },
  {
    name: 'Elegant Black',
    description: 'Sophisticated black button for premium brands',
    category: 'default',
    isPublic: true,
    text: 'AI Prompt',
    backgroundColor: '#1f2937',
    textColor: '#ffffff',
    fontSize: 15,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 1,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['elegant', 'black', 'premium', 'sophisticated'],
  },
  {
    name: 'Warm Orange',
    description: 'Energetic orange button that stands out',
    category: 'default',
    isPublic: true,
    text: 'Free Prompt',
    backgroundColor: '#f59e0b',
    textColor: '#ffffff',
    fontSize: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#d97706',
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['warm', 'orange', 'energetic', 'download'],
  },
  {
    name: 'Minimalist White',
    description: 'Clean white button with subtle border',
    category: 'default',
    isPublic: true,
    text: 'Start Prompt',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    fontSize: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#f3f4f6',
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['minimalist', 'white', 'clean', 'subtle'],
  },
  {
    name: 'Bold Red',
    description: 'Attention-grabbing red button for urgent actions',
    category: 'default',
    isPublic: true,
    text: 'Quick Prompt',
    backgroundColor: '#ef4444',
    textColor: '#ffffff',
    fontSize: 17,
    padding: 15,
    borderRadius: 6,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#dc2626',
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['bold', 'red', 'urgent', 'buy'],
  },
  {
    name: 'Tech Blue',
    description: 'Modern tech-style button with sharp edges',
    category: 'default',
    isPublic: true,
    text: 'Test Prompt',
    backgroundColor: '#0ea5e9',
    textColor: '#ffffff',
    fontSize: 16,
    padding: 12,
    borderRadius: 2,
    borderWidth: 0,
    borderColor: '#000000',
    shadowColor: '#0284c7',
    shadowBlur: 6,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    position: 'center',
    enableSearch: false,
    customPrompt: '',
    aiProvider: 'chatgpt',
    tags: ['tech', 'blue', 'modern', 'trial'],
  }
];

async function seedPresets() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing default presets
    console.log('Clearing existing default presets...');
    await Preset.deleteMany({ category: 'default' });

    // Insert new default presets
    console.log('Inserting new default presets...');
    await Preset.insertMany(defaultPresets);

    console.log(`✅ Successfully seeded ${defaultPresets.length} default presets!`);
    
    // Display the created presets
    const createdPresets = await Preset.find({ category: 'default' }).sort({ createdAt: 1 });
    console.log('\nCreated presets:');
    createdPresets.forEach((preset, index) => {
      console.log(`${index + 1}. ${preset.name} - ${preset.description}`);
    });

  } catch (error) {
    console.error('Error seeding presets:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the seeding function
if (require.main === module) {
  seedPresets();
}

module.exports = { seedPresets, defaultPresets };
