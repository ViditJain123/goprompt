import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import User, { IUserModel } from '@/models/User';
import Subscription from '@/models/Subscription';
import { SubscriptionService } from '@/lib/subscriptionService';
import { SubscriptionPlan } from '@/models/Subscription';

// DodoPayments webhook event types based on official documentation
type DodoWebhookEventType = 
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.pending'
  | 'payment.refunded'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.expired'
  | 'subscription.renewed'
  | 'subscription.plan_changed'
  | 'checkout.completed'
  | 'checkout.expired'
  | 'dispute.created'
  | 'dispute.updated'
  | 'customer.created'
  | 'customer.updated';

// DodoPayments webhook payload structure based on official docs
interface DodoWebhookEvent {
  id: string;
  type: DodoWebhookEventType;
  created_at: string;
  data: DodoWebhookData;
  api_version?: string;
}

interface DodoWebhookData {
  // Payment fields
  payment_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  
  // Subscription fields
  subscription_id?: string;
  customer_id?: string;
  
  // Customer information
  customer?: {
    id: string;
    email: string;
    name?: string;
    billing_address?: {
      country?: string;
      state?: string;
      city?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
    };
  };
  
  // Product information - DodoPayments uses product_cart
  product_cart?: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
    unit_amount: number;
    total_amount: number;
  }>;
  
  // Also support line_items for compatibility
  line_items?: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
    unit_amount: number;
    total_amount: number;
  }>;
  
  // Metadata for custom data
  metadata?: {
    user_id?: string;
    plan_type?: SubscriptionPlan;
    [key: string]: unknown;
  };
  
  // Transaction details
  transaction_id?: string;
  payment_method?: string;
  
  // Subscription specific
  billing_cycle?: 'monthly' | 'yearly' | 'one_time';
  trial_period_days?: number;
  next_billing_date?: string;
  
  // Additional fields that might be present
  [key: string]: unknown;
}

const WEBHOOK_SECRET = process.env.DODOPAYMENTS_WEBHOOK_SECRET;

// Product ID to plan mapping - update these with your actual product IDs
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlan> = {
  'pdt_kwbHw53PPUcSUCzDfQe5T': 'monthly',    // $50/month
  'pdt_AXwT4UhFdk72q1OZcNUEQ': 'yearly',     // $499/year
  'pdt_hnt3YWGbWfP7525gLeCiQ': 'lifetime',   // $1299 one-time
};

