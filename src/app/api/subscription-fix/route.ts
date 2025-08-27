import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Subscription from '@/models/Subscription';
import { SubscriptionService } from '@/lib/subscriptionService';

// This is a temporary fix endpoint to manually process failed subscription upgrades
// It should be removed after the webhook processing is fixed

export async function POST(request: NextRequest) {
  try {
    console.log('=== SUBSCRIPTION FIX ENDPOINT CALLED ===');
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      subscriptionId, 
      plan = 'monthly', 
      forceUpdate = false 
    } = body;

    console.log('Fix request:', { userId, subscriptionId, plan, forceUpdate });

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 });
    }

    await dbConnect();

    // Find the user
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`Found user: ${user.email} (${user._id})`);

    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({
      externalSubscriptionId: subscriptionId,
      paymentProvider: 'dodopayments'
    });

    if (existingSubscription) {
      console.log('Found existing subscription:', existingSubscription._id);
      
      // Check if it's already linked to the user
      if (user.currentSubscription?.toString() === existingSubscription._id.toString()) {
        console.log('Subscription already linked to user');
        return NextResponse.json({
          success: true,
          message: 'Subscription already linked',
          subscription: existingSubscription,
        });
      }

      // Link existing subscription to user
      user.currentSubscription = existingSubscription._id;
      await user.save();
      
      console.log('Linked existing subscription to user');
      
      const subscriptionDetails = await user.getSubscriptionDetails();
      
      return NextResponse.json({
        success: true,
        message: 'Existing subscription linked to user',
        subscription: existingSubscription,
        subscriptionDetails,
      });
    }

    // Create new subscription
    console.log('Creating new subscription...');
    
    const upgradeResult = await SubscriptionService.processUpgrade({
      userId: user._id,
      newPlan: plan as 'monthly' | 'yearly' | 'lifetime',
      paymentProvider: 'dodopayments',
      externalSubscriptionId: subscriptionId,
      externalCustomerId: `customer_${user._id}`,
      transactionId: `fix_${Date.now()}`,
      amount: plan === 'monthly' ? 5000 : plan === 'yearly' ? 49900 : 129900,
      currency: 'USD',
    });

    if (!upgradeResult.success) {
      console.error('Failed to create subscription:', upgradeResult.error);
      return NextResponse.json({
        success: false,
        error: upgradeResult.error,
      }, { status: 500 });
    }

    console.log('Successfully created subscription');

    const subscriptionDetails = await upgradeResult.user!.getSubscriptionDetails();

    return NextResponse.json({
      success: true,
      message: 'Subscription created and linked successfully',
      subscription: upgradeResult.subscription,
      subscriptionDetails,
    });

  } catch (error) {
    console.error('Subscription fix error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check current subscription status
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ clerkId: userId }).populate('currentSubscription');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all subscriptions for debug
    const allSubscriptions = await Subscription.find({ userId: user._id })
      .sort({ createdAt: -1 });

    const subscriptionDetails = await user.getSubscriptionDetails();

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        currentSubscriptionId: user.currentSubscription,
      },
      currentSubscription: user.currentSubscription,
      subscriptionDetails,
      allSubscriptions: allSubscriptions.map(sub => ({
        id: sub._id,
        plan: sub.plan,
        status: sub.status,
        externalId: sub.externalSubscriptionId,
        isActive: sub.isActive(),
        createdAt: sub.createdAt,
      })),
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
