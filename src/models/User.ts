import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  buttonCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  preferences: {
    defaultAiProvider: 'chatgpt' | 'claude';
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
  incrementButtonCount(): void;
}

const UserSchema: Schema = new Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  buttonCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  preferences: {
    defaultAiProvider: {
      type: String,
      enum: ['chatgpt', 'claude'],
      default: 'chatgpt',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light',
    },
    notifications: {
      type: Boolean,
      default: true,
    },
  },
  lastLoginAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

UserSchema.index({ clerkId: 1 });
UserSchema.index({ email: 1 });

UserSchema.methods.incrementButtonCount = function(): void {
  this.buttonCount += 1;
};

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
