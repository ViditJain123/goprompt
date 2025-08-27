import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User, { IUserModel } from '@/models/User';
import { SubscriptionService } from '@/lib/subscriptionService';
import { SubscriptionPlan } from '@/models/Subscription';

// These constants are defined but not used in this file - they may be used in future webhook validation
// const DODOPAYMENTS_API_KEY = process.env.DODOPAYMENT_API;
// const DODOPAYMENTS_BASE_URL = 'https://test.dodopayments.com';

// Product ID to plan mapping
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlan> = {
  'pdt_kwbHw53PPUcSUCzDfQe5T': 'monthly',    // $50/month
  'pdt_AXwT4UhFdk72q1OZcNUEQ': 'yearly',     // $499/year
  'pdt_hnt3YWGbWfP7525gLeCiQ': 'lifetime',   // $1299 one-time
};

export async function POST(request: NextRequest) {
  console.log('Subscription update API called');
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('Request URL:', request.url);
  
  try {
    // Get the authenticated user
    const { userId } = await auth();
    console.log('User ID from auth:', userId);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      subscriptionId, 
      // status, // Currently unused but may be needed for webhook validation
      productId, 
      amount, 
      currency = 'USD',
      transactionId,
      customerId,
      planType // New parameter from frontend
    } = body;
    
    console.log('Request body:', body);

    if (!subscriptionId) {
      console.log('Missing subscription ID');
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Determine plan from multiple sources (prioritized order)
    let plan: SubscriptionPlan = 'monthly'; // default fallback
    
    // 1. First priority: planType from frontend (when user returns from payment)
    if (planType && ['monthly', 'yearly', 'lifetime'].includes(planType)) {
      plan = planType as SubscriptionPlan;
      console.log('Plan determined from frontend planType:', plan);
    }
    // 2. Second priority: productId from webhook
    else if (productId && PRODUCT_ID_TO_PLAN[productId]) {
      plan = PRODUCT_ID_TO_PLAN[productId];
      console.log('Plan determined from product ID:', plan);
    } 
    // 3. Third priority: amount (for webhook calls)
    else {
      console.log('Product ID missing or unknown, attempting to determine plan from amount:', productId);
      
      if (amount) {
        // Convert amount to number if it's a string
        const numAmount = typeof amount === 'string' ? parseInt(amount) : amount;
        
        if (numAmount >= 129900) { // $1299+ = lifetime
          plan = 'lifetime';
          console.log('Plan determined from amount (lifetime):', numAmount);
        } else if (numAmount >= 49900) { // $499+ = yearly
          plan = 'yearly';
          console.log('Plan determined from amount (yearly):', numAmount);
        } else if (numAmount >= 5000) { // $50+ = monthly
          plan = 'monthly';
          console.log('Plan determined from amount (monthly):', numAmount);
        } else {
          console.log('Amount too low, defaulting to monthly:', numAmount);
        }
      } else {
        console.log('No product ID, amount, or planType provided, defaulting to monthly plan');
      }
    }

    console.log('Final detected plan:', plan);

    await dbConnect();
    
    let user = await User.findOne({ clerkId: userId });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (user) {
      // Get current subscription details for better logging
      const currentSubDetails = await user.getSubscriptionDetails();
      console.log('Current user plan:', currentSubDetails.plan);
      console.log('Target plan:', plan);
      console.log('Is this an upgrade?', currentSubDetails.plan !== plan);
      
      // If no product ID and no amount, but user is trying to "upgrade", 
      // this might be a webhook call with missing data
      if (!productId && !amount && currentSubDetails.plan === plan) {
        console.log('Possible webhook with missing product/amount data - treating as renewal');
      }
    }
    
    if (!user) {
      console.log('User not found in database, creating new user');
      // Create user with free subscription
      user = await (User as IUserModel).createWithFreeSubscription({
        clerkId: userId,
        email: 'unknown@example.com', // This should be updated from webhook data
        buttonCount: 0,
        isActive: true,
        preferences: {
          defaultAiProvider: 'chatgpt',
          theme: 'light',
          notifications: true,
        },
      });
      console.log('New user created with free subscription');
    }

    // Validate the upgrade (allow same-plan renewals for payment processing)
    const validation = await SubscriptionService.validateUpgrade(user._id, plan, true);
    if (!validation.isValid) {
      console.log('Upgrade validation failed:', validation.errors);
      return NextResponse.json(
        { 
          error: 'Upgrade validation failed', 
          details: validation.errors,
          warnings: validation.warnings 
        },
        { status: 400 }
      );
    }

    // Log if this is a renewal
    if (validation.isRenewal) {
      console.log(`Processing renewal for ${plan} plan`);
    } else {
      console.log(`Processing upgrade from ${validation.currentPlan} to ${plan}`);
    }

    // Process the subscription upgrade
    console.log('Starting subscription upgrade process...');
    const upgradeResult = await SubscriptionService.processUpgrade({
      userId: user._id,
      newPlan: plan,
      paymentProvider: 'dodopayments',
      externalSubscriptionId: subscriptionId,
      externalCustomerId: customerId,
      transactionId,
      amount: amount || 0,
      currency,
    });

    if (!upgradeResult.success) {
      console.error('Subscription upgrade failed:', upgradeResult.error);
      return NextResponse.json(
        { error: 'Failed to process subscription upgrade', details: upgradeResult.error },
        { status: 500 }
      );
    }

    console.log('Subscription upgrade completed successfully');

    // Get updated subscription details
    const subscriptionDetails = await upgradeResult.user!.getSubscriptionDetails();
    console.log('Updated subscription details:', {
      plan: subscriptionDetails.plan,
      status: subscriptionDetails.status,
      maxButtons: subscriptionDetails.maxButtons,
      isActive: subscriptionDetails.isActive,
    });

    return NextResponse.json({
      success: true,
      plan: subscriptionDetails.plan,
      maxButtons: subscriptionDetails.maxButtons,
      subscriptionId,
      status: subscriptionDetails.status,
      endDate: subscriptionDetails.endDate,
      features: subscriptionDetails.features,
      message: 'User subscription updated successfully'
    });

  } catch (error) {
    console.error('Subscription update error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve current subscription details
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const subscriptionDetails = await user.getSubscriptionDetails();
    const subscriptionHistory = await SubscriptionService.getUserSubscriptionHistory(user._id);

    return NextResponse.json({
      current: subscriptionDetails,
      history: {
        totalSpent: subscriptionHistory.totalSpent,
        planChanges: subscriptionHistory.planChanges,
        subscriptions: subscriptionHistory.subscriptions.slice(0, 5), // Last 5 subscriptions
      },
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
