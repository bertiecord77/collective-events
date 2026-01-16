/**
 * COLLECTIVE. Event Booking Function
 * Creates contact and books them onto an event via GHL API
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
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

  console.log(`GHL Request: ${method} ${endpoint}`);
  if (body) console.log('Payload:', JSON.stringify(body));

  const response = await fetch(`${GHL_API_BASE}${endpoint}`, options);
  const text = await response.text();

  console.log(`GHL Response: ${response.status}`);
  console.log('Response body:', text);

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

// Create ISO datetime string from date and time
function createISODateTime(dateStr, timeStr) {
  // dateStr is "YYYY-MM-DD", timeStr is "HH:MM"
  const [hours, minutes] = (timeStr || '17:00').split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
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

    console.log('Booking request received');
    const body = JSON.parse(event.body || '{}');
    console.log('Request body:', JSON.stringify(body));

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

    // Step 1: Create or update contact using upsert
    console.log('Creating/updating contact...');
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
    console.log('Contact ID:', contactId);

    // Step 2: Try to create a calendar event/blocked slot
    // For class/event calendars, we need to use the events endpoint
    const calendarId = body.calendarId || 'Bv8FhvFB2lOEcWreAcOM';
    const startTime = body.eventStartTime || '17:00';
    const endTime = body.eventEndTime || '19:30';

    // Try creating via /calendars/events (blocked event)
    const eventPayload = {
      calendarId: calendarId,
      locationId: LOCATION_ID,
      title: `${body.firstName} ${body.lastName} - ${body.eventTitle}`,
      startTime: createISODateTime(body.eventDate, startTime),
      endTime: createISODateTime(body.eventDate, endTime),
      // Link to contact
      assignedUserId: contactId,
      // Mark as appointment for the contact
      meetingLocationType: 'custom',
      address: body.eventVenue || '',
      notes: [
        `Attendee: ${body.firstName} ${body.lastName}`,
        `Email: ${body.email}`,
        `Business: ${body.businessName}`,
        `Event: ${body.eventTitle}`,
        `Location: ${body.eventLocation || 'TBC'}`,
        `Venue: ${body.eventVenue || 'TBC'}`,
        `Marketing opt-in: ${body.optIn ? 'Yes' : 'No'}`,
        `Booked via: COLLECTIVE Events Website`
      ].join('\n')
    };

    let appointmentResult;
    let appointmentId;

    try {
      // Try the blocked event endpoint first
      console.log('Trying /calendars/events/block-slots...');
      appointmentResult = await ghlRequest(
        '/calendars/events/block-slots',
        'POST',
        token,
        {
          calendarId: calendarId,
          locationId: LOCATION_ID,
          startTime: createISODateTime(body.eventDate, startTime),
          endTime: createISODateTime(body.eventDate, endTime),
          title: body.eventTitle,
          assignedUserId: contactId
        }
      );
      appointmentId = appointmentResult.id || appointmentResult.event?.id;
    } catch (blockError) {
      console.log('Block slot failed:', blockError.message);

      // Try creating appointment with different params
      try {
        console.log('Trying /calendars/events with slot override...');
        appointmentResult = await ghlRequest(
          '/calendars/events',
          'POST',
          token,
          {
            ...eventPayload,
            // Try forcing it as a manual/blocked event
            appointmentStatus: 'confirmed',
            isRecurring: false
          }
        );
        appointmentId = appointmentResult.id || appointmentResult.event?.id;
      } catch (eventError) {
        console.log('Calendar event failed:', eventError.message);
        // Calendar booking failed but contact was created - that's OK
        // The contact has the event tags so they can be tracked
        console.log('Continuing without calendar entry - contact created with tags');
      }
    }

    // Step 3: Add tags based on opt-in preference
    if (body.optIn) {
      try {
        await ghlRequest(
          `/contacts/${contactId}/tags`,
          'POST',
          token,
          { tags: ['COLLECTIVE Newsletter', 'Marketing Opted In'] }
        );
        console.log('Added marketing tags');
      } catch (tagError) {
        console.warn('Failed to add tags:', tagError.message);
      }
    }

    // Step 4: Add a note to the contact with booking details
    try {
      await ghlRequest(
        `/contacts/${contactId}/notes`,
        'POST',
        token,
        {
          body: `Booked for: ${body.eventTitle}\nDate: ${body.eventDate}\nTime: ${startTime} - ${endTime}\nVenue: ${body.eventVenue || 'TBC'}\nLocation: ${body.eventLocation || 'TBC'}`
        }
      );
      console.log('Added booking note to contact');
    } catch (noteError) {
      console.warn('Failed to add note:', noteError.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        eventTitle: body.eventTitle,
        contactId: contactId,
        appointmentId: appointmentId || null
      })
    };

  } catch (error) {
    console.error('Booking error:', error.message, error.stack);
    console.error('Error data:', JSON.stringify(error.data || {}));

    // Provide user-friendly error messages
    let userMessage = 'Failed to process booking. Please try again.';

    if (error.message.includes('slot') || error.message.includes('available')) {
      userMessage = 'This event slot is no longer available. Please refresh and try again.';
    } else if (error.message.includes('contact')) {
      userMessage = 'Unable to create your booking. Please check your details and try again.';
    } else if (error.message.includes('token') || error.message.includes('unauthorized')) {
      userMessage = 'Booking system temporarily unavailable. Please try again later.';
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: userMessage,
        details: error.message
      })
    };
  }
};
