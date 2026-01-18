/**
 * COLLECTIVE. Contact Migration Script
 * Backfills contact.type and booking stats for existing contacts
 *
 * Run manually via: GET /.netlify/functions/migrate-contacts?run=true
 * Dry run (preview): GET /.netlify/functions/migrate-contacts
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'JcB0t2fZpGS0lMrqKDWQ';
const API_VERSION = '2021-07-28';

// Contact type values
const CONTACT_TYPES = {
  PROSPECT: 'Prospect',
  GUEST_BOOKED: 'Guest Booked',
  COLLECTIVE_MEMBER: 'Collective Member',
  COLLECTIVE_COMMUNITY: 'Collective Community'
};

// Custom field keys for booking stats
const BOOKING_STATS_FIELDS = {
  events_booked: 'events_booked',
  events_attended: 'events_attended',
  no_show: 'no_show'
};

// Helper to make GHL API requests with rate limiting
async function ghlRequest(endpoint, method, token, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': API_VERSION,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${GHL_API_BASE}${endpoint}`, options);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(data.message || data.error || `API error: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Fetch all contacts with pagination
async function fetchAllContacts(token) {
  const contacts = [];
  let hasMore = true;
  let startAfter = null;
  let page = 0;

  while (hasMore) {
    const params = new URLSearchParams({
      locationId: LOCATION_ID,
      limit: '100'
    });

    if (startAfter) {
      params.append('startAfter', startAfter);
    }

    const result = await ghlRequest(`/contacts/?${params}`, 'GET', token);

    if (result.contacts && result.contacts.length > 0) {
      contacts.push(...result.contacts);
      startAfter = result.contacts[result.contacts.length - 1].id;
      page++;
      console.log(`Fetched page ${page}, total contacts: ${contacts.length}`);

      // Rate limiting - small delay between pages
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    hasMore = result.contacts && result.contacts.length === 100;
  }

  return contacts;
}

// Fetch appointments for a contact
async function fetchContactAppointments(token, contactId) {
  try {
    const params = new URLSearchParams({
      locationId: LOCATION_ID,
      contactId: contactId
    });

    const result = await ghlRequest(`/calendars/events?${params}`, 'GET', token);
    return result.events || [];
  } catch (error) {
    console.log(`Failed to fetch appointments for ${contactId}:`, error.message);
    return [];
  }
}

// Determine contact type based on tags and bookings
function determineContactType(contact, hasBookings) {
  const tags = contact.tags || [];
  const tagLower = tags.map(t => t.toLowerCase());

  // Check for COLLECTIVE Community tag (member who completed join form)
  if (tagLower.includes('collective community') || tags.includes('COLLECTIVE Community')) {
    return CONTACT_TYPES.COLLECTIVE_MEMBER;
  }

  // Has bookings but not a member
  if (hasBookings) {
    return CONTACT_TYPES.GUEST_BOOKED;
  }

  // Default - no bookings, not joined
  return CONTACT_TYPES.PROSPECT;
}

// Calculate booking stats from appointments
function calculateBookingStats(appointments) {
  let booked = 0;
  let attended = 0;
  let noShow = 0;

  for (const apt of appointments) {
    booked++;

    // Check appointment status
    const status = (apt.status || apt.appointmentStatus || '').toLowerCase();

    if (status === 'showed' || status === 'completed' || status === 'confirmed') {
      attended++;
    } else if (status === 'no_show' || status === 'noshow' || status === 'no-show') {
      noShow++;
    }
  }

  return { booked, attended, noShow };
}

// Update a single contact
async function updateContact(token, contactId, contactType, stats, dryRun) {
  const customFields = [
    { key: BOOKING_STATS_FIELDS.events_booked, field_value: String(stats.booked) },
    { key: BOOKING_STATS_FIELDS.events_attended, field_value: String(stats.attended) },
    { key: BOOKING_STATS_FIELDS.no_show, field_value: String(stats.noShow) }
  ];

  const payload = {
    type: contactType,
    customFields: customFields
  };

  if (dryRun) {
    return { dryRun: true, payload };
  }

  await ghlRequest(`/contacts/${contactId}`, 'PUT', token, payload);
  return { success: true };
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const params = event.queryStringParameters || {};
  const dryRun = params.run !== 'true';
  const limit = parseInt(params.limit) || 0; // 0 = no limit

  try {
    const token = process.env.COLLECTIVE_API_TOKEN;
    if (!token) {
      throw new Error('API token not configured');
    }

    console.log(`Starting migration... (dryRun: ${dryRun}, limit: ${limit || 'none'})`);

    // Fetch all contacts
    let contacts = await fetchAllContacts(token);
    console.log(`Total contacts: ${contacts.length}`);

    if (limit > 0) {
      contacts = contacts.slice(0, limit);
      console.log(`Limited to ${contacts.length} contacts`);
    }

    const results = {
      total: contacts.length,
      processed: 0,
      updated: 0,
      errors: 0,
      byType: {
        [CONTACT_TYPES.PROSPECT]: 0,
        [CONTACT_TYPES.GUEST_BOOKED]: 0,
        [CONTACT_TYPES.COLLECTIVE_MEMBER]: 0
      },
      samples: [],
      dryRun
    };

    for (const contact of contacts) {
      try {
        // Fetch appointments for this contact
        const appointments = await fetchContactAppointments(token, contact.id);

        // Calculate stats
        const stats = calculateBookingStats(appointments);

        // Determine contact type
        const contactType = determineContactType(contact, appointments.length > 0);

        // Update contact
        const updateResult = await updateContact(token, contact.id, contactType, stats, dryRun);

        results.processed++;
        results.byType[contactType]++;

        if (!dryRun) {
          results.updated++;
        }

        // Store sample for review
        if (results.samples.length < 10) {
          results.samples.push({
            id: contact.id,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            email: contact.email,
            tags: contact.tags,
            currentType: contact.type,
            newType: contactType,
            stats,
            appointmentCount: appointments.length
          });
        }

        // Rate limiting
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error.message);
        results.errors++;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: dryRun
          ? 'Dry run complete. Add ?run=true to execute updates.'
          : 'Migration complete!',
        results
      }, null, 2)
    };

  } catch (error) {
    console.error('Migration error:', error.message);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Migration failed',
        details: error.message
      })
    };
  }
};
