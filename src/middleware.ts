import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/users/subscription', // Allow subscription webhooks
  '/api/create-checkout', // Allow checkout creation
]);

const isApiRoute = createRouteMatcher(['/api/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Skip subscription checks for public routes and auth routes
  if (isPublicRoute(req) || req.nextUrl.pathname.startsWith('/_next') || req.nextUrl.pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check subscription status for protected routes
  try {
    const { userId } = await auth();
    
    if (userId && isApiRoute(req)) {
      // Only check subscription for API routes that require active subscription
      const protectedApiRoutes = ['/api/buttons'];
      const isProtectedApi = protectedApiRoutes.some(route => 
        req.nextUrl.pathname.startsWith(route)
      );

      if (isProtectedApi) {
        try {
          // Dynamically import to avoid module loading issues
          const dbConnect = (await import('@/lib/db')).default;
          const User = (await import('@/models/User')).default;
          
          await dbConnect();
          const user = await User.findOne({ clerkId: userId });
          
          if (user) {
            const subscriptionDetails = await user.getSubscriptionDetails();
            
            // Check if subscription is expired
            if (!subscriptionDetails.isActive && subscriptionDetails.plan !== 'free') {
              return NextResponse.json({
                error: 'Subscription expired',
                details: 'Your subscription has expired. Please upgrade to continue using this feature.',
                subscriptionStatus: subscriptionDetails.status,
                plan: subscriptionDetails.plan,
                expiredDate: subscriptionDetails.endDate,
              }, { status: 402 }); // 402 Payment Required
            }

            // Button limits removed - unlimited button creation for all users

            // Add subscription info to headers for API routes
            const response = NextResponse.next();
            response.headers.set('x-subscription-plan', subscriptionDetails.plan);
            response.headers.set('x-subscription-status', subscriptionDetails.status);
            response.headers.set('x-max-buttons', subscriptionDetails.maxButtons.toString());
            response.headers.set('x-current-buttons', user.buttonCount.toString());
            
            if (subscriptionDetails.daysUntilExpiry !== null) {
              response.headers.set('x-days-until-expiry', subscriptionDetails.daysUntilExpiry.toString());
            }
            
            return response;
          }
        } catch (error) {
          console.error('Middleware subscription check error:', error);
          // Continue without subscription checks if there's an error
        }
      }
    }
  } catch (error) {
    console.error('Middleware subscription check error:', error);
    // Don't block the request on middleware errors, just log them
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

