import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.ts';
import Subscription from '../src/models/Subscription.ts';

dotenv.config({ path: '.env.local' });

async function debugUserSubscription() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the specific user
    const userEmail = 'f20220942@goa.bits-pilani.ac.in';
    const user = await User.findOne({ email: userEmail }).populate('currentSubscription');
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('\n=== USER DETAILS ===');
    console.log('User ID:', user._id);
    console.log('Clerk ID:', user.clerkId);
    console.log('Email:', user.email);
    console.log('Current Subscription ID:', user.currentSubscription?._id || 'None');
    console.log('Current Subscription Plan:', user.currentSubscription?.plan || 'None');

    // Get all subscriptions for this user
    const allSubscriptions = await Subscription.find({ userId: user._id })
      .sort({ createdAt: -1 });

    console.log('\n=== ALL SUBSCRIPTIONS ===');
    console.log('Total subscriptions found:', allSubscriptions.length);
    
    for (const sub of allSubscriptions) {
      console.log(`\nSubscription ID: ${sub._id}`);
      console.log(`Plan: ${sub.plan}`);
      console.log(`Status: ${sub.status}`);
      console.log(`Created: ${sub.createdAt}`);
      console.log(`Start Date: ${sub.startDate}`);
      console.log(`End Date: ${sub.endDate || 'N/A'}`);
      console.log(`External Sub ID: ${sub.externalSubscriptionId || 'N/A'}`);
      console.log(`Payment Provider: ${sub.paymentProvider}`);
      console.log(`Amount: ${sub.amount} ${sub.currency}`);
      console.log(`Is Active: ${sub.isActive()}`);
      console.log(`Metadata:`, JSON.stringify(sub.metadata, null, 2));
    }

    // Check for any subscriptions with the specific external ID
    const subscriptionId = 'sub_3hoXhd6lhG9OY8xOB2rBS';
    const matchingSubscription = await Subscription.findOne({ 
      externalSubscriptionId: subscriptionId 
    });

    console.log('\n=== SPECIFIC SUBSCRIPTION CHECK ===');
    console.log(`Looking for subscription ID: ${subscriptionId}`);
    if (matchingSubscription) {
      console.log('Found matching subscription:');
      console.log(`ID: ${matchingSubscription._id}`);
      console.log(`User ID: ${matchingSubscription.userId}`);
      console.log(`Plan: ${matchingSubscription.plan}`);
      console.log(`Status: ${matchingSubscription.status}`);
      console.log(`Is Active: ${matchingSubscription.isActive()}`);
    } else {
      console.log('No subscription found with that external ID');
    }

    // Get subscription details using the user method
    console.log('\n=== SUBSCRIPTION DETAILS FROM USER METHOD ===');
    const subDetails = await user.getSubscriptionDetails();
    console.log('Subscription details:', JSON.stringify(subDetails, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugUserSubscription();
