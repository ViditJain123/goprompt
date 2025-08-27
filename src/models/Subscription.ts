import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionPlan = 'free' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending' | 'failed';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date; // undefined for lifetime
  nextBillingDate?: Date; // undefined for lifetime and expired
  paymentProvider: 'dodopayments' | 'stripe' | 'manual';
  externalSubscriptionId?: string; // ID from payment provider
  externalCustomerId?: string;
  amount: number; // in cents
  currency: string;
  billingCycle?: 'monthly' | 'yearly' | 'lifetime';
  metadata?: {
    upgradeFromPlan?: SubscriptionPlan;
    upgradeDate?: Date;
    paymentMethod?: string;
    transactionId?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  isActive(): boolean;
  isExpired(): boolean;
  daysUntilExpiry(): number | null;
  canUpgradeTo(targetPlan: SubscriptionPlan): boolean;
  getFeatures(): {
    maxButtons: number;
    features: string[];
    priority: string;
  };
}

// Static methods interface
export interface ISubscriptionModel extends mongoose.Model<ISubscription> {
  createFreeSubscription(userId: mongoose.Types.ObjectId, session?: mongoose.ClientSession): Promise<ISubscription>;
  findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
  findExpiringSubscriptions(daysAhead?: number): Promise<ISubscription[]>;
  getSubscriptionPricing(): Record<string, unknown>;
}

const SubscriptionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['free', 'monthly', 'yearly', 'lifetime'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending', 'failed'],
    required: true,
    index: true,
  },
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    index: true,
    // null/undefined for lifetime subscriptions
  },
  nextBillingDate: {
    type: Date,
    index: true,
    // null/undefined for lifetime and expired subscriptions
  },
  paymentProvider: {
    type: String,
    enum: ['dodopayments', 'stripe', 'manual'],
    required: true,
  },
  externalSubscriptionId: {
    type: String,
    index: true,
  },
  externalCustomerId: {
    type: String,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'lifetime'],
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Compound indexes for better query performance
try {
  SubscriptionSchema.index({ userId: 1, status: 1 });
  SubscriptionSchema.index({ userId: 1, createdAt: -1 });
  SubscriptionSchema.index({ endDate: 1, status: 1 }); // For finding expiring subscriptions
  SubscriptionSchema.index({ nextBillingDate: 1, status: 1 }); // For billing reminders
  // Index for external subscription IDs to prevent duplicate webhook processing
  SubscriptionSchema.index({ externalSubscriptionId: 1, paymentProvider: 1 }, { unique: true, sparse: true });
  // Index for better query performance on user subscriptions
  SubscriptionSchema.index({ userId: 1, plan: 1, createdAt: -1 });
} catch {
  // Indexes might already exist, ignore error
}

// Instance methods
SubscriptionSchema.methods.isActive = function(): boolean {
  if (this.status !== 'active') return false;
  if (this.plan === 'lifetime') return true;
  if (!this.endDate) return false;
  return this.endDate > new Date();
};

SubscriptionSchema.methods.isExpired = function(): boolean {
  if (this.plan === 'lifetime') return false;
  if (!this.endDate) return true;
  return this.endDate <= new Date();
};

