import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { SubscriptionService } from '@/lib/subscriptionService';

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external service)
// to handle expired subscriptions automatically

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET; // Set this in your environment variables
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    console.log('Starting expired subscription cleanup...');

    // Handle expired subscriptions
    const result = await SubscriptionService.handleExpiredSubscriptions();

    console.log(`Processed ${result.processed} expired subscriptions`);
    
    if (result.errors.length > 0) {
      console.error('Errors during subscription cleanup:', result.errors);
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `Successfully processed ${result.processed} expired subscriptions`,
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check the status of the cron job
export async function GET() {
  try {
    await dbConnect();

    // Get subscriptions that will expire soon
    const expiringSubscriptions = await SubscriptionService.getExpiringSubscriptions(7);
    const expiringToday = await SubscriptionService.getExpiringSubscriptions(0);

    return NextResponse.json({
      status: 'healthy',
      expiringIn7Days: expiringSubscriptions.length,
      expiringToday: expiringToday.length,
      lastCheck: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
