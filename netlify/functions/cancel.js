/**
 * COLLECTIVE. Event Cancellation Function
 * Cancels an appointment booking via GHL API
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
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

  // Only allow POST
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

    const body = JSON.parse(event.body || '{}');
    const { appointmentId, contactId, reason, comments } = body;

    // Need at least appointment ID to cancel
    if (!appointmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing appointment ID',
          message: 'Unable to cancel without booking reference'
        })
      };
    }

    console.log(`Cancelling appointment: ${appointmentId}, reason: ${reason}`);

    // Cancel the appointment via GHL API
    // GHL uses DELETE for appointment cancellation
    try {
      await ghlRequest(
        `/calendars/events/appointments/${appointmentId}`,
        'DELETE',
        token
      );
    } catch (deleteError) {
      // If already deleted or not found, that's fine
      if (deleteError.status === 404) {
        console.log('Appointment already cancelled or not found');
      } else {
        throw deleteError;
      }
    }

    // Add note to contact with cancellation reason (for tracking)
    if (contactId && (reason || comments)) {
      try {
        const reasonText = {
          'schedule_conflict': 'Schedule conflict (work/family)',
          'illness': 'Not feeling well',
          'transport': 'Transport issues',
          'other': 'Other/not specified'
        }[reason] || reason || 'Not specified';

        const noteBody = [
          `Event Booking Cancelled`,
          `Reason: ${reasonText}`,
          comments ? `Comments: ${comments}` : null,
          `Cancelled at: ${new Date().toISOString()}`
        ].filter(Boolean).join('\n');

        await ghlRequest(
          `/contacts/${contactId}/notes`,
          'POST',
          token,
          { body: noteBody }
        );
      } catch (noteError) {
        // Don't fail the cancellation if note fails
        console.warn('Failed to add cancellation note:', noteError.message);
      }
    }

    // Remove event tag from contact if possible
    if (contactId) {
      try {
        // We'd need to know the event title to remove the right tag
        // For now, just add a "Cancelled" tag for tracking
        await ghlRequest(
          `/contacts/${contactId}/tags`,
          'POST',
          token,
          { tags: ['Event Cancelled'] }
        );
      } catch (tagError) {
        console.warn('Failed to add cancellation tag:', tagError.message);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Booking cancelled successfully',
        appointmentId
      })
    };

  } catch (error) {
    console.error('Cancellation error:', error.message, error.stack);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to cancel booking',
        message: error.message
      })
    };
  }
};
