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

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);

async function checkLifetimeSubscriptions() {
  try {
    await connectDB();
    
    // Find all lifetime subscriptions
    const lifetimeSubscriptions = await Subscription.find({ plan: 'lifetime' }).sort({ createdAt: -1 });
    
    console.log('\n=== LIFETIME SUBSCRIPTIONS ===\n');
    console.log(`Total lifetime subscriptions found: ${lifetimeSubscriptions.length}`);
    
    for (const sub of lifetimeSubscriptions) {
      console.log(`Lifetime Subscription ID: ${sub._id}`);
      console.log(`  User ID: ${sub.userId}`);
      console.log(`  Status: ${sub.status}`);
      console.log(`  Created: ${sub.createdAt}`);
      console.log(`  External ID: ${sub.externalSubscriptionId}`);
      console.log(`  Payment Provider: ${sub.paymentProvider}`);
      console.log(`  Amount: ${sub.amount}`);
      console.log(`  Metadata:`, JSON.stringify(sub.metadata, null, 2));
      console.log('\n' + '-'.repeat(50) + '\n');
    }
    
    // Check for recent subscriptions with external payment IDs from the logs
    const recentPaymentIds = ['pay_JWo7d43CjMbOajsxEVneE', 'pay_UVLZgmy3roC2y5fna9HfB'];
    
    console.log('\n=== CHECKING FOR RECENT PAYMENT IDs ===\n');
    
    for (const paymentId of recentPaymentIds) {
      const subsWithPaymentId = await Subscription.find({
        $or: [
          { externalSubscriptionId: paymentId },
          { 'metadata.transactionId': paymentId }
        ]
      });
      
      console.log(`Payment ID ${paymentId}:`);
      if (subsWithPaymentId.length === 0) {
        console.log('  ❌ No subscriptions found with this payment ID');
      } else {
        subsWithPaymentId.forEach(sub => {
          console.log(`  ✅ Found subscription: ${sub._id}, Plan: ${sub.plan}, Status: ${sub.status}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking lifetime subscriptions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkLifetimeSubscriptions();
