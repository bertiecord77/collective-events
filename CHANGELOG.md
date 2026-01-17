# COLLECTIVE. Events Website - Changelog

All notable changes to this project are documented here.

---

## [2026-01-17] - Speaker-Contact Linking & Partner Logos

### Added
- **Speaker-Contact association** - Events can now link to a Contact record in GHL for speaker data
- **Contact profile photo support** - Speaker photos now pull from linked Contact's `profilePhoto`
- **Contact ID in speaker data** - API returns `contactId` for linking to speaker pages
- **Speaker social links** - API returns socials object (instagram, linkedin, twitter, tiktok, website)
- **Debug mode for events API** - Use `?debug=true` to see raw GHL records and contact data
- **All 7 partner logos** - EMCCA, Innovate UK, NotLuck, NTU, Derby, Lincoln, Mansfield District Council

### Architecture
- Speaker data priority: Event fields → Contact fields → null
- Photo priority: Contact profilePhoto → Event speaker_photo → null
- Speaker custom fields use GHL field ID mapping (see `SPEAKER_FIELD_IDS` in collective-events.js)

### Fixed
- **GHL Media API folder filtering** - Must use BOTH `folderId` AND `parentId` parameters (see GHL API Quirks below)
- **SVG file support** - Media API now includes `.svg` files in results

---

## GHL API Quirks & Gotchas

**IMPORTANT: Reference this section when working with GHL APIs to avoid repeating mistakes.**

### Media API - Folder Filtering
The `/medias/files` endpoint requires **BOTH** `folderId` AND `parentId` parameters to filter by folder:
```
GET /medias/files?altId={locationId}&altType=location&folderId={folderId}&parentId={folderId}
```
Using only one parameter will return all files regardless of folder.

### Contact Custom Fields
GHL returns contact `customFields` as an array with `{id, value}` objects - NOT `{key, value}`.
To look up a field by name, you need to:
1. Get field definitions from `/locations/{locationId}/customFields`
2. Map field keys to IDs
3. Look up by ID in the contact's customFields array

See `SPEAKER_FIELD_IDS` mapping in `collective-events.js` for example.

### Custom Object Associations
When an event has a linked Contact, the association appears in `record.relations[]`:
```json
{
  "relations": [{
    "objectKey": "contact",
    "recordId": "CONTACT_ID_HERE"
  }]
}
```

---

## [2026-01-17] - Gallery, Logo & Image Fallback Updates

### Fixed
- **Media API folder filtering** - Requires both `folderId` AND `parentId` parameters
- **URL decoding** - Added `decodeURIComponent()` to properly handle `%20` encoding in folder names
- **Homepage gallery** - Now correctly loads community photos from "HomePage Images" folder
- **Partner logos visibility** - Fixed CSS filter that was making logos invisible (changed from `brightness(0)` to proper grayscale treatment)
- **About page video** - Removed incorrect poster image from video player
- **Footer NotLuck link** - Now links to https://notluck.co.uk instead of internal /notluck page
- **Footer "Main Website" link** - Removed from all pages as it was irrelevant
- **Copyright year** - Updated to 2026 across all pages

### Changed
- **Logo updated** - New COLLECTIVE. logo across all 10 pages (nav + footer)
- **Footer logo styling** - Added `object-fit: contain` to prevent proportion distortion
- **Gallery redesign** - Converted from static 3-image grid to scrollable carousel with prev/next buttons
- **Past events cards** - Moved date and "Past Event" badge from image overlay to content area below
- **Partner logos styling** - Improved filter with `grayscale(100%) contrast(0.8) brightness(0.3)` and opacity for better visibility
- **Event image fallback** - Events without images now show a branded placeholder (solid color + location/title text) instead of location graphics
- **Speaker avatar fallback** - Speakers without photos now show a minimal SVG avatar icon instead of placeholder image

### Added
- **Scrollable carousel** - Homepage gallery now supports 12 images with smooth scrolling
- **Carousel navigation** - Added prev/next buttons for gallery control
- **components.js** - New shared components file for reusable header/footer (ready for integration)
- **collective-event-gallery.js** - New API endpoint for dynamic per-event photo galleries
- **DEFAULT_AVATAR** - SVG data URL for speaker placeholders in api.js
- **getEventPlaceholder()** - New function to generate branded SVG placeholders for events
- **hasEventImage()** - New function to check if event has a real featured image
- **LOCATION_COLORS** - Color mapping for placeholder generation

---

## [2026-01-16] - Venue Pages & Cancellation

### Added
- **Venue pages** - Individual pages for each venue with full details
- **Cancellation page** - Friendly cancellation flow at `/cancel`
- **Rich appointment notes** - Venue/directions info added to booking confirmations

### Changed
- **Appointment notes** - Simplified to venue info only (removed duplicate speaker/event data)
- **Booking flow** - Improved appointment update process