SubscriptionSchema.methods.daysUntilExpiry = function(): number | null {
  if (this.plan === 'lifetime') return null;
  if (!this.endDate) return 0;
  const now = new Date();
  const diffTime = this.endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

SubscriptionSchema.methods.canUpgradeTo = function(targetPlan: SubscriptionPlan): boolean {
  const planHierarchy: Record<SubscriptionPlan, number> = {
    free: 0,
    monthly: 1,
    yearly: 2,
    lifetime: 3,
  };
  
  const currentPlan = this.plan as SubscriptionPlan;
  return planHierarchy[targetPlan] > planHierarchy[currentPlan];
};

SubscriptionSchema.methods.getFeatures = function() {
  const features = {
    free: {
      maxButtons: 5,
      features: ['basic_button_generation'],
      priority: 'low',
    },
    monthly: {
      maxButtons: 100,
      features: ['basic_button_generation', 'custom_prompts', 'analytics', 'priority_support'],
      priority: 'high',
    },
    yearly: {
      maxButtons: 500,
      features: ['basic_button_generation', 'custom_prompts', 'analytics', 'priority_support', 'advanced_analytics', 'custom_branding'],
      priority: 'high',
    },
    lifetime: {
      maxButtons: -1, // unlimited
      features: ['all_features', 'vip_support', 'early_access', 'custom_integrations'],
      priority: 'vip',
    },
  };
  
  const currentPlan = this.plan as SubscriptionPlan;
  return features[currentPlan] || features.free;
};

// Static methods
SubscriptionSchema.statics.createFreeSubscription = async function(userId: mongoose.Types.ObjectId, session?: mongoose.ClientSession) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      // Check if user already has a free subscription
      const existingSubscription = await this.findOne({
        userId,
        plan: 'free',
        status: 'active'
      }).session(session || null);
      
      if (existingSubscription) {
        console.log('User already has a free subscription, returning existing one');
        return existingSubscription;
      }
      
      const subscriptionData = {
        userId,
        plan: 'free' as SubscriptionPlan,
        status: 'active' as SubscriptionStatus,
        startDate: new Date(),
        paymentProvider: 'manual' as const,
        externalSubscriptionId: `free_${userId}_${Date.now()}`, // Make it unique
        amount: 0,
        currency: 'USD',
        billingCycle: 'lifetime' as const,
        metadata: {
          type: 'free_tier',
          createdVia: 'user_signup',
        },
      };
      
      if (session) {
        return await this.create([subscriptionData], { session });
      } else {
        return await this.create(subscriptionData);
      }
          } catch (error: unknown) {
      console.error(`Error creating free subscription (attempt ${attempt}):`, error instanceof Error ? error.message : 'Unknown error');
      
      // If it's a write conflict, retry
      if (error && typeof error === 'object' && 'code' in error && ((error as { code: number }).code === 112 || ('codeName' in error && (error as { codeName: string }).codeName === 'WriteConflict'))) {
        if (attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          console.log(`Write conflict in subscription creation, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // If it's a duplicate key error, try to find existing subscription
      if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) {
        console.log('Duplicate subscription detected, attempting to find existing one');
        try {
          const existingSubscription = await this.findOne({
            userId,
            plan: 'free',
            status: 'active'
          }).session(session || null);
          
          if (existingSubscription) {
            console.log('Found existing subscription, returning it');
            return existingSubscription;
          }
        } catch (findError) {
          console.error('Error finding existing subscription:', findError);
        }
      }
      
      // If all retries failed or it's not a retryable error, throw
      if (attempt >= maxRetries) {
        console.error('All retry attempts failed for subscription creation');
        throw error;
      }
    }
  }
  
  throw new Error('Failed to create subscription after all retry attempts');
};

SubscriptionSchema.statics.findActiveByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({
    userId,
    status: 'active',
    $or: [
      { endDate: { $gt: new Date() } },
      { plan: 'lifetime' },
    ],
  }).sort({ createdAt: -1 });
};

SubscriptionSchema.statics.findExpiringSubscriptions = function(daysAhead: number = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    status: 'active',
    plan: { $in: ['monthly', 'yearly'] },
    endDate: {
      $gte: new Date(),
      $lte: futureDate,
    },
  }).populate('userId');
};

SubscriptionSchema.statics.getSubscriptionPricing = function() {
  return {
    monthly: {
      amount: 5000, // $50 in cents
      currency: 'USD',
      billingCycle: 'monthly',
      features: 'Pro features with monthly billing',
    },
    yearly: {
      amount: 49900, // $499 in cents (save $101)
      currency: 'USD',
      billingCycle: 'yearly',
      features: 'Pro features with yearly billing + advanced features',
    },
    lifetime: {
      amount: 129900, // $1299 in cents
      currency: 'USD',
      billingCycle: 'lifetime',
      features: 'All features forever',
    },
  };
};

// Pre-save middleware
SubscriptionSchema.pre('save', function(this: ISubscription, next) {
  // Set end date for recurring subscriptions
  if (this.isNew || this.isModified('plan') || this.isModified('startDate')) {
    if (this.plan === 'monthly' && !this.endDate) {
      this.endDate = new Date(this.startDate);
      this.endDate.setMonth(this.endDate.getMonth() + 1);
      this.nextBillingDate = new Date(this.endDate);
    } else if (this.plan === 'yearly' && !this.endDate) {
      this.endDate = new Date(this.startDate);
      this.endDate.setFullYear(this.endDate.getFullYear() + 1);
      this.nextBillingDate = new Date(this.endDate);
    } else if (this.plan === 'lifetime') {
      this.endDate = undefined;
      this.nextBillingDate = undefined;
    }
  }
  
  // Update status based on expiry
  if (this.isModified('endDate') || this.isModified('status')) {
    if (this.plan !== 'lifetime' && this.endDate && this.endDate <= new Date() && this.status === 'active') {
      this.status = 'expired';
    }
  }
  
  next();
});

export default mongoose.models.Subscription || mongoose.model<ISubscription, ISubscriptionModel>('Subscription', SubscriptionSchema);
