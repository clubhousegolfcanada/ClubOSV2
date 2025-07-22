import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRequestSubmission, useNotifications, useDemoMode } from '@/state/hooks';
import { useSettingsState, useAuthState } from '@/state/useStore';
import { canAccessRoute, getRestrictedTooltip } from '@/utils/roleUtils';
import type { UserRequest, RequestRoute } from '@/types/request';
import { Lock, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRouter } from 'next/router';
import axios from 'axios';

// Ensure API URL is properly formatted
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  // Remove any trailing slashes
  return url.replace(/\/$/, '');
};

const API_URL = getApiUrl();
console.log('API_URL configured:', API_URL);

// Add keyframes for button animation
const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes block-wave {
    0%, 60%, 100% {
      transform: scaleY(0.5);
      opacity: 0.3;
    }
    30% {
      transform: scaleY(1);
      opacity: 1;
    }
  }
`;

interface FormData {
  requestDescription: string;
  location: string;
  toneConversion?: string;
}

const RequestForm: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const { preferences } = useSettingsState();
  const { user } = useAuthState();
  const { 
    isSubmitting, 
    lastResponse, 
    error,
    submitRequest,
    resetRequestState,
    setLastResponse 
  } = useRequestSubmission();
  const { notify } = useNotifications();
  const { demoMode, runDemo } = useDemoMode();
  
  const [smartAssistEnabled, setSmartAssistEnabled] = useState(true);
  const [routePreference, setRoutePreference] = useState<RequestRoute>(preferences.defaultRoute);
  const [showResponse, setShowResponse] = useState(false);
  const [isNewSubmission, setIsNewSubmission] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [convertedTone, setConvertedTone] = useState<string>('');
  const [isConvertingTone, setIsConvertingTone] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [isTicketMode, setIsTicketMode] = useState(false);
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketCategory, setTicketCategory] = useState<'facilities' | 'tech'>('facilities');
  const [lastRequestData, setLastRequestData] = useState<FormData | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>();

  const requestDescription = watch('requestDescription');
  const toneConversion = watch('toneConversion');

  const routes: RequestRoute[] = ['Auto', 'Emergency', 'Booking&Access', 'TechSupport', 'BrandTone'];
  
  // Route access mapping
  const routeAccessMap: Record<RequestRoute, string> = {
    'Auto': 'llm_request',
    'Emergency': 'emergency',
    'Booking&Access': 'bookings',
    'TechSupport': 'tech_support',
    'BrandTone': 'brand_tone'
  };

  // Handle demo mode
  useEffect(() => {
    if (demoMode) {
      setValue('requestDescription', 'Customer says equipment is frozen');
      setValue('location', 'Halifax Bay 3');
      setRoutePreference('TechSupport');
      setSmartAssistEnabled(true);
    }
  }, [demoMode, setValue]);

  // Handle error notifications
  useEffect(() => {
    if (error) {
      notify('error', error);
    }
  }, [error, notify]);

  // Handle loading timer
  useEffect(() => {
    if (isProcessing && loadingStartTime) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
      }, 100);
      return () => clearInterval(timer);
    } else {
      setElapsedTime(0);
    }
  }, [isProcessing, loadingStartTime]);

  // Handle response display
  useEffect(() => {
    if (lastResponse && isNewSubmission) {
      console.log('Full lastResponse object:', JSON.stringify(lastResponse, null, 2));
      
      setShowResponse(true);
      setIsNewSubmission(false); // Reset the flag
      setLoadingStartTime(null); // Reset loading timer
      setIsProcessing(false); // Stop loading state
      notify('success', smartAssistEnabled ? 'Request processed successfully!' : 'Message sent to Slack!');
      
      // Smooth scroll to response
      setTimeout(() => {
        document.getElementById('response-area')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }, 100);
    }
  }, [lastResponse, isNewSubmission, smartAssistEnabled, notify]);

  const onSubmit = async (data: FormData) => {
    console.log('Form submitted!', data);
    
    // If in ticket mode, create a ticket instead
    if (isTicketMode) {
      setIsProcessing(true);
      try {
        const token = localStorage.getItem('clubos_token');
        const response = await axios.post(
          `${API_URL}/tickets`,
          {
            title: data.requestDescription.substring(0, 100), // First 100 chars as title
            description: data.requestDescription,
            category: ticketCategory,
            priority: ticketPriority,
            location: data.location || undefined,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          notify('success', 'Ticket created successfully!');
          reset();
          // Redirect to ticket center
          setTimeout(() => router.push('/tickets'), 1000);
        }
      } catch (error) {
        console.error('Failed to create ticket:', error);
        notify('error', 'Failed to create ticket');
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Clear everything immediately when starting a new request
    setShowResponse(false);
    setLastResponse(null); // Clear the response from state
    resetRequestState(); // Clear old response immediately
    setIsNewSubmission(true); // Mark this as a new submission
    setLoadingStartTime(Date.now()); // Start loading timer
    setIsProcessing(true); // Start loading state
    setFeedbackGiven(null); // Clear previous feedback
    setLastRequestData(data); // Store the request data for feedback

    const request: UserRequest = {
      requestDescription: data.requestDescription,
      location: data.location || undefined,
      routePreference: smartAssistEnabled ? routePreference : undefined,
      smartAssistEnabled,
    } as any;

    console.log('About to submit request:', request);
    console.log('isSubmitting before:', isSubmitting);

    try {
      await submitRequest(request);
    } catch (error) {
      console.error('Submit error:', error);
      setIsProcessing(false); // Stop loading on error
      // Error is handled by the hook and notifications
    }
  };

  const handleReset = () => {
    reset();
    setRoutePreference(preferences.defaultRoute);
    setShowResponse(false);
    resetRequestState();
    setConvertedTone(''); // Clear converted tone
    setFeedbackGiven(null); // Clear feedback state
  };

  // Handle feedback submission
  const handleFeedback = async (isUseful: boolean) => {
    if (!lastResponse || feedbackGiven) return;
    
    // Check if user is authenticated before attempting feedback
    const token = localStorage.getItem('clubos_token');
    if (!token || !user) {
      notify('error', 'Please log in to submit feedback');
      // Store current location and redirect to login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      router.push('/login');
      return;
    }
    
    setFeedbackLoading(true);
    const feedbackType = isUseful ? 'useful' : 'not_useful';
    
    try {
      // Log feedback data
      const feedbackData = {
        timestamp: new Date().toISOString(),
        requestDescription: lastRequestData?.requestDescription || requestDescription || 'No description',
        location: lastRequestData?.location || watch('location') || '',
        route: lastResponse.botRoute || 'Unknown',
        response: lastResponse.llmResponse?.response || 'No response',
        confidence: lastResponse.llmResponse?.confidence || 0,
        isUseful: isUseful,
        feedbackType: feedbackType
      };
      
      console.log('Sending feedback:', feedbackData);
      console.log('Auth token present:', !!token);
      console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
      console.log('Full API URL:', `${API_URL}/feedback`);
      
      // Send feedback to API with authentication
      const response = await axios.post(`${API_URL}/feedback`, feedbackData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Feedback response:', response.data);
      
      setFeedbackGiven(feedbackType);
      notify('success', isUseful ? 'Thanks for the feedback!' : 'Feedback recorded for improvement');
      
      // If not useful, also log to console for debugging
      if (!isUseful) {
        console.log('Not useful response logged:', feedbackData);
      }
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Handle 401 specifically
      if (error.response?.status === 401) {
        notify('error', 'Your session has expired. Please log in again.');
        // Store current location and redirect to login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        router.push('/login');
      } else {
        notify('error', `Failed to record feedback: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Handle tone conversion
  const handleToneConversion = async () => {
    if (!toneConversion || toneConversion.trim().length === 0) return;
    
    setIsConvertingTone(true);
    try {
      const response = await axios.post(`${API_URL}/tone/convert`, {
        text: toneConversion
      });
      
      if (response.data.success) {
        setConvertedTone(response.data.data.convertedText);
        notify('success', 'Tone converted!');
      }
    } catch (error) {
      console.error('Tone conversion failed:', error);
      notify('error', 'Failed to convert tone');
    } finally {
      setIsConvertingTone(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to reset
      if (e.key === 'Escape') {
        handleReset();
      }
      
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
      
      // Ctrl/Cmd + D for demo
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        runDemo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, runDemo, handleReset, onSubmit]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: shimmerKeyframes }} />
      
      {/* Main Form Card */}
      <div className="card group">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Mode Toggle */}
          <div className="form-group">
            <div className="flex items-center justify-between mb-4">
              <label className="form-label mb-0">
                {isTicketMode ? 'Create Support Ticket' : 'Request Description'}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">Ticket Mode</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isTicketMode}
                    onChange={(e) => {
                      setIsTicketMode(e.target.checked);
                      if (e.target.checked) {
                        setSmartAssistEnabled(false);
                      }
                    }}
                    disabled={isSubmitting || demoMode}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Task Description */}
          <div className="form-group">
            <textarea
              id="taskInput"
              {...register('requestDescription', {
                required: 'Please enter a request description',
                minLength: {
                  value: 10,
                  message: 'Please provide at least 10 characters',
                },
              })}
              className="form-textarea"
              placeholder="e.g., What to do when the power is out, customer says equipment is frozen, booking cancellation request..."
              disabled={isSubmitting || demoMode}
            />
            {errors.requestDescription && (
              <p className="error-message">{errors.requestDescription.message}</p>
            )}
          </div>

          {/* Tone Conversion Input - HIDDEN FOR NOW */}
          {/* <div className="form-group">
            <label className="form-label" htmlFor="toneInput">
              Clubhouse Tone Converter
            </label>
            <div className="flex gap-2">
              <input
                id="toneInput"
                {...register('toneConversion')}
                type="text"
                className="form-input flex-1"
                placeholder="Type anything and convert it to Clubhouse's friendly tone..."
                disabled={isConvertingTone}
              />
              <button
                type="button"
                onClick={handleToneConversion}
                disabled={isConvertingTone || !toneConversion}
                className="btn btn-secondary"
              >
                {isConvertingTone ? 'Converting...' : 'Convert'}
              </button>
            </div>
            {convertedTone && (
              <div className="mt-2 p-3 bg-[var(--accent)]/10 rounded-lg border border-[var(--accent)]/20">
                <p className="text-sm text-[var(--accent)]">{convertedTone}</p>
              </div>
            )}
          </div> */}

          {/* Location Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="locationInput">
              Location (optional)
            </label>
            <input
              id="locationInput"
              {...register('location')}
              type="text"
              className="form-input"
              placeholder="e.g., Main Floor, Bay 3, Gym Area"
              disabled={isSubmitting || demoMode}
            />
            <div className="form-helper">
              Add location context if relevant to your {isTicketMode ? 'ticket' : 'request'}
            </div>
          </div>

          {/* Ticket Options */}
          {isTicketMode && (
            <>
              <div className="form-group">
                <label className="form-label">Ticket Category</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketCategory('facilities')}
                    className={`
                      flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all
                      ${ticketCategory === 'facilities'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    🏢 Facilities
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketCategory('tech')}
                    className={`
                      flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all
                      ${ticketCategory === 'tech'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    🔧 Tech Support
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setTicketPriority(priority)}
                      className={`
                        py-2 px-3 rounded-lg font-medium text-sm transition-all capitalize
                        ${ticketPriority === priority
                          ? priority === 'urgent' ? 'bg-red-500 text-white' :
                            priority === 'high' ? 'bg-orange-500 text-white' :
                            priority === 'medium' ? 'bg-yellow-500 text-white' :
                            'bg-gray-500 text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }
                      `}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
                <div className="form-helper mt-2">
                  <span className="text-gray-400">Low: minor issues • Medium: standard requests • High: impacts operations • Urgent: critical issues</span>
                </div>
              </div>
            </>
          )}

          {/* Route Selector */}
          {smartAssistEnabled && !isTicketMode && (
            <div className="form-group">
              <label className="form-label">
                Force Bot Route (optional)
              </label>
              <div className="route-selector">
                {routes.map((route) => {
                  const isDisabled = !canAccessRoute(user?.role, routeAccessMap[route]);
                  const tooltip = isDisabled ? getRestrictedTooltip(routeAccessMap[route]) : '';
                  
                  return (
                    <React.Fragment key={route}>
                      <input
                        type="radio"
                        id={`route-${route.toLowerCase()}`}
                        name="route"
                        value={route}
                        checked={routePreference === route}
                        onChange={() => {
                          setRoutePreference(route);
                          // Clear response when changing routes
                          if (showResponse) {
                            setShowResponse(false);
                            resetRequestState();
                          }
                        }}
                        disabled={isSubmitting || demoMode || isDisabled}
                      />
                      <label
                        htmlFor={`route-${route.toLowerCase()}`}
                        className={`route-option ${route === 'Auto' ? 'route-auto' : ''} ${isDisabled ? 'route-disabled' : ''}`}
                        title={tooltip}
                      >
                        {route.replace('&', ' & ')}
                        {isDisabled && <Lock className="inline-block w-3 h-3 ml-1" />}
                      </label>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="form-helper">
                <span className="text-gray-400">Each route has specialized access to facility resources</span> 
                (emergency protocols, booking systems, equipment guides, service scripts).<br />
                <span className="text-accent">Select "Auto" for smart routing or manually choose for specific expertise.</span>
              </div>
            </div>
          )}

          {/* Toggle Options */}
          {!isTicketMode && (
            <>
              <div className="toggle-group">
                <div className="toggle-item">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={smartAssistEnabled}
                      onChange={(e) => {
                        setSmartAssistEnabled(e.target.checked);
                        // Clear response when toggling
                        if (showResponse) {
                          setShowResponse(false);
                          resetRequestState();
                        }
                      }}
                      disabled={isSubmitting || demoMode}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <label className="toggle-label">Smart Assist (AI)</label>
                  {!smartAssistEnabled && (
                    <span className="slack-indicator">→ Slack</span>
                  )}
                </div>
              </div>
              {!smartAssistEnabled && (
                <div className="llm-toggle-helper">
                  When disabled, your request will be sent to Slack as a general question
                </div>
              )}
            </>
          )}

          {/* Submit Buttons */}
          <div className="button-group">
            <button
              type="submit"
              className={`btn btn-primary ${!smartAssistEnabled ? 'slack-mode' : ''}`}
              disabled={isProcessing || demoMode}
              onClick={() => console.log('Button clicked!', isProcessing)}
              style={{
                ...(isProcessing ? {
                  background: 'linear-gradient(90deg, #152f2f 0%, #1a3939 50%, #152f2f 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite',
                  position: 'relative',
                  overflow: 'hidden'
                } : {})
              }}
            >
              {isProcessing ? (
                <>
                  {smartAssistEnabled ? 'Processing...' : 'Sending to Slack...'}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                    animation: 'sweep 2s infinite',
                    pointerEvents: 'none'
                  }} />
                </>
              ) : (
                isTicketMode ? 'Create Ticket' : (smartAssistEnabled ? 'Process Request' : 'Send to Slack')
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={isSubmitting || demoMode}
              title="Clear form and start a new query (Esc)"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {isProcessing && (
        <div className="card response-area" id="response-area">
          <div className="flex flex-col items-center justify-center py-12">
            {/* Blocky loading animation */}
            <div className="flex gap-2 mb-6">
              <div className="w-3 h-12 bg-[var(--accent)]" style={{
                animation: 'block-wave 1.2s ease-in-out infinite',
                animationDelay: '0s'
              }}></div>
              <div className="w-3 h-12 bg-[var(--accent)]" style={{
                animation: 'block-wave 1.2s ease-in-out infinite',
                animationDelay: '0.1s'
              }}></div>
              <div className="w-3 h-12 bg-[var(--accent)]" style={{
                animation: 'block-wave 1.2s ease-in-out infinite',
                animationDelay: '0.2s'
              }}></div>
              <div className="w-3 h-12 bg-[var(--accent)]" style={{
                animation: 'block-wave 1.2s ease-in-out infinite',
                animationDelay: '0.3s'
              }}></div>
            </div>
            <p className="text-lg font-medium text-gray-300 mb-2">
              {smartAssistEnabled ? 'Processing your request...' : 'Sending to Slack...'}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              This may take a few seconds
            </p>
            {elapsedTime > 0 && (
              <p className="text-xs text-gray-500">
                {elapsedTime}s elapsed
              </p>
            )}
          </div>
        </div>
      )}

      {/* Response Area */}
      {showResponse && lastResponse && !isProcessing && (
        <div className="card response-area" id="response-area">
          <div className="response-header">
            <div className="status-badge">
              <span className={`status-dot ${lastResponse.status === 'completed' ? 'status-success' : 'status-processing'}`}></span>
              <span className="status-text capitalize">{lastResponse.status || 'Completed'}</span>
            </div>
            {smartAssistEnabled && lastResponse.llmResponse?.confidence !== undefined && (
              <div className="confidence-meter">
                Confidence: <strong>{Math.round((lastResponse.llmResponse.confidence || 0) * 100)}%</strong>
              </div>
            )}
          </div>
          
          <div className="response-content">
            {!smartAssistEnabled ? (
              <>
                <strong>Sent to Slack</strong><br />
                Your question has been posted to the general Slack channel.
              </>
            ) : (
              <>
                <strong>Recommendation:</strong>
                <p className="response-text">{lastResponse.llmResponse?.response || 'Request processed successfully'}</p>
                
                {lastResponse.llmResponse?.suggestedActions && lastResponse.llmResponse.suggestedActions.length > 0 && (
                  <div className="response-actions">
                    <strong>Actions:</strong>
                    <ul className="response-list">
                      {lastResponse.llmResponse.suggestedActions.map((action: string, index: number) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {lastResponse.llmResponse?.extractedInfo && (
                  <div className="response-info">
                    {lastResponse.llmResponse.extractedInfo.timeEstimate && (
                      <div className="info-item">
                        <strong>Time Estimate:</strong> <span>{lastResponse.llmResponse.extractedInfo.timeEstimate}</span>
                      </div>
                    )}
                    {lastResponse.llmResponse.extractedInfo.escalation && (
                      <div className="info-item">
                        <strong>Escalation:</strong> <span>{lastResponse.llmResponse.extractedInfo.escalation}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {(lastResponse.botRoute || lastResponse.processingTime) && (
                  <div className="response-metadata">
                    {lastResponse.botRoute && (
                      <div>Route Used: <span className="text-gray-400">{lastResponse.botRoute}</span></div>
                    )}
                    {lastResponse.processingTime && (
                      <div>Processing Time: <span className="text-gray-400">{lastResponse.processingTime}ms</span></div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Feedback Section */}
          {smartAssistEnabled && (
            <div className="mt-6 pt-4 border-t border-[var(--border-secondary)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  Was this response helpful?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback(true)}
                    disabled={feedbackGiven !== null || feedbackLoading}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                      feedbackGiven === 'useful'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    } ${feedbackGiven !== null || feedbackLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Useful
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    disabled={feedbackGiven !== null || feedbackLoading}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                      feedbackGiven === 'not_useful'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    } ${feedbackGiven !== null || feedbackLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not Useful
                  </button>
                </div>
              </div>
              {feedbackGiven && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {feedbackGiven === 'useful' 
                    ? 'Thank you for your feedback!' 
                    : 'Thank you. Your feedback will help us improve our responses.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      <div className="shortcuts-hint">
        <strong>Keyboard Shortcuts:</strong>{' '}
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> Submit •{' '}
        <kbd>Esc</kbd> Reset •{' '}
        <kbd>Ctrl</kbd>+<kbd>D</kbd> Demo
      </div>
    </div>
  );
};

export default RequestForm;
