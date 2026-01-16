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

// Search for existing contact by email using lookup endpoint
async function findContactByEmail(email, token) {
  // Method 1: Direct lookup by email (most reliable)
  try {
    console.log('Trying lookup endpoint for:', email);
    const result = await ghlRequest(
      `/contacts/lookup?locationId=${LOCATION_ID}&email=${encodeURIComponent(email.toLowerCase())}`,
      token
    );
    console.log('Lookup result:', JSON.stringify(result));

    // Lookup returns contact directly or in contacts array
    const contact = result.contact || result.contacts?.[0] || result;
    if (contact?.id) {
      return contact;
    }
  } catch (error) {
    console.log('Lookup failed:', error.message);
  }

  // Method 2: Query-based search as fallback
  try {
    console.log('Trying query search for:', email);
    const result = await ghlRequest(
      `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(email)}&limit=20`,
      token
    );
    console.log('Query search result:', JSON.stringify(result));

    const contact = result.contacts?.find(c =>
      c.email?.toLowerCase() === email.toLowerCase()
    );
    if (contact) {
      return contact;
    }
  } catch (error) {
    console.log('Query search failed:', error.message);
  }

  console.log('No contact found for:', email);
  return null;
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
      console.log('No existing contact found, creating new contact...');
      try {
        const result = await createContact(body, token);
        contact = result.contact;
        console.log('Created contact:', contact?.id);
      } catch (createError) {
        // Handle duplicate contact error
        const errMsg = createError.message.toLowerCase();
        if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
          console.log('Duplicate contact detected, retrying search...');

          // Wait a moment then search again
          await new Promise(r => setTimeout(r, 500));
          contact = await findContactByEmail(body.email, token);

          if (contact) {
            console.log('Found contact on retry:', contact.id);
          } else {
            // Last resort: list all contacts and find manually
            console.log('Still not found, listing contacts...');
            try {
              const listResult = await ghlRequest(
                `/contacts/?locationId=${LOCATION_ID}&limit=100`,
                token
              );
              contact = listResult.contacts?.find(c =>
                c.email?.toLowerCase() === body.email.toLowerCase()
              );
              if (contact) {
                console.log('Found contact in list:', contact.id);
              }
            } catch (listError) {
              console.log('List contacts failed:', listError.message);
            }
          }
        } else {
          throw createError;
        }
      }
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
