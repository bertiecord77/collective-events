# Collective Events System - Setup Guide

## Overview

This system uses GHL Custom Objects to store event and venue data, with a Netlify API middleware that serves the data to an embeddable iframe widget.

---

## Step 1: Create Custom Objects in GHL

### Events Object

Go to: **Settings → Custom Objects → Create Object**

**Object Name:** `Events`  
**Object Key:** (note this down - you'll need it for Netlify)

**Fields to create:**

| Field Name | API Key | Type | Required | Notes |
|------------|---------|------|----------|-------|
| Event Title | `event_title` | Text | Yes | Main headline |
| Event Slug | `event_slug` | Text | No | URL-friendly name |
| Event Date | `event_date` | Date | Yes | The event date |
| Start Time | `start_time` | Text | No | Format: "17:00" |
| End Time | `end_time` | Text | No | Format: "19:30" |
| Status | `status` | Dropdown | Yes | Options: `draft`, `live` |
| Venue | `venue` | Association | No | Link to Venues object |
| Short Description | `short_description` | Long Text | No | For cards (max 200 chars) |
| Full Description | `full_description` | Long Text | No | Detail page content |
| Speaker Name | `speaker_name` | Text | No | |
| Speaker Title | `speaker_title` | Text | No | Role/company |
| Speaker Bio | `speaker_bio` | Long Text | No | |
| Speaker Photo | `speaker_photo` | Media/URL | No | |
| Price | `price` | Text | No | "Free" or "£X.XX" |
| Booking URL | `booking_url` | URL | No | Link to form/page |
| Featured Image | `featured_image` | Media/URL | No | Hero image |
| Location Tag | `location_tag` | Dropdown | No | Nottingham / Mansfield / Chesterfield / Derby / Online |

---

### Venues Object

Go to: **Settings → Custom Objects → Create Object**

**Object Name:** `Venues`  
**Object Key:** (note this down)

**Fields to create:**

| Field Name | API Key | Type | Notes |
|------------|---------|------|-------|
| Venue Name | `venue_name` | Text | Primary identifier |
| Address Line 1 | `address_line_1` | Text | Street address |
| Address Line 2 | `address_line_2` | Text | Optional |
| City | `city` | Text | |
| Postcode | `postcode` | Text | |
| Google Maps URL | `google_maps_url` | URL | Direct link |
| Parking Info | `parking_info` | Long Text | |
| Public Transport | `public_transport` | Long Text | |
| Accessibility | `accessibility` | Long Text | |
| Venue Contact | `venue_contact` | Text | Phone or email |
| Venue Image | `venue_image` | Media/URL | |
| Internal Notes | `internal_notes` | Long Text | Staff only |

---

## Step 2: Configure Netlify Environment Variables

Go to: https://app.netlify.com/projects/notluck-api/settings/env

**Add/update these variables:**

| Key | Value | Notes |
|-----|-------|-------|
| `COLLECTIVE_API_TOKEN` | Your GHL API key | Already set |
| `COLLECTIVE_LOCATION_ID` | `JcB0t2fZpGS0lMrqKDWQ` | Already known |
| `COLLECTIVE_EVENTS_OBJECT_KEY` | (from Step 1) | e.g., `events_abc123` |
| `COLLECTIVE_VENUES_OBJECT_KEY` | (from Step 1) | e.g., `venues_xyz789` |

After adding, trigger a redeploy.

---

## Step 3: Deploy the Updated Function

Replace the existing `events.js` in your `notluck-api` repo with the new version.

**File location:** `netlify/functions/collective-events.js`

The function handles:
- `GET /collective/events` - Returns all live events
- `GET /collective/events?status=draft` - Returns draft events (for admin)
- `GET /collective/events?limit=3` - Limit results
- `GET /collective/events?includeVenues=false` - Skip venue lookups

---

## Step 4: Add the Widget to Collective Site

### Option A: Custom Code Block in GHL

Add a Custom Code element with this iframe:

```html
<iframe 
  src="https://api.notluck.co.uk/collective/events-widget.html?limit=6" 
  style="width: 100%; min-height: 600px; border: none;"
  title="Upcoming Events"
></iframe>
```

### Option B: Direct embed

Host the `collective-events-widget.html` file on Netlify (in `/public/` folder) and embed where needed.

### Widget Parameters

- `?limit=6` - Number of events to show
- `?status=live` - Which status to filter (default: live)
- Add `dark` or remove class from body for light/dark theme

---

## Step 5: Test the Flow

1. Create a Venue record in GHL
2. Create an Event record, link it to the venue, set status to "Live"
3. Hit `https://api.notluck.co.uk/collective/events` - should return your event
4. Check the widget renders correctly

---

## API Response Format

```json
{
  "success": true,
  "count": 3,
  "events": [
    {
      "id": "abc123",
      "title": "Your First AI Employee",
      "slug": "nottingham-jan-2026",
      "date": "2026-01-21",
      "startTime": "17:00",
      "endTime": "19:30",
      "status": "live",
      "shortDescription": "Forget the hype about AI...",
      "fullDescription": "...",
      "speaker": {
        "name": "Bertie Cordingley",
        "title": "Founder, NotLuck",
        "bio": "...",
        "photo": "https://..."
      },
      "price": "Free",
      "bookingUrl": "https://cdicollective.co.uk/events/nottingham",
      "featuredImage": "https://...",
      "locationTag": "Nottingham",
      "venue": {
        "name": "Dryden Enterprise Centre",
        "address": "Dryden St",
        "city": "Nottingham",
        "postcode": "NG1 4FQ",
        "mapsUrl": "https://maps.google.com/...",
        "parking": "Street parking available...",
        "transport": "5 min walk from Nottingham station",
        "accessibility": "Step-free access...",
        "image": "https://..."
      }
    }
  ]
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "API token not configured" | Check `COLLECTIVE_API_TOKEN` in Netlify env vars |
| "Events object key not configured" | Add `COLLECTIVE_EVENTS_OBJECT_KEY` after creating Custom Object |
| Empty events array | Check records exist with status = "live" |
| 401 Unauthorized | API token may have expired or lack `objects/record.readonly` scope |
| Venue data missing | Check `COLLECTIVE_VENUES_OBJECT_KEY` is set and association is linked |

---

## Future Enhancements

- [ ] Auto-archive events after date passes (workflow)
- [ ] Registration count sync from form submissions
- [ ] Auto-generate event pages from object data
- [ ] Calendar sync when status changes to "live"
