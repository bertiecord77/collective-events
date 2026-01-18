/**
 * COLLECTIVE. Profile Update Function
 * Updates a contact's profile with additional information from the quiz
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'JcB0t2fZpGS0lMrqKDWQ';
const API_VERSION = '2021-07-28';

// Custom field IDs for profile data (COLLECTIVE. location)
// These can be created in GHL Settings > Custom Fields
const PROFILE_CUSTOM_FIELDS = {
  business_sector: 'business_sector',      // Dropdown or text field
  business_stage: 'business_stage',        // Dropdown or text field
  team_size: 'team_size',                  // Dropdown or text field
  business_postcode: 'business_postcode'   // Text field
};

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
        status: 'Update profile function is running',
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

    // Validate contact ID
    if (!body.contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Contact ID is required' })
      };
    }

    // Build custom fields array
    const customFields = [];

    if (body.sector) {
      customFields.push({
        key: PROFILE_CUSTOM_FIELDS.business_sector,
        field_value: body.sector
      });
    }

    if (body.stage) {
      customFields.push({
        key: PROFILE_CUSTOM_FIELDS.business_stage,
        field_value: body.stage
      });
    }

    if (body.teamSize) {
      customFields.push({
        key: PROFILE_CUSTOM_FIELDS.team_size,
        field_value: body.teamSize
      });
    }

    if (body.postcode) {
      customFields.push({
        key: PROFILE_CUSTOM_FIELDS.business_postcode,
        field_value: body.postcode.toUpperCase()
      });
    }

    // Update contact with custom fields
    const updatePayload = {};

    // Only add customFields if we have any
    if (customFields.length > 0) {
      updatePayload.customFields = customFields;
    }

    // Also update the postal code in the address if provided
    if (body.postcode) {
      updatePayload.postalCode = body.postcode.toUpperCase();
    }

    // Update the contact
    if (Object.keys(updatePayload).length > 0) {
      await ghlRequest(
        `/contacts/${body.contactId}`,
        'PUT',
        token,
        updatePayload
      );
    }

    // Add a note with the profile information
    const profileDetails = [];
    if (body.sector) profileDetails.push(`Sector: ${body.sector}`);
    if (body.stage) profileDetails.push(`Stage: ${body.stage}`);
    if (body.teamSize) profileDetails.push(`Team Size: ${body.teamSize}`);
    if (body.postcode) profileDetails.push(`Postcode: ${body.postcode.toUpperCase()}`);

    if (profileDetails.length > 0) {
      try {
        await ghlRequest(
          `/contacts/${body.contactId}/notes`,
          'POST',
          token,
          {
            body: `**Profile Updated via Website Quiz**\n\n${profileDetails.join('\n')}`
          }
        );
      } catch (noteError) {
        console.log('Failed to add profile note:', noteError.message);
        // Don't fail the request if note fails
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Profile updated successfully'
      })
    };

  } catch (error) {
    console.error('Profile update error:', error.message);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to update profile. Please try again.',
        details: error.message
      })
    };
  }
};
