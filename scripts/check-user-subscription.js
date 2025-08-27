const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Define schemas inline for this script
const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['free', 'monthly', 'yearly', 'lifetime'], required: true },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'past_due'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  externalSubscriptionId: { type: String },
  paymentProvider: { type: String, enum: ['dodopayments', 'stripe', 'manual'] },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

const UserSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: { type: String },
  lastName: { type: String },
  currentSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  buttonCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  preferences: {
    defaultAiProvider: { type: String, enum: ['chatgpt', 'claude'], default: 'chatgpt' },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    notifications: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);

async function checkUserSubscription() {
  try {
    await connectDB();
    
    // Find all users with their current subscriptions
    const users = await User.find({}).populate('currentSubscription').limit(5);
    
    console.log('\n=== USER SUBSCRIPTION STATUS ===\n');
    
    for (const user of users) {
      console.log(`User: ${user.email} (${user.clerkId})`);
      console.log(`Current Subscription ID: ${user.currentSubscription?._id || 'None'}`);
      
      if (user.currentSubscription) {
        const sub = user.currentSubscription;
        console.log(`  Plan: ${sub.plan}`);
        console.log(`  Status: ${sub.status}`);
        console.log(`  Created: ${sub.createdAt}`);
        console.log(`  External ID: ${sub.externalSubscriptionId || 'None'}`);
        console.log(`  Metadata: ${JSON.stringify(sub.metadata, null, 2)}`);
      }
      
      // Get all subscriptions for this user
      const allSubs = await Subscription.find({ userId: user._id }).sort({ createdAt: -1 });
      console.log(`  Total subscriptions: ${allSubs.length}`);
      
      if (allSubs.length > 0) {
        console.log(`  Recent subscriptions:`);
        allSubs.slice(0, 3).forEach((sub, index) => {
          console.log(`    ${index + 1}. ${sub.plan} (${sub.status}) - ${sub.createdAt} - External: ${sub.externalSubscriptionId || 'None'}`);
        });
        
        // Check for lifetime subscriptions
        const lifetimeSubs = allSubs.filter(sub => sub.plan === 'lifetime');
        if (lifetimeSubs.length > 0) {
          console.log(`  🚨 LIFETIME SUBSCRIPTIONS FOUND:`);
          lifetimeSubs.forEach((sub, index) => {
            console.log(`    ${index + 1}. Status: ${sub.status}, Created: ${sub.createdAt}, External: ${sub.externalSubscriptionId}`);
            console.log(`        Current subscription points to: ${user.currentSubscription?._id}`);
            console.log(`        This lifetime sub ID: ${sub._id}`);
            console.log(`        MATCH: ${user.currentSubscription?._id?.toString() === sub._id.toString()}`);
          });
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('Error checking user subscriptions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkUserSubscription();
