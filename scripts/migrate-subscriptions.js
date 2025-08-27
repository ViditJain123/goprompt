/**
 * Migration script to convert existing users to the new subscription system
 * 
 * This script should be run once to migrate existing users from the old subscription
 * format to the new Subscription model.
 * 
 * Usage: node scripts/migrate-subscriptions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models (adjust paths as needed)
const User = require('../src/models/User').default;
const Subscription = require('../src/models/Subscription').default;

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function migrateUsers() {
  try {
    console.log('Starting user migration...');

    // Find all users with old subscription format
    const usersToMigrate = await User.find({
      $or: [
        { subscriptionTier: { $exists: true } },
        { subscriptionStatus: { $exists: true } },
        { currentSubscription: { $exists: false } }
      ]
    });

    console.log(`Found ${usersToMigrate.length} users to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      try {
        console.log(`Migrating user: ${user.clerkId}`);

        // Skip if user already has a current subscription
        if (user.currentSubscription) {
          console.log(`User ${user.clerkId} already has currentSubscription, skipping`);
          continue;
        }

        // Determine the plan based on old subscription data
        let plan = 'free';
        let status = 'active';
        let amount = 0;
        let billingCycle = 'lifetime';
        let endDate = null;

        // Map old subscription tiers to new plans
        if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'premium') {
          // Assume these are monthly subscriptions if no end date
          plan = 'monthly';
          amount = 5000; // $50
          billingCycle = 'monthly';
          
          // If there's an end date, use it; otherwise set to 1 month from start date
          if (user.subscriptionEndDate) {
            endDate = user.subscriptionEndDate;
          } else if (user.subscriptionStartDate) {
            endDate = new Date(user.subscriptionStartDate);
            endDate.setMonth(endDate.getMonth() + 1);
          } else {
            // Default to 1 month from now
            endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
          }
        } else if (user.subscriptionTier === 'enterprise') {
          plan = 'yearly';
          amount = 49900; // $499
          billingCycle = 'yearly';
          
          if (user.subscriptionEndDate) {
            endDate = user.subscriptionEndDate;
          } else if (user.subscriptionStartDate) {
            endDate = new Date(user.subscriptionStartDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else {
            endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);
          }
        }

        // Check if subscription is expired
        if (endDate && endDate <= new Date() && plan !== 'free') {
          status = 'expired';
        }

        // Create new subscription
        const subscriptionData = {
          userId: user._id,
          plan,
          status,
          startDate: user.subscriptionStartDate || user.createdAt || new Date(),
          paymentProvider: 'manual', // Since we're migrating existing data
          amount,
          currency: 'USD',
          billingCycle,
          metadata: {
            migratedFrom: 'legacy_system',
            migrationDate: new Date(),
            oldSubscriptionTier: user.subscriptionTier,
            oldSubscriptionStatus: user.subscriptionStatus,
            oldSubscriptionId: user.subscriptionId,
            oldSubscriptionData: user.subscriptionData,
          },
        };

        if (endDate) {
          subscriptionData.endDate = endDate;
          if (plan !== 'lifetime' && status === 'active') {
            subscriptionData.nextBillingDate = endDate;
          }
        }

        const subscription = new Subscription(subscriptionData);
        await subscription.save();

        // Update user to reference the new subscription
        user.currentSubscription = subscription._id;
        
        // Clean up old subscription fields (optional - you might want to keep them for reference)
        // user.subscriptionTier = undefined;
        // user.subscriptionStatus = undefined;
        // user.subscriptionId = undefined;
        // user.subscriptionData = undefined;
        // user.subscriptionStartDate = undefined;
        // user.subscriptionEndDate = undefined;
        // user.maxButtons = undefined;

        await user.save();

        console.log(`✅ Migrated user ${user.clerkId} to ${plan} plan`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating user ${user.clerkId}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total users processed: ${usersToMigrate.length}`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️ Migration completed with some errors. Please review the logs.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function verifyMigration() {
  try {
    console.log('\n=== Verification ===');

    const totalUsers = await User.countDocuments();
    const usersWithSubscriptions = await User.countDocuments({ currentSubscription: { $exists: true } });
    const totalSubscriptions = await Subscription.countDocuments();

    console.log(`Total users: ${totalUsers}`);
    console.log(`Users with subscriptions: ${usersWithSubscriptions}`);
    console.log(`Total subscriptions: ${totalSubscriptions}`);

    // Count subscriptions by plan
    const subscriptionCounts = await Subscription.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\nSubscription counts by plan:');
    subscriptionCounts.forEach(({ _id, count }) => {
      console.log(`  ${_id}: ${count}`);
    });

  } catch (error) {
    console.error('Verification failed:', error);
  }
}

async function main() {
  try {
    await connectDB();
    
    console.log('🚀 Starting subscription migration...\n');
    
    await migrateUsers();
    await verifyMigration();
    
    console.log('\n✨ Migration process completed!');
    
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { migrateUsers, verifyMigration };
