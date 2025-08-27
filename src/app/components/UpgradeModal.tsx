'use client';

import { useState } from 'react';
import { X, Check, Sparkles, Zap, Crown, AlertTriangle } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useUser as useUserData } from '@/hooks/useUser';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Callback for when upgrade is successful
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'lifetime' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const { user: userData, canUpgradeTo, isSubscriptionExpiring, getUpgradeRecommendation } = useUserData();

  if (!isOpen) return null;

  const currentPlan = userData?.subscription?.plan || 'free';
  const upgradeRecommendation = getUpgradeRecommendation();
  const isExpiring = isSubscriptionExpiring();

  const plans = [
    {
      id: 'monthly' as const,
      name: 'Monthly',
      price: '$50',
      period: '/month',
      description: 'Perfect for getting started',
      icon: Sparkles,
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'from-blue-600 to-blue-700',
      features: [
        'Unlimited button generations',
        'All customization options',
        'Priority support',
        'Export to HTML/CSS',
        'Cancel anytime'
      ]
    },
    {
      id: 'yearly' as const,
      name: 'Yearly',
      price: '$499',
      period: '/year',
      description: 'Best value - Save $101',
      icon: Zap,
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'from-purple-600 to-purple-700',
      popular: true,
      features: [
        'Everything in Monthly',
        'Save $101 per year',
        'Advanced analytics',
        'Custom branding',
        'Priority email support',
        'Early access to new features'
      ]
    },
    {
      id: 'lifetime' as const,
      name: 'Lifetime',
      price: '$1299',
      period: 'one-time',
      description: 'Pay once, use forever',
      icon: Crown,
      color: 'from-gradient-to-r from-yellow-500 to-orange-500',
      hoverColor: 'from-yellow-600 to-orange-600',
      features: [
        'Everything in Yearly',
        'Lifetime access',
        'No recurring payments',
        'Future-proof investment',
        'VIP support channel',
        'Exclusive lifetime features'
      ]
    }
  ];

  const handleSelectPlan = async (planId: 'monthly' | 'yearly' | 'lifetime') => {
    if (!user) {
      setError('Please sign in to continue');
      return;
    }

    // Check if user can upgrade to this plan
    if (!canUpgradeTo(planId)) {
      const planNames = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' };
      setError(`You cannot ${currentPlan === planId ? 'select the same plan' : 'downgrade'} to ${planNames[planId]}. You can only upgrade to higher tier plans.`);
      return;
    }

    setSelectedPlan(planId);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: planId,
          userEmail: user.primaryEmailAddress?.emailAddress,
          userName: user.fullName || user.firstName || 'User',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Cannot upgrade to this plan') {
          setError(`${data.error}: ${data.details?.join(', ') || 'Invalid upgrade path'}`);
        } else {
          throw new Error(data.error || 'Failed to create checkout session');
        }
        return;
      }

      // Store the plan information in localStorage before redirecting
      // This will help us identify the correct plan when user returns from payment
      localStorage.setItem('pendingUpgrade', JSON.stringify({
        planType: planId,
        timestamp: Date.now(),
        userEmail: user.primaryEmailAddress?.emailAddress,
      }));

      // Redirect to DodoPayments checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSelectedPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {currentPlan === 'free' 
                ? 'Upgrade Your Experience' 
                : currentPlan === 'monthly'
                ? 'Upgrade to Save More'
                : currentPlan === 'yearly'
                ? 'Go Lifetime'
                : 'Upgrade Your Experience'
              }
            </h2>
            <p className="text-gray-600 text-lg">
              {currentPlan === 'free' 
                ? 'Choose the perfect plan for your needs'
                : currentPlan === 'monthly'
                ? 'Switch to yearly and save $101, or go lifetime forever'
                : currentPlan === 'yearly'
                ? 'Upgrade to lifetime access - pay once, use forever'
                : `Current plan: ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}`
              }
            </p>
            
            {/* Current subscription info */}
            {userData && currentPlan !== 'free' && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  You have {userData.subscription.maxButtons === -1 ? 'unlimited' : userData.subscription.maxButtons} buttons available
                  {userData.subscription.daysUntilExpiry && (
                    <span className={`ml-2 ${userData.subscription.daysUntilExpiry <= 7 ? 'text-orange-600 font-medium' : ''}`}>
                      • Expires in {userData.subscription.daysUntilExpiry} days
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Expiring warning */}
            {isExpiring && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <p className="text-orange-800 text-sm">
                  Your subscription expires soon! Upgrade now to avoid interruption.
                </p>
              </div>
            )}

            {/* Upgrade recommendation */}
            {upgradeRecommendation && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm font-medium">
                  💡 Recommended: {upgradeRecommendation.recommended.charAt(0).toUpperCase() + upgradeRecommendation.recommended.slice(1)}
                </p>
                <p className="text-green-700 text-xs mt-1">
                  {upgradeRecommendation.reason}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const IconComponent = plan.icon;
              const canUpgrade = canUpgradeTo(plan.id);
              const isCurrentPlan = currentPlan === plan.id;
              const isRecommended = upgradeRecommendation?.recommended === plan.id;
              
              // Enhanced logic for button states based on current plan
              let buttonText = '';
              let isDisabled = false;
              let buttonClass = '';
              
              if (isCurrentPlan) {
                buttonText = 'Current Plan';
                isDisabled = true;
                buttonClass = 'bg-blue-600 text-white cursor-default';
              } else if (!canUpgrade) {
                buttonText = 'Cannot Downgrade';
                isDisabled = true;
                buttonClass = 'bg-gray-300 text-gray-500 cursor-not-allowed';
              } else if (selectedPlan === plan.id && isLoading) {
                buttonText = 'Processing...';
                isDisabled = true;
                buttonClass = `text-white ${plan.popular ? 'bg-gradient-to-r from-purple-500 to-purple-600' : `bg-gradient-to-r ${plan.color}`}`;
              } else if (isLoading) {
                buttonText = 'Please wait...';
                isDisabled = true;
                buttonClass = 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50';
              } else {
                buttonText = `Upgrade to ${plan.name}`;
                isDisabled = false;
                buttonClass = `text-white transform hover:scale-105 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg'
                    : `bg-gradient-to-r ${plan.color} hover:${plan.hoverColor}`
                }`;
              }
              
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-6 transition-all duration-200 ${
                    isCurrentPlan
                      ? 'border-blue-500 bg-blue-50'
                      : canUpgrade
                      ? 'hover:shadow-lg border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  } ${
                    plan.popular && canUpgrade && !isCurrentPlan
                      ? 'border-purple-500 shadow-lg scale-105' 
                      : ''
                  } ${
                    isRecommended && canUpgrade && !isCurrentPlan
                      ? 'ring-2 ring-green-400 border-green-500'
                      : ''
                  }`}
                >
                  {plan.popular && canUpgrade && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  {isRecommended && canUpgrade && !isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Recommended
                      </span>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className={`inline-flex p-3 rounded-full bg-gradient-to-r ${plan.color} mb-4`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <div className="mb-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      <span className="text-gray-600 ml-1">
                        {plan.period}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      {plan.description}
                    </p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => !isDisabled && handleSelectPlan(plan.id)}
                    disabled={isDisabled}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {selectedPlan === plan.id && isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {buttonText}
                      </span>
                    ) : (
                      buttonText
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="text-center text-sm text-gray-500">
            <p className="mb-2">
              All plans include a 30-day money-back guarantee
            </p>
            <p>
              Questions? Contact us at{' '}
              <a href="mailto:support@promptbutton.com" className="text-blue-600 hover:underline">
                support@promptbutton.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
