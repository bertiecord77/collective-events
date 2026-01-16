/**
 * COLLECTIVE. Event Booking Function
 * Creates contact via API, triggers appointment via webhook
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/JcB0t2fZpGS0lMrqKDWQ/webhook-trigger/eb256439-b6f6-48e1-8fcc-747fe78b7f4b';
const LOCATION_ID = 'JcB0t2fZpGS0lMrqKDWQ';
const API_VERSION = '2021-07-28';

// Helper to make GHL API requests
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

// Format date/time for GHL automation: "MM-DD-YYYY HH:MM AM/PM"
function formatGHLDateTime(dateStr, timeStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  // Parse time (expects "HH:MM" in 24hr format)
  let hours = 17;
  let minutes = 0;

  if (timeStr) {
    const timeParts = timeStr.split(':');
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10) || 0;
  }

  // Convert to 12-hour format
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${month}-${day}-${year} ${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Debug log collector
  const debugLogs = [];
  const log = (msg) => {
    console.log(msg);
    debugLogs.push(msg);
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // GET request returns debug info
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'Book function is running',
        hasToken: !!process.env.COLLECTIVE_API_TOKEN,
        timestamp: new Date().toISOString()
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const token = process.env.COLLECTIVE_API_TOKEN;
    if (!token) {
      throw new Error('API token not configured');
    }

    log('Booking request received');
    const body = JSON.parse(event.body || '{}');
    log('Request body: ' + JSON.stringify(body));

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'businessName', 'eventTitle', 'eventDate'];
    const missing = required.filter(field => !body[field]);

    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
      };
    }

    // Step 1: Create or update contact using API (this gives us the contact ID)
    log('Creating/updating contact via API...');
    const contactPayload = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone || undefined,
      companyName: body.businessName,
      locationId: LOCATION_ID,
      source: 'COLLECTIVE Events Website',
      tags: ['COLLECTIVE Event Booking', `COLLECTIVE: ${body.eventTitle}`]
    };

    const contactResult = await ghlRequest(
      '/contacts/upsert',
      'POST',
      token,
      contactPayload
    );

    const contactId = contactResult.contact?.id;
    if (!contactId) {
      throw new Error('Failed to create contact - no ID returned');
    }
    log('Contact ID: ' + contactId);

    // Step 2: Send webhook to trigger automation (which creates the appointment with override)
    const startTime = body.eventStartTime || '17:00';
    const endTime = body.eventEndTime || '19:30';
    const calendarId = body.calendarId || 'Bv8FhvFB2lOEcWreAcOM';

    // Format dates for GHL automation
    const eventStartDateTime = formatGHLDateTime(body.eventDate, startTime);
    const eventEndDateTime = formatGHLDateTime(body.eventDate, endTime);

    const webhookPayload = {
      // Contact info
      contact_id: contactId,
      first_name: body.firstName,
      last_name: body.lastName,
      full_name: `${body.firstName} ${body.lastName}`,
      email: body.email,
      phone: body.phone || '',
      company_name: body.businessName,

      // Event details - formatted for GHL automation
      event_title: body.eventTitle,
      event_name: body.eventTitle,
      event_date: body.eventDate,
      event_start_datetime: eventStartDateTime,
      event_end_datetime: eventEndDateTime,
      event_start_time: startTime,
      event_end_time: endTime,
      event_location: body.eventLocation || '',
      event_venue: body.eventVenue || '',
      event_id: body.eventId || '',
      calendar_id: calendarId,

      // Preferences
      opt_in: body.optIn ? 'Yes' : 'No',
      marketing_consent: body.optIn ? 'true' : 'false',

      // Metadata
      source: 'COLLECTIVE Events Website',
      booking_timestamp: new Date().toISOString(),
      tags: `COLLECTIVE Event Booking,COLLECTIVE: ${body.eventTitle}`
    };

    log('Sending webhook to trigger automation...');
    log('Webhook payload: ' + JSON.stringify(webhookPayload));

    const webhookResponse = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const webhookText = await webhookResponse.text();
    log('Webhook response: ' + webhookResponse.status + ' - ' + webhookText);

    if (!webhookResponse.ok) {
      log('Webhook failed but contact was created');
    }

    // Step 3: Add marketing tags if opted in
    if (body.optIn) {
      try {
        await ghlRequest(
          `/contacts/${contactId}/tags`,
          'POST',
          token,
          { tags: ['COLLECTIVE Newsletter', 'Marketing Opted In'] }
        );
        log('Added marketing tags');
      } catch (tagError) {
        log('Failed to add tags: ' + tagError.message);
      }
    }

    // Step 4: Add booking note to contact
    try {
      await ghlRequest(
        `/contacts/${contactId}/notes`,
        'POST',
        token,
        {
          body: `Booked for: ${body.eventTitle}\nDate: ${body.eventDate}\nTime: ${startTime} - ${endTime}\nVenue: ${body.eventVenue || 'TBC'}\nLocation: ${body.eventLocation || 'TBC'}`
        }
      );
      log('Added booking note to contact');
    } catch (noteError) {
      log('Failed to add note: ' + noteError.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        eventTitle: body.eventTitle,
        contactId: contactId,
        debug: debugLogs
      })
    };

  } catch (error) {
    console.error('Booking error:', error.message, error.stack);
    debugLogs.push(`ERROR: ${error.message}`);
    debugLogs.push(`Error data: ${JSON.stringify(error.data || {})}`);

    let userMessage = 'Failed to process booking. Please try again.';

    if (error.message.includes('contact')) {
      userMessage = 'Unable to create your booking. Please check your details and try again.';
    } else if (error.message.includes('token') || error.message.includes('unauthorized')) {
      userMessage = 'Booking system temporarily unavailable. Please try again later.';
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: userMessage,
        details: error.message,
        debug: debugLogs
      })
    };
  }
};
