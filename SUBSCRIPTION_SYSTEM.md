# Subscription System Documentation

This document describes the production-grade subscription system implemented for the Newsletter Button application.

## Overview

The subscription system supports multiple subscription tiers with proper upgrade paths, expiry handling, and payment integration with DodoPayments. Users can only upgrade to higher tiers (no downgrades allowed) and the system automatically handles expired subscriptions.

## Subscription Plans

### Available Plans
- **Free**: 5 buttons, basic features
- **Monthly**: 100 buttons, $50/month, all premium features
- **Yearly**: 500 buttons, $499/year (save $101), advanced features
- **Lifetime**: Unlimited buttons, $1299 one-time, all features forever

### Upgrade Path
Users can only upgrade in this order:
```
Free → Monthly → Yearly → Lifetime
```

Downgrades are not allowed to maintain revenue integrity.

## Architecture

### Models

#### Subscription Model (`src/models/Subscription.ts`)
- Stores subscription details including plan, status, dates, and payment info
- Supports multiple payment providers (DodoPayments, Stripe, manual)
- Includes metadata for tracking upgrades and payment details
- Provides methods for checking status, expiry, and upgrade eligibility

#### User Model (`src/models/User.ts`)
- References current active subscription
- Includes virtual methods for subscription details
- Supports atomic operations for subscription changes

### Services

#### SubscriptionService (`src/lib/subscriptionService.ts`)
- Handles subscription validation and upgrades
- Manages expired subscriptions
- Provides analytics and history tracking
- Ensures data consistency with transactions

## API Endpoints

### Subscription Management
- `POST /api/users/subscription` - Process subscription upgrades
- `GET /api/users/subscription` - Get current subscription details
- `POST /api/create-checkout` - Create payment checkout (with upgrade validation)

### Webhooks
- `POST /api/webhooks/dodopayments` - Handle payment provider webhooks
- `POST /api/cron/expire-subscriptions` - Handle expired subscriptions (cron job)

## Features

### Upgrade Validation
- Prevents downgrades and duplicate subscriptions
- Validates upgrade paths before payment processing
- Provides detailed error messages for invalid operations

### Expiry Handling
- Automatic detection of expired subscriptions
- Grace period management
- Automatic downgrade to free tier after expiry

### Payment Integration
- Secure webhook handling with signature verification
- Support for multiple payment providers
- Automatic subscription creation from successful payments

### Middleware Protection
- API route protection based on subscription status
- Button creation limits enforcement
- Subscription status headers for frontend use

### Frontend Integration
- Real-time subscription status display
- Upgrade recommendations based on usage
- Visual indicators for current plan and upgrade paths
- Expiry warnings and notifications

## Usage Examples

### Check if User Can Create Button
```typescript
const user = await User.findById(userId);
const canCreate = await user.canCreateButton();
```

### Process Subscription Upgrade
```typescript
const result = await SubscriptionService.processUpgrade({
  userId: user._id,
  newPlan: 'yearly',
  paymentProvider: 'dodopayments',
  externalSubscriptionId: 'sub_123',
  amount: 49900,
  currency: 'USD',
});
```

### Get Subscription Details
```typescript
const user = await User.findById(userId);
const details = await user.getSubscriptionDetails();
// Returns: { plan, status, maxButtons, features, isActive, endDate, daysUntilExpiry }
```

## Environment Variables

```env
MONGODB_URI=your_mongodb_connection_string
DODOPAYMENT_API=your_dodopayments_api_key
DODOPAYMENTS_WEBHOOK_SECRET=your_webhook_secret
CRON_SECRET=your_cron_job_secret
```

## Migration

For existing applications, run the migration script:

```bash
node scripts/migrate-subscriptions.js
```

This will:
- Convert existing users to the new subscription system
- Create appropriate Subscription records
- Preserve existing subscription data
- Provide migration summary and verification

## Monitoring and Maintenance

### Cron Jobs
Set up the following cron jobs:

1. **Expired Subscriptions** (daily)
   ```bash
   curl -X POST https://yourapp.com/api/cron/expire-subscriptions \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Health Check** (hourly)
   ```bash
   curl https://yourapp.com/api/cron/expire-subscriptions
   ```

### Monitoring Metrics
- Subscription conversion rates
- Churn rates by plan
- Failed payment rates
- API response times
- Error rates in webhook processing

## Security Considerations

1. **Webhook Verification**: All webhooks verify signatures to prevent fraud
2. **Upgrade Validation**: Server-side validation prevents unauthorized upgrades
3. **Transaction Safety**: All subscription changes use database transactions
4. **Rate Limiting**: API endpoints include rate limiting protection
5. **Input Validation**: All user inputs are validated and sanitized

## Error Handling

The system includes comprehensive error handling:
- Payment failures with retry logic
- Network timeout handling
- Database transaction rollbacks
- Graceful degradation for non-critical features
- Detailed logging for debugging

## Testing

### Unit Tests
```bash
npm run test:subscription
```

### Integration Tests
```bash
npm run test:integration
```

### Webhook Testing
Use the provided webhook endpoint for testing:
```bash
curl -X POST https://yourapp.com/api/webhooks/dodopayments \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.completed","data":{...}}'
```

## Troubleshooting

### Common Issues

1. **Subscription Not Updating After Payment**
   - Check webhook endpoint is reachable
   - Verify webhook signature configuration
   - Check logs for processing errors

2. **User Cannot Create Buttons**
   - Verify subscription is active
   - Check button count vs. limits
   - Ensure middleware is properly configured

3. **Upgrade Validation Failing**
   - Confirm current subscription status
   - Verify upgrade path is valid
   - Check for expired subscriptions

### Debugging

Enable debug logging:
```env
DEBUG=subscription:*
```

Check subscription status:
```javascript
const details = await user.getSubscriptionDetails();
console.log('Subscription details:', details);
```

## Performance Considerations

- Database indexes on subscription queries
- Caching of subscription details
- Efficient webhook processing
- Minimal middleware overhead
- Optimized subscription lookups

## Future Enhancements

- Multi-currency support
- Proration for mid-cycle upgrades
- Team/organization subscriptions
- Usage-based billing
- Advanced analytics dashboard
- Subscription pause/resume functionality

---

For technical support or questions about the subscription system, please refer to the codebase documentation or contact the development team.
