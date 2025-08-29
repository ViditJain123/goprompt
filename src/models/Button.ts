import mongoose, { Schema, Document } from 'mongoose';

export interface IButton extends Document {
  userId: mongoose.Types.ObjectId;
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
  usageCount: number;
  lastUsedAt?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  generateHTML(): string;
}

const ButtonSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
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
  enableSearch: {
    type: Boolean,
    default: false,
  },
  customPrompt: {
    type: String,
    trim: true,
    maxlength: 1000,
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
  aiProvider: {
    type: String,
    enum: ['chatgpt', 'claude'],
    default: 'chatgpt',
  },
  htmlCode: {
    type: String,
    required: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastUsedAt: {
    type: Date,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
}, {
  timestamps: true,
});

// Indexes for better query performance
ButtonSchema.index({ userId: 1, createdAt: -1 });
ButtonSchema.index({ isPublic: 1, createdAt: -1 });
ButtonSchema.index({ tags: 1 });
ButtonSchema.index({ usageCount: -1 });

// Method to increment usage count
ButtonSchema.methods.incrementUsage = function(): void {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
};

// Method to format prompt for ChatGPT to preserve structure
ButtonSchema.methods.formatPromptForChatGPT = function(prompt: string): string {
  if (!prompt) return prompt;
  
  // Split the prompt into lines and process each line
  const lines = prompt.split('\n');
  const formattedLines = lines.map((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines but preserve them
    if (!trimmedLine) {
      return '';
    }
    
    // Check if line appears to be a heading (starts with number, bullet, or is all caps)
    if (/^\d+\./.test(trimmedLine) || /^[-•*]/.test(trimmedLine)) {
      // It's already formatted as a list item
      return line;
    } else if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
      // Likely a heading - make it bold
      return `**${trimmedLine}**`;
    } else if (index === 0 && lines.length > 1) {
      // First line is likely a title/heading
      return `**${trimmedLine}**`;
    }
    
    // Regular line - preserve as is
    return line;
  });
  
  // Add instruction to preserve formatting
  const preserveFormatInstruction = "\n\n[Please maintain the formatting and structure of this prompt when editing]";
  
  return formattedLines.join('\n') + preserveFormatInstruction;
};

// Method to generate HTML code
ButtonSchema.methods.generateHTML = function(): string {
  const buttonStyle = `
    background-color: ${this.backgroundColor};
    color: ${this.textColor};
    font-size: ${this.fontSize}px;
    padding: ${this.padding}px ${this.padding * 2}px;
    border-radius: ${this.borderRadius}px;
    border: ${this.borderWidth}px solid ${this.borderColor};
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    font-family: Arial, sans-serif;
    transition: all 0.2s ease;
    box-shadow: ${this.shadowOffsetX}px ${this.shadowOffsetY}px ${this.shadowBlur}px ${this.shadowColor};
  `;

  const searchParams = this.enableSearch ? 'hints=search' : '';
  
  let promptParams = '';
  if (this.customPrompt) {
    if (this.aiProvider === 'chatgpt') {
      // Preserve text structure by adding formatting markers for ChatGPT
      const formattedPrompt = this.formatPromptForChatGPT(this.customPrompt);
      promptParams = `prompt=${encodeURIComponent(formattedPrompt)}`;
    } else {
      promptParams = `q=${encodeURIComponent(this.customPrompt)}`;
    }
  }
  
  const params = [searchParams, promptParams].filter(Boolean).join('&');
  
  let url = '';
  if (this.aiProvider === 'chatgpt') {
    url = params ? `https://chatgpt.com?${params}` : 'https://chatgpt.com';
  } else {
    url = params ? `https://claude.ai/new?${params}` : 'https://claude.ai/new';
  }

  let wrapperStyle = '';
  if (this.position === 'center') {
    wrapperStyle = 'text-align: center;';
  } else if (this.position === 'right') {
    wrapperStyle = 'text-align: right;';
  } else {
    wrapperStyle = 'text-align: left;';
  }

  return `<div style="${wrapperStyle}"><a href="${url}" style="${buttonStyle}">${this.text}</a></div>`;
};

// Pre-save middleware to update HTML code
ButtonSchema.pre('save', function(this: IButton, next) {
  if (this.isModified('text') || this.isModified('backgroundColor') || 
      this.isModified('textColor') || this.isModified('fontSize') || 
      this.isModified('padding') || this.isModified('borderRadius') || 
      this.isModified('borderWidth') || this.isModified('borderColor') || 
      this.isModified('enableSearch') || this.isModified('customPrompt') || 
      this.isModified('shadowColor') || this.isModified('shadowBlur') || 
      this.isModified('shadowOffsetX') || this.isModified('shadowOffsetY') || 
      this.isModified('position') || this.isModified('aiProvider')) {
    this.htmlCode = this.generateHTML();
  }
  next();
});

export default mongoose.models.Button || mongoose.model<IButton>('Button', ButtonSchema);

