import { useCallback, useEffect } from 'react';
import { useStore, useRequestState, useHistoryState, useAnalyticsState } from './useStore';
import { submitRequest as apiSubmitRequest } from '@/api/apiClient';
import axios from 'axios';
import type { UserRequest, HistoryEntry } from '@/types/request';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Hook for handling request submission
export const useRequestSubmission = () => {
  const {
    currentRequest,
    isSubmitting,
    lastResponse,
    error,
    setCurrentRequest,
    setSubmitting,
    setLastResponse,
    setError,
    resetRequestState,
  } = useRequestState();

  const submitRequest = useCallback(async (request: UserRequest) => {
    console.log('submitRequest called in hook');
    try {
      setSubmitting(true);
      console.log('Set submitting to true');
      setError(null);
      
      const response = await apiSubmitRequest(request);
      console.log('Got response:', response);
      
      if (response.success) {
        setLastResponse(response.data);
        return response.data;
      } else {
        throw new Error(response.error || 'Request failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      console.log('Setting submitting to false');
      setSubmitting(false);
    }
  }, [setSubmitting, setLastResponse, setError]);

  return {
    currentRequest,
    isSubmitting,
    lastResponse,
    error,
    setCurrentRequest,
    submitRequest,
    resetRequestState,
    setLastResponse,
  };
};

// Hook for fetching and managing history
export const useRequestHistory = () => {
  const {
    entries,
    isLoading,
    totalCount,
    currentPage,
    pageSize,
    filter,
    setHistoryEntries,
    setHistoryLoading,
    setHistoryFilter,
    clearHistoryFilter,
    setHistoryPagination,
  } = useHistoryState();

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });

      if (filter.status) params.append('status', filter.status);
      if (filter.botRoute) params.append('botRoute', filter.botRoute);
      if (filter.dateRange?.start) params.append('startDate', filter.dateRange.start.toISOString());
      if (filter.dateRange?.end) params.append('endDate', filter.dateRange.end.toISOString());

      const response = await axios.get(`${API_URL}/history?${params}`);
      
      if (response.data.success) {
        setHistoryEntries(response.data.data.entries);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentPage, pageSize, filter, setHistoryEntries, setHistoryLoading]);

  // Auto-fetch when filters change
  useEffect(() => {
    fetchHistory();
  }, [currentPage, pageSize, filter]);

  return {
    entries,
    isLoading,
    totalCount,
    currentPage,
    pageSize,
    filter,
    fetchHistory,
    setFilter: setHistoryFilter,
    clearFilter: clearHistoryFilter,
    setPagination: setHistoryPagination,
  };
};

// Hook for analytics data
export const useAnalytics = () => {
  const {
    stats,
    isLoading,
    period,
    setStats,
    setAnalyticsPeriod,
    setAnalyticsLoading,
  } = useAnalyticsState();

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      
      const response = await axios.get(`${API_URL}/history/stats/overview`, {
        params: { period: period || '24h' },  // Default to 24h for "today"
      });
      
      if (response.data.success) {
        const data = response.data.data.stats;
        setStats({
          totalRequests: data.totalRequests,
          successRate: data.totalRequests > 0 ? (data.byStatus.completed / data.totalRequests * 100) : 0,
          avgResponseTime: data.averageProcessingTime,
          routeDistribution: data.byRoute,
          peakHour: data.peakHour,
        });
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [period, setStats, setAnalyticsLoading]);

  // Auto-fetch when period changes
  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  return {
    stats,
    isLoading,
    period: period || '24h',  // Ensure we always have a period
    setPeriod: setAnalyticsPeriod,
    refresh: fetchAnalytics,
  };
};

// Hook for demo mode
export const useDemoMode = () => {
  const demoMode = useStore((state) => state.demoMode);
  const setDemoMode = useStore((state) => state.setDemoMode);
  const { setCurrentRequest, submitRequest } = useRequestSubmission();

  const runDemo = useCallback(async () => {
    setDemoMode(true);
    
    // Demo request data
    const demoRequest: UserRequest = {
      requestDescription: "Customer says equipment is frozen",
      location: "Halifax Bay 3",
      routePreference: "TechSupport",
      smartAssistEnabled: true,
    } as any;

    // Set the request in the form
    setCurrentRequest(demoRequest);

    // Wait a bit for visual effect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit the request
    try {
      await submitRequest(demoRequest);
    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      setDemoMode(false);
    }
  }, [setDemoMode, setCurrentRequest, submitRequest]);

  return {
    demoMode,
    runDemo,
  };
};

// Hook for system status
export const useSystemStatus = () => {
  const config = useStore((state) => state.config);
  const updateConfig = useStore((state) => state.updateConfig);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const [llmStatus, slackStatus] = await Promise.all([
        axios.get(`${API_URL}/llm/status`),
        axios.get(`${API_URL}/slack/status`),
      ]);

      updateConfig({
        llmEnabled: llmStatus.data.data.enabled,
        slackFallbackEnabled: slackStatus.data.data.enabled,
      });

      return {
        llm: llmStatus.data.data,
        slack: slackStatus.data.data,
      };
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return null;
    }
  }, [updateConfig]);

  return {
    config,
    fetchSystemStatus,
    updateConfig,
  };
};

// Hook for notifications
export const useNotifications = () => {
  const notifications = useStore((state) => state.notifications);
  const addNotification = useStore((state) => state.addNotification);
  const removeNotification = useStore((state) => state.removeNotification);
  const clearNotifications = useStore((state) => state.clearNotifications);

  const notify = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    addNotification({ type, message });
  }, [addNotification]);

  return {
    notifications,
    notify,
    removeNotification,
    clearNotifications,
  };
};
