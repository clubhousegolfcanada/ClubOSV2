import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { Loader } from 'lucide-react';


interface FormData {
  question: string;
  location: string;
}

export default function PublicClubOSBoy() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [resetTimer, setResetTimer] = useState<NodeJS.Timeout | null>(null);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();

  // Clear any existing timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [resetTimer, inactivityTimer]);

  // Auto-clear form after 60 seconds of inactivity
  useEffect(() => {
    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      const timer = setTimeout(() => {
        handleReset();
      }, 60000); // 60 seconds
      
      setInactivityTimer(timer);
    };

    // Set up event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Initial timer
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
    };
  }, [inactivityTimer]);

  const onSubmit = async (data: FormData) => {
    setIsProcessing(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/public/clubosboy`, {
        question: data.question,
        location: data.location || 'Not specified',
        source: 'public_hubspot'
      });

      if (response.data.success) {
        setResponseMessage(response.data.message || "Your question has been sent to our staff. We'll respond shortly!");
        setShowResponse(true);
        
        // Auto-reset after 30 seconds
        const timer = setTimeout(() => {
          handleReset();
        }, 30000);
        
        setResetTimer(timer);
      }
    } catch (error) {
      console.error('Request failed:', error);
      setResponseMessage("Sorry, something went wrong. Please text us directly at (902) 707-3748 for immediate help.");
      setShowResponse(true);
      
      // Also set timer for error state
      const timer = setTimeout(() => {
        handleReset();
      }, 30000);
      
      setResetTimer(timer);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    reset();
    setShowResponse(false);
    setResponseMessage('');
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  };

  return (
    <>
      <Head>
        <title>ClubHouse247 Golf - AI Assistant</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="description" content="Get instant help from ClubHouse247 Golf's AI assistant. Available 24/7 for all your golf simulator questions." />
        {/* Allow iframe embedding */}
        <meta httpEquiv="X-Frame-Options" content="ALLOWALL" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          {/* Title with Public Indicator */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              ClubOS Boy
            </h1>
            <p className="text-[var(--text-secondary)]">
              Ask any question about ClubHouse247 Golf
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Public Interface - Available 24/7
            </p>
          </div>

          {/* Main Card */}
          <div className="card">
            {!showResponse ? (
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Question Input */}
                <div className="form-group">
                  <label className="form-label" htmlFor="questionInput">
                    What can I help you with?
                  </label>
                  <textarea
                    id="questionInput"
                    {...register('question', {
                      required: 'Please enter your question',
                      minLength: {
                        value: 10,
                        message: 'Please provide more details',
                      },
                      maxLength: {
                        value: 500,
                        message: 'Please keep your question under 500 characters',
                      },
                    })}
                    className="form-textarea text-base md:text-lg"
                    placeholder="e.g., What are your hours? How do I book a simulator? What's the wifi password?"
                    rows={4}
                    disabled={isProcessing}
                    autoFocus
                  />
                  {errors.question && (
                    <p className="error-message">{errors.question.message}</p>
                  )}
                </div>

                {/* Location Input */}
                <div className="form-group">
                  <label className="form-label" htmlFor="locationInput">
                    Which location? (optional)
                  </label>
                  <input
                    id="locationInput"
                    {...register('location')}
                    type="text"
                    className="form-input text-base md:text-lg"
                    placeholder="e.g., Bedford, Dartmouth"
                    disabled={isProcessing}
                  />
                  <div className="form-helper">
                    Let us know which location you're asking about
                  </div>
                </div>

                {/* Submit Buttons with larger touch targets */}
                <div className="button-group">
                  <button
                    type="submit"
                    className="btn btn-primary min-h-[3.5rem] text-lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="inline-block w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Ask Question'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-[3.5rem] text-lg"
                    onClick={handleReset}
                    disabled={isProcessing}
                  >
                    Clear
                  </button>
                </div>
              </form>
            ) : (
              /* Response Display */
              <div className="response-area">
                <div className="response-content">
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                      Question Sent!
                    </h3>
                    <p className="text-[var(--text-secondary)] mb-6">
                      {responseMessage}
                    </p>
                    <button
                      onClick={handleReset}
                      className="btn btn-primary min-h-[3.5rem] text-lg"
                    >
                      Ask Another Question
                    </button>
                    <p className="text-sm text-[var(--text-muted)] mt-4">
                      This screen will reset automatically in 30 seconds
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact Details Section */}
          <div className="mt-8 bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 text-center">
              Contact the Clubhouse
            </h2>
            <p className="text-[var(--text-secondary)] text-center mb-6">
              Clubhouse provides 24/7 support for our members and guests. If we don't respond within 5 minutes, your next hour is on us!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-[var(--text-muted)] mb-1">Email</p>
                <a href="mailto:booking@clubhouse247golf.com" className="text-[var(--accent)] hover:underline">
                  booking@clubhouse247golf.com
                </a>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-muted)] mb-1">Instagram</p>
                <a href="https://instagram.com/clubhousegolfcanada" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  @clubhousegolfcanada
                </a>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[var(--text-secondary)] mb-4">
                Need immediate help?
              </p>
              <a 
                href="sms:9027073748" 
                className="inline-flex items-center justify-center px-8 py-4 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-lg min-h-[3.5rem]"
              >
                <svg className="w-6 h-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Text Now: (902) 707-3748
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              Powered by ClubOS - AI Golf Assistant
            </p>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* Prevent text selection for kiosk mode */
        main {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        
        /* Allow text selection only in input areas */
        textarea, input, p {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
        
        /* Ensure proper iframe behavior */
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
    </>
  );
}