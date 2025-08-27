// Manual subscription fix script
// This script simulates the subscription webhook to fix the user's subscription

const SUBSCRIPTION_ID = 'sub_3hoXhd6lhG9OY8xOB2rBS';
const USER_EMAIL = 'f20220942@goa.bits-pilani.ac.in';
const PLAN = 'monthly'; // Assuming monthly plan

console.log('Manual subscription fix script');
console.log(`Fixing subscription for user: ${USER_EMAIL}`);
console.log(`Subscription ID: ${SUBSCRIPTION_ID}`);
console.log(`Plan: ${PLAN}`);

// Simulate the webhook payload
const webhookPayload = {
  type: 'payment.succeeded',
  data: {
    subscription_id: SUBSCRIPTION_ID,
    customer: {
      email: USER_EMAIL,
      name: 'Test User',
    },
    metadata: {
      user_id: 'user_2pGe9E4GZz6m7rlXPwBYO0iHTnJ', // This would need to be the actual clerk ID
      plan_type: PLAN,
    },
    product_cart: [{
      product_id: 'pdt_kwbHw53PPUcSUCzDfQe5T', // Monthly plan product ID
    }],
    amount: 5000, // $50 in cents
    currency: 'USD',
    transaction_id: `tx_${Date.now()}`,
  }
};

console.log('\nSimulated webhook payload:');
console.log(JSON.stringify(webhookPayload, null, 2));

// Instructions for manual fix
console.log('\n=== MANUAL FIX STEPS ===');
console.log('1. Open the application in a browser while logged in as the affected user');
console.log('2. Open browser dev tools and go to Console');
console.log('3. Run the following code to manually trigger the subscription update:');
console.log('\n// Manual subscription update');
console.log(`fetch('/api/users/subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subscriptionId: '${SUBSCRIPTION_ID}',
    status: 'active',
    planType: '${PLAN}',
    amount: 5000,
    currency: 'USD'
  })
}).then(response => response.json()).then(data => console.log('Response:', data));`);

console.log('\n4. This should create the subscription and link it to the user');
console.log('5. Refresh the page to see the updated subscription status');
