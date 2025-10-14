import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Check, Clock, AlertCircle, MessageSquare, X, ChevronDown, ChevronUp,
  MapPin, Archive, Filter, Camera, Layers, Search, MoreVertical,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from './shared/BottomSheet';
import { FloatingActionButton } from './shared/FloatingActionButton';

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
  photoUrls?: string[];
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

// Province configuration for location grouping
const LOCATION_CONFIG: Record<string, string[]> = {
  'Nova Scotia': ['Bedford', 'Dartmouth', 'Halifax', 'Bayers Lake'],
  'Prince Edward Island': ['Stratford'],
  'Ontario': ['Truro'],
  'New Brunswick': ['River Oaks']
};

// Flatten locations for easy access
const ALL_LOCATIONS = Object.values(LOCATION_CONFIG).flat();

const TicketCenterV4 = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isMobile = useIsMobile();

  // State management
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'archived'>('active');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<'all' | 'urgent' | 'my-tickets' | 'unassigned'>('all');

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

  // Helper functions
  const priorityConfig = {
    urgent: {
      color: 'var(--status-error)',
      bg: 'bg-red-500/10',
      text: 'text-red-600',
      icon: <AlertTriangle className="w-3 h-3" />
    },
    high: {
      color: '#f97316',
      bg: 'bg-orange-500/10',
      text: 'text-orange-600',
      icon: <TrendingUp className="w-3 h-3" />
    },
    medium: {
      color: '#eab308',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600',
      icon: <AlertCircle className="w-3 h-3" />
    },
    low: {
      color: 'var(--status-success)',
      bg: 'bg-green-500/10',
      text: 'text-green-600',
      icon: <CheckCircle className="w-3 h-3" />
    }
  };

  const getStatusConfig = (status: TicketStatus) => {
    const configs = {
      'open': { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Open' },
      'in-progress': { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'In Progress' },
      'resolved': { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Resolved' },
      'closed': { bg: 'bg-gray-500/10', text: 'text-gray-600', label: 'Closed' },
      'archived': { bg: 'bg-gray-400/10', text: 'text-gray-500', label: 'Archived' }
    };
    return configs[status];
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

  const getTimeUrgency = (date: string) => {
    const hours = Math.floor((new Date().getTime() - new Date(date).getTime()) / 3600000);
    if (hours >= 72) return 'critical';
    if (hours >= 48) return 'high';
    if (hours >= 24) return 'medium';
    return 'normal';
  };


  const toggleGroupByLocation = () => {
    const newValue = !groupByLocation;
    setGroupByLocation(newValue);
    localStorage.setItem('ticketGroupByLocation', String(newValue));
    if (newValue) {
      setExpandedLocations(new Set(ALL_LOCATIONS));
    }
  };

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
        toast.success('Ticket archived');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
          setShowTicketDetail(false);
        }
      }
    } catch (error: any) {
      toast.error('Failed to archive ticket');
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
        toast.success('Comment added');
        const newCommentData = response.data.data;
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
  };

  return (
    <div className="space-y-4">
      {/* Unified Filter Container */}
      <div className="card p-0">
        {/* Status Tabs Section */}
        <div className="p-3 border-b border-[var(--border-secondary)]">
          <div className="flex gap-2">
            {[
              { id: 'active', label: 'Active', count: statusCounts.active },
              { id: 'resolved', label: 'Resolved', count: statusCounts.resolved },
              { id: 'archived', label: 'Archived', count: statusCounts.archived }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
              { id: 'all', label: 'All' },
              { id: 'urgent', label: 'Urgent', icon: <AlertTriangle className="w-3 h-3" /> },
              { id: 'my-tickets', label: 'Mine' },
              { id: 'unassigned', label: 'Unassigned' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setQuickFilter(filter.id as any)}
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
                { id: 'all', label: 'All' },
                { id: 'facilities', label: 'Facilities' },
                { id: 'tech', label: 'Tech' }
              ].map(category => (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id as any)}
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
                        onSelect={async () => {
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
                        }}
                        onResolve={() => updateTicketStatus(ticket.id, 'resolved')}
                        onArchive={() => archiveTicket(ticket.id)}
                        onPhotoClick={(photo) => setSelectedPhoto(photo)}
                        priorityConfig={priorityConfig}
                        getStatusConfig={getStatusConfig}
                        formatTimeAgo={formatTimeAgo}
                        getTimeUrgency={getTimeUrgency}
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
            onClose={() => {
              setShowTicketDetail(false);
              setSelectedTicket(null);
              setNewComment('');
            }}
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
            onClose={() => {
              setShowTicketDetail(false);
              setSelectedTicket(null);
              setNewComment('');
            }}
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
  );
};

