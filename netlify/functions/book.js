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
  const emailLower = email.toLowerCase();
  console.log('Searching for contact with email:', emailLower);

  // Method 1: Simple query search (most widely supported)
  try {
    console.log('Method 1: Query search');
    const url = `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(emailLower)}&limit=50`;
    const result = await ghlRequest(url, token);

    if (result.contacts && result.contacts.length > 0) {
      console.log(`Found ${result.contacts.length} contacts, checking emails...`);
      for (const c of result.contacts) {
        console.log(`  - ${c.email} (id: ${c.id})`);
        if (c.email?.toLowerCase() === emailLower) {
          console.log('Exact email match found!');
          return c;
        }
      }
    }
  } catch (error) {
    console.log('Method 1 failed:', error.message);
  }

  // Method 2: Lookup endpoint
  try {
    console.log('Method 2: Lookup endpoint');
    const url = `/contacts/lookup?locationId=${LOCATION_ID}&email=${encodeURIComponent(emailLower)}`;
    const result = await ghlRequest(url, token);

    const contact = result.contact || result.contacts?.[0];
    if (contact?.id) {
      console.log('Found via lookup:', contact.id);
      return contact;
    }
  } catch (error) {
    console.log('Method 2 failed:', error.message);
  }

  // Method 3: List recent contacts and search
  try {
    console.log('Method 3: List all and search');
    const url = `/contacts/?locationId=${LOCATION_ID}&limit=100`;
    const result = await ghlRequest(url, token);

    if (result.contacts) {
      const contact = result.contacts.find(c => c.email?.toLowerCase() === emailLower);
      if (contact) {
        console.log('Found in list:', contact.id);
        return contact;
      }
    }
  } catch (error) {
    console.log('Method 3 failed:', error.message);
  }

  console.log('No contact found for:', emailLower);
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
