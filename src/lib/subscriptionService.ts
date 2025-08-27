import mongoose from 'mongoose';
import User, { IUser } from '@/models/User';
import Subscription, { ISubscription, ISubscriptionModel, SubscriptionPlan, SubscriptionStatus } from '@/models/Subscription';

export interface SubscriptionUpgradeData {
  userId: mongoose.Types.ObjectId | string;
  newPlan: SubscriptionPlan;
  paymentProvider: 'dodopayments' | 'stripe' | 'manual';
  externalSubscriptionId?: string;
  externalCustomerId?: string;
  transactionId?: string;
  amount: number;
  currency?: string;
}

export interface SubscriptionValidationResult {
  isValid: boolean;
  canUpgrade: boolean;
  currentPlan?: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  errors: string[];
  warnings: string[];
  isRenewal?: boolean; // Flag to indicate if this is a renewal of the same plan
}

export class SubscriptionService {
  /**
   * Validate if a user can upgrade to a specific plan
   */
  static async validateUpgrade(
    userId: mongoose.Types.ObjectId | string,
    targetPlan: SubscriptionPlan,
    isPaymentProcessing: boolean = false // Flag to indicate this is from payment processing
  ): Promise<SubscriptionValidationResult> {
    const result: SubscriptionValidationResult = {
      isValid: false,
      canUpgrade: false,
      targetPlan,
      errors: [],
      warnings: [],
      isRenewal: false,
    };

    try {
      const user = await User.findById(userId).populate('currentSubscription');
      if (!user) {
        result.errors.push('User not found');
        return result;
      }

      const currentSubscription = user.currentSubscription as ISubscription;
      result.currentPlan = currentSubscription?.plan || 'free';

      // Check if target plan is valid
      const validPlans: SubscriptionPlan[] = ['free', 'monthly', 'yearly', 'lifetime'];
      if (!validPlans.includes(targetPlan)) {
        result.errors.push('Invalid target plan');
        return result;
      }

      // Can't "upgrade" to free
      if (targetPlan === 'free') {
        result.errors.push('Cannot downgrade to free plan');
        return result;
      }

      // Check upgrade path (can only go from lower to higher tier)
      const planHierarchy: Record<SubscriptionPlan, number> = {
        free: 0,
        monthly: 1,
        yearly: 2,
        lifetime: 3,
      };

      const currentLevel = planHierarchy[result.currentPlan];
      const targetLevel = planHierarchy[targetPlan];

      // If this is payment processing, allow same-plan "upgrades" (renewals)
      if (targetLevel === currentLevel && isPaymentProcessing) {
        result.isRenewal = true;
        result.warnings.push(`Renewing ${targetPlan} plan`);
        result.isValid = true;
        result.canUpgrade = true;
        return result;
      }

      if (targetLevel <= currentLevel) {
        if (targetLevel === currentLevel) {
          result.errors.push(`User already has ${targetPlan} plan`);
        } else {
          result.errors.push(`Cannot downgrade from ${result.currentPlan} to ${targetPlan}`);
        }
        return result;
      }

      // Check if current subscription is still active
      if (currentSubscription && !currentSubscription.isActive()) {
        result.warnings.push('Current subscription is expired or inactive');
      }

      // Special case: if user has yearly and wants lifetime
      if (result.currentPlan === 'yearly' && targetPlan === 'lifetime') {
        const daysLeft = currentSubscription?.daysUntilExpiry();
        if (daysLeft && daysLeft > 30) {
          result.warnings.push(`You have ${daysLeft} days left on your yearly subscription. Consider upgrading closer to expiry.`);
        }
      }

      result.isValid = true;
      result.canUpgrade = true;
      return result;

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Process a subscription upgrade
   */
  static async processUpgrade(upgradeData: SubscriptionUpgradeData): Promise<{
    success: boolean;
    subscription?: ISubscription;
    user?: IUser;
    error?: string;
  }> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Validate the upgrade first (allowing same-plan renewals for payment processing)
      const validation = await this.validateUpgrade(upgradeData.userId, upgradeData.newPlan, true);
      if (!validation.isValid || !validation.canUpgrade) {
        throw new Error(`Upgrade validation failed: ${validation.errors.join(', ')}`);
      }

      const user = await User.findById(upgradeData.userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Get current subscription if exists
      let currentSubscription: ISubscription | null = null;
      if (user.currentSubscription) {
        currentSubscription = await Subscription.findById(user.currentSubscription).session(session);
      }

      // Also find any other active subscriptions for this user (in case of edge cases)
      const activeSubscriptions = await Subscription.find({
        userId: user._id,
        status: 'active'
      }).session(session);

      console.log(`Found ${activeSubscriptions.length} active subscriptions for user`);
      
      // Check for duplicate subscription attempts
      const existingWithSameExternal = await Subscription.findOne({
        externalSubscriptionId: upgradeData.externalSubscriptionId,
        paymentProvider: upgradeData.paymentProvider
      }).session(session);
      
      if (existingWithSameExternal) {
        console.log('Duplicate subscription detected, checking for existing subscription...');
        // This subscription already exists, check if it's the current one
        if (existingWithSameExternal._id.toString() === user.currentSubscription?.toString()) {
          console.log('Subscription already processed and set as current');
          await session.commitTransaction();
          return {
            success: true,
            subscription: existingWithSameExternal,
            user,
          };
        } else {
          // Update user's current subscription to point to this one
          user.currentSubscription = existingWithSameExternal._id;
          await user.save({ session });
          console.log('Updated user to point to existing subscription');
          await session.commitTransaction();
          return {
            success: true,
            subscription: existingWithSameExternal,
            user,
          };
        }
      }

      // Create new subscription
      const subscriptionPricing = (Subscription as ISubscriptionModel).getSubscriptionPricing();
      const planPricing = subscriptionPricing[upgradeData.newPlan as keyof typeof subscriptionPricing] as {
        amount: number;
        currency: string;
        billingCycle: string;
        features: string;
      } | undefined;
      
      const newSubscriptionData: Partial<ISubscription> = {
        userId: user._id,
        plan: upgradeData.newPlan,
        status: 'active' as SubscriptionStatus,
        startDate: new Date(),
        paymentProvider: upgradeData.paymentProvider,
        externalSubscriptionId: upgradeData.externalSubscriptionId,
        externalCustomerId: upgradeData.externalCustomerId,
        amount: upgradeData.amount || planPricing?.amount || 0,
        currency: upgradeData.currency || 'USD',
        billingCycle: planPricing?.billingCycle as 'monthly' | 'yearly' | 'lifetime' | undefined,
        metadata: {
          upgradeFromPlan: currentSubscription?.plan || 'free',
          upgradeDate: new Date(),
          transactionId: upgradeData.transactionId,
          isRenewal: validation.isRenewal || false,
        },
      };

      const newSubscription = new Subscription(newSubscriptionData);
      
      try {
        await newSubscription.save({ session });
      } catch (saveError: unknown) {
        // Handle duplicate key errors more gracefully
        if (saveError && typeof saveError === 'object' && 'code' in saveError && (saveError as { code: number }).code === 11000) {
          console.log('Duplicate subscription detected, checking for existing subscription...');
          
          // Check if there's an existing subscription with the same external ID
          if (upgradeData.externalSubscriptionId) {
            const existingSubscription = await Subscription.findOne({
              externalSubscriptionId: upgradeData.externalSubscriptionId,
              paymentProvider: upgradeData.paymentProvider
            }).session(session);
            
            if (existingSubscription) {
              console.log('Found existing subscription with same external ID, using that instead');
              // Update user reference to this subscription
              user.currentSubscription = existingSubscription._id;
              await user.save({ session });
              
              await session.commitTransaction();
              await user.populate('currentSubscription');
              
              return {
                success: true,
                subscription: existingSubscription,
                user,
              };
            }
          }
          
          // If we can't find a matching subscription, this is a real duplicate error
          throw new Error(`Duplicate subscription error: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
        }
        throw saveError;
      }

      // Deactivate ALL existing active subscriptions to ensure only one is active
      for (const activeSubscription of activeSubscriptions) {
        if (validation.isRenewal && activeSubscription.plan === upgradeData.newPlan) {
          // For renewals of the same plan, mark as renewed
          activeSubscription.status = 'cancelled';
          activeSubscription.metadata = {
            ...activeSubscription.metadata,
            renewedDate: new Date(),
            cancelReason: 'renewed',
            renewedToSubscription: newSubscription._id,
          };
        } else {
          // For upgrades or different plans, mark as cancelled due to upgrade
          activeSubscription.status = 'cancelled';
          activeSubscription.metadata = {
            ...activeSubscription.metadata,
            cancelledDate: new Date(),
            cancelReason: validation.isRenewal ? 'renewed' : 'upgraded',
            upgradedToPlan: upgradeData.newPlan,
          };
        }
        await activeSubscription.save({ session });
      }

      // Update user's current subscription reference
      user.currentSubscription = newSubscription._id;
      await user.save({ session });

      await session.commitTransaction();

      // Populate the subscription details for return
      await user.populate('currentSubscription');

      return {
        success: true,
        subscription: newSubscription,
        user,
      };

    } catch (error) {
      await session.abortTransaction();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Check for expired subscriptions and handle them
   */
  static async handleExpiredSubscriptions(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Find subscriptions that are active but expired
      const expiredSubscriptions = await Subscription.find({
        status: 'active',
        plan: { $in: ['monthly', 'yearly'] },
        endDate: { $lt: new Date() },
      }).populate('userId');

      for (const subscription of expiredSubscriptions) {
        try {
          const session = await mongoose.startSession();
          session.startTransaction();

          // Update subscription status
          subscription.status = 'expired';
          subscription.metadata = {
            ...subscription.metadata,
            expiredDate: new Date(),
            autoExpired: true,
          };
          await subscription.save({ session });

          // Create a new free subscription for the user
          const user = subscription.userId as IUser;
          const freeSubscription = await (Subscription as ISubscriptionModel).createFreeSubscription(user._id as mongoose.Types.ObjectId, session);

          // Update user's current subscription
          user.currentSubscription = freeSubscription._id as mongoose.Types.ObjectId;
          await user.save({ session });

          await session.commitTransaction();
          session.endSession();

          processed++;
        } catch (error) {
          errors.push(`Failed to process expired subscription ${subscription._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      errors.push(`Failed to fetch expired subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { processed, errors };
  }

  /**
   * Get subscription analytics for a user
   */
  static async getUserSubscriptionHistory(userId: mongoose.Types.ObjectId | string): Promise<{
    subscriptions: ISubscription[];
    totalSpent: number;
    currentPlan: SubscriptionPlan;
    planChanges: number;
  }> {
    const subscriptions = await Subscription.find({ userId })
      .sort({ createdAt: -1 });

    const totalSpent = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
    const currentPlan = subscriptions.find(sub => sub.status === 'active')?.plan || 'free';
    const planChanges = subscriptions.length - 1; // Excluding the initial subscription

    return {
      subscriptions,
      totalSpent,
      currentPlan,
      planChanges,
    };
  }

  /**
   * Get subscriptions that are about to expire
   */
  static async getExpiringSubscriptions(daysAhead: number = 7): Promise<ISubscription[]> {
    return (Subscription as ISubscriptionModel).findExpiringSubscriptions(daysAhead);
  }

  /**
   * Cancel a subscription (mark as cancelled, but keep active until end date)
   */
  static async cancelSubscription(
    subscriptionId: mongoose.Types.ObjectId | string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      if (subscription.status !== 'active') {
        return { success: false, error: 'Subscription is not active' };
      }

      if (subscription.plan === 'lifetime') {
        return { success: false, error: 'Cannot cancel lifetime subscription' };
      }

      subscription.status = 'cancelled';
      subscription.metadata = {
        ...subscription.metadata,
        cancelledDate: new Date(),
        cancelReason: reason || 'user_requested',
        willExpireOn: subscription.endDate,
      };

      await subscription.save();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default SubscriptionService;
