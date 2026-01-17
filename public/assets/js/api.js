// COLLECTIVE. API Utilities
// Wrapped in IIFE to avoid global scope pollution
(function() {
  'use strict';

  const API_BASE = 'https://api.notluck.co.uk/collective';

  // Location colors for fallback placeholders
  const LOCATION_COLORS = {
    nottingham: '#E5F608', // lime
    mansfield: '#D8B4FE',  // lilac
    chesterfield: '#9CA3AF', // grey
    derby: '#E5F608' // lime
  };

  // Location-specific fallback images (kept for backward compatibility)
  const LOCATION_IMAGES = {
    nottingham: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69454390106fdc3abdfa3264.png',
    mansfield: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69413d35ca7298e25b32203a.png',
    chesterfield: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/6967cbfe02f1be4a61702e71.png'
  };

  // Default blank avatar for speakers (SVG data URL)
  const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none"><rect width="120" height="120" fill="#1a1a1a"/><circle cx="60" cy="45" r="20" stroke="#E5F608" stroke-width="2" fill="none"/><path d="M30 95c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="#E5F608" stroke-width="2" fill="none"/></svg>');

  const DEFAULT_IMAGE = 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/68efb0a2629b057f6907b407.png';

  // Fetch events from API
  async function fetchEvents(options = {}) {
    const params = new URLSearchParams();

    if (options.location) params.append('location', options.location);
    if (options.upcoming !== undefined) params.append('upcoming', options.upcoming);
    if (options.limit) params.append('limit', options.limit);
    if (options.slug) params.append('slug', options.slug);

    const url = `${API_BASE}/events${params.toString() ? '?' + params.toString() : ''}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return await response.json();
    } catch (error) {
      console.error('Error fetching events:', error);
      return { events: [], total: 0 };
    }
  }

  // Fetch single event by slug or ID
  async function fetchEvent(slugOrId) {
    console.log('fetchEvent called with:', slugOrId);

    // Fetch all events (both live and past) to find by slug
    const liveData = await fetchEvents({ limit: 200 });
    const liveEvents = liveData.events || [];
    console.log('Fetched live events:', liveEvents.length);

    // Also fetch past events
    let pastEvents = [];
    try {
      const pastResponse = await fetch(`${API_BASE}/events?status=past&limit=200`);
      const pastData = await pastResponse.json();
      pastEvents = pastData.events || [];
      console.log('Fetched past events:', pastEvents.length);
    } catch (e) {
      console.log('Could not fetch past events:', e);
    }

    // Combine all events
    const allEvents = [...liveEvents, ...pastEvents];
    console.log('Total events to search:', allEvents.length);
    console.log('Available slugs:', allEvents.map(e => e.slug));

    // Find event by slug or ID
    const event = allEvents.find(e =>
      e.slug === slugOrId ||
      e.id === slugOrId ||
      e.slug?.toLowerCase() === slugOrId?.toLowerCase()
    );

    console.log('Found event:', event ? event.title : 'NOT FOUND');
    return event || null;
  }

  // Fetch speakers from API
  async function fetchSpeakers(options = {}) {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit);
    if (options.slug) params.append('slug', options.slug);

    const url = `${API_BASE}/speakers${params.toString() ? '?' + params.toString() : ''}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch speakers');
      return await response.json();
    } catch (error) {
      console.error('Error fetching speakers:', error);
      return { speakers: [], total: 0 };
    }
  }

  // Fetch single speaker by slug
  async function fetchSpeaker(slug) {
    const data = await fetchSpeakers({ slug, limit: 1 });
    return data.speakers?.[0] || null;
  }

  // Fetch venues from API
  async function fetchVenues(options = {}) {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit);
    if (options.city) params.append('city', options.city);

    const url = `${API_BASE}/venues${params.toString() ? '?' + params.toString() : ''}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch venues');
      return await response.json();
    } catch (error) {
      console.error('Error fetching venues:', error);
      return { venues: [], total: 0 };
    }
  }

  // Fetch single venue by slug
  async function fetchVenue(slug) {
    try {
      const response = await fetch(`${API_BASE}/venues/${slug}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.venue || null;
    } catch (error) {
      console.error('Error fetching venue:', error);
      return null;
    }
  }

  // Fetch stats
  async function fetchStats() {
    try {
      const response = await fetch(`${API_BASE}/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { events: 0, members: 0, locations: 3, speakers: 0 };
    }
  }

  // Check if event has a real featured image
  function hasEventImage(event) {
    return !!(event.featuredImage && event.featuredImage.trim());
  }

  // Get image for event (returns null if no image - use placeholder pattern instead)
  function getEventImage(event) {
    if (event.featuredImage) return event.featuredImage;
    return null; // Return null to trigger placeholder
  }

  // Get location color for placeholder
  function getLocationPlaceholderColor(location) {
    return LOCATION_COLORS[location?.toLowerCase()] || LOCATION_COLORS.nottingham;
  }

  // Generate SVG placeholder for event (solid color with event title)
  function getEventPlaceholder(event) {
    const color = getLocationPlaceholderColor(event.locationTag);
    const title = event.title || 'Event';
    // Truncate title if too long
    const displayTitle = title.length > 30 ? title.substring(0, 27) + '...' : title;
    const location = event.locationTag || 'COLLECTIVE.';

    return 'data:image/svg+xml,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">
        <rect width="400" height="300" fill="#1a1a1a"/>
        <rect x="0" y="0" width="400" height="6" fill="${color}"/>
        <text x="200" y="130" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="16" font-weight="600">${location}</text>
        <text x="200" y="170" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="14">${displayTitle}</text>
      </svg>
    `);
  }

  // Format date
  function formatDate(dateStr, options = {}) {
    if (!dateStr) return '';
    const date = new Date(dateStr);

    const defaultOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };

    return date.toLocaleDateString('en-GB', { ...defaultOptions, ...options });
  }

  // Format time
  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // Get location color class
  function getLocationColor(location) {
    const colors = {
      nottingham: 'lime',
      mansfield: 'lilac',
      chesterfield: 'grey'
    };
    return colors[location?.toLowerCase()] || 'lime';
  }

  // Check if event is upcoming
  function isUpcoming(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) > new Date();
  }

  // Get slug from current URL path
  function getSlugFromPath(prefix) {
    const path = window.location.pathname;
    return path.replace(prefix, '').replace(/^\/|\/$/g, '');
  }

  // Export utilities to window.CollectiveAPI
  window.CollectiveAPI = {
    fetchEvents,
    fetchEvent,
    fetchSpeakers,
    fetchSpeaker,
    fetchVenues,
    fetchVenue,
    fetchStats,
    getEventImage,
    hasEventImage,
    getEventPlaceholder,
    getLocationPlaceholderColor,
    formatDate,
    formatTime,
    getLocationColor,
    isUpcoming,
    getSlugFromPath,
    LOCATION_IMAGES,
    LOCATION_COLORS,
    DEFAULT_IMAGE,
    DEFAULT_AVATAR
  };

})();
