import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Check, Clock, AlertCircle, MessageSquare, X, ChevronRight, ChevronDown, ChevronUp, MapPin, Archive, Filter, Camera, Layers, Search } from 'lucide-react';
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

// Province configuration for location grouping
const LOCATION_CONFIG: Record<string, string[]> = {
  'Nova Scotia': ['Bedford', 'Dartmouth', 'Halifax', 'Bayers Lake'],
  'Prince Edward Island': ['Stratford'],
  'Ontario': ['Truro'],
  'New Brunswick': ['River Oaks']
};

// Flatten locations for easy access
const ALL_LOCATIONS = Object.values(LOCATION_CONFIG).flat();

const TicketCenterOptimizedV3 = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const { user } = useAuthState();

  // Simplified tabs: Active, Resolved, Archived
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'archived'>('active');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [groupByProvince, setGroupByProvince] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showTicketDetail, setShowTicketDetail] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedGroupBy = localStorage.getItem('ticketGroupByLocation');
    const savedGroupByProvince = localStorage.getItem('ticketGroupByProvince');
    if (savedGroupBy === 'true') {
      setGroupByLocation(true);
      // Expand all locations by default when grouping is enabled
      setExpandedLocations(new Set(ALL_LOCATIONS));
    }
    if (savedGroupByProvince === 'true') {
      setGroupByProvince(true);
      // Expand all provinces by default
      setExpandedProvinces(new Set(Object.keys(LOCATION_CONFIG)));
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

  // Filter locations by search
  const filteredLocations = useMemo(() => {
    if (!locationSearch) return ALL_LOCATIONS;
    const search = locationSearch.toLowerCase();
    return ALL_LOCATIONS.filter(loc => loc.toLowerCase().includes(search));
  }, [locationSearch]);

  // Count tickets by location
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tickets.length };
    ALL_LOCATIONS.forEach(loc => {
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
    urgent: 'var(--status-error)',
    high: '#f97316', // Orange for high priority
    medium: 'var(--status-warning)',
    low: 'var(--status-success)'
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'text-[var(--status-warning)] bg-[var(--status-warning)]/10';
      case 'in-progress': return 'text-[var(--status-info)] bg-[var(--status-info)]/10';
      case 'resolved': return 'text-[var(--status-success)] bg-[var(--status-success)]/10';
      case 'closed': return 'text-[var(--text-secondary)] bg-[var(--text-secondary)]/10';
      case 'archived': return 'text-[var(--text-muted)] bg-[var(--text-muted)]/10';
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
      setExpandedLocations(new Set(ALL_LOCATIONS));
    }
  };

  // Toggle group by province
  const toggleGroupByProvince = () => {
    const newValue = !groupByProvince;
    setGroupByProvince(newValue);
    localStorage.setItem('ticketGroupByProvince', String(newValue));
    if (newValue) {
      setExpandedProvinces(new Set(Object.keys(LOCATION_CONFIG)));
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

  // Toggle province expansion
  const toggleProvinceExpansion = (province: string) => {
    const newSet = new Set(expandedProvinces);
    if (newSet.has(province)) {
      newSet.delete(province);
    } else {
      newSet.add(province);
    }
    setExpandedProvinces(newSet);
  };

  // Group tickets by location and province
  const groupedTickets = useMemo(() => {
    if (!groupByLocation && !groupByProvince) return { all: filteredTickets };

    if (groupByProvince) {
      const provinceGroups: Record<string, Record<string, Ticket[]>> = {};

      Object.entries(LOCATION_CONFIG).forEach(([province, locations]) => {
        provinceGroups[province] = {};
        locations.forEach(location => {
          const locationTickets = filteredTickets.filter(t => t.location === location);
          if (locationTickets.length > 0) {
            provinceGroups[province][location] = locationTickets.sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
        });
      });

      // Add tickets without location
      const noLocationTickets = filteredTickets.filter(t => !t.location);
      if (noLocationTickets.length > 0) {
        provinceGroups['No Location'] = { 'Unassigned': noLocationTickets };
      }

      return provinceGroups;
    }

    if (groupByLocation) {
      const groups: Record<string, Ticket[]> = {};
      filteredTickets.forEach(ticket => {
        const location = ticket.location || 'No Location';
        if (!groups[location]) {
          groups[location] = [];
        }
        groups[location].push(ticket);
      });

      // Sort groups by ticket count (descending) and tickets by age
      const sortedGroups: Record<string, Ticket[]> = {};
      Object.entries(groups)
        .sort(([, a], [, b]) => b.length - a.length)
        .forEach(([key, value]) => {
          sortedGroups[key] = value.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

      return sortedGroups;
    }

    return { all: filteredTickets };
  }, [filteredTickets, groupByLocation, groupByProvince]);

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
              onClick={toggleGroupByProvince}
              className={`p-1.5 rounded-lg transition-all ${
                groupByProvince
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Group by Province"
            >
              <MapPin className="w-4 h-4" />
            </button>
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

        {/* Filters Section */}
        <div className="space-y-3 mb-4">
          {/* Location Filter - Grid layout with search */}
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

            {/* Location Grid */}
            {showLocationFilter && (
              <div className="p-3 border-t border-[var(--border-secondary)]">
                {/* Search input */}
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder="Search locations..."
                      className="w-full pl-10 pr-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                {/* Location grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      setSelectedLocation('all');
                      setShowLocationFilter(false);
                    }}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      selectedLocation === 'all'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <span className="block">All</span>
                    <span className="text-xs opacity-75">({locationCounts.all})</span>
                  </button>
                  {filteredLocations.map(location => (
                    <button
                      key={location}
                      onClick={() => {
                        setSelectedLocation(location);
                        setShowLocationFilter(false);
                      }}
                      className={`p-2 rounded-lg text-sm transition-colors ${
                        selectedLocation === location
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <span className="block">{location}</span>
                      <span className="text-xs opacity-75">({locationCounts[location] || 0})</span>
                    </button>
                  ))}
                </div>
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
        <div className="space-y-1">
          {loading ? (
            // Loading skeleton
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-[var(--bg-secondary)] rounded-lg" />
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
            // Render grouped tickets
            groupByProvince ? (
              // Province grouping
              Object.entries(groupedTickets as Record<string, Record<string, Ticket[]>>).map(([province, locationGroups]) => (
                <div key={province} className="space-y-3">
                  {/* Province header */}
                  <button
                    onClick={() => toggleProvinceExpansion(province)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors sticky top-0 z-10"
                  >
                    <div className="flex items-center gap-2">
                      {expandedProvinces.has(province) ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                      <span className="font-medium text-sm uppercase tracking-wider text-[var(--text-muted)]">{province}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {Object.values(locationGroups).flat().length} tickets
                      </span>
                    </div>
                  </button>

                  {/* Location groups within province */}
                  {expandedProvinces.has(province) && (
                    <div className="ml-4 space-y-3">
                      {Object.entries(locationGroups).map(([location, tickets]) => (
                        <div key={location} className="space-y-2">
                          <button
                            onClick={() => toggleLocationExpansion(location)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {expandedLocations.has(location) ? (
                                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                              )}
                              <span className="font-medium text-sm">{location}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
                              </span>
                              {urgentByLocation[location] > 0 && (
                                <span className="text-xs bg-[var(--status-error)]/20 text-[var(--status-error)] px-2 py-0.5 rounded-full animate-pulse">
                                  {urgentByLocation[location]} urgent
                                </span>
                              )}
                            </div>
                          </button>

                          {expandedLocations.has(location) && (
                            <div className="space-y-1">
                              {tickets.map(ticket => (
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
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Regular grouping or no grouping
              Object.entries(groupedTickets).map(([location, locationTickets]) => (
                <div key={location} className="space-y-3">
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
                          <span className="text-xs bg-[var(--status-error)]/20 text-[var(--status-error)] px-2 py-0.5 rounded-full animate-pulse">
                            {urgentByLocation[location]} urgent
                          </span>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Ticket cards */}
                  {(!groupByLocation || location === 'all' || expandedLocations.has(location)) && (
                    <div className="space-y-1">
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
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
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

      {/* Ticket Detail Modal */}
      {showTicketDetail && selectedTicket && (
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
          formatTimeAgo={formatTimeAgo}
        />
      )}
    </div>
  );
};

// Ticket Card Component - Compact 2-line layout
const TicketCard: React.FC<{
  ticket: Ticket;
  onSelect: () => void;
  onResolve: () => void;
  onArchive: () => void;
  onPhotoClick: (photo: string) => void;
}> = ({ ticket, onSelect, onResolve, onArchive, onPhotoClick }) => {
  const urgency = getTimeUrgency(ticket.createdAt);
  const locationBg = getLocationColor(ticket.location);

  return (
    <div
      className="p-2 bg-[var(--bg-primary)] rounded-lg transition-all group cursor-pointer hover:bg-[var(--bg-hover)] border border-[var(--border-secondary)] hover:shadow-md"
      style={{
        backgroundColor: locationBg ? `color-mix(in srgb, ${locationBg} 5%, transparent)` : undefined,
        borderLeft: `2px solid ${priorityColors[ticket.priority]}`
      }}
      onClick={onSelect}
    >
      {/* Compact 2-line layout */}
      <div className="flex items-center gap-2">
        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Title, Status, Time, Actions */}
          <div className="flex items-center gap-2 mb-1">
            {/* Priority indicator (small colored dot) */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColors[ticket.priority] }}
            />

            {/* Title - truncated */}
            <h4 className="flex-1 font-medium text-sm text-[var(--text-primary)] truncate">
              {ticket.title}
            </h4>

            {/* Status badge - compact */}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusColor(ticket.status)}`}>
              {ticket.status === 'in-progress' ? 'In Prog' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
            </span>

            {/* Time with urgency coloring */}
            <span className={`text-xs flex-shrink-0 ${
              urgency === 'critical' ? 'text-[var(--status-error)] font-semibold' :
              urgency === 'high' ? 'text-[var(--status-warning)]' :
              urgency === 'medium' ? 'text-[var(--text-secondary)]' :
              'text-[var(--text-muted)]'
            }`}>
              {formatTimeAgo(ticket.createdAt)}
            </span>
          </div>

          {/* Line 2: Location, Category, and metadata */}
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            {ticket.location && (
              <>
                <MapPin className="w-3 h-3" />
                <span className="font-medium">{ticket.location}</span>
                <span>•</span>
              </>
            )}
            <span className="capitalize">{ticket.category}</span>
            <span>•</span>
            <span>{ticket.createdBy.name.split(' ')[0]}</span>
            {ticket.comments.length > 0 && (
              <>
                <span>•</span>
                <MessageSquare className="w-3 h-3" />
                <span>{ticket.comments.length}</span>
              </>
            )}
            {ticket.photo_urls && ticket.photo_urls.length > 0 && (
              <>
                <span>•</span>
                <Camera className="w-3 h-3" />
                <span>{ticket.photo_urls.length}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick actions - compact */}
        <div className="flex gap-0.5 flex-shrink-0">
          {(ticket.status === 'open' || ticket.status === 'in-progress') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              className="p-1.5 text-[var(--status-success)] hover:bg-[var(--bg-hover)] rounded transition-colors"
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
              className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const priorityColors = {
  urgent: 'var(--status-error)',
  high: '#f97316', // Orange for high priority
  medium: 'var(--status-warning)',
  low: 'var(--status-success)'
};

const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case 'open': return 'text-[var(--status-warning)] bg-[var(--status-warning)]/10';
    case 'in-progress': return 'text-[var(--status-info)] bg-[var(--status-info)]/10';
    case 'resolved': return 'text-[var(--status-success)] bg-[var(--status-success)]/10';
    case 'closed': return 'text-[var(--text-secondary)] bg-[var(--text-secondary)]/10';
    case 'archived': return 'text-[var(--text-muted)] bg-[var(--text-muted)]/10';
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

const getTimeUrgency = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const hours = Math.floor((now.getTime() - then.getTime()) / 3600000);

  if (hours >= 72) return 'critical';
  if (hours >= 48) return 'high';
  if (hours >= 24) return 'medium';
  return 'normal';
};

const getLocationColor = (location?: string) => {
  if (!location) return '';
  const locationKey = location.toLowerCase().replace(/\s+/g, '-');
  return `var(--location-${locationKey})`;
};

// Ticket Detail Modal Component with Editable Fields
const TicketDetailModal: React.FC<{
  ticket: Ticket;
  onClose: () => void;
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onAddComment: () => void;
  newComment: string;
  setNewComment: (comment: string) => void;
  formatTimeAgo: (date: string) => string;
}> = ({ ticket, onClose, onUpdateStatus, onAddComment, newComment, setNewComment, formatTimeAgo }) => {
  const { notify } = useNotifications();

  // Local state for editable fields
  const [localTicket, setLocalTicket] = useState(ticket);
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Track original values for rollback
  const originalValues = useRef({
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    location: ticket.location
  });

  // Update local state when ticket prop changes
  useEffect(() => {
    setLocalTicket(ticket);
    originalValues.current = {
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      location: ticket.location
    };
  }, [ticket]);

  // Handle field updates
  const updateField = async (field: 'status' | 'priority' | 'category' | 'location', value: string) => {
    // Optimistically update UI
    setLocalTicket(prev => ({ ...prev, [field]: value }));
    setFieldLoading(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    try {
      const token = tokenManager.getToken();
      const response = await http.patch(
        `tickets/${ticket.id}`,
        { [field]: value },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Update original values on success
        originalValues.current = { ...originalValues.current, [field]: value };
        notify('success', `${field.charAt(0).toUpperCase() + field.slice(1)} updated`);

        // If status was updated, also update parent component
        if (field === 'status') {
          onUpdateStatus(ticket.id, value as TicketStatus);
        }
      }
    } catch (error: any) {
      // Rollback on error
      setLocalTicket(prev => ({
        ...prev,
        [field]: originalValues.current[field as keyof typeof originalValues.current]
      }));
      setFieldErrors(prev => ({
        ...prev,
        [field]: error.response?.data?.message || 'Failed to update'
      }));
      notify('error', `Failed to update ${field}`);
    } finally {
      setFieldLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const validStatuses: TicketStatus[] = ['open', 'in-progress', 'resolved', 'closed', 'archived'];
  const validPriorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
  const validCategories: TicketCategory[] = ['facilities', 'tech'];
  // Use the same locations as defined in LOCATION_CONFIG at the top of the file
  const validLocations = ['bedford', 'dartmouth', 'halifax', 'bayers-lake', 'river-oaks', 'stratford', 'truro'];

  return (
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
            <p className="text-xs text-[var(--text-muted)] mt-0.5">#{ticket.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title and Description */}
          <div>
            <h3 className="font-medium text-lg mb-2">{localTicket.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
              {localTicket.description}
            </p>
          </div>

          {/* Editable Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Status Dropdown */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <span className="text-[var(--text-muted)] text-xs">Status</span>
              <select
                value={localTicket.status}
                onChange={(e) => updateField('status', e.target.value)}
                disabled={fieldLoading.status}
                className={`mt-1 w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  fieldLoading.status ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                {validStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace('-', ' ')}
                  </option>
                ))}
              </select>
              {fieldErrors.status && (
                <p className="text-xs text-[var(--status-error)] mt-1">{fieldErrors.status}</p>
              )}
            </div>

            {/* Priority Dropdown */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <span className="text-[var(--text-muted)] text-xs">Priority</span>
              <select
                value={localTicket.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                disabled={fieldLoading.priority}
                className={`mt-1 w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  fieldLoading.priority ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                {validPriorities.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
              {fieldErrors.priority && (
                <p className="text-xs text-[var(--status-error)] mt-1">{fieldErrors.priority}</p>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <span className="text-[var(--text-muted)] text-xs">Category</span>
              <select
                value={localTicket.category}
                onChange={(e) => updateField('category', e.target.value)}
                disabled={fieldLoading.category}
                className={`mt-1 w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  fieldLoading.category ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                {validCategories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <p className="text-xs text-[var(--status-error)] mt-1">{fieldErrors.category}</p>
              )}
            </div>

            {/* Location Dropdown */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <span className="text-[var(--text-muted)] text-xs">Location</span>
              <select
                value={localTicket.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                disabled={fieldLoading.location}
                className={`mt-1 w-full px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  fieldLoading.location ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                <option value="">No Location</option>
                {validLocations.map(location => {
                  // Format location names properly
                  const displayName = location === 'bayers-lake' ? 'Bayers Lake' :
                                      location === 'river-oaks' ? 'River Oaks' :
                                      location.charAt(0).toUpperCase() + location.slice(1);
                  return (
                    <option key={location} value={location}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.location && (
                <p className="text-xs text-[var(--status-error)] mt-1">{fieldErrors.location}</p>
              )}
            </div>
          </div>

          {/* Photos */}
          {ticket.photo_urls && ticket.photo_urls.length > 0 && (
            <div>
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Photos ({ticket.photo_urls.length})
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {ticket.photo_urls.map((photo, index) => (
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
              onClick={onAddComment}
              disabled={!newComment.trim()}
              className="mt-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketCenterOptimizedV3;