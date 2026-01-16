/**
 * COLLECTIVE. Event Booking Function
 * Creates a contact and calendar appointment in GHL
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const LOCATION_ID = 'JcB0t2fZpGS0lMrqKDWQ';

// Helper to make GHL API requests
async function ghlRequest(endpoint, token, options = {}) {
  const url = `${GHL_API_BASE}${endpoint}`;
  console.log(`GHL Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': API_VERSION,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  console.log(`GHL Response: ${response.status} - ${text.substring(0, 500)}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error || data.msg || `GHL API Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// Search for existing contact by email
async function findContactByEmail(email, token) {
  try {
    const result = await ghlRequest(
      `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(email)}&limit=10`,
      token
    );
    const contact = result.contacts?.find(c =>
      c.email?.toLowerCase() === email.toLowerCase()
    );
    return contact || null;
  } catch (error) {
    console.log('Contact search failed:', error.message);
    return null;
  }
}

// Create a new contact
async function createContact(contactData, token) {
  const payload = {
    locationId: LOCATION_ID,
    firstName: contactData.firstName,
    lastName: contactData.lastName,
    email: contactData.email,
    phone: contactData.phone || undefined,
    companyName: contactData.businessName,
    tags: ['COLLECTIVE Event Booking'],
    source: 'COLLECTIVE Events Website'
  };

  // Remove undefined values
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

  console.log('Creating contact with payload:', JSON.stringify(payload));

  return ghlRequest('/contacts/', token, {
    method: 'POST',
    body: payload
  });
}

// Update an existing contact
async function updateContact(contactId, contactData, token) {
  const payload = {
    firstName: contactData.firstName,
    lastName: contactData.lastName,
    companyName: contactData.businessName
  };

  if (contactData.phone) {
    payload.phone = contactData.phone;
  }

  return ghlRequest(`/contacts/${contactId}`, token, {
    method: 'PUT',
    body: payload
  });
}

// Create calendar appointment
async function createAppointment(contactId, bookingData, token) {
  const eventDate = new Date(bookingData.eventDate);
  const [startHour, startMin] = (bookingData.eventStartTime || '17:00').split(':');
  const [endHour, endMin] = (bookingData.eventEndTime || '19:30').split(':');

  const startTime = new Date(eventDate);
  startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

  const endTime = new Date(eventDate);
  endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

  const payload = {
    calendarId: bookingData.calendarId,
    locationId: LOCATION_ID,
    contactId: contactId,
    title: `${bookingData.eventTitle} - ${bookingData.firstName} ${bookingData.lastName}`,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    appointmentStatus: 'confirmed',
    address: bookingData.eventVenue || bookingData.eventLocation || '',
    notes: `Event: ${bookingData.eventTitle}\nBooked via: COLLECTIVE Events Website\nBusiness: ${bookingData.businessName}\nOpt-in: ${bookingData.optIn ? 'Yes' : 'No'}`
  };

  console.log('Creating appointment with payload:', JSON.stringify(payload));

  return ghlRequest('/calendars/events/appointments', token, {
    method: 'POST',
    body: payload
  });
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

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
    console.log('Booking request received');
    const body = JSON.parse(event.body || '{}');
    console.log('Request body:', JSON.stringify(body));

    // Validate required fields
    const required = ['firstName', 'lastName', 'email', 'businessName', 'eventTitle', 'eventDate', 'calendarId'];
    const missing = required.filter(field => !body[field]);

    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
      };
    }

    // Get API token
    const token = process.env.COLLECTIVE_API_TOKEN || process.env.GHL_API_TOKEN;
    console.log('Token available:', !!token, 'Length:', token?.length || 0);

    if (!token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server configuration error - no API token' })
      };
    }

    // Step 1: Find or create contact
    console.log('Step 1: Looking up contact:', body.email);
    let contact = await findContactByEmail(body.email, token);

    if (contact) {
      console.log('Found existing contact:', contact.id);
      try {
        await updateContact(contact.id, body, token);
        console.log('Updated contact');
      } catch (e) {
        console.log('Could not update contact:', e.message);
      }
    } else {
      console.log('Creating new contact...');
      const result = await createContact(body, token);
      contact = result.contact;
      console.log('Created contact:', contact?.id);
    }

    if (!contact?.id) {
      throw new Error('Failed to create or find contact');
    }

    // Step 2: Create calendar appointment
    console.log('Step 2: Creating appointment for calendar:', body.calendarId);
    const appointment = await createAppointment(contact.id, body, token);
    console.log('Created appointment:', appointment?.id || appointment?.event?.id);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        contactId: contact.id,
        appointmentId: appointment?.id || appointment?.event?.id
      })
    };

  } catch (error) {
    console.error('Booking error:', error.message, error.stack);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Failed to process booking'
      })
    };
  }
};
