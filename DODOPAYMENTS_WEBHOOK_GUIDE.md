# DodoPayments Webhook Setup Guide

This guide explains how to set up webhooks with DodoPayments according to their official documentation.

## Environment Variables

Add these to your `.env.local` file:

```bash
# DodoPayments API Configuration
DODOPAYMENT_API=your_dodo_api_key_here
DODOPAYMENTS_WEBHOOK_SECRET=your_webhook_signing_key_here

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

## Webhook Configuration in DodoPayments Dashboard

1. **Access Webhook Settings**
   - Navigate to `Settings > Webhooks` in your DodoPayments dashboard
   - Click "Create Webhook" or manage existing webhooks

2. **Webhook URL**
   ```
   https://your-domain.com/api/webhooks/dodopayments
   ```
   For development:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/dodopayments
   ```

3. **Events to Subscribe To**
   Select these webhook events according to the DodoPayments documentation:
   - `payment.succeeded` - When a payment is completed successfully
   - `payment.failed` - When a payment fails
   - `payment.refunded` - When a payment is refunded
   - `checkout.completed` - When a checkout session is completed
   - `subscription.created` - When a subscription is created
   - `subscription.updated` - When subscription details are updated
   - `subscription.renewed` - When a subscription is renewed
   - `subscription.plan_changed` - When subscription plan is changed
   - `subscription.cancelled` - When a subscription is cancelled
   - `subscription.expired` - When a subscription expires
   - `dispute.created` - When a dispute is created

4. **Get Webhook Signing Key**
   - After creating the webhook, copy the signing key
   - Add it to your `.env.local` as `DODOPAYMENTS_WEBHOOK_SECRET`

## Product ID Configuration

Update the product ID mapping in the webhook handler:

```typescript
// In src/app/api/webhooks/dodopayments/route.ts
const PRODUCT_ID_TO_PLAN: Record<string, SubscriptionPlan> = {
  'your_monthly_product_id': 'monthly',    
  'your_yearly_product_id': 'yearly',     
  'your_lifetime_product_id': 'lifetime',   
};
```

To find your product IDs:
1. Go to `Products` in your DodoPayments dashboard
2. Click on each product to view its details
3. Copy the Product ID (starts with `pdt_`)

## Webhook Event Types

According to the DodoPayments documentation, these are the main webhook events:

### Payment Events
- **payment.succeeded**: Payment completed successfully
- **payment.failed**: Payment failed
- **payment.pending**: Payment is pending
- **payment.refunded**: Payment was refunded

### Subscription Events
- **subscription.created**: New subscription created
- **subscription.updated**: Subscription details updated
- **subscription.renewed**: Subscription renewed (billing cycle)
- **subscription.plan_changed**: Subscription plan upgraded/downgraded
- **subscription.cancelled**: Subscription cancelled
- **subscription.expired**: Subscription expired

### Checkout Events
- **checkout.completed**: Checkout session completed
- **checkout.expired**: Checkout session expired

### Other Events
- **dispute.created**: Payment dispute created
- **dispute.updated**: Payment dispute updated
- **customer.created**: New customer created
- **customer.updated**: Customer information updated

## Webhook Payload Structure

Based on DodoPayments documentation, webhook payloads follow this structure:

```json
{
  "id": "evt_1234567890",
  "type": "payment.succeeded",
  "created_at": "2025-08-25T12:00:00Z",
  "api_version": "v1.51.0",
  "data": {
    "payment_id": "pay_1234567890",
    "subscription_id": "sub_1234567890",
    "customer_id": "cus_1234567890",
    "amount": 5000,
    "currency": "USD",
    "status": "succeeded",
    "customer": {
      "id": "cus_1234567890",
      "email": "customer@example.com",
      "name": "John Doe",
      "billing_address": {
        "country": "US",
        "state": "CA",
        "city": "San Francisco",
        "line1": "123 Main St",
        "postal_code": "94105"
      }
    },
    "line_items": [
      {
        "product_id": "pdt_1234567890",
        "product_name": "Monthly Subscription",
        "quantity": 1,
        "unit_amount": 5000,
        "total_amount": 5000
      }
    ],
    "metadata": {
      "user_id": "user_1234567890",
      "plan_type": "monthly"
    },
    "transaction_id": "txn_1234567890",
    "payment_method": "card",
    "billing_cycle": "monthly",
    "next_billing_date": "2025-09-25T12:00:00Z"
  }
}
```

## Testing Webhooks

### Using ngrok for Local Development

1. **Install ngrok**
   ```bash
   npm install -g ngrok
   # or
   brew install ngrok
   ```

2. **Start your Next.js server**
   ```bash
   npm run dev
   ```

3. **Expose localhost with ngrok**
   ```bash
   ngrok http 3000
   ```

4. **Update webhook URL in DodoPayments dashboard**
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/dodopayments
   ```

### Test Webhook Events

1. **Create a test payment** in DodoPayments dashboard
2. **Check webhook logs** in DodoPayments dashboard under `Settings > Webhooks > Webhook Logs`
3. **Monitor your application logs** for webhook processing

## Webhook Security

### Signature Verification

The webhook handler verifies signatures using HMAC-SHA256:

```typescript
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true;
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  
  const cleanSignature = signature.replace(/^sha256=/, '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(cleanSignature, 'hex')
  );
}
```

### Best Practices

1. **Always verify webhook signatures** in production
2. **Use HTTPS** for webhook URLs
3. **Implement idempotency** to handle duplicate events
4. **Log webhook events** for debugging
5. **Return 200 status** for successful processing
6. **Return 4xx/5xx status** for failures to trigger retries

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook URL is correct and accessible
   - Verify SSL certificate is valid
   - Check firewall settings

2. **Signature verification failing**
   - Ensure webhook secret is correct
   - Check signature header name (might be `dodo-signature` or `x-dodo-signature`)
   - Verify payload is not modified before verification

3. **Duplicate processing**
   - Implement idempotency checks using external IDs
   - Check for existing subscriptions before creating new ones

4. **Missing metadata**
   - Ensure `user_id` is passed in metadata when creating checkouts
   - Add `plan_type` to metadata for easier plan determination

### Debugging

1. **Enable verbose logging**
   ```typescript
   console.log('Webhook received:', JSON.stringify(event, null, 2));
   ```

2. **Check DodoPayments webhook logs**
   - Navigate to `Settings > Webhooks > Webhook Logs`
   - Check delivery status and response codes

3. **Test with webhook tester tools**
   - Use tools like `webhook.site` for testing
   - Send test events from DodoPayments dashboard

## Migration from Old Implementation

If you're migrating from an older webhook implementation:

1. **Update event type handling** to match DodoPayments documentation
2. **Update payload field names** (e.g., `product_cart` → `line_items`)
3. **Add new event handlers** for additional event types
4. **Update signature verification** if using different header names
5. **Test thoroughly** with test events before going live

## Support

- **DodoPayments Documentation**: https://docs.dodopayments.com
- **DodoPayments Support**: support@dodopayments.com
- **Webhook API Reference**: https://docs.dodopayments.com/api-reference/webhooks
