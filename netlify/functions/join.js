/**
 * COLLECTIVE. Community Join Function
 * Creates/updates a contact in GHL for community members
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

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'Join function is running',
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

    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    const required = ['firstName', 'lastName', 'email'];
    const missing = required.filter(field => !body[field]);

    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // Build tags
    const tags = ['COLLECTIVE Community', 'Website Signup'];
    if (body.optIn) {
      tags.push('COLLECTIVE Newsletter', 'Marketing Opted In');
    }

    // Build contact payload
    const contactPayload = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone || undefined,
      companyName: body.businessName || undefined,
      locationId: LOCATION_ID,
      source: 'COLLECTIVE Website - Join',
      tags: tags
    };

    // Create/update contact
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

    // Add a note about how they joined
    try {
      await ghlRequest(
        `/contacts/${contactId}/notes`,
        'POST',
        token,
        {
          body: `Joined COLLECTIVE community via website signup.\n\nOpt-in for marketing: ${body.optIn ? 'Yes' : 'No'}\nBusiness: ${body.businessName || 'Not provided'}\nPhone: ${body.phone || 'Not provided'}`
        }
      );
    } catch (noteError) {
      console.log('Failed to add note:', noteError.message);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Welcome to COLLECTIVE!',
        contactId: contactId
      })
    };

  } catch (error) {
    console.error('Join error:', error.message);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process signup. Please try again.',
        details: error.message
      })
    };
  }
};
