import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { Loader, Send, HelpCircle, CheckCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FormData {
  question: string;
}

export default function ClubOSBoy() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();

  // Auto-reset after successful submission
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        reset();
        setShowResponse(false);
        setResponse(null);
        setIsSuccess(false);
      }, 30000); // Reset after 30 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isSuccess, reset]);

  const onSubmit = async (data: FormData) => {
    setIsProcessing(true);
    setShowResponse(false);
    setResponse(null);
    
    try {
      const response = await axios.post(`${API_URL}/customer/ask`, {
        question: data.question,
        location: 'Customer Kiosk',
        kioskId: 'main-lobby'
      });
      
      if (response.data.success) {
        const aiResponse = response.data.data.response || 
                          "I'll help you with that. A staff member will assist you shortly.";
        setResponse(aiResponse);
        setShowResponse(true);
        setIsSuccess(true);
      }
    } catch (error) {
      console.error('Request failed:', error);
      setResponse("I'm having trouble right now. Please ask a staff member for help.");
      setShowResponse(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewQuestion = () => {
    reset();
    setShowResponse(false);
    setResponse(null);
    setIsSuccess(false);
  };

  return (
    <>
      <Head>
        <title>ClubOS Boy - How can I help?</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <main className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f1f1f] to-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">ClubOS Boy</h1>
            </div>
            <p className="text-lg text-gray-400">
              Hi! I'm here to help. Ask me anything about ClubHouse247 Golf.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl p-8 border border-gray-800">
            {!showResponse ? (
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="question" className="block text-sm font-medium text-gray-400 mb-2">
                      What can I help you with today?
                    </label>
                    <textarea
                      id="question"
                      {...register('question', {
                        required: 'Please ask a question',
                        minLength: {
                          value: 5,
                          message: 'Please provide more details',
                        },
                      })}
                      className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all text-lg"
                      placeholder="e.g., What are your hours? Do you have lessons? How do I book a bay?"
                      rows={4}
                      disabled={isProcessing}
                      autoFocus
                    />
                    {errors.question && (
                      <p className="mt-2 text-sm text-red-500">{errors.question.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-4 bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 text-lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Getting answer...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Ask ClubOS Boy
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-[var(--bg-primary)] rounded-lg p-6 border border-gray-700">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">Here's what I found:</h3>
                      <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNewQuestion}
                  className="w-full py-4 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  Ask Another Question
                </button>

                <p className="text-center text-sm text-gray-500">
                  This screen will reset in 30 seconds
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need more help? Ask our friendly staff!
            </p>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* Custom styles for customer interface */
        :global(body) {
          overflow: hidden;
        }
        
        /* Larger text for better readability */
        @media (min-width: 768px) {
          textarea {
            font-size: 1.125rem !important;
          }
        }
        
        /* Prevent text selection for kiosk mode */
        main {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        
        /* Allow text selection only in input areas */
        textarea, p {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
      `}</style>
    </>
  );
}