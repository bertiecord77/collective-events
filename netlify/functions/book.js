/**
 * COLLECTIVE. Event Booking Function
 * Posts booking data to GHL webhook for automation processing
 */

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/JcB0t2fZpGS0lMrqKDWQ/webhook-trigger/eb256439-b6f6-48e1-8fcc-747fe78b7f4b';

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

    // Build webhook payload with all the data your automation needs
    // Adjust these field names to match what your GHL automation expects
    const webhookPayload = {
      // Contact info
      first_name: body.firstName,
      last_name: body.lastName,
      full_name: `${body.firstName} ${body.lastName}`,
      email: body.email,
      phone: body.phone || '',
      company_name: body.businessName,

      // Event details
      event_title: body.eventTitle,
      event_name: body.eventTitle,
      event_date: body.eventDate,
      event_start_time: body.eventStartTime || '17:00',
      event_end_time: body.eventEndTime || '19:30',
      event_location: body.eventLocation || '',
      event_venue: body.eventVenue || '',
      event_id: body.eventId || '',
      calendar_id: body.calendarId || '',

      // Preferences
      opt_in: body.optIn ? 'Yes' : 'No',
      marketing_consent: body.optIn ? 'true' : 'false',

      // Metadata
      source: 'COLLECTIVE Events Website',
      booking_timestamp: new Date().toISOString(),

      // Tags for automation
      tags: `COLLECTIVE Event Booking,COLLECTIVE: ${body.eventTitle}`
    };

    console.log('Sending to webhook:', JSON.stringify(webhookPayload));

    // POST to GHL webhook
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await response.text();
    console.log('Webhook response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status} - ${responseText}`);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking confirmed',
        eventTitle: body.eventTitle
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