// Verify webhook signature using DodoPayments signing key
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('No webhook secret configured - skipping signature verification');
    return true;
  }
  
  try {
    // DodoPayments uses HMAC-SHA256 for webhook signature verification
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');
    
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(cleanSignature, 'hex')
    );
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    
    // DodoPayments uses different header names - check their webhook documentation
    const signature = headersList.get('dodo-signature') || 
                     headersList.get('x-dodo-signature') || 
                     headersList.get('webhook-signature') || '';

    console.log('DodoPayments webhook received');
    console.log('Headers:', Object.fromEntries(headersList.entries()));

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET && signature) {
      if (!verifyWebhookSignature(body, signature)) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      console.log('Webhook signature verified successfully');
    } else {
      console.warn('Webhook signature verification skipped - no secret or signature provided');
    }

    const event: DodoWebhookEvent = JSON.parse(body);
    console.log('Webhook event:', {
      id: event.id,
      type: event.type,
      created_at: event.created_at,
      api_version: event.api_version
    });

    await dbConnect();

    // Handle different webhook event types according to DodoPayments documentation
    switch (event.type) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(event.data);
        break;
        
      case 'checkout.completed':
        await handleCheckoutCompleted(event.data);
        break;
        
      case 'subscription.created':
        await handleSubscriptionCreated(event.data);
        break;
        
      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data);
        break;
        
      case 'subscription.renewed':
        await handleSubscriptionRenewed(event.data);
        break;
        
      case 'subscription.plan_changed':
        await handleSubscriptionPlanChanged(event.data);
        break;
        
      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionCancelled(event.data);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;
        
      case 'payment.refunded':
        await handlePaymentRefunded(event.data);
        break;
        
      case 'dispute.created':
        await handleDisputeCreated(event.data);
        break;
        
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
        // Still return success to prevent retries for unknown event types
    }

    return NextResponse.json({ 
      received: true, 
      event_id: event.id,
      event_type: event.type 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return appropriate error status
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handler for payment.succeeded webhook event
async function handlePaymentSucceeded(data: DodoWebhookData) {
  try {
    console.log('Processing payment.succeeded:', data);
    await processPaymentSuccess(data);
  } catch (error) {
    console.error('Error handling payment.succeeded:', error);
    throw error;
  }
}

// Handler for checkout.completed webhook event
async function handleCheckoutCompleted(data: DodoWebhookData) {
  try {
    console.log('Processing checkout.completed:', data);
    // For checkout completed, we typically also process it as a payment success
    await processPaymentSuccess(data);
  } catch (error) {
    console.error('Error handling checkout.completed:', error);
    throw error;
  }
}

// Core payment success processing logic
async function processPaymentSuccess(data: DodoWebhookData) {
  const { customer, metadata, product_cart, line_items, amount, currency, transaction_id, subscription_id, payment_id } = data;
  const userId = metadata?.user_id;
  const planType = metadata?.plan_type;

  if (!userId) {
    console.error('No user_id in webhook metadata');
    throw new Error('Missing user_id in webhook metadata');
  }

  // Determine plan from line items, product cart, metadata, or fallback
  let plan: SubscriptionPlan = planType || 'monthly';
  
  // Check product_cart first (DodoPayments format), then line_items for compatibility
  const productItems = product_cart || line_items;
  if (!planType && productItems && productItems.length > 0) {
    const productId = productItems[0].product_id;
    plan = PRODUCT_ID_TO_PLAN[productId] || 'monthly';
    console.log(`Plan determined from product ID ${productId}: ${plan}`);
  }

  // Use subscription_id, payment_id, or transaction_id as external identifier
  const externalId = subscription_id || payment_id || transaction_id;
  
  if (!externalId) {
    console.error('No external identifier found in webhook data');
    throw new Error('Missing external identifier (subscription_id, payment_id, or transaction_id)');
  }

  // Check for duplicate processing
  const existingSubscription = await Subscription.findOne({
    externalSubscriptionId: externalId,
    paymentProvider: 'dodopayments'
  });
  
  if (existingSubscription) {
    console.log('Subscription already exists, checking if linked to user');
    
    const user = await User.findOne({ clerkId: userId });
    if (user && user.currentSubscription?.toString() === existingSubscription._id.toString()) {
      console.log('Subscription already processed and linked');
      return;
    } else if (user) {
      // Link existing subscription to user
      user.currentSubscription = existingSubscription._id;
      await user.save();
      console.log('Linked existing subscription to user');
      return;
    }
  }

  // Find or create user
  let user = await User.findOne({ clerkId: userId });
  if (!user) {
    console.log('Creating new user from webhook data');
    user = await (User as IUserModel).createWithFreeSubscription({
      clerkId: userId,
      email: customer?.email || 'unknown@example.com',
      firstName: customer?.name?.split(' ')[0] || '',
      lastName: customer?.name?.split(' ').slice(1).join(' ') || '',
      buttonCount: 0,
      isActive: true,
      preferences: {
        defaultAiProvider: 'chatgpt',
        theme: 'light',
        notifications: true,
      },
    });
  }

  // Calculate amount if not provided directly
  let totalAmount = amount || 0;
  const paymentItems = product_cart || line_items;
  if (!totalAmount && paymentItems) {
    totalAmount = paymentItems.reduce((sum, item) => sum + (item.total_amount || item.unit_amount * item.quantity), 0);
  }

  // Process the subscription upgrade with retry logic
  const maxRetries = 3;
  let upgradeResult;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      upgradeResult = await SubscriptionService.processUpgrade({
        userId: user._id,
        newPlan: plan,
        paymentProvider: 'dodopayments',
        externalSubscriptionId: externalId,
        externalCustomerId: customer?.id || data.customer_id,
        transactionId: transaction_id || payment_id,
        amount: totalAmount,
        currency: currency || 'USD',
      });

      if (upgradeResult.success) {
        console.log(`Successfully upgraded user ${userId} to ${plan} plan on attempt ${attempt}`);
        break;
      } else {
        console.error(`Upgrade attempt ${attempt} failed:`, upgradeResult.error);
        if (attempt === maxRetries) {
          throw new Error(upgradeResult.error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error) {
      console.error(`Upgrade attempt ${attempt} threw error:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  if (!upgradeResult?.success) {
    throw new Error('All upgrade attempts failed');
  }
}

async function handleSubscriptionCreated(data: DodoWebhookData) {
  console.log('Subscription created:', data);
  // For subscription.created, we might want to process it similar to payment success
  // but this depends on your business logic
  try {
    if (data.subscription_id) {
      await processPaymentSuccess(data);
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
    // Don't throw here as this might be duplicate processing
  }
}

async function handleSubscriptionUpdated(data: DodoWebhookData) {
  try {
    console.log('Subscription updated:', data);

    const { subscription_id, status } = data;
    
    if (!subscription_id) {
      console.error('No subscription_id in webhook data');
      return;
    }

    const subscription = await Subscription.findOne({ 
      externalSubscriptionId: subscription_id 
    }).populate('userId');

    if (!subscription) {
      console.error(`Subscription not found: ${subscription_id}`);
      return;
    }

    // Update subscription status based on webhook data
    let newStatus = subscription.status;
    if (status === 'active') {
      newStatus = 'active';
    } else if (status === 'cancelled' || status === 'canceled') {
      newStatus = 'cancelled';
    } else if (status === 'expired') {
      newStatus = 'expired';
    } else if (status === 'pending') {
      newStatus = 'pending';
    }

    if (newStatus !== subscription.status) {
      subscription.status = newStatus as 'active' | 'cancelled' | 'expired' | 'pending';
      subscription.metadata = {
        ...subscription.metadata,
        lastWebhookUpdate: new Date(),
        webhookEventType: 'subscription.updated',
        webhookData: data,
      };

      await subscription.save();
      console.log(`Updated subscription ${subscription_id} status from ${subscription.status} to ${newStatus}`);
    }

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionRenewed(data: DodoWebhookData) {
  try {
    console.log('Subscription renewed:', data);
    
    const { subscription_id, next_billing_date } = data;
    
    if (!subscription_id) {
      console.error('No subscription_id in webhook data');
      return;
    }

    const subscription = await Subscription.findOne({ 
      externalSubscriptionId: subscription_id 
    });

    if (!subscription) {
      console.error(`Subscription not found: ${subscription_id}`);
      return;
    }

    // Update next billing date and ensure subscription is active
    subscription.status = 'active';
    if (next_billing_date) {
      subscription.nextBillingDate = new Date(next_billing_date);
    }
    
    subscription.metadata = {
      ...subscription.metadata,
      lastRenewal: new Date(),
      webhookEventType: 'subscription.renewed',
    };

    await subscription.save();
    console.log(`Renewed subscription ${subscription_id}`);

  } catch (error) {
    console.error('Error handling subscription renewal:', error);
  }
}

async function handleSubscriptionPlanChanged(data: DodoWebhookData) {
  try {
    console.log('Subscription plan changed:', data);
    
    // This webhook indicates a plan change - process as a new subscription
    await processPaymentSuccess(data);

  } catch (error) {
    console.error('Error handling subscription plan change:', error);
  }
}

async function handleSubscriptionCancelled(data: DodoWebhookData) {
  try {
    console.log('Subscription cancelled/expired:', data);

    const { subscription_id } = data;
    
    if (!subscription_id) {
      console.error('No subscription_id in webhook data');
      return;
    }

    // Find and cancel subscription using our service
    const result = await SubscriptionService.cancelSubscription(
      subscription_id,
      'payment_provider_cancelled'
    );

    if (!result.success) {
      console.error(`Failed to cancel subscription: ${result.error}`);
      return;
    }

    console.log(`Successfully cancelled subscription ${subscription_id}`);

  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handlePaymentFailed(data: DodoWebhookData) {
  try {
    console.log('Payment failed:', data);

    const { subscription_id, payment_id, metadata, customer } = data;
    const userId = metadata?.user_id;

    // Log the failure for monitoring
    console.error(`Payment failed for user ${userId}, subscription ${subscription_id}, payment ${payment_id}`);

    // You might want to:
    // 1. Send email notification to user
    // 2. Update subscription status to 'failed'
    // 3. Set up retry logic
    // 4. Downgrade user to free tier after grace period

    // For now, just log additional details
    if (customer?.email) {
      console.error(`Failed payment for customer: ${customer.email}`);
    }

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handlePaymentRefunded(data: DodoWebhookData) {
  try {
    console.log('Payment refunded:', data);
    
    const { payment_id, amount } = data;
    
    console.log(`Refund processed for payment ${payment_id}, amount: ${amount}`);
    
    // Handle refund logic here
    // You might want to:
    // 1. Update subscription status if it's a subscription refund
    // 2. Send notification to user
    // 3. Update internal records

  } catch (error) {
    console.error('Error handling payment refund:', error);
  }
}

async function handleDisputeCreated(data: DodoWebhookData) {
  try {
    console.log('Dispute created:', data);
    
    // Handle dispute creation
    // You might want to:
    // 1. Send notification to admin
    // 2. Temporarily suspend related subscription
    // 3. Log for manual review

  } catch (error) {
    console.error('Error handling dispute creation:', error);
  }
}

// GET endpoint for webhook verification/testing
export async function GET() {
  return NextResponse.json({
    message: 'DodoPayments webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