---

## [2026-01-15] - Venue Data & API Updates

### Added
- **admin-update-venues.js** - One-time endpoint to push venue descriptions to GHL
- **collective-media.js** - New API endpoint for GHL Media Library images
- **Venue descriptions** - Full descriptions, parking, transport, accessibility info for 5 venues

### Fixed
- **GHL Custom Objects API** - Fixed locationId placement (query string vs body)
- **Field naming** - Corrected to use `venue_short_description`, `venue_long_description`
- **Folder ID lookup** - GHL uses `_id` not `id` for folders

---

## [2026-01-14] - Initial Booking System

### Added
- **Event booking flow** - Form submission creates GHL contact and appointment
- **Webhook integration** - Triggers GHL automation for appointment creation
- **Polling mechanism** - Waits for appointment confirmation before success
- **Marketing opt-in** - Tags added for newsletter subscribers

---

## Project Structure

```
collective-events/
├── public/
│   ├── index.html              # Homepage
│   ├── assets/
│   │   ├── css/main.css        # Shared styles
│   │   └── js/
│   │       ├── api.js          # API utilities
│   │       └── components.js   # Shared header/footer (new)
│   └── pages/
│       ├── about.html          # About page
│       ├── cancel.html         # Cancellation page
│       ├── event.html          # Single event page
│       ├── location.html       # Location pages (Nottingham, etc.)
│       ├── notluck.html        # NotLuck sponsor page
│       ├── past.html           # Past events timeline
│       ├── speaker.html        # Single speaker page
│       ├── speakers.html       # All speakers
│       └── venue.html          # Single venue page
├── netlify/
│   ├── functions/
│   │   └── book.js             # Booking function
│   └── edge-functions/
│       └── seo-inject.js       # Dynamic meta tags
└── CHANGELOG.md                # This file

notluck-api/
├── netlify/functions/
│   ├── collective-events.js       # Events API
│   ├── collective-venues.js       # Venues API
│   ├── collective-media.js        # Media Library API
│   ├── collective-event-gallery.js # Per-event photo galleries API
│   └── admin-update-venues.js     # Admin: venue data updates
└── lib/
    └── client-config.js           # Client configuration
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /collective/events` | List events (supports `?status=past`) |
| `GET /collective/events/:slug` | Single event by slug |
| `GET /collective/venues` | List all venues |
| `GET /collective/venues/:slug` | Single venue by slug |
| `GET /collective/media` | Media Library images |
| `GET /collective/media?folders=true` | List media folders |
| `GET /collective/event-gallery` | List all event gallery folders |
| `GET /collective/event-gallery/:slug` | Get images for a specific event |
| `POST /collective/event-gallery` | Create a new event gallery folder |
| `POST /book` | Create event booking |

---

## Known Issues / TODO

### High Priority (Launch Blockers)
- [ ] **Partner logos** - "Trusted Partner Logos" folder in GHL is empty. Need to upload logos (NTU, Innovate UK, NotLuck, EMCCA) to folder, OR move existing logos from where they are to this folder. API returns 0 images: `GET /collective/media?folder=Trusted%20Partner%20Logos`
- [ ] **Google Tag Manager** - GTM placeholder added but needs container ID (currently commented out in index.html)

### Medium Priority
- [ ] Header/footer duplicated across pages (components.js ready for integration)
- [ ] Speaker data architecture - Consider linking speaker info to Contact records (bio, headshot) and event-specific info (talk title) separately
- [ ] Speaker pages enhancement - Make speaker profiles more compelling with fuller bios

### Completed
- [x] Partner logos banner styling - Fixed CSS filter for better visibility
- [x] Dynamic event gallery folder system - API created (`collective-event-gallery.js`)
- [x] SEO essentials - robots.txt, sitemap.xml, OG tags, Twitter cards, favicon added
- [x] Event hero images - Now uses location fallback images instead of SVG placeholder
- [x] Navbar logo - Increased to 48px across all pages

---

## Media API Notes

**IMPORTANT**: The GHL Media API has a known issue - it doesn't return files from subfolders correctly.

**Working examples:**
- `GET /collective/media?folder=HomePage%20Images` - Returns 7 images (folder at root level)

**NOT working:**
- `GET /collective/media?folder=Trusted%20Partner%20Logos` - Returns 0 images even though folder has 7 files!

The folder exists (`folderId: 68becd57cbed3f563d1ec48c`) and contains files (verified in GHL UI), but the API returns empty array.

**Workaround**: Use direct GHL storage URLs for partner logos. Example format:
```
https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/{fileId}.svg
```

Example working URL: `68caab16f411f37250c3fc87.svg` (EMCCA logo)

To get direct URLs: In GHL Media Library, right-click each logo → "Copy image address"
