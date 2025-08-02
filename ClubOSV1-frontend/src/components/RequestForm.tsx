import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRequestSubmission, useNotifications, useDemoMode } from '@/state/hooks';
import { useSettingsState, useAuthState } from '@/state/useStore';
import { canAccessRoute, getRestrictedTooltip } from '@/utils/roleUtils';
import type { UserRequest, RequestRoute } from '@/types/request';
import { Lock, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { ResponseDisplay } from './ResponseDisplay';
import { SlackConversation } from './SlackConversation';

// Ensure API URL is properly formatted
const getApiUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  // Remove any trailing slashes
  return url.replace(/\/$/, '');
};

const API_URL = getApiUrl();

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
  const router = useRouter();
  
  // Initialize state with consistent defaults
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [smartAssistEnabled, setSmartAssistEnabled] = useState(true);
  const [routePreference, setRoutePreference] = useState<RequestRoute>('Auto');
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
  const [slackReplies, setSlackReplies] = useState<any[]>([]);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [lastSlackThreadTs, setLastSlackThreadTs] = useState<string | null>(null);
  const [showAdvancedRouting, setShowAdvancedRouting] = useState(false);

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

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
    // Set route preference from settings after mount
    if (preferences.defaultRoute) {
      setRoutePreference(preferences.defaultRoute);
    }
    // Load advanced routing state
    const savedRoutingState = localStorage.getItem('showAdvancedRouting');
    if (savedRoutingState !== null) {
      setShowAdvancedRouting(savedRoutingState === 'true');
    }
  }, [preferences.defaultRoute]);

  // Save advanced routing preference when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('showAdvancedRouting', String(showAdvancedRouting));
    }
  }, [showAdvancedRouting, isMounted]);

  // Check for ticket query parameter on mount (client-side only)
  useEffect(() => {
    if (isMounted && (router.query.ticket === 'true' || router.query.ticketMode === 'true')) {
      setIsTicketMode(true);
      setSmartAssistEnabled(false);
      // Remove the query parameter from URL without reload
      router.replace('/', undefined, { shallow: true });
    }
  }, [router.query.ticket, router.query.ticketMode, router, isMounted]);

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
    if (!isMounted) return; // Skip on server-side
    
    if (lastResponse && isNewSubmission) {
      console.log('Full lastResponse object:', JSON.stringify(lastResponse, null, 2));
      
      setShowResponse(true);
      setIsNewSubmission(false); // Reset the flag
      setLoadingStartTime(null); // Reset loading timer
      setIsProcessing(false); // Stop loading state
      notify('success', smartAssistEnabled ? 'Request processed successfully!' : 'Message sent to Slack!');
      
      // Smooth scroll to response with offset
      setTimeout(() => {
        const element = document.getElementById('response-area');
        if (element) {
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - 100; // 100px offset from top
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 200);
    }
  }, [lastResponse, isNewSubmission, smartAssistEnabled, notify, isMounted]);

  const onSubmit = async (data: FormData) => {
    if (isMounted) {
      console.log('Form submitted!', data);
    }
    
    // If in ticket mode, create a ticket instead
    if (isTicketMode) {
      setIsProcessing(true);
      try {
        const token = isMounted ? localStorage.getItem('clubos_token') : null;
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
    
    // Gentle nudge scroll to loading area
    setTimeout(() => {
      const element = document.getElementById('response-area');
      if (element) {
        const elementPosition = element.getBoundingClientRect().top;
        // Only scroll if element is below the viewport
        if (elementPosition > window.innerHeight - 200) {
          const offsetPosition = elementPosition + window.pageYOffset - 150; // 150px offset for a gentle nudge
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    }, 100);

    const request: UserRequest = {
      requestDescription: data.requestDescription,
      location: data.location || undefined,
      routePreference: smartAssistEnabled ? routePreference : undefined,
      smartAssistEnabled,
    } as any;

    if (isMounted) {
      console.log('About to submit request:', request);
      console.log('isSubmitting before:', isSubmitting);
    }

    try {
      await submitRequest(request);
    } catch (error) {
      console.error('Submit error:', error);
      setIsProcessing(false); // Stop loading on error
      // Error is handled by the hook and notifications
    }
  };

  // Start polling for Slack replies when a message is sent to Slack
  useEffect(() => {
    if (showResponse && lastResponse && !smartAssistEnabled && !isWaitingForReply) {
      setIsWaitingForReply(true);
      // Try to find the thread_ts from the response
      // For now, we'll poll the conversations endpoint to find the latest
      pollForSlackReplies();
    }
  }, [showResponse, lastResponse, smartAssistEnabled]);

  const pollForSlackReplies = async () => {
    // Get thread_ts from the last response (when Smart Assist is off)
    const threadTs = lastResponse?.slackThreadTs;
    
    if (!threadTs) {
      console.error('No thread timestamp available for polling');
      setIsWaitingForReply(false);
      return;
    }
    
    console.log('Starting to poll for replies using thread_ts:', threadTs);
    setLastSlackThreadTs(threadTs);
    
    let pollCount = 0;
    const maxPolls = 60; // Poll for 5 minutes (60 polls * 5 seconds)
    
    const poll = async () => {
      try {
        console.log(`Polling attempt ${pollCount + 1}/${maxPolls} for thread ${threadTs}`);
        
        // Use the specific thread_ts to check for replies directly from Slack
        const repliesResponse = await axios.get(`${API_URL}/slack/thread-replies/${threadTs}`);
        
        if (repliesResponse.data.success && repliesResponse.data.data.replies.length > 0) {
          console.log('Found replies:', repliesResponse.data.data.replies);
          setSlackReplies(repliesResponse.data.data.replies);
          
          // Don't stop waiting for replies - staff might send multiple messages
          // Continue polling to check for new replies
          console.log('Continuing to poll for additional replies...');
        } else {
          console.log('No replies yet, continuing to poll...');
        }
        
        // Continue polling if no replies found and haven't exceeded max polls
        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          console.log('Polling timeout reached, stopping');
          setIsWaitingForReply(false); // Stop waiting after max time
        }
      } catch (error) {
        console.error('Error polling for replies:', error);
        // Don't stop polling immediately on error, could be temporary
        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000); // Continue polling
        } else {
          setIsWaitingForReply(false);
        }
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 2000);
  };

  const handleReset = () => {
    // Reset form fields
    reset();
    
    // Reset all state to defaults
    setRoutePreference('Auto'); // Reset to Auto route
    setSmartAssistEnabled(true); // Enable Smart Assist by default
    setShowResponse(false);
    resetRequestState();
    setConvertedTone('');
    setFeedbackGiven(null);
    setIsTicketMode(false); // Reset to request mode
    setTicketPriority('medium'); // Reset ticket priority
    setTicketCategory('facilities'); // Reset ticket category
    setLastRequestData(null);
    setIsProcessing(false);
    setLoadingStartTime(null);
    setElapsedTime(0);
    setIsNewSubmission(false);
    setSlackReplies([]);
    setIsWaitingForReply(false);
    setLastSlackThreadTs(null);
    
    // Clear any notifications
    notify('info', 'Form reset to defaults');
  };

  // Handle feedback submission
  const handleFeedback = async (isUseful: boolean) => {
    if (!lastResponse || feedbackGiven) return;
    
    // Check if user is authenticated before attempting feedback
    const token = isMounted ? localStorage.getItem('clubos_token') : null;
    if (!token || !user) {
      notify('error', 'Please log in to submit feedback');
      // Store current location and redirect to login
      if (isMounted) {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      }
      router.push('/login');
      return;
    }
    
    setFeedbackLoading(true);
    const feedbackType = isUseful ? 'useful' : 'not_useful';
    
    try {
      // Log feedback data - include full structured response
      const feedbackData = {
        timestamp: new Date().toISOString(),
        requestDescription: lastRequestData?.requestDescription || requestDescription || 'No description',
        location: lastRequestData?.location || watch('location') || '',
        route: lastResponse.botRoute || 'Unknown',
        response: JSON.stringify({
          text: lastResponse.llmResponse?.response || 'No response',
          structured: lastResponse.llmResponse?.structured,
          category: lastResponse.llmResponse?.category,
          priority: lastResponse.llmResponse?.priority,
          actions: lastResponse.llmResponse?.actions,
          metadata: lastResponse.llmResponse?.metadata,
          escalation: lastResponse.llmResponse?.escalation
        }),
        confidence: lastResponse.llmResponse?.confidence || 0,
        isUseful: isUseful,
        feedbackType: feedbackType
      };
      
      if (isMounted) {
        console.log('Sending feedback:', feedbackData);
        console.log('Auth token present:', !!token);
        console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'no token');
        console.log('Full API URL:', `${API_URL}/feedback`);
      }
      
      // Use apiClient to ensure auth header is properly attached
      const response = await axios.post(`${API_URL}/feedback`, feedbackData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (isMounted) {
        console.log('Feedback response:', response.data);
      }
      
      setFeedbackGiven(feedbackType);
      notify('success', isUseful ? 'Thanks for the feedback!' : 'Feedback recorded for improvement');
      
      // If not useful, also log to console for debugging
      if (!isUseful && isMounted) {
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
      if (error.message?.includes('401')) {
        notify('error', 'Your session has expired. Please log in again.');
        // Store current location and redirect to login
        if (isMounted) {
          sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        }
        router.push('/login');
      } else {
        notify('error', `Failed to record feedback: ${error.message}`);
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
    <div className="w-full">
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: shimmerKeyframes }} />
      
      {/* Main Form Card */}
      <div className="card group">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Mode Toggle - Compressed */}
          <div className="flex items-center justify-end mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Ticket Mode</span>
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

          {/* Task Description - No label, just placeholder */}
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
              placeholder={isTicketMode ? "Describe the issue for the support ticket..." : "Describe your request (e.g., power outage, equipment frozen, booking cancellation...)"}
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
            <input
              id="locationInput"
              {...register('location')}
              type="text"
              className="form-input"
              placeholder="Location (Optional)"
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
                    Facilities
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
                    Tech Support
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

          {/* Route Selector - Simplified */}
          {!isTicketMode && smartAssistEnabled && (
            <div className="form-group">
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">
                  Bot Route: <span className="text-[var(--accent)]">{routePreference}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvancedRouting(!showAdvancedRouting)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                  disabled={isSubmitting || demoMode}
                >
                  {showAdvancedRouting ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Advanced Options
                </button>
              </div>
              
              {/* Collapsible Route Options */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                showAdvancedRouting ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="route-selector mt-2">
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
                <div className="form-helper mt-2">
                  Auto mode intelligently selects the best bot based on your request
                </div>
              </div>
            </div>
          )}

          {/* Toggle Options */}
          {!isTicketMode && (
            <div className="form-group">
              <div className="flex items-center justify-between">
                <div className="toggle-item flex items-center gap-3">
                  <span className="text-sm text-[var(--text-muted)]">AI</span>
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
                  <span className="text-sm text-[var(--text-muted)]">Human</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons - Improved hierarchy */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className={`btn btn-primary flex items-center justify-center gap-2 ${!smartAssistEnabled ? 'slack-mode' : ''}`}
              disabled={isProcessing || demoMode}
              onClick={() => isMounted && console.log('Button clicked!', isProcessing)}
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
              {!isProcessing && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
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
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all duration-200"
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
              {smartAssistEnabled ? 'This could take up to 30 seconds... we are thinking' : 'This could take up to 2-3 minutes for a response... we are asking a real human'}
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
                
                {/* Waiting for Reply State */}
                {isWaitingForReply && slackReplies.length === 0 && (
                  <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                      {/* Loading animation */}
                      <div className="flex gap-1">
                        <div className="w-2 h-8 bg-[var(--accent)]" style={{
                          animation: 'block-wave 1.2s ease-in-out infinite',
                          animationDelay: '0s'
                        }}></div>
                        <div className="w-2 h-8 bg-[var(--accent)]" style={{
                          animation: 'block-wave 1.2s ease-in-out infinite',
                          animationDelay: '0.1s'
                        }}></div>
                        <div className="w-2 h-8 bg-[var(--accent)]" style={{
                          animation: 'block-wave 1.2s ease-in-out infinite',
                          animationDelay: '0.2s'
                        }}></div>
                        <div className="w-2 h-8 bg-[var(--accent)]" style={{
                          animation: 'block-wave 1.2s ease-in-out infinite',
                          animationDelay: '0.3s'
                        }}></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Waiting for staff reply...
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Please allow a few moments for a response
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Slack Replies */}
                {slackReplies.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="border-t border-[var(--border-secondary)] pt-3">
                      <strong className="text-[var(--accent)]">Staff Response:</strong>
                    </div>
                    {slackReplies.map((reply, index) => (
                      <div key={reply.ts || index} className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)]">
                        <div className="flex items-center gap-2 mb-2 text-sm text-[var(--text-secondary)]">
                          <span className="font-medium text-[var(--text-primary)]">
                            {reply.user_name || reply.user || 'Staff Member'}
                          </span>
                          <span>•</span>
                          <span>{new Date(reply.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-[var(--text-primary)]">
                          {reply.text}
                        </p>
                      </div>
                    ))}
                    
                    {/* Still checking for new replies indicator */}
                    {isWaitingForReply && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-[var(--text-secondary)]">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-[var(--accent)] rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-[var(--accent)] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1 h-1 bg-[var(--accent)] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-xs">Checking for new replies...</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <ResponseDisplay 
                  response={lastResponse.llmResponse} 
                  route={lastResponse.botRoute}
                />
                
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

      {/* Slack Conversation Panel - Show when Smart Assist is disabled but no active response */}
      {!smartAssistEnabled && !showResponse && (
        <div className="mt-6">
          <SlackConversation className="w-full" />
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
