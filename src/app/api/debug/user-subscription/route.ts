import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Subscription from '@/models/Subscription';

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

    // Get all subscriptions for this user
    const allSubscriptions = await Subscription.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    const subscriptionDetails = await user.getSubscriptionDetails();

    return NextResponse.json({
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        currentSubscriptionId: user.currentSubscription,
      },
      currentSubscription: user.currentSubscription,
      subscriptionDetails,
      allSubscriptions: allSubscriptions.map(sub => ({
        id: sub._id,
        plan: sub.plan,
        status: sub.status,
        createdAt: sub.createdAt,
        startDate: sub.startDate,
        endDate: sub.endDate,
        externalSubscriptionId: sub.externalSubscriptionId,
        metadata: sub.metadata,
      })),
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
