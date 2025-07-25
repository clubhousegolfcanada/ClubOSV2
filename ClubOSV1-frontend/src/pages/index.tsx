import Head from 'next/head';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLLMStore, useNotifications } from '@/state/hooks';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuthState } from '@/state/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type RouteOption = 'Auto' | 'Emergency' | 'Booking & Access' | 'TechSupport' | 'BrandTone';

export default function Commands() {
  const [requestDescription, setRequestDescription] = useState('');
  const [location, setLocation] = useState('');
  const [forceRoute, setForceRoute] = useState<RouteOption>('Auto');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ticketMode, setTicketMode] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [response, setResponse] = useState<any>(null);
  
  const { smartAssist, setSmartAssist } = useLLMStore();
  const { notify } = useNotifications();
  const { user } = useAuthState();

  const routeOptions: RouteOption[] = ['Auto', 'Emergency', 'Booking & Access', 'TechSupport', 'BrandTone'];

  const routeDescriptions = {
    'Auto': 'Each route has specialized access to facility resources',
    'Emergency': 'Emergency protocols, booking systems, equipment guides, service scripts',
    'Booking & Access': 'Booking systems, equipment guides, service scripts',
    'TechSupport': 'Equipment guides, service scripts',
    'BrandTone': 'Service scripts'
  };

  const handleSubmit = async () => {
    if (!requestDescription.trim()) {
      notify('error', 'Please describe your request');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/llm/request`, {
        requestDescription,
        location: location || undefined,
        routePreference: forceRoute,
        smartAssist,
        ticketMode,
        userEmail: user?.email
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`
        }
      });

      if (response.data.success) {
        setResponse(response.data.data);
        setShowResponse(true);
        notify('success', 'Request processed successfully');
      }
    } catch (error: any) {
      console.error('Request failed:', error);
      notify('error', error.response?.data?.message || 'Failed to process request');
    } finally {
      setIsLoading(false);
    }
  };

  const markNotHelpful = async () => {
    if (!response) return;
    
    try {
      await axios.post(`${API_URL}/feedback/not-useful`, {
        requestDescription,
        location,
        route: response.selectedRoute,
        confidence: response.confidence,
        response: response.response,
        userEmail: user?.email
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`
        }
      });
      
      notify('info', 'Feedback recorded. Thank you!');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const reset = () => {
    setRequestDescription('');
    setLocation('');
    setForceRoute('Auto');
    setSmartAssist(true);
    setTicketMode(false);
    setShowResponse(false);
    setResponse(null);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Head>
        <title>ClubOSV1 - AI Command Center</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-[var(--text-secondary)]">
            AI-powered assistant for facility management
          </p>
        </div>

        <div className="card">
          <div className="space-y-6">
            {/* Request Description */}
            <div>
              <label className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Request Description
                </span>
                <button
                  onClick={() => setTicketMode(!ticketMode)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    ticketMode 
                      ? 'bg-[var(--accent)] text-white' 
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  Ticket Mode {ticketMode ? 'ON' : 'OFF'}
                </button>
              </label>
              <textarea
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                placeholder="e.g., What to do when the power is out, customer says equipment is frozen, booking cancellation request..."
                className="w-full h-32 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {ticketMode ? 'This request will create a support ticket' : 'Direct AI assistance mode'}
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Location (Optional)
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Floor, Bay 3, Gym Area"
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Add location context if relevant to your request
              </p>
            </div>

            {/* Route Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Force Bot Route (Optional)
              </label>
              
              <div className="space-y-3">
                <div className="relative">
                  <button
                    onClick={() => setShowRouteDropdown(!showRouteDropdown)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg flex items-center justify-between hover:border-[var(--accent)] transition-colors"
                  >
                    <span className={forceRoute === 'Auto' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>
                      {forceRoute}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${showRouteDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showRouteDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden">
                      {routeOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setForceRoute(option);
                            setShowRouteDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group"
                        >
                          <span className={option === forceRoute ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}>
                            {option}
                          </span>
                          {option === forceRoute && (
                            <span className="text-[var(--accent)]">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-[var(--text-muted)]">
                  {routeDescriptions[forceRoute]}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Select 'Auto' for smart routing or manually choose for specific expertise.
                </p>
              </div>
            </div>

            {/* Smart Assist Toggle */}
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
              <div>
                <label className="text-sm font-medium">Smart Assist (AI)</label>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {smartAssist ? 'AI-powered responses enabled' : 'Manual mode - routes to Slack'}
                </p>
              </div>
              <button
                onClick={() => setSmartAssist(!smartAssist)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  smartAssist ? 'bg-[var(--accent)]' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    smartAssist ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={isLoading || !requestDescription.trim()}
                className="flex-1 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'PROCESSING...' : 'PROCESS REQUEST'}
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                RESET
              </button>
            </div>
          </div>
        </div>

        {/* Response Section */}
        {showResponse && response && (
          <div className="card mt-6 animate-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Response</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Route: <span className="text-[var(--accent)]">{response.selectedRoute}</span>
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    Confidence: <span className="text-[var(--accent)]">{Math.round((response.confidence || 0) * 100)}%</span>
                  </span>
                </div>
              </div>
              
              <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <p className="whitespace-pre-wrap">{response.response}</p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={markNotHelpful}
                  className="px-4 py-2 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  Not Helpful
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(response.response);
                    notify('success', 'Copied to clipboard');
                  }}
                  className="px-4 py-2 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Copy Response
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

        {/* External Tools Section */}
        <div className="card mt-6">
          <h3 className="text-lg font-semibold mb-4">External Tools</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
              href="https://app.skedda.com/register?i=277234"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center"
            >
              <div className="text-2xl mb-1">Skedda</div>
              <div className="text-sm">Skedda</div>
            </a>
            
              href="https://my.splashtop.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center"
            >
              <div className="text-2xl mb-1">Remote</div>
              <div className="text-sm">Splashtop</div>
            </a>
            
              href="https://app.hubspot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center"
            >
              <div className="text-2xl mb-1">CRM</div>
              <div className="text-sm">HubSpot</div>
            </a>
            
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center"
            >
              <div className="text-2xl mb-1">Pay</div>
              <div className="text-sm">Stripe</div>
            </a>
          </div>
        </div>
