import mongoose from 'mongoose';

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: CachedConnection | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newsletterbutton';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached?.conn) {
    return cached.conn;
  }

  if (!cached?.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      w: 'majority' as const,
      // Better connection handling for write conflicts
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      // Add write concern majority for better consistency
      writeConcern: {
        w: 'majority' as const,
        j: true,
        wtimeout: 10000
      },
      // Add read preference
      readPreference: 'primary' as const,
      // Add max idle time
      maxIdleTimeMS: 30000,
      // Add wait queue timeout
      waitQueueTimeoutMS: 10000,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Connected to MongoDB:', MONGODB_URI.split('@')[1] || MONGODB_URI);
      return mongoose;
    }).catch((error) => {
      console.error('MongoDB connection error:', error);
      cached!.promise = null;
      throw error;
    });
  }

  try {
    cached!.conn = await cached!.promise!;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

// Add connection event listeners
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Add connection pool monitoring
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('close', () => {
  console.log('MongoDB connection closed');
});

export default dbConnect;

// Utility function to retry operations that might encounter write conflicts
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on write conflicts
      if (error && typeof error === 'object' && 'code' in error) {
        const mongoError = error as { code?: number; codeName?: string };
        if (mongoError.code === 112 || mongoError.codeName === 'WriteConflict') {
          if (attempt < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 2000);
            console.log(`Write conflict detected, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }
      
      // For non-retryable errors, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

