import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User, { IUserModel } from '@/models/User';
import { SubscriptionService } from '@/lib/subscriptionService';
import { SubscriptionPlan } from '@/models/Subscription';

const DODOPAYMENTS_API_KEY = process.env.DODOPAYMENT_API;
const DODOPAYMENTS_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://live.dodopayments.com' 
  : 'https://test.dodopayments.com';

// Product IDs from your DodoPayments dashboard - update these with your actual product IDs
const PRODUCT_IDS = {
  monthly: 'pdt_kwbHw53PPUcSUCzDfQe5T',    // $50/month
  yearly: 'pdt_AXwT4UhFdk72q1OZcNUEQ',     // $499/year
  lifetime: 'pdt_hnt3YWGbWfP7525gLeCiQ'    // $1299 one-time
} as const;

export async function POST(request: NextRequest) {
  try {
    console.log('Creating checkout session...');
    
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      console.log('Unauthorized: No user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { planType, userEmail, userName } = body;

    console.log('Checkout request:', { planType, userEmail, userName, userId });

    // Validate required fields
    if (!planType) {
      return NextResponse.json(
        { error: 'Plan type is required' },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    // Validate plan type
    if (!PRODUCT_IDS[planType as keyof typeof PRODUCT_IDS]) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be monthly, yearly, or lifetime' },
        { status: 400 }
      );
    }

    // Validate API key
    if (!DODOPAYMENTS_API_KEY) {
      console.error('DodoPayments API key not configured');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    await dbConnect();

    // Find or create user
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      console.log('Creating new user...');
      // Create user with free subscription if they don't exist
      user = await (User as IUserModel).createWithFreeSubscription({
        clerkId: userId,
        email: userEmail,
        firstName: userName?.split(' ')[0] || '',
        lastName: userName?.split(' ').slice(1).join(' ') || '',
        buttonCount: 0,
        isActive: true,
        preferences: {
          defaultAiProvider: 'chatgpt',
          theme: 'light',
          notifications: true,
        },
      });
      console.log('User created successfully');
    }

    // Validate the upgrade
    const targetPlan = planType as SubscriptionPlan;
    console.log('Validating upgrade from current plan to:', targetPlan);
    
    const validation = await SubscriptionService.validateUpgrade(user._id, targetPlan);
    
    if (!validation.isValid || !validation.canUpgrade) {
      console.log('Upgrade validation failed:', validation.errors);
      return NextResponse.json({
        error: 'Cannot upgrade to this plan',
        details: validation.errors,
        warnings: validation.warnings,
        currentPlan: validation.currentPlan,
        targetPlan: validation.targetPlan,
      }, { status: 400 });
    }

    console.log('Upgrade validation passed');

    // Get the product ID for the selected plan
    const productId = PRODUCT_IDS[planType as keyof typeof PRODUCT_IDS];

    // Prepare checkout session data according to DodoPayments API
    const checkoutData = {
      // Product cart using the expected API format
      product_cart: [
        {
          product_id: productId,
          quantity: 1
        }
      ],
      
      // Customer information
      customer: {
        email: userEmail,
        name: userName || userEmail.split('@')[0]
      },
      
      // Success and cancel URLs - DodoPayments will automatically append payment_id and status
      return_url: `${request.nextUrl.origin}/?payment=success&plan=${planType}`,
      
      // Metadata for webhook processing
      metadata: {
        user_id: userId,
        plan_type: planType,
        source: 'subscription_upgrade',
        user_email: userEmail,
        timestamp: new Date().toISOString()
      },
      
      // Mode for the checkout
      mode: planType === 'lifetime' ? 'payment' : 'subscription'
    };

    console.log('Creating checkout with DodoPayments...', {
      productId,
      mode: checkoutData.mode,
      baseUrl: DODOPAYMENTS_BASE_URL
    });

    // Create checkout session with DodoPayments
    const response = await fetch(`${DODOPAYMENTS_BASE_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODOPAYMENTS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'NewsletterButton/1.0'
      },
      body: JSON.stringify(checkoutData),
    });

    console.log('DodoPayments response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('DodoPayments API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch {
        parsedError = { message: errorData };
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create checkout session', 
          details: parsedError,
          status: response.status 
        },
        { status: response.status >= 500 ? 500 : 400 }
      );
    }

    const sessionData = await response.json();
    console.log('Checkout session created successfully:', sessionData.id || sessionData.session_id);

    // Store pending upgrade information for the success page
    // This helps with cases where webhook might be delayed
    const pendingUpgrade = {
      userId,
      planType,
      sessionId: sessionData.id || sessionData.session_id,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      session_id: sessionData.id || sessionData.session_id,
      checkout_url: sessionData.url || sessionData.checkout_url,
      pending_upgrade: pendingUpgrade
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
