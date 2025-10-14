import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, ChevronDown, ChevronUp, MapPin, Filter, Search,
  Layers, AlertCircle, Loader2, AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from '../shared/BottomSheet';
import { FloatingActionButton } from '../shared/FloatingActionButton';
import ErrorBoundary from '../shared/ErrorBoundary';

// Import extracted components
import TicketCard from './TicketCard';
import TicketDetailContent from './TicketDetailContent';
import TicketDetailModal from './TicketDetailModal';

// Import types and helpers
import type {
  Ticket, TicketStatus, TicketCategory, TabFilter,
  QuickFilter, TimeUrgency, Comment
} from '@/types/ticket.types';
import {
  priorityConfig, getStatusConfig, formatTimeAgo, getTimeUrgency,
  LOCATION_CONFIG, ALL_LOCATIONS
} from '@/utils/ticketHelpers';

const TicketCenterV4: React.FC = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isMobile = useIsMobile();

  // State management
  const [activeTab, setActiveTab] = useState<TabFilter>('active');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showTicketDetail, setShowTicketDetail] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedGroupBy = localStorage.getItem('ticketGroupByLocation');
    if (savedGroupBy === 'true') {
      setGroupByLocation(true);
      setExpandedLocations(new Set(ALL_LOCATIONS));
    }
  }, []);

  // Load tickets on mount and when filters change
  useEffect(() => {
    loadTickets();
  }, [activeTab, selectedLocation, categoryFilter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const token = tokenManager.getToken();
      if (!token) {
        notify('error', 'Please login to view tickets');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (selectedLocation !== 'all') {
        params.append('location', selectedLocation);
      }

      const response = await http.get(`tickets?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setTickets(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to load tickets:', error);
      notify('error', 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Filter tickets based on tab and quick filters
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    // Filter by tab
    if (activeTab === 'active') {
      filtered = filtered.filter(t => t.status === 'open' || t.status === 'in-progress');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'resolved' || t.status === 'closed');
    } else if (activeTab === 'archived') {
      filtered = filtered.filter(t => t.status === 'archived');
    }

    // Apply quick filters
    if (quickFilter === 'urgent') {
      filtered = filtered.filter(t => t.priority === 'urgent' || t.priority === 'high');
    } else if (quickFilter === 'my-tickets') {
      filtered = filtered.filter(t => t.createdBy.id === user?.id || t.assignedTo?.id === user?.id);
    } else if (quickFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assignedTo);
    }

    return filtered;
  }, [tickets, activeTab, quickFilter, user]);

  // Count tickets by status
  const statusCounts = useMemo(() => {
    return {
      active: tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length,
      resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
      archived: tickets.filter(t => t.status === 'archived').length
    };
  }, [tickets]);

  // Filter locations by search
  const filteredLocations = useMemo(() => {
    if (!locationSearch) return ALL_LOCATIONS;
    const search = locationSearch.toLowerCase();
    return ALL_LOCATIONS.filter(loc => loc.toLowerCase().includes(search));
  }, [locationSearch]);

  // Group tickets by location
  const groupedTickets = useMemo(() => {
    if (!groupByLocation) return { all: filteredTickets };

    const groups: Record<string, Ticket[]> = {};
    filteredTickets.forEach(ticket => {
      const location = ticket.location || 'No Location';
      if (!groups[location]) {
        groups[location] = [];
      }
      groups[location].push(ticket);
    });

    // Sort groups by ticket count and tickets by age
    const sortedGroups: Record<string, Ticket[]> = {};
    Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([key, value]) => {
        sortedGroups[key] = value.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

    return sortedGroups;
  }, [filteredTickets, groupByLocation]);

  // Event handlers with useCallback for optimization
  const toggleGroupByLocation = useCallback(() => {
    const newValue = !groupByLocation;
    setGroupByLocation(newValue);
    localStorage.setItem('ticketGroupByLocation', String(newValue));
    if (newValue) {
      setExpandedLocations(new Set(ALL_LOCATIONS));
    }
  }, [groupByLocation]);

  const toggleLocationExpansion = useCallback((location: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(location)) {
        newSet.delete(location);
      } else {
        newSet.add(location);
      }
      return newSet;
    });
  }, []);

  const updateTicketStatus = useCallback(async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const token = tokenManager.getToken();
      const response = await http.patch(
        `tickets/${ticketId}/status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Ticket status updated');
        setTickets(prevTickets =>
          prevTickets.map(ticket =>
            ticket.id === ticketId
              ? { ...ticket, status: newStatus, updatedAt: new Date().toISOString() }
              : ticket
          )
        );

        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
        }
      }
    } catch (error) {
      logger.error('Failed to update ticket status:', error);
      toast.error('Failed to update ticket status');
    }
  }, [selectedTicket]);

  const archiveTicket = useCallback(async (ticketId: string) => {
    if (!confirm('Archive this ticket?')) return;

    try {
      const token = tokenManager.getToken();
      const response = await http.patch(
        `tickets/${ticketId}/status`,
        { status: 'archived' },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Ticket archived');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
          setShowTicketDetail(false);
        }
      }
    } catch (error) {
      toast.error('Failed to archive ticket');
    }
  }, [selectedTicket]);

  const addComment = useCallback(async (ticketId: string) => {
    if (!newComment.trim()) return;

    try {
      const token = tokenManager.getToken();
      const response = await http.post(
        `tickets/${ticketId}/comments`,
        { text: newComment },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Comment added');
        const newCommentData: Comment = response.data.data;
        setNewComment('');

        if (selectedTicket?.id === ticketId) {
          const updatedTicket = {
            ...selectedTicket,
            comments: [...(selectedTicket.comments || []), newCommentData],
            updatedAt: new Date().toISOString()
          };
          setSelectedTicket(updatedTicket);

          setTickets(prevTickets =>
            prevTickets.map(ticket =>
              ticket.id === ticketId ? updatedTicket : ticket
            )
          );
        }
      }
    } catch (error) {
      toast.error('Failed to add comment');
    }
  }, [newComment, selectedTicket]);

  const handleTicketSelect = useCallback(async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowTicketDetail(true);

    // Load full ticket details
    try {
      const token = tokenManager.getToken();
      const response = await http.get(`tickets/${ticket.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setSelectedTicket(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to load ticket details:', error);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowTicketDetail(false);
    setSelectedTicket(null);
    setNewComment('');
  }, []);

  return (
    <ErrorBoundary fallbackMessage="Unable to load ticket center">
      <div className="space-y-4">
        {/* Unified Filter Container */}
        <div className="card p-0">
          {/* Status Tabs Section */}
          <div className="p-3 border-b border-[var(--border-secondary)]">
            <div className="flex gap-2">
              {[
                { id: 'active' as TabFilter, label: 'Active', count: statusCounts.active },
                { id: 'resolved' as TabFilter, label: 'Resolved', count: statusCounts.resolved },
                { id: 'archived' as TabFilter, label: 'Archived', count: statusCounts.archived }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 touch-manipulation
                    ${activeTab === tab.id
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                  style={{ minHeight: '44px' }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded-full
                        ${activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }
                      `}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Filters Section */}
          <div className="p-3 border-b border-[var(--border-secondary)]">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all' as QuickFilter, label: 'All' },
                { id: 'urgent' as QuickFilter, label: 'Urgent', icon: <AlertTriangle className="w-3 h-3" /> },
                { id: 'my-tickets' as QuickFilter, label: 'Mine' },
                { id: 'unassigned' as QuickFilter, label: 'Unassigned' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setQuickFilter(filter.id)}
                  className={`
                    px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 touch-manipulation whitespace-nowrap
                    ${quickFilter === filter.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }
                    ${filter.icon ? 'flex items-center gap-1.5' : ''}
                  `}
                  style={{ minHeight: '36px' }}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              ))}

              <div className="ml-auto flex items-center">
                <button
                  onClick={toggleGroupByLocation}
                  className={`
                    p-2 rounded-md transition-all duration-200 touch-manipulation
                    ${groupByLocation
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                  title="Group by Location"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Location and Category Section */}
          <div className="p-3">
            <div className="flex gap-2 items-center">
              {/* Location Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLocationFilter(!showLocationFilter)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-sm touch-manipulation
                    ${selectedLocation !== 'all'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                  style={{ minHeight: '36px' }}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{selectedLocation === 'all' ? 'All Locations' : selectedLocation}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showLocationFilter ? 'rotate-180' : ''}`} />
                </button>

                {/* Location Dropdown */}
                {showLocationFilter && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg shadow-lg z-10 overflow-hidden">
                    <div className="p-2 border-b border-[var(--border-secondary)]">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          placeholder="Search locations..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedLocation('all');
                          setShowLocationFilter(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors ${
                          selectedLocation === 'all' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : ''
                        }`}
                      >
                        All Locations
                      </button>
                      {Object.entries(LOCATION_CONFIG).map(([province, locations]) => (
                        <div key={province}>
                          <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-primary)]">
                            {province}
                          </div>
                          {locations.filter(loc => filteredLocations.includes(loc)).map(location => (
                            <button
                              key={location}
                              onClick={() => {
                                setSelectedLocation(location);
                                setShowLocationFilter(false);
                              }}
                              className={`w-full px-6 py-2 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors ${
                                selectedLocation === location ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : ''
                              }`}
                            >
                              {location}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="w-px h-8 bg-[var(--border-secondary)]" />

              {/* Category Filters */}
              <div className="flex gap-2">
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'facilities' as const, label: 'Facilities' },
                  { id: 'tech' as const, label: 'Tech' }
                ].map(category => (
                  <button
                    key={category.id}
                    onClick={() => setCategoryFilter(category.id)}
                    className={`
                      px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 touch-manipulation
                      ${categoryFilter === category.id
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }
                    `}
                    style={{ minHeight: '36px' }}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket List */}
        <div className="card">
          <div className="space-y-3">
            {loading ? (
              // Loading skeletons
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="rounded-lg p-3 border border-[var(--border-secondary)]">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3 mb-2" />
                          <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/2 mb-2" />
                          <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/4" />
                        </div>
                        <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              // Empty state
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <p className="text-sm text-[var(--text-secondary)]">
                  No {activeTab} tickets found
                </p>
                <button
                  onClick={() => router.push('/?ticketMode=true')}
                  className="mt-4 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  Create First Ticket
                </button>
              </div>
            ) : (
              // Render tickets
              Object.entries(groupedTickets).map(([location, locationTickets]) => (
                <div key={location} className="space-y-3">
                  {/* Location header (if grouping is enabled) */}
                  {groupByLocation && location !== 'all' && (
                    <button
                      onClick={() => toggleLocationExpansion(location)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        {expandedLocations.has(location) ? (
                          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                        <span className="font-medium text-sm">{location}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {locationTickets.length} {locationTickets.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Ticket cards */}
                  {(!groupByLocation || location === 'all' || expandedLocations.has(location)) && (
                    <div className="space-y-2">
                      {(locationTickets as Ticket[]).map(ticket => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          onSelect={() => handleTicketSelect(ticket)}
                          onResolve={() => updateTicketStatus(ticket.id, 'resolved')}
                          onArchive={() => archiveTicket(ticket.id)}
                          onPhotoClick={(photo) => setSelectedPhoto(photo)}
                          priorityConfig={priorityConfig}
                          getStatusConfig={getStatusConfig}
                          formatTimeAgo={formatTimeAgo}
                          getTimeUrgency={getTimeUrgency}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto}
              alt="Full size"
              className="max-w-full max-h-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Ticket Detail Modal - Polished */}
        {showTicketDetail && selectedTicket && (
          isMobile ? (
            <BottomSheet
              isOpen={showTicketDetail}
              onClose={handleCloseDetail}
              title="Ticket Details"
            >
              <TicketDetailContent
                ticket={selectedTicket}
                onUpdateStatus={updateTicketStatus}
                onAddComment={() => addComment(selectedTicket.id)}
                newComment={newComment}
                setNewComment={setNewComment}
                priorityConfig={priorityConfig}
                getStatusConfig={getStatusConfig}
              />
            </BottomSheet>
          ) : (
            <TicketDetailModal
              ticket={selectedTicket}
              onClose={handleCloseDetail}
              onUpdateStatus={updateTicketStatus}
              onAddComment={() => addComment(selectedTicket.id)}
              newComment={newComment}
              setNewComment={setNewComment}
              priorityConfig={priorityConfig}
              getStatusConfig={getStatusConfig}
            />
          )
        )}

        {/* Floating Action Button for mobile */}
        {isMobile && (
          <FloatingActionButton
            onClick={() => router.push('/?ticketMode=true')}
            label="Create new ticket"
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default TicketCenterV4;