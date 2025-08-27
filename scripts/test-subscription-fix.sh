#!/bin/bash

# Test script to verify subscription fix
echo "=== Subscription Fix Test ==="
echo ""

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server is running on localhost:3000"
else
    echo "❌ Server is not running. Please start with: npm run dev"
    exit 1
fi

echo ""
echo "🔧 Manual fix instructions:"
echo ""
echo "1. Open browser and go to: http://localhost:3000"
echo "2. Log in as the affected user (f20220942@goa.bits-pilani.ac.in)"
echo "3. Open browser console (F12 → Console)"
echo "4. Run this code:"
echo ""
echo "fetch('/api/subscription-fix', {"
echo "  method: 'POST',"
echo "  headers: { 'Content-Type': 'application/json' },"
echo "  body: JSON.stringify({"
echo "    subscriptionId: 'sub_3hoXhd6lhG9OY8xOB2rBS',"
echo "    plan: 'monthly',"
echo "    forceUpdate: true"
echo "  })"
echo "}).then(r => r.json()).then(d => {"
echo "  console.log('Result:', d);"
echo "  if (d.success) {"
echo "    alert('Fixed! Reloading...');"
echo "    window.location.reload();"
echo "  } else {"
echo "    alert('Error: ' + d.error);"
echo "  }"
echo "});"
echo ""
echo "5. Wait for success message and page reload"
echo ""
echo "💡 Alternatively, visit this URL with payment success params:"
echo "   http://localhost:3000/?payment=success&status=active&subscription_id=sub_3hoXhd6lhG9OY8xOB2rBS&plan=monthly"
echo ""
echo "This should automatically trigger the fix logic."
