# Troubleshooting Guide

## Database Connection Issues

### Error: WriteConflict (Code 112)
This error occurs when MongoDB experiences concurrent write operations or collection schema changes.

**Solutions:**
1. **Check your MongoDB URI**: Ensure `MONGODB_URI` environment variable is set correctly
2. **Database name**: Make sure you're connecting to the right database (not 'test')
3. **Retry logic**: The application now includes automatic retry logic for write conflicts

### Environment Variables
Create a `.env.local` file in your project root with:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/newsletterbutton

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### MongoDB Connection Issues
1. **Local MongoDB**: Ensure MongoDB is running locally
2. **MongoDB Atlas**: Use the connection string from your Atlas dashboard
3. **Network**: Check firewall and network connectivity

### Collection Access Issues
The error "Unable to write to collection 'test.subscriptions'" suggests:
- Wrong database name in connection string
- Missing environment variable
- Database permissions issue

## Recent Improvements Made

### 1. Enhanced Database Connection
- Added retry logic for write conflicts
- Better connection pooling
- Improved error handling

### 2. User Creation Retry Logic
- Automatic retry for failed user creation
- Better handling of duplicate users
- Improved transaction management

### 3. Better Error Messages
- Specific error codes for different failure types
- Detailed logging for debugging
- User-friendly error responses

## Testing the Fix

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Check the console logs** for connection status

3. **Try creating a user again** - the retry logic should handle conflicts

## If Issues Persist

1. **Check MongoDB logs** for any server-side errors
2. **Verify database permissions** - ensure your user has read/write access
3. **Check for concurrent operations** - multiple signups happening simultaneously
4. **Database schema**: Ensure collections exist and have proper indexes

## Common MongoDB Commands

```bash
# Connect to MongoDB shell
mongosh

# List databases
show dbs

# Use your database
use newsletterbutton

# List collections
show collections

# Check user collection
db.users.find().limit(1)

# Check subscription collection
db.subscriptions.find().limit(1)
```
