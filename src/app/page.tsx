'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Copy, Palette, Type, Settings, Bookmark, Lock, Zap } from 'lucide-react';
import clsx from 'clsx';
import PresetSelector from './components/PresetSelector';
import { useUser } from '@/hooks/useUser';

interface ButtonConfig {
  text: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  enableSearch: boolean;
  customPrompt: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'left' | 'center' | 'right';
  aiProvider: 'chatgpt' | 'claude';
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: userLoading, isAuthenticated } = useUser();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [hasProcessedPayment, setHasProcessedPayment] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [config, setConfig] = useState<ButtonConfig>({
    text: 'Click me!',
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    fontSize: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 0,
    borderColor: '#000000',
    enableSearch: false,
    customPrompt: '',
    shadowColor: '#000000',
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    position: 'center',
    aiProvider: 'chatgpt',
  });

  const [copied, setCopied] = useState(false);
  const [showPresets, setShowPresets] = useState(true);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const paymentId = searchParams.get('payment_id'); // DodoPayments uses payment_id
    const subscriptionId = searchParams.get('subscription_id'); // DodoPayments also uses subscription_id
    const status = searchParams.get('status');
    const plan = searchParams.get('plan'); // Extract plan from URL
    const productId = searchParams.get('product_id'); // Extract product_id from URL
    
    // Use whichever ID is available (payment_id or subscription_id)
    const transactionId = paymentId || subscriptionId;
    
    console.log('Payment success page - URL params:', {
      payment,
      paymentId,
      subscriptionId,
      transactionId,
      status,
      plan,
      productId,
      hasProcessedPayment
    });
    
    // Prevent infinite loop - check if we've already processed this payment
    if (hasProcessedPayment) {
      console.log('Payment already processed, skipping...');
      return;
    }
    
    // Prevent infinite loop - check if transactionId is a placeholder or invalid
    const isValidTransactionId = transactionId && 
      transactionId !== '{CHECKOUT_SESSION_ID}' && 
      !transactionId.includes('%7B') && // URL encoded {
      !transactionId.includes('%7D') && // URL encoded }
      transactionId.length > 10; // Reasonable minimum length for a real transaction ID
    
    if (payment === 'success' && isValidTransactionId) {
      console.log('Processing successful payment...');
      setHasProcessedPayment(true);
      setShowSuccessMessage(true);
      
      // Update user subscription in database
      updateUserSubscription(transactionId, status, plan, productId);
      
      // Clear URL parameters to prevent infinite loop
      router.replace('/', { scroll: false });
      
      // Hide the message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else if (payment === 'success' && !isValidTransactionId) {
      console.warn('Payment success detected but transactionId is invalid or placeholder:', transactionId);
      setHasProcessedPayment(true);
      // Still show success message but don't try to update subscription
      setShowSuccessMessage(true);
      
      // Clear URL parameters to prevent infinite loop
      router.replace('/', { scroll: false });
      
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, hasProcessedPayment, router]);

  const updateUserSubscription = async (
    transactionId: string, 
    status?: string | null, 
    plan?: string | null, 
    productId?: string | null
  ) => {
    try {
      // Get the stored plan information from localStorage if plan not in URL
      let planType = plan; // Use plan from URL first
      
      if (!planType) {
        const pendingUpgradeData = localStorage.getItem('pendingUpgrade');
        
        if (pendingUpgradeData) {
          try {
            const pendingUpgrade = JSON.parse(pendingUpgradeData);
            // Check if the stored data is recent (within last hour)
            if (Date.now() - pendingUpgrade.timestamp < 60 * 60 * 1000) {
              planType = pendingUpgrade.planType;
              console.log('Found pending upgrade plan from localStorage:', planType);
            }
          } catch (e) {
            console.warn('Failed to parse pending upgrade data:', e);
          }
        }
      } else {
        console.log('Using plan from URL:', planType);
      }
      
      // Clear any stored pending upgrade data after use
      localStorage.removeItem('pendingUpgrade');

      console.log('Calling subscription API with:', {
        subscriptionId: transactionId,
        status: status || 'active',
        planType,
        productId
      });

      // First try the main subscription API
      let response = await fetch('/api/users/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          subscriptionId: transactionId, // This can be either payment_id or subscription_id
          status: status || 'active',
          planType, // Include planType from URL or localStorage
          productId // Include productId from URL
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Main subscription API failed:', errorData);
        
        // Fallback to the fix endpoint
        console.log('Trying subscription fix endpoint...');
        response = await fetch('/api/subscription-fix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: transactionId,
            plan: planType || 'monthly',
            forceUpdate: true,
          }),
        });
        
        if (!response.ok) {
          const fixErrorData = await response.json();
          console.error('Fix endpoint also failed:', fixErrorData);
          throw new Error(`Both subscription APIs failed: ${fixErrorData.error}`);
        } else {
          console.log('Fix endpoint succeeded');
        }
      }
      
      const responseData = await response.json();
      console.log('Subscription updated successfully:', responseData);
      
      // Try to update the success message with plan information if available
      if (planType) {
        console.log(`Successfully upgraded to ${planType} plan!`);
      }
      
      // Force a page reload after a short delay to refresh all components with new subscription
      setTimeout(() => {
        console.log('Reloading page to refresh subscription state...');
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error updating subscription:', error);
      
      // Show error message to user
      alert(`Failed to update subscription: ${error instanceof Error ? error.message : 'Unknown error'}. Please contact support if this persists.`);
    }
  };



  const copyToClipboard = async () => {
    try {
      setCopyError(null);
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        setCopyError('Please sign in to copy HTML code');
        return;
      }

      // Check if user data is loaded
      if (userLoading || !user) {
        setCopyError('Loading user data...');
        return;
      }

      // If user is on free plan, show upgrade modal instead of copying
      if (user.subscription.plan === 'free') {
        setShowUpgradeModal(true);
        return;
      }

      // Call secure API endpoint to generate HTML
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        await navigator.clipboard.writeText(data.htmlCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        if (data.requiresUpgrade) {
          setShowUpgradeModal(true);
        } else {
          setCopyError(data.error || 'Failed to generate HTML code');
        }
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
      setCopyError('Failed to copy HTML code. Please try again.');
    }
  };

  const updateConfig = (key: keyof ButtonConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectPreset = (presetConfig: ButtonConfig) => {
    setConfig(presetConfig);
  };

  const handleSavePreset = (currentConfig: ButtonConfig) => {
    // This will be handled by the PresetSelector component
    console.log('Save preset:', currentConfig);
  };

  return (
    <div className="h-[calc(100vh-80px)] bg-white overflow-hidden">
      <div className="h-full flex flex-col">
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 px-6 py-4 mx-8 mt-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-800">Payment Successful!</h3>
                <p className="text-sm text-green-700">Thank you for your purchase. Your upgrade is being processed.</p>
              </div>
            </div>
          </div>
        )}

        {copyError && (
          <div className="bg-red-50 border border-red-200 px-6 py-4 mx-8 mt-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Copy Failed</h3>
                <p className="text-sm text-red-700">{copyError}</p>
              </div>
              <button
                onClick={() => setCopyError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}


        {/* AI Provider Tabs */}
        <div className="bg-white border-b border-gray-200 px-8 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => updateConfig('aiProvider', 'chatgpt')}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                config.aiProvider === 'chatgpt'
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              ChatGPT
            </button>
            <button
              onClick={() => updateConfig('aiProvider', 'claude')}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                config.aiProvider === 'claude'
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Claude
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preset Panel - Collapsible Left Side */}
          <div className={clsx(
            "bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden",
            showPresets ? "w-96" : "w-0"
          )}>
            {showPresets && (
              <div className="w-96 h-full p-4 overflow-y-auto">
                <PresetSelector
                  onSelectPreset={handleSelectPreset}
                  currentConfig={config}
                  onSavePreset={handleSavePreset}
                />
              </div>
            )}
          </div>

          {/* Live Preview Panel - Center */}
          <div className="flex-1 bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="p-8 pb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Live Preview
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPresets(!showPresets)}
                    className={clsx(
                      "px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2",
                      showPresets
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-gray-600 hover:bg-purple-600 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    )}
                  >
                    <Bookmark className="w-4 h-4" />
                    {showPresets ? 'Hide Presets' : 'Show Presets'}
                  </button>
                  <button
                    onClick={copyToClipboard}
                    disabled={userLoading || !isAuthenticated || (user?.subscription?.plan === 'free')}
                    className={clsx(
                      "px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2",
                      copied
                        ? "bg-green-500 text-white shadow-lg"
                        : userLoading || !isAuthenticated || (user?.subscription?.plan === 'free')
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed shadow-md"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    )}
                  >
                    {copied ? (
                      <>
                        <Copy className="w-4 h-4" />
                        Copied!
                      </>
                    ) : userLoading ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                        Loading...
                      </>
                    ) : !isAuthenticated ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Sign In to Copy
                      </>
                    ) : user && user.subscription.plan === 'free' ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Upgrade to Copy
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy HTML
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setConfig({
                        text: 'Click me!',
                        backgroundColor: '#3b82f6',
                        textColor: '#ffffff',
                        fontSize: 16,
                        padding: 12,
                        borderRadius: 6,
                        borderWidth: 0,
                        borderColor: '#000000',
                        enableSearch: false,
                        customPrompt: '',
                        shadowColor: '#000000',
                        shadowBlur: 4,
                        shadowOffsetX: 0,
                        shadowOffsetY: 2,
                        position: 'center',
                        aiProvider: 'chatgpt',
                      });
                    }}
                    className="px-3 py-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
              </div>
            </div>
            
            {/* Button Preview - Centered in remaining space */}
            <div className="flex-1 flex items-center justify-center p-8 pt-0">
              <div className="relative p-8 bg-white rounded-xl shadow-lg border border-gray-200">
                <a
                  href={(() => {
                    const searchParams = config.enableSearch ? 'hints=search' : '';
                    let promptParams = '';
                    if (config.customPrompt) {
                      if (config.aiProvider === 'chatgpt') {
                        // ChatGPT encoding: use proper URL encoding to preserve newlines
                        promptParams = `prompt=${encodeURIComponent(config.customPrompt)}`;
                      } else {
                        // Claude encoding: use proper URL encoding with q parameter (preserves newlines)
                        promptParams = `q=${encodeURIComponent(config.customPrompt)}`;
                      }
                    }
                    const params = [searchParams, promptParams].filter(Boolean).join('&');
                    
                    if (config.aiProvider === 'chatgpt') {
                      return params ? `https://chatgpt.com?${params}` : 'https://chatgpt.com';
                    } else {
                      return params ? `https://claude.ai/new?${params}` : 'https://claude.ai/new';
                    }
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: config.backgroundColor,
                    color: config.textColor,
                    fontSize: `${config.fontSize}px`,
                    padding: `${config.padding}px ${config.padding * 2}px`,
                    borderRadius: `${config.borderRadius}px`,
                    border: `${config.borderWidth}px solid ${config.borderColor}`,
                    display: 'inline-block',
                    fontFamily: 'Arial, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: `${config.shadowOffsetX}px ${config.shadowOffsetY}px ${config.shadowBlur}px ${config.shadowColor}`,
                    textDecoration: 'none',
                  }}
                  className="hover:opacity-90 transform hover:scale-105"
                >
                  {config.text}
                </a>
              </div>
            </div>
          </div>

          {/* Controls Panel - Right Side */}
          <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Customize Your Button
            </h2>

            {/* Text Settings */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Type className="w-4 h-4 text-gray-500" />
                Text Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={config.text}
                    onChange={(e) => updateConfig('text', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    placeholder="Enter button text..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Font Size: {config.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    value={config.fontSize}
                    onChange={(e) => updateConfig('fontSize', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Custom Prompt
                  </label>
                  <textarea
                    value={config.customPrompt}
                    onChange={(e) => updateConfig('customPrompt', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    rows={3}
                    placeholder={`Enter a custom prompt that will be passed as the ${config.aiProvider === 'chatgpt' ? 'prompt' : 'q'} parameter to ${config.aiProvider === 'chatgpt' ? 'ChatGPT' : 'Claude'}...`}
                  />
                  
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Button Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => updateConfig('position', 'left')}
                      className={clsx(
                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200",
                        config.position === 'left'
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig('position', 'center')}
                      className={clsx(
                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200",
                        config.position === 'center'
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig('position', 'right')}
                      className={clsx(
                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200",
                        config.position === 'right'
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      Right
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-500" />
                Color Settings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Background Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={config.backgroundColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                          updateConfig('backgroundColor', value);
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Text Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.textColor}
                      onChange={(e) => updateConfig('textColor', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={config.textColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                          updateConfig('textColor', value);
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Size & Shape Settings */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Size & Shape
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Padding: {config.padding}px
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    value={config.padding}
                    onChange={(e) => updateConfig('padding', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Border Radius: {config.borderRadius}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={config.borderRadius}
                    onChange={(e) => updateConfig('borderRadius', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Border Width: {config.borderWidth}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    value={config.borderWidth}
                    onChange={(e) => updateConfig('borderWidth', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                {config.borderWidth > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Border Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={config.borderColor}
                        onChange={(e) => updateConfig('borderColor', e.target.value)}
                        className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={config.borderColor}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                            updateConfig('borderColor', value);
                          }
                        }}
                        placeholder="#000000"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Shadow Settings */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Shadow Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Shadow Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.shadowColor}
                      onChange={(e) => updateConfig('shadowColor', e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={config.shadowColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                          updateConfig('shadowColor', value);
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Shadow Blur: {config.shadowBlur}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={config.shadowBlur}
                    onChange={(e) => updateConfig('shadowBlur', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Shadow Offset X: {config.shadowOffsetX}px
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={config.shadowOffsetX}
                    onChange={(e) => updateConfig('shadowOffsetX', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Shadow Offset Y: {config.shadowOffsetY}px
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={config.shadowOffsetY}
                    onChange={(e) => updateConfig('shadowOffsetY', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Advanced Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Enable Search
                  </label>
                  <button
                    type="button"
                    onClick={() => updateConfig('enableSearch', !config.enableSearch)}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                      config.enableSearch ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        config.enableSearch ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    When enabled, adds hints=search parameter to the URL (ChatGPT only)
                  </p>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upgrade Required</h3>
                <p className="text-sm text-gray-600">Copy feature is not available on the free plan</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">Unlock Premium Features</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Copy HTML code to clipboard</li>
                <li>• Create up to 100+ buttons</li>
                <li>• Advanced customization options</li>
                <li>• Priority support</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  // Navigate to pricing/upgrade page
                  window.open('/profile', '_blank');
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all transform hover:scale-105 shadow-md"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-80px)] bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
