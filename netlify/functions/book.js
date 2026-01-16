/**
 * COLLECTIVE. Event Booking Function
 * Creates contact and books appointment via GHL API
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

    // Step 2: Create appointment on calendar
    const calendarId = body.calendarId || 'Bv8FhvFB2lOEcWreAcOM';
    const startTime = body.eventStartTime || '17:00';
    const endTime = body.eventEndTime || '19:30';

    // Build appointment payload
    const appointmentPayload = {
      calendarId: calendarId,
      locationId: LOCATION_ID,
      contactId: contactId,
      startTime: createISODateTime(body.eventDate, startTime),
      endTime: createISODateTime(body.eventDate, endTime),
      title: body.eventTitle,
      appointmentStatus: 'confirmed',
      assignedUserId: '', // No specific user assigned
      address: body.eventVenue || '',
      ignoreDateRange: true, // Allow booking outside normal calendar hours
      toNotify: true // Send notification to contact
    };

    // Add notes with booking details
    const notes = [
      `Event: ${body.eventTitle}`,
      `Location: ${body.eventLocation || 'TBC'}`,
      `Venue: ${body.eventVenue || 'TBC'}`,
      `Business: ${body.businessName}`,
      `Booked via: COLLECTIVE Events Website`,
      `Marketing opt-in: ${body.optIn ? 'Yes' : 'No'}`
    ].join('\n');

    appointmentPayload.notes = notes;

    console.log('Creating appointment:', JSON.stringify(appointmentPayload));

    const appointmentResult = await ghlRequest(
      '/calendars/events/appointments',
      'POST',
      token,
      appointmentPayload
    );

    console.log('Appointment created:', appointmentResult);

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
        // Don't fail the whole booking for tag errors
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        eventTitle: body.eventTitle,
        appointmentId: appointmentResult.id || appointmentResult.appointment?.id
      })
    };

  } catch (error) {
    console.error('Booking error:', error.message, error.stack);

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
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
