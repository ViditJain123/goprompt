import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User, { IUserModel } from '@/models/User';

// GET /api/users - Get current user info
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    let user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      // User not found in our database, let's get their info from Clerk and create them
      console.log(`User not found in database for clerkId: ${userId}, attempting to create...`);
      
      try {
        const clerkUser = await currentUser();
        
        if (!clerkUser) {
          console.log('No Clerk user found');
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Create user with free subscription using Clerk data
        user = await (User as IUserModel).createWithFreeSubscription({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          buttonCount: 0,
          isActive: true,
          preferences: {
            defaultAiProvider: 'chatgpt',
            theme: 'light',
            notifications: true,
          },
        });

        console.log(`User created successfully with ID: ${user._id}`);
      } catch (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
    }

    // Force refresh user data from database to ensure we have latest subscription info
    user = await User.findById(user._id);
    if (!user) {
      return NextResponse.json({ error: 'User not found after refresh' }, { status: 404 });
    }

    console.log(`GET /api/users: User ${user.email} has currentSubscription: ${user.currentSubscription}`);

    // Get subscription details
    const subscriptionDetails = await user.getSubscriptionDetails();

    return NextResponse.json({
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      subscriptionStatus: subscriptionDetails.status,
      subscriptionTier: subscriptionDetails.plan,
      subscriptionPlan: subscriptionDetails.plan,
      buttonCount: user.buttonCount,
      maxButtons: subscriptionDetails.maxButtons,
      isActive: user.isActive,
      preferences: user.preferences,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      subscription: {
        plan: subscriptionDetails.plan,
        status: subscriptionDetails.status,
        isActive: subscriptionDetails.isActive,
        endDate: subscriptionDetails.endDate,
        daysUntilExpiry: subscriptionDetails.daysUntilExpiry,
        features: subscriptionDetails.features,
        maxButtons: subscriptionDetails.maxButtons,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users - Create new user (called when user first signs up)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Creating user for clerkId: ${userId}`);
    
    await dbConnect();
    
    // Check if user already exists
    const existingUser = await User.findOne({ clerkId: userId });
    if (existingUser) {
      console.log(`User already exists for clerkId: ${userId}`);
      // Return the existing user instead of an error
      const subscriptionDetails = await existingUser.getSubscriptionDetails();
      return NextResponse.json({
        message: 'User already exists',
        user: {
          id: existingUser._id,
          clerkId: existingUser.clerkId,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          subscriptionStatus: subscriptionDetails.status,
          subscriptionTier: subscriptionDetails.plan,
          subscriptionPlan: subscriptionDetails.plan,
          buttonCount: existingUser.buttonCount,
          maxButtons: subscriptionDetails.maxButtons,
          isActive: existingUser.isActive,
          preferences: existingUser.preferences,
          createdAt: existingUser.createdAt,
          subscription: subscriptionDetails,
        },
      }, { status: 200 });
    }

    const body = await request.json();
    const { email, firstName, lastName } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`Creating new user with email: ${email}`);

    // Create new user with free subscription
    const newUser = await (User as IUserModel).createWithFreeSubscription({
      clerkId: userId,
      email,
      firstName,
      lastName,
      buttonCount: 0,
      isActive: true,
      preferences: {
        defaultAiProvider: 'chatgpt',
        theme: 'light',
        notifications: true,
      },
    });

    console.log(`User created successfully with ID: ${newUser._id}`);

    // Get subscription details for response
    const subscriptionDetails = await newUser.getSubscriptionDetails();

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        clerkId: newUser.clerkId,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        subscriptionStatus: subscriptionDetails.status,
        subscriptionTier: subscriptionDetails.plan,
        subscriptionPlan: subscriptionDetails.plan,
        buttonCount: newUser.buttonCount,
        maxButtons: subscriptionDetails.maxButtons,
        isActive: newUser.isActive,
        preferences: newUser.preferences,
        createdAt: newUser.createdAt,
        subscription: subscriptionDetails,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating user:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Provide more specific error messages
    if (error instanceof Error && 'code' in error) {
      const mongoError = error as Error & { code?: number; codeName?: string };
      if (mongoError.code === 112 || mongoError.codeName === 'WriteConflict') {
        return NextResponse.json({ 
          error: 'Database write conflict. Please try again.',
          retry: true,
          code: 'WRITE_CONFLICT'
        }, { status: 409 });
      }
      
      if (mongoError.code === 11000) {
        return NextResponse.json({ 
          error: 'User already exists with this information.',
          code: 'DUPLICATE_USER'
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

// PUT /api/users - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, preferences } = body;

    // Update allowed fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (preferences) {
      if (preferences.defaultAiProvider) user.preferences.defaultAiProvider = preferences.defaultAiProvider;
      if (preferences.theme) user.preferences.theme = preferences.theme;
      if (preferences.notifications !== undefined) user.preferences.notifications = preferences.notifications;
    }

    await user.save();

    // Get updated subscription details
    const subscriptionDetails = await user.getSubscriptionDetails();

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionStatus: subscriptionDetails.status,
        subscriptionTier: subscriptionDetails.plan,
        subscriptionPlan: subscriptionDetails.plan,
        buttonCount: user.buttonCount,
        maxButtons: subscriptionDetails.maxButtons,
        isActive: user.isActive,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        subscription: subscriptionDetails,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/users - Legacy endpoint for subscription updates (deprecated - use /api/users/subscription instead)
export async function PATCH() {
  console.log('PATCH /api/users called - this endpoint is deprecated, use /api/users/subscription instead');
  
  return NextResponse.json({
    error: 'This endpoint is deprecated. Please use /api/users/subscription for subscription updates.',
    redirect: '/api/users/subscription'
  }, { status: 410 }); // 410 Gone - indicates deprecated endpoint
}

