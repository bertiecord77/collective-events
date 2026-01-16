// COLLECTIVE. API Utilities
const API_BASE = 'https://api.notluck.co.uk/collective';

// Location-specific fallback images
const LOCATION_IMAGES = {
  nottingham: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69454390106fdc3abdfa3264.png',
  mansfield: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69413d35ca7298e25b32203a.png',
  chesterfield: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/6967cbfe02f1be4a61702e71.png'
};

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

// Get image for event (with location fallback)
function getEventImage(event) {
  if (event.featuredImage) return event.featuredImage;
  const locationKey = event.locationTag?.toLowerCase();
  return LOCATION_IMAGES[locationKey] || DEFAULT_IMAGE;
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

// Export utilities
window.CollectiveAPI = {
  fetchEvents,
  fetchEvent,
  fetchSpeakers,
  fetchSpeaker,
  fetchStats,
  getEventImage,
  formatDate,
  formatTime,
  getLocationColor,
  isUpcoming,
  getSlugFromPath,
  LOCATION_IMAGES,
  DEFAULT_IMAGE
};
