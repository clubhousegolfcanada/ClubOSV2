import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { Loader } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FormData {
  question: string;
  location: string;
}

export default function ClubOSBoy() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [resetTimer, setResetTimer] = useState<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();

  // Clear any existing timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
    };
  }, [resetTimer]);

  // Heartbeat to keep session alive and prevent any timeouts
  useEffect(() => {
    // Ping the server every 5 minutes to keep connection alive
    const heartbeat = setInterval(() => {
      axios.get(`${API_URL}/health`)
        .catch(() => {
          // Silently ignore errors - this is just a keepalive
        });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(heartbeat);
  }, []);

  // Prevent page from being cached or timing out
  useEffect(() => {
    // Disable bfcache to ensure fresh page load
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        window.location.reload();
      }
    });

    // Keep the page active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page is visible again, ensure form is reset if needed
        if (!showResponse && !isProcessing) {
          reset();
        }
      }
    });
  }, [reset, showResponse, isProcessing]);

  const onSubmit = async (data: FormData) => {
    setIsProcessing(true);
    setShowResponse(false);
    
    // Clear any existing timer
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
    
    try {
      // Send directly to customer endpoint without authentication
      const request = {
        question: data.question,
        location: data.location || 'Customer Kiosk',
        kioskId: 'kiosk-1' // You can make this configurable if needed
      };

      const response = await axios.post(`${API_URL}/customer/ask`, request);
      
      if (response.data.success) {
        setResponseMessage("Thanks! Your question has been sent to our staff. Someone will help you shortly.");
        setShowResponse(true);
        
        // Set timer to reset after 30 seconds
        const timer = setTimeout(() => {
          reset();
          setShowResponse(false);
          setResponseMessage('');
        }, 30000);
        
        setResetTimer(timer);
      }
    } catch (error) {
      console.error('Request failed:', error);
      setResponseMessage("Sorry, something went wrong. Please ask a staff member for help.");
      setShowResponse(true);
      
      // Also set timer for error state
      const timer = setTimeout(() => {
        reset();
        setShowResponse(false);
        setResponseMessage('');
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
        <title>ClubOS Boy - Ask a Question</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="robots" content="noindex, nofollow" />
        {/* Prevent any caching */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              ClubOS Boy
            </h1>
            <p className="text-[var(--text-secondary)]">
              Ask any question about ClubHouse247 Golf
            </p>
          </div>

          {/* Main Card - matching RequestForm style */}
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
                    })}
                    className="form-textarea"
                    placeholder="e.g., The trackman is frozen what do I do? What is the wifi password? When is the next tournament?"
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
                    Location (optional)
                  </label>
                  <input
                    id="locationInput"
                    {...register('location')}
                    type="text"
                    className="form-input"
                    placeholder="e.g., Bedford Box 2, Dartmouth Box 4"
                    disabled={isProcessing}
                  />
                  <div className="form-helper">
                    Let us know where you are if it helps with your question
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="button-group">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="inline-block w-4 h-4 mr-2 animate-spin" />
                        Sending to Staff...
                      </>
                    ) : (
                      'Ask Question'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
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
                      className="btn btn-primary"
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

          {/* Footer Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Need immediate help? Call us at (902)707-3748
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
        
        /* Larger touch targets for kiosk */
        @media (min-width: 768px) {
          .btn {
            min-height: 3.5rem;
            font-size: 1.125rem;
          }
        }
      `}</style>
    </>
  );
}