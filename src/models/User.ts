import mongoose, { Schema, Document } from 'mongoose';
import { SubscriptionPlan, ISubscription, ISubscriptionModel } from './Subscription';
import Subscription from './Subscription';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  currentSubscription?: mongoose.Types.ObjectId; // Reference to active subscription
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
  // Virtual fields populated from subscription
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: string;
  subscriptionEndDate?: Date;
  maxButtons?: number;
  
  // Instance methods
  getSubscriptionDetails(): Promise<{
    plan: SubscriptionPlan;
    status: string;
    maxButtons: number;
    features: string[];
    isActive: boolean;
    endDate?: Date;
    daysUntilExpiry?: number | null;
  }>;
  canCreateButton(): Promise<boolean>;
  incrementButtonCount(): void;
  canUpgradeTo(targetPlan: SubscriptionPlan): Promise<boolean>;
}

// Static methods interface
export interface IUserModel extends mongoose.Model<IUser> {
  createWithFreeSubscription(userData: Partial<IUser>): Promise<IUser>;
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
  currentSubscription: {
    type: Schema.Types.ObjectId,
    ref: 'Subscription',
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
  lastLoginAt: {
    type: Date,
    default: Date.now,
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
try {
  UserSchema.index({ email: 1 });
  UserSchema.index({ currentSubscription: 1 });
  UserSchema.index({ createdAt: 1 });
} catch {
  // Indexes might already exist, ignore error
}

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.email;
});

// Virtual fields populated from subscription
UserSchema.virtual('subscription', {
  ref: 'Subscription',
  localField: 'currentSubscription',
  foreignField: '_id',
  justOne: true,
});

// Method to populate subscription data
UserSchema.methods.getSubscriptionDetails = async function() {
  if (!this.currentSubscription) {
    console.log(`User ${this.email}: No currentSubscription found, returning free plan`);
    return {
      plan: 'free' as SubscriptionPlan,
      status: 'active',
      maxButtons: 5,
      features: ['basic_button_generation'],
      isActive: true,
    };
  }

  console.log(`User ${this.email}: Current subscription ID: ${this.currentSubscription}`);
  
  // Force reload the subscription from database to get latest data
  await this.populate({
    path: 'currentSubscription',
    options: { lean: false } // Ensure we get the full Mongoose document
  });
  
  const subscription = this.currentSubscription as unknown as ISubscription;
  
  if (!subscription) {
    console.log(`User ${this.email}: Subscription not found after populate, returning free plan`);
    return {
      plan: 'free' as SubscriptionPlan,
      status: 'expired',
      maxButtons: 5,
      features: ['basic_button_generation'],
      isActive: false,
    };
  }
  
  console.log(`User ${this.email}: Found subscription with plan: ${subscription.plan}, status: ${subscription.status}`);
  
  if (!subscription.isActive()) {
    console.log(`User ${this.email}: Subscription is not active, returning free plan`);
    // Subscription expired or invalid, fallback to free
    return {
      plan: 'free' as SubscriptionPlan,
      status: 'expired',
      maxButtons: 5,
      features: ['basic_button_generation'],
      isActive: false,
    };
  }

  const features = subscription.getFeatures();
  console.log(`User ${this.email}: Returning subscription details - plan: ${subscription.plan}, maxButtons: ${features.maxButtons}`);
  
  return {
    plan: subscription.plan,
    status: subscription.status,
    maxButtons: features.maxButtons,
    features: features.features,
    isActive: subscription.isActive(),
    endDate: subscription.endDate,
    daysUntilExpiry: subscription.daysUntilExpiry(),
  };
};

// Method to check if user can create more buttons
UserSchema.methods.canCreateButton = async function(): Promise<boolean> {
  const subscriptionDetails = await this.getSubscriptionDetails();
  if (subscriptionDetails.maxButtons === -1) return true; // Unlimited
  return this.buttonCount < subscriptionDetails.maxButtons;
};

// Method to increment button count
UserSchema.methods.incrementButtonCount = function(): void {
  this.buttonCount += 1;
};

// Method to check if user can upgrade to a plan
UserSchema.methods.canUpgradeTo = async function(targetPlan: SubscriptionPlan): Promise<boolean> {
  if (!this.currentSubscription) {
    return targetPlan !== 'free'; // Can upgrade from free to any paid plan
  }

  await this.populate('currentSubscription');
  const subscription = this.currentSubscription as unknown as ISubscription;
  
  if (!subscription) return targetPlan !== 'free';
  
  return subscription.canUpgradeTo(targetPlan);
};

// Static method to create user with free subscription
UserSchema.statics.createWithFreeSubscription = async function(userData: Partial<IUser>) {
  const maxRetries = 5;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      const session = await mongoose.startSession();
      
      try {
        session.startTransaction();
        
        // Create user first
        const user = new this(userData);
        await user.save({ session });
        
        // Create free subscription
        const freeSubscription = await (Subscription as ISubscriptionModel).createFreeSubscription(user._id, session);
        
        // Link subscription to user
        user.currentSubscription = freeSubscription._id;
        await user.save({ session });
        
        await session.commitTransaction();
        console.log(`User created successfully on attempt ${attempt}`);
        return user;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      // If it's a write conflict, retry with exponential backoff
      if (error && typeof error === 'object' && 'code' in error) {
        const mongoError = error as { code?: number; codeName?: string };
        if (mongoError.code === 112 || mongoError.codeName === 'WriteConflict') {
          if (attempt < maxRetries) {
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000); // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
            console.log(`Write conflict detected, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If it's a duplicate key error, user might already exist
        if (mongoError.code === 11000) {
          console.log('User already exists, attempting to find existing user');
          try {
            const existingUser = await this.findOne({ clerkId: userData.clerkId });
            if (existingUser) {
              console.log('Found existing user, returning it');
              return existingUser;
            }
          } catch (findError) {
            console.error('Error finding existing user:', findError);
          }
        }
      }
      
      // If all retries failed or it's not a retryable error, throw
      if (attempt >= maxRetries) {
        console.error('All retry attempts failed');
        throw error;
      }
    }
  }
  
  throw new Error('Failed to create user after all retry attempts');
};

export default mongoose.models.User || mongoose.model<IUser, IUserModel>('User', UserSchema);

