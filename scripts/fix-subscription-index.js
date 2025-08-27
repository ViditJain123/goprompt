/**
 * Script to fix the problematic unique index on subscriptions collection
 * This script will drop the old unique index that's causing duplicate key errors
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newsletterbutton';

async function fixSubscriptionIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    // Get current indexes
    console.log('\nCurrent indexes on subscriptions collection:');
    const indexes = await subscriptionsCollection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
      if (index.unique) {
        console.log('   ^ UNIQUE INDEX');
      }
    });

    // Check for the problematic index
    const problematicIndex = indexes.find(index => 
      index.name.includes('userId_1_plan_1_status_1') || 
      (index.key.userId === 1 && index.key.plan === 1 && index.key.status === 1)
    );

    if (problematicIndex) {
      console.log(`\nFound problematic unique index: ${problematicIndex.name}`);
      console.log('Dropping this index...');
      
      try {
        await subscriptionsCollection.dropIndex(problematicIndex.name);
        console.log('✅ Successfully dropped the problematic index');
      } catch (error) {
        if (error.code === 27) {
          console.log('Index not found (already dropped)');
        } else {
          console.error('Error dropping index:', error.message);
        }
      }
    } else {
      console.log('\n✅ No problematic unique index found');
    }

    // Show final indexes
    console.log('\nFinal indexes on subscriptions collection:');
    const finalIndexes = await subscriptionsCollection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
      if (index.unique) {
        console.log('   ^ UNIQUE INDEX');
      }
    });

    console.log('\n✅ Index fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing subscription index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixSubscriptionIndex()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSubscriptionIndex };
