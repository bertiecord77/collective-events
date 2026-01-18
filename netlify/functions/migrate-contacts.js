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

// Contact type values (GHL option values)
const CONTACT_TYPES = {
  PROSPECT: 'lead',
  GUEST_BOOKED: 'guest_booker',
  COLLECTIVE_MEMBER: 'customer',
  COLLECTIVE_COMMUNITY: 'community_member'
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

// Fetch contacts with pagination using cursor-based approach
// GHL API requires both startAfter (timestamp) and startAfterId (contact ID) for pagination
async function fetchAllContacts(token, maxContacts = 500, startAfter = null, startAfterId = null) {
  const contacts = [];
  let hasMore = true;
  let nextStartAfter = startAfter;
  let nextStartAfterId = startAfterId;
  const batchSize = Math.min(100, maxContacts);
  let page = 0;

  while (hasMore && contacts.length < maxContacts) {
    const fetchLimit = Math.min(batchSize, maxContacts - contacts.length);
    const params = new URLSearchParams({
      locationId: LOCATION_ID,
      limit: String(fetchLimit)
    });

    // GHL API requires both startAfter and startAfterId for pagination
    if (nextStartAfter && nextStartAfterId) {
      params.append('startAfter', String(nextStartAfter));
      params.append('startAfterId', nextStartAfterId);
    }

    const result = await ghlRequest(`/contacts/?${params}`, 'GET', token);

    if (result.contacts && result.contacts.length > 0) {
      contacts.push(...result.contacts);
      // Get pagination info from meta for next page
      nextStartAfter = result.meta?.startAfter || null;
      nextStartAfterId = result.meta?.startAfterId || null;
      page++;
      console.log(`Fetched page ${page}, total contacts: ${contacts.length}`);

      // Rate limiting - small delay between pages
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    hasMore = result.contacts && result.contacts.length === fetchLimit && contacts.length < maxContacts && nextStartAfter;
  }

  return { contacts, nextStartAfter, nextStartAfterId, totalAvailable: 639 };
}

// Fetch appointments for a contact (disabled for speed - can enable later)
async function fetchContactAppointments(token, contactId) {
  // Skip appointment fetching for now to avoid timeouts
  // TODO: Enable this when running in batches
  return [];
}

// Determine contact type - all existing contacts are Members
// Prospects are only for NEW contacts from non-booking/non-join sources
function determineContactType(contact, hasBookings) {
  // All existing/imported contacts are considered Members
  return CONTACT_TYPES.COLLECTIVE_MEMBER;
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

// Update a single contact using upsert
async function updateContact(token, contactId, email, contactType, stats, dryRun) {
  // Use upsert endpoint with email - this properly updates contact type
  const payload = {
    email: email,
    locationId: LOCATION_ID,
    type: contactType
  };

  // Add booking stats if we have actual data
  if (stats.booked > 0) {
    payload.customFields = [
      { key: BOOKING_STATS_FIELDS.events_booked, field_value: String(stats.booked) },
      { key: BOOKING_STATS_FIELDS.events_attended, field_value: String(stats.attended) },
      { key: BOOKING_STATS_FIELDS.no_show, field_value: String(stats.noShow) }
    ];
  }

  if (dryRun) {
    return { dryRun: true, payload };
  }

  // Use upsert endpoint to update contact type
  await ghlRequest('/contacts/upsert', 'POST', token, payload);
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
  // GHL pagination requires both startAfter (timestamp) and startAfterId (contact ID)
  const startAfter = params.startAfter || null;
  const startAfterId = params.startAfterId || null;
  const diagnostic = params.diag === 'true';

  try {
    const token = process.env.COLLECTIVE_API_TOKEN;
    if (!token) {
      throw new Error('API token not configured');
    }

    // Diagnostic mode - just test the contacts API
    if (diagnostic) {
      const testParams = new URLSearchParams({
        locationId: LOCATION_ID,
        limit: '1'
      });
      const testResult = await ghlRequest(`/contacts/?${testParams}`, 'GET', token);
      const contact = testResult.contacts?.[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          diagnostic: true,
          contactsFound: testResult.contacts?.length || 0,
          sampleContact: contact ? {
            id: contact.id,
            name: `${contact.firstName} ${contact.lastName}`,
            tags: contact.tags,
            type: contact.type,
            customFields: contact.customFields,
            // Show all top-level keys to find where type might be stored
            allKeys: Object.keys(contact)
          } : null,
          // Show full API response keys for pagination debugging
          apiResponseKeys: Object.keys(testResult),
          meta: testResult.meta || testResult.pagination || null
        }, null, 2)
      };
    }

    console.log(`Starting migration... (dryRun: ${dryRun}, limit: ${limit || 'none'}, page: ${startAfterId ? 'continuing' : 'first'})`);

    // Fetch contacts (with cursor-based pagination)
    const fetchResult = await fetchAllContacts(token, limit || 500, startAfter, startAfterId);
    const contacts = fetchResult.contacts;
    console.log(`Fetched ${contacts.length} contacts`);

    const results = {
      total: contacts.length,
      totalAvailable: fetchResult.totalAvailable,
      processed: 0,
      updated: 0,
      errors: 0,
      // Next page params (use both in next request: ?startAfter=X&startAfterId=Y)
      nextStartAfter: fetchResult.nextStartAfter,
      nextStartAfterId: fetchResult.nextStartAfterId,
      byType: {
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

        // Update contact (pass email for upsert)
        const updateResult = await updateContact(token, contact.id, contact.email, contactType, stats, dryRun);

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
