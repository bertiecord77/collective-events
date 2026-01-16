/**
 * COLLECTIVE. Event Booking Function v2
 * 1. Creates contact via API
 * 2. Triggers webhook to create appointment (with slot override)
 * 3. Polls API to confirm appointment was created
 * 4. Updates appointment with full event details
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

  // Parse date explicitly to avoid timezone issues
  // dateStr is expected as "YYYY-MM-DD"
  const dateParts = dateStr.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = String(parseInt(dateParts[1], 10)).padStart(2, '0');
  const day = String(parseInt(dateParts[2], 10)).padStart(2, '0');

  let hours = 17;
  let minutes = 0;

  if (timeStr) {
    const timeParts = timeStr.split(':');
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10) || 0;
  }

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${month}-${day}-${year} ${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll for appointment created by webhook
async function waitForAppointment(token, contactId, calendarId, eventDate, log, maxAttempts = 10) {
  log(`Polling for appointment (contact: ${contactId}, calendar: ${calendarId})...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Poll attempt ${attempt}/${maxAttempts}...`);

    try {
      // Get appointments for this contact
      const response = await ghlRequest(
        `/contacts/${contactId}/appointments`,
        'GET',
        token
      );

      const appointments = response.appointments || response.events || [];
      log(`Found ${appointments.length} appointments for contact`);

      // Look for an appointment on the target calendar and date
      const targetDate = new Date(eventDate).toISOString().split('T')[0];

      for (const apt of appointments) {
        const aptDate = apt.startTime ? new Date(apt.startTime).toISOString().split('T')[0] : null;
        const aptCalendar = apt.calendarId;

        log(`Checking appointment: ${apt.id}, calendar: ${aptCalendar}, date: ${aptDate}`);

        if (aptCalendar === calendarId && aptDate === targetDate) {
          log(`Found matching appointment: ${apt.id}`);
          return apt;
        }
      }
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait before next attempt (increasing delay)
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * attempt, 3000); // 1s, 2s, 3s, 3s, 3s...
      log(`Waiting ${delay}ms before next poll...`);
      await sleep(delay);
    }
  }

  log('Appointment not found after polling');
  return null;
}

// Update appointment with full details
async function updateAppointmentDetails(token, appointmentId, details, log) {
  log(`Updating appointment ${appointmentId} with details...`);

  try {
    // Build location string for email template
    const locationStr = [details.eventVenue, details.eventLocation].filter(Boolean).join(', ') || 'TBC';

    const updatePayload = {
      title: details.eventTitle,
      address: locationStr,
      meetingLocation: locationStr,  // For {{appointment.meeting_location}} in emails
      notes: [
        `Event: ${details.eventTitle}`,
        `Date: ${details.eventDate}`,
        `Time: ${details.startTime} - ${details.endTime}`,
        `Location: ${details.eventLocation || 'TBC'}`,
        `Venue: ${details.eventVenue || 'TBC'}`,
        ``,
        `Attendee: ${details.firstName} ${details.lastName}`,
        `Email: ${details.email}`,
        `Phone: ${details.phone || 'Not provided'}`,
        `Business: ${details.businessName}`,
        `Marketing opt-in: ${details.optIn ? 'Yes' : 'No'}`,
        ``,
        `Booked via: COLLECTIVE Events Website`,
        `Booked at: ${new Date().toISOString()}`
      ].join('\n')
    };

    await ghlRequest(
      `/calendars/events/appointments/${appointmentId}`,
      'PUT',
      token,
      updatePayload
    );

    log('Appointment updated successfully');
    return true;
  } catch (err) {
    log(`Failed to update appointment: ${err.message}`);
    return false;
  }
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const debugLogs = [];
  const log = (msg) => {
    console.log(msg);
    debugLogs.push(msg);
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

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

    const startTime = body.eventStartTime || '17:00';
    const endTime = body.eventEndTime || '19:30';
    const calendarId = body.calendarId || 'Bv8FhvFB2lOEcWreAcOM';

    // ========================================
    // STEP 1: Create/update contact via API
    // ========================================
    log('Step 1: Creating/updating contact via API...');
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
    log('Contact created: ' + contactId);

    // ========================================
    // STEP 2: Trigger webhook to create appointment
    // ========================================
    log('Step 2: Triggering webhook to create appointment...');

    const eventStartDateTime = formatGHLDateTime(body.eventDate, startTime);
    const eventEndDateTime = formatGHLDateTime(body.eventDate, endTime);

    log(`Formatted datetime - Input: ${body.eventDate} ${startTime} -> Output: ${eventStartDateTime}`);

    const webhookPayload = {
      contact_id: contactId,
      first_name: body.firstName,
      last_name: body.lastName,
      full_name: `${body.firstName} ${body.lastName}`,
      email: body.email,
      phone: body.phone || '',
      company_name: body.businessName,
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
      opt_in: body.optIn ? 'Yes' : 'No',
      source: 'COLLECTIVE Events Website',
      booking_timestamp: new Date().toISOString()
    };

    log('Webhook payload: ' + JSON.stringify(webhookPayload));

    const webhookResponse = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const webhookText = await webhookResponse.text();
    log('Webhook response: ' + webhookResponse.status + ' - ' + webhookText);

    if (!webhookResponse.ok) {
      throw new Error('Webhook failed to trigger automation');
    }

    // ========================================
    // STEP 3: Poll for appointment creation
    // ========================================
    log('Step 3: Waiting for appointment to be created...');

    // Give webhook a moment to trigger
    await sleep(2000);

    const appointment = await waitForAppointment(
      token,
      contactId,
      calendarId,
      body.eventDate,
      log,
      8 // Max 8 attempts (~15 seconds total)
    );

    if (!appointment) {
      // Appointment wasn't created - return error
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Booking could not be confirmed. Please try again or contact support.',
          contactId: contactId,
          debug: debugLogs
        })
      };
    }

    log('Appointment confirmed: ' + appointment.id);

    // ========================================
    // STEP 4: Update appointment with full details
    // ========================================
    log('Step 4: Updating appointment with full details...');

    await updateAppointmentDetails(token, appointment.id, {
      eventTitle: body.eventTitle,
      eventDate: body.eventDate,
      startTime,
      endTime,
      eventLocation: body.eventLocation,
      eventVenue: body.eventVenue,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      businessName: body.businessName,
      optIn: body.optIn
    }, log);

    // ========================================
    // STEP 5: Add marketing tags if opted in
    // ========================================
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

    // ========================================
    // SUCCESS - Booking confirmed
    // ========================================
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        confirmed: true,
        message: 'Booking confirmed',
        eventTitle: body.eventTitle,
        contactId: contactId,
        appointmentId: appointment.id,
        debug: debugLogs
      })
    };

  } catch (error) {
    console.error('Booking error:', error.message, error.stack);
    debugLogs.push(`ERROR: ${error.message}`);
    debugLogs.push(`Error data: ${JSON.stringify(error.data || {})}`);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        confirmed: false,
        error: 'Failed to process booking. Please try again.',
        details: error.message,
        debug: debugLogs
      })
    };
  }
};
