import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Check, Clock, AlertCircle, MessageSquare, X, ChevronRight, ChevronDown, ChevronUp, MapPin, Archive, Filter, Camera, Layers } from 'lucide-react';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';

type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'archived';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'facilities' | 'tech';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  location?: string;
  photo_urls?: string[];
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: Comment[];
}

interface Comment {
  id: string;
  text: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

const TicketCenterOptimizedV2 = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const { user } = useAuthState();

  // Simplified tabs: Active, Resolved, Archived
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'archived'>('active');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showTicketDetail, setShowTicketDetail] = useState(false);

  const locations = ['Bedford', 'Dartmouth', 'River Oaks', 'Bayers Lake', 'Stratford', 'Truro', 'Halifax'];

  // Load saved preferences
  useEffect(() => {
    const savedGroupBy = localStorage.getItem('ticketGroupByLocation');
    if (savedGroupBy === 'true') {
      setGroupByLocation(true);
      // Expand all locations by default when grouping is enabled
      setExpandedLocations(new Set(locations));
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
      notify('error', 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Filter tickets based on tab and status
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

    // Apply status filter if not 'all'
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    return filtered;
  }, [tickets, activeTab, statusFilter]);

  // Count tickets by location
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tickets.length };
    locations.forEach(loc => {
      counts[loc] = tickets.filter(t => t.location === loc).length;
    });
    return counts;
  }, [tickets]);

  // Count tickets by status
  const statusCounts = useMemo(() => {
    const counts = {
      all: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      'in-progress': tickets.filter(t => t.status === 'in-progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };
    return counts;
  }, [tickets]);

  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'text-yellow-600 bg-yellow-500/10';
      case 'in-progress': return 'text-blue-600 bg-blue-500/10';
      case 'resolved': return 'text-green-600 bg-green-500/10';
      case 'closed': return 'text-gray-600 bg-gray-500/10';
      case 'archived': return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get urgency based on age
  const getTimeUrgency = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const hours = Math.floor((now.getTime() - then.getTime()) / 3600000);

    if (hours >= 72) return 'critical';
    if (hours >= 48) return 'high';
    if (hours >= 24) return 'medium';
    return 'normal';
  };

  // Get location background color
  const getLocationColor = (location?: string) => {
    if (!location) return '';
    const locationKey = location.toLowerCase().replace(/\s+/g, '-');
    return `var(--location-${locationKey})`;
  };

  // Toggle group by location
  const toggleGroupByLocation = () => {
    const newValue = !groupByLocation;
    setGroupByLocation(newValue);
    localStorage.setItem('ticketGroupByLocation', String(newValue));
    if (newValue) {
      // Expand all locations when enabling grouping
      setExpandedLocations(new Set(locations));
    }
  };

  // Toggle location expansion
  const toggleLocationExpansion = (location: string) => {
    const newSet = new Set(expandedLocations);
    if (newSet.has(location)) {
      newSet.delete(location);
    } else {
      newSet.add(location);
    }
    setExpandedLocations(newSet);
  };

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

    // Sort groups by ticket count (descending)
    const sortedGroups: Record<string, Ticket[]> = {};
    Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([key, value]) => {
        // Sort tickets within each group by age (oldest first)
        sortedGroups[key] = value.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

    return sortedGroups;
  }, [filteredTickets, groupByLocation]);

  // Count urgent tickets by location
  const urgentByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(ticket => {
      if ((ticket.status === 'open' || ticket.status === 'in-progress') &&
          (ticket.priority === 'urgent' || getTimeUrgency(ticket.createdAt) === 'critical')) {
        const loc = ticket.location || 'No Location';
        counts[loc] = (counts[loc] || 0) + 1;
      }
    });
    return counts;
  }, [tickets]);

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
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
        notify('success', 'Ticket status updated');
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
      notify('error', 'Failed to update ticket status');
    }
  };

  const archiveTicket = async (ticketId: string) => {
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
        notify('success', 'Ticket archived');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
          setShowTicketDetail(false);
        }
      }
    } catch (error: any) {
      notify('error', 'Failed to archive ticket');
    }
  };

  const addComment = async (ticketId: string) => {
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
        notify('success', 'Comment added');
        const newCommentData = response.data.data;
        setNewComment('');

        // Update the selected ticket with the new comment
        if (selectedTicket?.id === ticketId) {
          const updatedTicket = {
            ...selectedTicket,
            comments: [...(selectedTicket.comments || []), newCommentData],
            updatedAt: new Date().toISOString()
          };
          setSelectedTicket(updatedTicket);

          // Also update the tickets list
          setTickets(prevTickets =>
            prevTickets.map(ticket =>
              ticket.id === ticketId ? updatedTicket : ticket
            )
          );
        } else {
          // If not the selected ticket, just update the tickets list
          setTickets(prevTickets =>
            prevTickets.map(ticket =>
              ticket.id === ticketId
                ? {
                    ...ticket,
                    comments: [...(ticket.comments || []), newCommentData],
                    updatedAt: new Date().toISOString()
                  }
                : ticket
            )
          );
        }
      }
    } catch (error) {
      notify('error', 'Failed to add comment');
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Card Container */}
      <div className="card">
        {/* Header with tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2 text-sm font-semibold transition-colors relative ${
                activeTab === 'active'
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Active
              {(statusCounts.open + statusCounts['in-progress']) > 0 && (
                <span className="ml-2 text-xs bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-full">
                  {statusCounts.open + statusCounts['in-progress']}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`pb-2 text-sm font-semibold transition-colors relative ${
                activeTab === 'resolved'
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Resolved
              {(statusCounts.resolved + statusCounts.closed) > 0 && (
                <span className="ml-2 text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded-full">
                  {statusCounts.resolved + statusCounts.closed}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`pb-2 text-sm font-semibold transition-colors relative ${
                activeTab === 'archived'
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Archived
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleGroupByLocation}
              className={`p-1.5 rounded-lg transition-all ${
                groupByLocation
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Group by Location"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/?ticketMode=true')}
              className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>

        {/* Location Summary Bar */}
        {activeTab === 'active' && (
          <div className="flex items-center gap-2 mb-3 text-xs overflow-x-auto scrollbar-hide pb-1">
            {locations.map(location => {
              const count = tickets.filter(t =>
                t.location === location &&
                (t.status === 'open' || t.status === 'in-progress')
              ).length;
              const urgentCount = urgentByLocation[location] || 0;

              if (count === 0) return null;

              return (
                <button
                  key={location}
                  onClick={() => {
                    setSelectedLocation(selectedLocation === location ? 'all' : location);
                    setShowLocationFilter(false);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md whitespace-nowrap transition-all ${
                    selectedLocation === location
                      ? 'bg-[var(--accent)] text-white'
                      : urgentCount > 0
                      ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <span>{location}</span>
                  <span className={`font-semibold ${urgentCount > 0 ? '' : 'opacity-75'}`}>
                    ({count})
                  </span>
                  {urgentCount > 0 && (
                    <span className="text-red-500 font-bold animate-pulse">!</span>
                  )}
                </button>
              );
            })}
            {selectedLocation !== 'all' && (
              <button
                onClick={() => setSelectedLocation('all')}
                className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Filters Section */}
        <div className="space-y-3 mb-4">
          {/* Location Filter - Collapsible on mobile */}
          <div className="border border-[var(--border-secondary)] rounded-lg">
            <button
              onClick={() => setShowLocationFilter(!showLocationFilter)}
              className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium">
                  {selectedLocation === 'all' ? 'All Locations' : selectedLocation}
                </span>
                {selectedLocation !== 'all' && (
                  <span className="text-xs bg-[var(--accent)] text-white px-2 py-0.5 rounded-full">
                    {locationCounts[selectedLocation]}
                  </span>
                )}
              </div>
              {showLocationFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Location List - Vertical layout */}
            {showLocationFilter && (
              <div className="p-2 space-y-1 border-t border-[var(--border-secondary)]">
                <button
                  onClick={() => {
                    setSelectedLocation('all');
                    setShowLocationFilter(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors ${
                    selectedLocation === 'all' ? 'bg-[var(--bg-tertiary)]' : ''
                  }`}
                >
                  <span className="text-sm">All Locations</span>
                  <span className="text-xs text-[var(--text-muted)]">{locationCounts.all}</span>
                </button>
                {locations.map(location => (
                  <button
                    key={location}
                    onClick={() => {
                      setSelectedLocation(location);
                      setShowLocationFilter(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors ${
                      selectedLocation === location ? 'bg-[var(--bg-tertiary)]' : ''
                    }`}
                  >
                    <span className="text-sm">{location}</span>
                    <span className="text-xs text-[var(--text-muted)]">{locationCounts[location] || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Filter - Simple toggle buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                categoryFilter === 'all'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setCategoryFilter('facilities')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                categoryFilter === 'facilities'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              Facilities
            </button>
            <button
              onClick={() => setCategoryFilter('tech')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                categoryFilter === 'tech'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              Tech
            </button>
          </div>
        </div>

        {/* Ticket List */}
        <div className="space-y-2">
          {loading ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-[var(--bg-secondary)] rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
              <p className="text-sm text-[var(--text-secondary)]">
                No {activeTab} tickets
              </p>
            </div>
          ) : (
            // Render grouped or ungrouped tickets
            Object.entries(groupedTickets).map(([location, locationTickets]) => (
              <div key={location} className="space-y-2">
                {/* Location header (only if grouping is enabled) */}
                {groupByLocation && location !== 'all' && (
                  <button
                    onClick={() => toggleLocationExpansion(location)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors sticky top-0 z-10"
                  >
                    <div className="flex items-center gap-2">
                      {expandedLocations.has(location) ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                      <span className="font-medium text-sm">{location}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {locationTickets.length} {locationTickets.length === 1 ? 'ticket' : 'tickets'}
                      </span>
                      {urgentByLocation[location] > 0 && (
                        <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded-full animate-pulse">
                          {urgentByLocation[location]} urgent
                        </span>
                      )}
                    </div>
                  </button>
                )}

                {/* Ticket cards */}
                {(!groupByLocation || location === 'all' || expandedLocations.has(location)) && (
                  <div className="space-y-2">
                    {locationTickets.map(ticket => {
                      const urgency = getTimeUrgency(ticket.createdAt);
                      const locationBg = getLocationColor(ticket.location);

                      return (
                        <div
                          key={ticket.id}
                          className="p-3 bg-[var(--bg-primary)] rounded-lg transition-all group cursor-pointer hover:bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]"
                          style={{
                            backgroundColor: locationBg,
                            borderLeft: `3px solid ${priorityColors[ticket.priority]}`
                          }}
                          onClick={async () => {
                            setSelectedTicket(ticket);
                            setShowTicketDetail(true);

                            // Load full ticket details with comments
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
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">
                                {ticket.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                                <span className={`px-2 py-0.5 rounded-full ${getStatusColor(ticket.status)}`}>
                                  {ticket.status.replace('-', ' ')}
                                </span>
                                <span>{ticket.category}</span>
                                {ticket.location && (
                                  <>
                                    <span>•</span>
                                    <span>{ticket.location}</span>
                                  </>
                                )}
                                <span>•</span>
                                {/* Time with urgency indicator */}
                                <span className={`flex items-center gap-1 ${
                                  urgency === 'critical' ? 'text-red-500 font-semibold animate-pulse' :
                                  urgency === 'high' ? 'text-orange-500 font-semibold' :
                                  urgency === 'medium' ? 'text-yellow-500 font-semibold' :
                                  ''
                                }`}>
                                  {urgency !== 'normal' && <Clock className="w-3 h-3" />}
                                  {formatTimeAgo(ticket.createdAt)}
                                </span>
                                {ticket.comments.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" />
                                      {ticket.comments.length}
                                    </span>
                                  </>
                                )}
                                {ticket.photo_urls && ticket.photo_urls.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Camera className="w-3 h-3" />
                                      {ticket.photo_urls.length}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Photo thumbnail */}
                            {ticket.photo_urls && ticket.photo_urls.length > 0 && (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={ticket.photo_urls[0]}
                                  alt="Ticket photo"
                                  className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhoto(ticket.photo_urls![0]);
                                  }}
                                />
                                {ticket.photo_urls.length > 1 && (
                                  <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-[10px] px-1 rounded-full">
                                    +{ticket.photo_urls.length - 1}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Quick actions - visible on hover */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(ticket.status === 'open' || ticket.status === 'in-progress') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateTicketStatus(ticket.id, 'resolved');
                                  }}
                                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                  title="Resolve"
                                >
                                  <Check className="w-4 h-4 text-green-500" />
                                </button>
                              )}
                              {ticket.status !== 'archived' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveTicket(ticket.id);
                                  }}
                                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="w-4 h-4 text-gray-500" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Ticket Detail Modal - Mobile optimized */}
      {showTicketDetail && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-[var(--bg-primary)] w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-lg overflow-hidden flex flex-col">
            {/* Mobile swipe indicator */}
            <div className="sm:hidden py-2">
              <div className="w-12 h-1 bg-gray-400 rounded-full mx-auto" />
            </div>

            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Ticket Details</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">#{selectedTicket.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => {
                  setShowTicketDetail(false);
                  setSelectedTicket(null);
                  setNewComment('');
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title and Description */}
              <div>
                <h3 className="font-medium text-lg mb-2">{selectedTicket.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <span className="text-[var(--text-muted)] text-xs">Status</span>
                  <div className={`mt-1 px-2 py-1 rounded-md inline-block ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace('-', ' ')}
                  </div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <span className="text-[var(--text-muted)] text-xs">Priority</span>
                  <div className="mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${priorityColors[selectedTicket.priority]} mr-2`} />
                    <span className="capitalize">{selectedTicket.priority}</span>
                  </div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <span className="text-[var(--text-muted)] text-xs">Category</span>
                  <div className="mt-1 capitalize">{selectedTicket.category}</div>
                </div>
                {selectedTicket.location && (
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <span className="text-[var(--text-muted)] text-xs">Location</span>
                    <div className="mt-1">{selectedTicket.location}</div>
                  </div>
                )}
              </div>

              {/* Status Update Buttons */}
              <div>
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Update Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['open', 'in-progress', 'resolved', 'closed', 'archived'] as TicketStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => updateTicketStatus(selectedTicket.id, status)}
                      disabled={selectedTicket.status === status}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedTicket.status === status
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {status.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos */}
              {selectedTicket.photo_urls && selectedTicket.photo_urls.length > 0 && (
                <div>
                  <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Photos ({selectedTicket.photo_urls.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedTicket.photo_urls.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(photo, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Comments ({selectedTicket.comments.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTicket.comments.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-4">No comments yet</p>
                  ) : (
                    selectedTicket.comments.map(comment => (
                      <div key={comment.id} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{comment.createdBy.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {formatTimeAgo(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Comment */}
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                  rows={3}
                />
                <button
                  onClick={() => addComment(selectedTicket.id)}
                  disabled={!newComment.trim()}
                  className="mt-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketCenterOptimizedV2;