# COLLECTIVE. Events Website - Changelog

All notable changes to this project are documented here.

---

## [2026-01-17] - Gallery, Logo & Image Fallback Updates

### Fixed
- **Media API folder filtering** - Changed from `folderId` to `parentId` parameter for GHL API compatibility
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

**IMPORTANT**: The media API uses `folder=FolderName` with URL encoding for spaces (`%20`).

Working examples:
- `GET /collective/media?folder=HomePage%20Images` - Returns 7 images
- `GET /collective/media?folder=Trusted%20Partner%20Logos` - Returns 0 images (folder empty!)

The folder exists (`folderId: 68becd57cbed3f563d1ec48c`) but has no images uploaded to it.
Gallery images work because "HomePage Images" folder has content.
