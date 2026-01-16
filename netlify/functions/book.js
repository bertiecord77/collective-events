/**
 * COLLECTIVE. Event Booking Function
 * Creates a contact and calendar appointment in GHL
 *
 * Environment Variables Required:
 * - COLLECTIVE_API_TOKEN: GHL API key with contacts.write and calendars/events.write scopes
 *
 * Request Body:
 * {
 *   firstName, lastName, phone, businessName, email, optIn,
 *   eventId, eventTitle, eventDate, eventStartTime, eventEndTime,
 *   eventLocation, eventVenue, calendarId
 * }
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const LOCATION_ID = 'JcB0t2fZpGS0lMrqKDWQ';

// Helper to make GHL API requests
async function ghlRequest(endpoint, token, options = {}) {
  const response = await fetch(`${GHL_API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('GHL API Error:', data);
    throw new Error(data.message || `GHL API Error ${response.status}`);
  }

  return data;
}

// Search for existing contact by email
async function findContactByEmail(email, token) {
  try {
    const result = await ghlRequest(
      `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(email)}`,
      token
    );
    // Find exact email match
    const contact = result.contacts?.find(c =>
      c.email?.toLowerCase() === email.toLowerCase()
    );
    return contact || null;
  } catch (error) {
    console.log('Contact search error (may not exist):', error.message);
    return null;
  }
}

// Create a new contact
async function createContact(contactData, token) {
  return ghlRequest('/contacts/', token, {
    method: 'POST',
    body: {
      locationId: LOCATION_ID,
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      email: contactData.email,
      phone: contactData.phone || undefined,
      companyName: contactData.businessName,
      tags: ['COLLECTIVE Event Booking', 'Website Booking'],
      source: 'COLLECTIVE Events Website'
    }
  });
}

// Update an existing contact
async function updateContact(contactId, contactData, token) {
  return ghlRequest(`/contacts/${contactId}`, token, {
    method: 'PUT',
    body: {
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      phone: contactData.phone || undefined,
      companyName: contactData.businessName
    }
  });
}

// Create calendar appointment
async function createAppointment(contactId, bookingData, token) {
  // Parse date and times
  const eventDate = new Date(bookingData.eventDate);
  const [startHour, startMin] = (bookingData.eventStartTime || '17:00').split(':');
  const [endHour, endMin] = (bookingData.eventEndTime || '19:30').split(':');

  const startTime = new Date(eventDate);
  startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

  const endTime = new Date(eventDate);
  endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

  // Build appointment title
  const appointmentTitle = `${bookingData.eventTitle} - ${bookingData.firstName} ${bookingData.lastName}`;

  // Build location string
  let location = bookingData.eventLocation || '';
  if (bookingData.eventVenue) {
    location = bookingData.eventVenue + (location ? `, ${location}` : '');
  }

  return ghlRequest('/calendars/events/appointments', token, {
    method: 'POST',
    body: {
      calendarId: bookingData.calendarId,
      locationId: LOCATION_ID,
      contactId: contactId,
      title: appointmentTitle,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      appointmentStatus: 'confirmed',
      address: location,
      notes: `Event: ${bookingData.eventTitle}\nBooked via: COLLECTIVE Events Website\nBusiness: ${bookingData.businessName}\nOpt-in: ${bookingData.optIn ? 'Yes' : 'No'}`
    }
  });
}

export const handler = async (event, context) => {
  // CORS headers
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

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'businessName', 'eventTitle', 'eventDate', 'calendarId'];
    const missing = required.filter(field => !body[field]);

    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `Missing required fields: ${missing.join(', ')}`
        })
      };
    }

    // Get API token
    const token = process.env.COLLECTIVE_API_TOKEN;
    if (!token) {
      console.error('COLLECTIVE_API_TOKEN not configured');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Step 1: Find or create contact
    console.log('Looking up contact:', body.email);
    let contact = await findContactByEmail(body.email, token);

    if (contact) {
      console.log('Found existing contact:', contact.id);
      // Update with latest info
      await updateContact(contact.id, body, token);
    } else {
      console.log('Creating new contact');
      const result = await createContact(body, token);
      contact = result.contact;
      console.log('Created contact:', contact.id);
    }

    // Step 2: Create calendar appointment
    console.log('Creating appointment for calendar:', body.calendarId);
    const appointment = await createAppointment(contact.id, body, token);
    console.log('Created appointment:', appointment.id || appointment.event?.id);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        contactId: contact.id,
        appointmentId: appointment.id || appointment.event?.id
      })
    };

  } catch (error) {
    console.error('Booking error:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Failed to process booking'
      })
    };
  }
};
