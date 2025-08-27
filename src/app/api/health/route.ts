import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Subscription from '@/models/Subscription';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Test database connection
    await dbConnect();
    const dbConnectionTime = Date.now() - startTime;
    
    // Test basic operations
    const userCount = await User.countDocuments();
    const subscriptionCount = await Subscription.countDocuments();
    
    // Test collection access
    const testUser = await User.findOne().limit(1);
    const testSubscription = await Subscription.findOne().limit(1);
    
    const totalTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        connectionTime: `${dbConnectionTime}ms`,
        totalTime: `${totalTime}ms`,
        collections: {
          users: {
            count: userCount,
            accessible: !!testUser || userCount === 0,
          },
          subscriptions: {
            count: subscriptionCount,
            accessible: !!testSubscription || subscriptionCount === 0,
          },
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasMongoUri: !!process.env.MONGODB_URI,
        mongoUriPreview: process.env.MONGODB_URI ? 
          `${process.env.MONGODB_URI.split('@')[0]}@***` : 
          'Not set (using default)',
      },
    });
  } catch (error: unknown) {
    console.error('Health check failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error && 'code' in error ? (error as Error & { code?: number }).code : undefined;
    const errorCodeName = error instanceof Error && 'codeName' in error ? (error as Error & { codeName?: string }).codeName : undefined;
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: {
        message: errorMessage,
        code: errorCode,
        codeName: errorCodeName,
      },
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasMongoUri: !!process.env.MONGODB_URI,
        mongoUriPreview: process.env.MONGODB_URI ? 
          `${process.env.MONGODB_URI.split('@')[0]}@***` : 
          'Not set (using default)',
      },
    }, { status: 500 });
  }
}
