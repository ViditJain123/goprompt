const mongoose = require('mongoose');

async function testConnection() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newsletterbutton';
  
  console.log('Testing MongoDB connection...');
  console.log('URI:', MONGODB_URI.split('@')[1] || MONGODB_URI);
  
  try {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 10000
      },
      readPreference: 'primary',
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 10000,
      retryDelay: 1000,
      maxRetries: 3,
    };

    console.log('Connection options:', JSON.stringify(opts, null, 2));
    
    const conn = await mongoose.connect(MONGODB_URI, opts);
    console.log('✅ Connected to MongoDB successfully!');
    
    // Test basic operations
    console.log('Testing basic operations...');
    
    // Test write operation
    const testCollection = conn.connection.db.collection('test_connection');
    await testCollection.insertOne({ test: true, timestamp: new Date() });
    console.log('✅ Write operation successful');
    
    // Test read operation
    const result = await testCollection.findOne({ test: true });
    console.log('✅ Read operation successful:', result);
    
    // Clean up
    await testCollection.deleteOne({ test: true });
    console.log('✅ Cleanup successful');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

// Add connection event listeners
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('close', () => {
  console.log('MongoDB connection closed');
});

testConnection();


