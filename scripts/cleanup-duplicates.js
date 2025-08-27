const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newsletterbutton';

async function cleanupDuplicates() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('Connected to MongoDB');
    
    // Find duplicate free subscriptions with null externalSubscriptionId
    const duplicates = await mongoose.connection.db.collection('subscriptions').aggregate([
      {
        $match: {
          paymentProvider: 'manual',
          externalSubscriptionId: null
        }
      },
      {
        $group: {
          _id: {
            externalSubscriptionId: '$externalSubscriptionId',
            paymentProvider: '$paymentProvider'
          },
          count: { $sum: 1 },
          docs: { $push: { _id: '$_id', userId: '$userId', createdAt: '$createdAt' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();
    
    console.log(`Found ${duplicates.length} sets of duplicate free subscriptions`);
    
    for (const dup of duplicates) {
      console.log(`Processing ${dup.count} duplicates for null externalSubscriptionId...`);
      
      // Sort by createdAt and keep the latest one
      dup.docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const toKeep = dup.docs[0];
      const toDelete = dup.docs.slice(1);
      
      console.log(`Keeping subscription ${toKeep._id} for user ${toKeep.userId}`);
      
      if (toDelete.length > 0) {
        const idsToDelete = toDelete.map(doc => doc._id);
        const result = await mongoose.connection.db.collection('subscriptions').deleteMany({
          _id: { $in: idsToDelete }
        });
        console.log(`Deleted ${result.deletedCount} duplicate subscriptions`);
      }
    }
    
    console.log('Cleanup completed successfully');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupDuplicates().catch(console.error);
