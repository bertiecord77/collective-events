/**
 * NotLuck API - Collective Events Handler
 * Fetches events from GHL Custom Objects for the Collective website
 *
 * Endpoint: GET /collective/events
 * Query params:
 *   - status: Filter by status (default: 'live')
 *   - limit: Max events to return (default: 10)
 *   - includeVenues: Include venue data (default: true)
 *
 * Environment Variables Required:
 * - COLLECTIVE_API_TOKEN: GHL API key with objects/record.readonly scope
 *
 * Config (hardcoded in client-config.js):
 * - Location ID: JcB0t2fZpGS0lMrqKDWQ
 * - Events Object: custom_objects.collective_event
 * - Venues Object: custom_objects.collective_venue
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

// Collective client config (matches notluck-api/netlify/functions/lib/client-config.js)
const COLLECTIVE_CONFIG = {
  locationId: 'JcB0t2fZpGS0lMrqKDWQ',
  schemas: {
    events: 'custom_objects.collective_event',
    venues: 'custom_objects.collective_venue'
  }
};

// Helper to make GHL API requests
async function ghlRequest(endpoint, token) {
  const response = await fetch(`${GHL_API_BASE}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': API_VERSION,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Fetch all records from a Custom Object
async function fetchObjectRecords(objectKey, token, locationId, filters = {}) {
  let endpoint = `/objects/${objectKey}/records?locationId=${locationId}`;
  
  // Add any filters as query params
  if (filters.status) {
    endpoint += `&filter[status]=${encodeURIComponent(filters.status)}`;
  }

  return ghlRequest(endpoint, token, locationId);
}

// Fetch a single record by ID (for linked venues)
async function fetchObjectRecord(objectKey, recordId, token, locationId) {
  const endpoint = `/objects/${objectKey}/records/${recordId}?locationId=${locationId}`;
  return ghlRequest(endpoint, token, locationId);
}

// Transform raw GHL record to clean event format
function transformEvent(record, venue = null) {
  const fields = record.properties || record.fields || record;

  // Calculate capacity info
  const maxAttendees = parseInt(fields.max_attendees || fields.maxAttendees) || null;
  const currentAttendees = parseInt(fields.current_attendees || fields.currentAttendees) || 0;
  const waitlistEnabled = fields.waitlist_enabled === true || fields.waitlist_enabled === 'true' || fields.waitlistEnabled === true;
  const isFeatured = fields.featured === true || fields.featured === 'true' || fields.is_featured === true;

  // Determine availability status
  let availabilityStatus = 'available';
  let spotsRemaining = null;

  if (maxAttendees) {
    spotsRemaining = Math.max(0, maxAttendees - currentAttendees);
    if (spotsRemaining === 0) {
      availabilityStatus = waitlistEnabled ? 'waitlist' : 'sold_out';
    } else if (spotsRemaining <= 5) {
      availabilityStatus = 'limited';
    }
  }

  return {
    id: record.id,
    title: fields.event_title || fields.title || 'Untitled Event',
    slug: fields.event_slug || fields.slug || '',
    date: fields.event_date || fields.date || null,
    startTime: fields.start_time || fields.startTime || null,
    endTime: fields.end_time || fields.endTime || null,
    status: fields.status || 'draft',
    shortDescription: fields.short_description || fields.shortDescription || '',
    fullDescription: fields.full_description || fields.fullDescription || '',
    speaker: {
      name: fields.speaker_name || fields.speakerName || null,
      title: fields.speaker_title || fields.speakerTitle || null,
      bio: fields.speaker_bio || fields.speakerBio || null,
      photo: fields.speaker_photo || fields.speakerPhoto || null
    },
    price: fields.price || 'Free',
    bookingUrl: fields.booking_url || fields.bookingUrl || null,
    featuredImage: fields.featured_image || fields.featuredImage || null,
    locationTag: fields.location_tag || fields.locationTag || null,
    featured: isFeatured,
    // Capacity and availability
    capacity: {
      max: maxAttendees,
      current: currentAttendees,
      remaining: spotsRemaining,
      waitlistEnabled: waitlistEnabled,
      status: availabilityStatus
    },
    // GHL Calendar integration
    calendarId: fields.calendar_id || fields.calendarId || null,
    venue: venue ? {
      name: venue.venue_name || venue.name || null,
      address: venue.address_line_1 || venue.address || null,
      city: venue.city || null,
      postcode: venue.postcode || null,
      mapsUrl: venue.google_maps_url || venue.mapsUrl || null,
      what3words: venue.what3words || venue.what_3_words || null,
      parking: venue.parking_info || venue.parking || null,
      transport: venue.public_transport || venue.transport || null,
      accessibility: venue.accessibility || null,
      image: venue.venue_image || venue.image || null
    } : null
  };
}

export const handler = async (event, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get config
    const token = process.env.COLLECTIVE_API_TOKEN;
    const locationId = COLLECTIVE_CONFIG.locationId;
    const eventsObjectKey = COLLECTIVE_CONFIG.schemas.events;
    const venuesObjectKey = COLLECTIVE_CONFIG.schemas.venues;

    // Validate API token
    if (!token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'API token not configured',
          hint: 'Set COLLECTIVE_API_TOKEN in Netlify environment variables'
        })
      };
    }

    // Parse query params
    const params = event.queryStringParameters || {};
    const statusFilter = params.status || 'live'; // Default to live events only
    const limit = parseInt(params.limit) || 10;
    const includeVenues = params.includeVenues !== 'false'; // Default true

    // Fetch events from Custom Objects
    const eventsResponse = await fetchObjectRecords(eventsObjectKey, token, locationId, {
      status: statusFilter
    });

    const records = eventsResponse.records || eventsResponse.data || [];

    // Fetch venue data for each event if we have a venues object configured
    const venueCache = {};
    const events = [];

    for (const record of records.slice(0, limit)) {
      let venueData = null;
      const fields = record.properties || record.fields || record;
      const venueId = fields.venue || fields.venue_id || fields.venueId;

      // Fetch venue if linked and not cached
      if (includeVenues && venuesObjectKey && venueId && !venueCache[venueId]) {
        try {
          const venueResponse = await fetchObjectRecord(venuesObjectKey, venueId, token, locationId);
          venueCache[venueId] = venueResponse.properties || venueResponse.fields || venueResponse;
        } catch (err) {
          console.warn(`Failed to fetch venue ${venueId}:`, err.message);
        }
      }

      venueData = venueCache[venueId] || null;
      events.push(transformEvent(record, venueData));
    }

    // Sort by date ascending (nearest first)
    events.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300' // Cache for 5 mins
      },
      body: JSON.stringify({
        success: true,
        count: events.length,
        events: events
      })
    };

  } catch (error) {
    console.error('Collective Events API Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to fetch events',
        message: error.message
      })
    };
  }
};
