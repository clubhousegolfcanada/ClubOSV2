import React, { useState, useEffect } from 'react';
import { Star, Zap, Clock, TrendingUp } from 'lucide-react';
import type { FavoriteSimulatorProps, Space } from '@/types/booking';
import { http } from '@/api/http';

/**
 * Favorite Simulator Component
 * Part 5 of Booking System Master Plan
 *
 * Allows users to save favorite simulators for quick booking.
 * Tracks preferences per location and enables one-click rebooking.
 */
export const FavoriteSimulator: React.FC<FavoriteSimulatorProps> = ({
  userId,
  locationId,
  currentFavorites,
  onToggleFavorite,
  onQuickBook,
  showQuickActions = true
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [recentBookings, setRecentBookings] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [lastBookedSetup, setLastBookedSetup] = useState<string[]>([]);

  // Load spaces and user's booking history
  useEffect(() => {
    loadSpacesAndHistory();
  }, [locationId, userId]);

  const loadSpacesAndHistory = async () => {
    setLoading(true);
    try {
      // Load spaces for the location
      const spacesResponse = await http.get(`/api/bookings/spaces?locationId=${locationId}`);
      if (spacesResponse.data.success) {
        setSpaces(spacesResponse.data.data);
      }

      // Load user's booking history to show frequently used simulators
      const historyResponse = await http.get(`/api/bookings/user-history?userId=${userId}&locationId=${locationId}`);
      if (historyResponse.data.success) {
        const bookingCounts = new Map<string, number>();
        let lastSetup: string[] = [];

        historyResponse.data.bookings.forEach((booking: any) => {
          booking.spaceIds.forEach((spaceId: string) => {
            bookingCounts.set(spaceId, (bookingCounts.get(spaceId) || 0) + 1);
          });
          // Track the most recent booking setup
          if (!lastSetup.length && booking.spaceIds.length > 0) {
            lastSetup = booking.spaceIds;
          }
        });

        setRecentBookings(bookingCounts);
        setLastBookedSetup(lastSetup);
      }
    } catch (error) {
      logger.error('Failed to load spaces and history:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFavorites = async () => {
    try {
      await http.patch(`/api/users/${userId}/preferences`, {
        favoriteSpaceIds: {
          ...currentFavorites,
          [locationId]: currentFavorites
        }
      });
    } catch (error) {
      logger.error('Failed to save favorites:', error);
    }
  };

  const getSpaceStats = (spaceId: string) => {
    const bookingCount = recentBookings.get(spaceId) || 0;
    const isFavorite = currentFavorites.includes(spaceId);
    const wasLastBooked = lastBookedSetup.includes(spaceId);

    return { bookingCount, isFavorite, wasLastBooked };
  };

  const handleToggleFavorite = async (spaceId: string) => {
    onToggleFavorite(spaceId);
    // Save to backend after toggling
    setTimeout(saveFavorites, 500);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading your preferences...</p>
      </div>
    );
  }

  // Group spaces by their stats
  const favoriteSpaces = spaces.filter(s => currentFavorites.includes(s.id));
  const frequentSpaces = spaces
    .filter(s => !currentFavorites.includes(s.id) && recentBookings.get(s.id))
    .sort((a, b) => (recentBookings.get(b.id) || 0) - (recentBookings.get(a.id) || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      {showQuickActions && (
        <div className="space-y-3">
          {/* Book same as last time */}
          {lastBookedSetup.length > 0 && (
            <button
              onClick={() => onQuickBook(lastBookedSetup)}
              className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-semibold">Book Same as Last Time</div>
                    <div className="text-sm opacity-90">
                      {lastBookedSetup.length === 1
                        ? `Simulator ${spaces.find(s => s.id === lastBookedSetup[0])?.spaceNumber}`
                        : `${lastBookedSetup.length} simulators`}
                    </div>
                  </div>
                </div>
                <Zap className="w-5 h-5" />
              </div>
            </button>
          )}

          {/* Quick book favorites */}
          {favoriteSpaces.length > 0 && (
            <button
              onClick={() => onQuickBook(currentFavorites)}
              className="w-full p-4 bg-gradient-to-r from-[var(--accent)] to-[#084a45] text-white rounded-lg hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="w-6 h-6 fill-current" />
                  <div className="text-left">
                    <div className="font-semibold">Book All Favorites</div>
                    <div className="text-sm opacity-90">
                      {favoriteSpaces.map(s => s.spaceNumber).join(', ')}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-1 bg-white/20 rounded text-sm">
                  {favoriteSpaces.length} simulators
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Favorite Simulators */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-current" />
          Your Favorites
        </h3>
        {favoriteSpaces.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {favoriteSpaces.map((space) => {
              const stats = getSpaceStats(space.id);
              return (
                <div
                  key={space.id}
                  className="relative p-3 bg-yellow-50 border-2 border-yellow-200 rounded-lg"
                >
                  <button
                    onClick={() => handleToggleFavorite(space.id)}
                    className="absolute top-2 right-2"
                  >
                    <Star className="w-5 h-5 text-yellow-500 fill-current hover:scale-110 transition-transform" />
                  </button>

                  <div className="font-semibold text-lg">#{space.spaceNumber}</div>
                  <div className="text-sm text-gray-600">{space.name}</div>
                  {stats.bookingCount > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Booked {stats.bookingCount} times
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            No favorites yet. Star your preferred simulators to save them here.
          </p>
        )}
      </div>

      {/* Frequently Used */}
      {frequentSpaces.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            Frequently Used
          </h3>
          <div className="space-y-2">
            {frequentSpaces.map((space) => {
              const stats = getSpaceStats(space.id);
              return (
                <div
                  key={space.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center font-semibold">
                      {space.spaceNumber}
                    </div>
                    <div>
                      <div className="font-medium">{space.name}</div>
                      <div className="text-sm text-gray-500">
                        Used {stats.bookingCount} times
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(space.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Star className="w-5 h-5 text-gray-400 hover:text-yellow-500 transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Simulators */}
      <div>
        <h3 className="font-semibold mb-3">All Simulators</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {spaces.map((space) => {
            const stats = getSpaceStats(space.id);
            return (
              <button
                key={space.id}
                onClick={() => handleToggleFavorite(space.id)}
                className={`
                  p-3 rounded-lg border-2 transition-all
                  ${stats.isFavorite
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">#{space.spaceNumber}</span>
                  <Star
                    className={`w-4 h-4 transition-colors ${
                      stats.isFavorite
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </div>
                <div className="text-xs text-gray-600 text-left">
                  {space.name}
                </div>
                {stats.bookingCount > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {stats.bookingCount} bookings
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tips */}
      <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
        <p>💡 Star your favorite simulators for quick booking</p>
        <p>💡 Your favorites are saved per location</p>
        <p>💡 We'll remember your last setup for one-click rebooking</p>
      </div>
    </div>
  );
};

export default FavoriteSimulator;