// Ticket Card Component - Compact two-line professional design
const TicketCard: React.FC<{
  ticket: Ticket;
  onSelect: () => void;
  onResolve: () => void;
  onArchive: () => void;
  onPhotoClick: (photo: string) => void;
  priorityConfig: any;
  getStatusConfig: any;
  formatTimeAgo: (date: string) => string;
  getTimeUrgency: (date: string) => string;
}> = ({
  ticket, onSelect, onResolve, onArchive, onPhotoClick,
  priorityConfig, getStatusConfig, formatTimeAgo, getTimeUrgency
}) => {
  const urgency = getTimeUrgency(ticket.createdAt);
  const statusConfig = getStatusConfig(ticket.status);
  const priority = priorityConfig[ticket.priority];
  const isMobile = useIsMobile();

  // Get abbreviated location for mobile if needed
  const getLocationDisplay = (location: string) => {
    if (!location) return null;
    // On mobile, abbreviate long location names
    if (isMobile && location.length > 8) {
      // Special cases for known locations
      if (location === 'Bayers Lake') return 'BL';
      if (location === 'River Oaks') return 'RO';
      // Default: first 3 letters
      return location.substring(0, 3).toUpperCase();
    }
    return location;
  };

  return (
    <div
      className="group rounded-lg transition-all duration-200 hover:bg-[var(--bg-hover)] cursor-pointer border border-[var(--border-secondary)] hover:border-[var(--border-primary)]"
      style={{
        borderLeft: `3px solid ${priority.color}`
      }}
      onClick={onSelect}
    >
      <div className="p-2 md:p-2.5">
        {/* Two-line grid layout */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Left side: Title and metadata */}
          <div className="min-w-0">
            {/* Line 1: Location + Title + Time */}
            <div className="flex items-center gap-2 mb-1.5">
              {/* Location badge - compact */}
              {ticket.location && (
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
                  <MapPin className="w-2.5 h-2.5" />
                  {getLocationDisplay(ticket.location)}
                </span>
              )}

              {/* Title - single line with ellipsis */}
              <h4 className="flex-1 font-medium text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                {ticket.title}
              </h4>

              {/* Time - always visible, color indicates urgency */}
              <span className={`
                flex-shrink-0 text-xs
                ${urgency === 'critical' ? 'text-red-500 font-semibold' :
                  urgency === 'high' ? 'text-orange-500' :
                  urgency === 'medium' ? 'text-yellow-500' :
                  'text-[var(--text-muted)]'}
              `}>
                {formatTimeAgo(ticket.createdAt)}
              </span>
            </div>

            {/* Line 2: Status + Category + Metadata */}
            <div className="flex items-center gap-1.5 text-xs">
              {/* Status - compact pill */}
              <span className={`px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text} font-medium`}>
                {statusConfig.label}
              </span>

              {/* Priority - icon only on desktop, with text on mobile */}
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                {priority.icon}
                <span className={isMobile ? '' : 'hidden md:inline'}>{ticket.priority}</span>
              </span>

              {/* Category - compact */}
              <span className="px-1.5 py-0.5 text-[var(--text-muted)] capitalize">
                {ticket.category}
              </span>

              {/* Assigned to - if exists */}
              {ticket.assignedTo && (
                <span className="px-1.5 py-0.5 text-[var(--text-muted)]">
                  @{ticket.assignedTo.name.split(' ')[0]}
                </span>
              )}

              {/* Comments indicator */}
              {ticket.comments.length > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[var(--text-muted)]">
                  <MessageSquare className="w-3 h-3" />
                  {ticket.comments.length > 9 ? '9+' : ticket.comments.length}
                </span>
              )}

              {/* Photos indicator */}
              {ticket.photoUrls && ticket.photoUrls.length > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[var(--text-muted)]">
                  <Camera className="w-3 h-3" />
                  {ticket.photoUrls.length}
                </span>
              )}
            </div>
          </div>

          {/* Right side: Photo thumbnail and actions */}
          <div className="flex items-center gap-1">
            {/* Photo thumbnail - smaller */}
            {ticket.photoUrls && ticket.photoUrls.length > 0 && (
              <div className="relative flex-shrink-0">
                <img
                  src={ticket.photoUrls[0]}
                  alt="Ticket photo"
                  className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPhotoClick(ticket.photoUrls![0]);
                  }}
                />
                {ticket.photoUrls.length > 1 && (
                  <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-[9px] px-0.5 rounded-full leading-none">
                    +{ticket.photoUrls.length - 1}
                  </span>
                )}
              </div>
            )}

            {/* Quick actions - more compact, visible on mobile */}
            <div className={`flex gap-0.5 flex-shrink-0 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              {(ticket.status === 'open' || ticket.status === 'in-progress') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve();
                  }}
                  className="p-2 text-green-500 hover:bg-green-500/10 rounded transition-colors touch-manipulation"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="Resolve"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              {ticket.status !== 'archived' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-500/10 rounded transition-colors touch-manipulation"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="Archive"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Ticket Detail Content - Shared between mobile and desktop
const TicketDetailContent: React.FC<{
  ticket: Ticket;
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onAddComment: () => void;
  newComment: string;
  setNewComment: (comment: string) => void;
  priorityConfig: any;
  getStatusConfig: any;
}> = ({ ticket, onUpdateStatus, onAddComment, newComment, setNewComment, priorityConfig, getStatusConfig }) => {
  return (
    <div className="p-4 space-y-4">
      {/* Title and Description */}
      <div>
        <h3 className="font-medium text-lg mb-2 text-[var(--text-primary)]">{ticket.title}</h3>
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {ticket.description}
        </p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs block mb-1">Status</span>
          <select
            value={ticket.status}
            onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
            className={`w-full px-2 py-1 rounded-md text-sm font-medium border-0 cursor-pointer transition-all
              ${getStatusConfig(ticket.status).bg} ${getStatusConfig(ticket.status).text}
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1
            `}
            style={{ backgroundColor: 'transparent' }}
          >
            {(['open', 'in-progress', 'resolved', 'closed', 'archived'] as TicketStatus[]).map(status => (
              <option
                key={status}
                value={status}
                className="bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                {getStatusConfig(status).label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs">Priority</span>
          <div className="mt-1 flex items-center gap-1">
            {priorityConfig[ticket.priority].icon}
            <span className="capitalize">{ticket.priority}</span>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs">Category</span>
          <div className="mt-1 capitalize">{ticket.category}</div>
        </div>
        {ticket.location && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <span className="text-[var(--text-muted)] text-xs">Location</span>
            <div className="mt-1">{ticket.location}</div>
          </div>
        )}
      </div>

      {/* Photos */}
      {ticket.photoUrls && ticket.photoUrls.length > 0 && (
        <div>
          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Photos ({ticket.photoUrls.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {ticket.photoUrls.map((photo, index) => (
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
          Comments ({ticket.comments.length})
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {ticket.comments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">No comments yet</p>
          ) : (
            ticket.comments.map(comment => (
              <div key={comment.id} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{comment.createdBy.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(comment.createdAt).toLocaleDateString()}
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
          className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors touch-manipulation"
          rows={3}
          style={{ minHeight: '80px' }}
        />
        <button
          onClick={onAddComment}
          disabled={!newComment.trim()}
          className="mt-2 px-4 py-3 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all duration-200 touch-manipulation"
          style={{ minHeight: '48px' }}
        >
          Add Comment
        </button>
      </div>
    </div>
  );
};

// Ticket Detail Modal Component - Enhanced design
const TicketDetailModal: React.FC<{
  ticket: Ticket;
  onClose: () => void;
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onAddComment: () => void;
  newComment: string;
  setNewComment: (comment: string) => void;
  priorityConfig: any;
  getStatusConfig: any;
}> = ({ ticket, onClose, onUpdateStatus, onAddComment, newComment, setNewComment, priorityConfig, getStatusConfig }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[var(--bg-primary)] w-full max-w-2xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col animate-in fade-in-up duration-300">
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ticket Details</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">#{ticket.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors touch-manipulation"
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <TicketDetailContent
            ticket={ticket}
            onUpdateStatus={onUpdateStatus}
            onAddComment={onAddComment}
            newComment={newComment}
            setNewComment={setNewComment}
            priorityConfig={priorityConfig}
            getStatusConfig={getStatusConfig}
          />
        </div>
      </div>
    </div>
  );
};

export default TicketCenterV4;