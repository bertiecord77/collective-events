# COLLECTIVE. Events Platform - Project Documentation

> **Last Updated:** 2026-01-16
> **Status:** In Development
> **Live URL:** TBD (Netlify)
> **Staging URL:** TBD (Netlify)

---

## Project Overview

### What Is This?
A full website replacement for cdicollective.co.uk - an events platform for the East Midlands creative, digital and tech community. The platform displays events stored in GHL (GoHighLevel) Custom Objects and allows users to browse and book events.

### Original Scope vs Current Scope
| Original Scope | Current Scope |
|----------------|---------------|
| GHL extension for calendar booking | Full website replacement |
| Embed widget | Standalone Netlify-hosted site |
| Basic event listing | SEO-rich dynamic pages |

### Core Functionality Required
1. **Store event data** in GHL Custom Objects
2. **Fetch and display events** dynamically on the website
3. **Generate clickable event pages** with full details
4. **Enable booking** directly from event pages (link to booking URL)
5. **Add to Calendar** functionality (Google Calendar integration)

---

## Technical Architecture

### Current Approach: Client-Side Rendering
- **Why chosen:** Speed of development, deemed no SEO downsides initially
- **How it works:** JavaScript fetches from API on page load, renders content client-side
- **Status:** NOT FULLY WORKING - events display but booking links may be missing

### Alternative Approach: Static Site Generation (SSG)
- **How it would work:** Webhook triggers rebuild, generates static HTML pages
- **Pros:** Better SEO, faster page loads, works without JavaScript
- **Cons:** Requires webhook setup, slight delay on event updates
- **Status:** Not implemented yet

### API Details
```
Base URL: https://api.notluck.co.uk/collective
Location ID: JcB0t2fZpGS0lMrqKDWQ

Endpoints:
- GET /events              → All events
- GET /events?status=live  → Upcoming/live events only
- GET /events?status=past  → Past events only
- GET /events/:slug        → Single event by slug/ID
```

### Verified API Field Names (tested 2026-01-16)
```javascript
// CONFIRMED Event fields from API:
event.id                // "6969788c390682fb6763b18a"
event.title             // "Your First AI Employee..."
event.slug              // "nottingham-jan-2026"
event.date              // "2026-01-21"
event.startTime         // "17:00"
event.endTime           // "19:30"
event.status            // "live" or "past"
event.shortDescription  // Short text
event.fullDescription   // "" (often empty)
event.speaker           // { name, title, bio, photo } - SINGLE object
event.price             // "Free"
event.bookingUrl        // "https://cdicollective.co.uk/events/nottingham" ✅ CONFIRMED
event.featuredImage     // null (often)
event.locationTag       // "Nottingham", "Mansfield", "Chesterfield"
event.featured          // false
event.capacity          // { max, current, remaining, waitlistEnabled, status }
event.calendarId        // null
event.venue             // null (often) or { address, what3words }

// IMPORTANT: API does NOT support filtering by slug
// Must fetch all events and filter client-side
```

---

## Brand Guidelines

### Colors
| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Lime | #E5F608 | `--lime` | Primary accent, CTAs |
| Lilac | #C5B6F1 | `--lilac` | Secondary accent |
| Black | #000000 | `--black` | Background |
| Grey | #EBEBE9 | `--grey` | Tertiary |

### Typography
- **Font:** Work Sans
- **Weights:** 300, 400, 500, 600, 700

### Logo
- **White version (current):** `https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/68e88f864d2dff0a63480113.png`
- **Original PNG:** `https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/68efb0a2629b057f6907b407.png`

---

## Site Structure

### Pages
| Page | Path | Status | Notes |
|------|------|--------|-------|
| Homepage | `/` | Working | Event listing, filter bar |
| Event Detail | `/event/:slug` | ISSUES | Booking link not working |
| Speakers | `/speakers` | Working | Extracts from events |
| Past Events | `/past` | Working | Uses `?status=past` |
| About | `/about` | Working | Video player added |
| NotLuck | `/notluck` | Working | Partner/sponsor page |
| Nottingham | `/nottingham` | Working | Location filter |
| Mansfield | `/mansfield` | Working | Location filter |
| Chesterfield | `/chesterfield` | Working | Location filter |
| Derby | `/derby` | Working | Location filter |

### Navigation Structure
**Header Nav:**
- Events (/)
- Speakers (/speakers)
- About (/about)

**Footer:**
- Locations: Nottingham, Mansfield, Chesterfield, Derby
- Explore: Events, Speakers, Past Events
- About: About Us, Main Website
- "Proudly built in Notts by NotLuck"

---

## Outstanding Issues & Priorities

### CRITICAL - Must Fix
1. **[x] Booking links not working on event pages** - FIXED 2026-01-16
   - ROOT CAUSE: `fetchEvent()` function was broken - API doesn't support slug filtering
   - FIX: Updated to fetch all events and filter client-side by slug/ID
   - `bookingUrl` field IS present in API data ✅

2. **[x] Verify API returns expected data structure** - VERIFIED 2026-01-16
   - API returns `bookingUrl` field correctly
   - Speaker is single object (`event.speaker`), not array
   - See "Verified API Field Names" section above

3. **[ ] Test event detail page end-to-end**
   - Click event card → loads event page → booking button works
   - NEEDS TESTING after fix deployment

### HIGH PRIORITY
4. **[ ] SEO verification**
   - Confirm client-side rendering is being indexed
   - Check if edge function SEO injection is working
   - Consider SSG approach if SEO is poor

5. **[ ] Event cards clickable on homepage**
   - Verify clicking cards navigates to event detail page

6. **[ ] Add to Calendar functionality**
   - Test Google Calendar integration
   - Verify date/time formatting

### MEDIUM PRIORITY
7. **[ ] Location pages filtering**
   - Verify case-insensitive matching works
   - Test each location page

8. **[ ] Past events page**
   - Verify API returns past events correctly

9. **[ ] Speakers page**
   - Extracts speakers from events - verify working

### LOW PRIORITY / FUTURE
10. **[ ] Community directory feature** (deferred)
11. **[ ] SSG implementation** (if SEO issues found)
12. **[ ] Performance optimization**

---

## File Structure

```
collective-events/
├── netlify.toml              # Netlify config, redirects
├── netlify/
│   └── edge-functions/
│       └── seo-inject.js     # SEO meta injection
├── public/
│   ├── index.html            # Homepage
│   ├── assets/
│   │   ├── css/
│   │   │   └── main.css      # Global styles
│   │   └── js/
│   │       └── api.js        # API utilities
│   └── pages/
│       ├── about.html        # About page (has video)
│       ├── event.html        # Event detail template
│       ├── location.html     # Location filter template
│       ├── notluck.html      # NotLuck partner page
│       ├── past.html         # Past events
│       ├── speaker.html      # Individual speaker (if needed)
│       └── speakers.html     # All speakers
└── DOCUMENTATION.md          # This file
```

---

## Key Code References

### API Utilities (`/public/assets/js/api.js`)
- `fetchEvents({ limit, upcoming, location })` - Get events list
- `fetchEvent(slug)` - Get single event
- `getEventImage(event)` - Get event image with fallback
- `formatDate(date)` - Format date for display
- `isUpcoming(date)` - Check if event is in future

### Event Page Booking Logic (`/public/pages/event.html:608-645`)
```javascript
const bookingUrl = event.bookingUrl || event.registrationUrl ||
                   event.ticketUrl || event.eventUrl ||
                   event.link || event.url;
// Console logs added for debugging
```

### CSS Class Convention
- Uses BEM-like with double dash: `btn--primary`, `btn--secondary`
- NOT single dash: `btn-primary` (this was causing issues)

---

## Testing Checklist

### Before Each Deploy
- [ ] Homepage loads events
- [ ] Event cards are clickable
- [ ] Event detail page loads
- [ ] Booking button appears and works
- [ ] Add to Calendar works
- [ ] Location pages filter correctly
- [ ] Speakers page loads
- [ ] Past events page loads
- [ ] Logo displays correctly (white version)
- [ ] Navigation links work
- [ ] Footer links work

### API Testing
```bash
# Test live events
curl https://api.notluck.co.uk/collective/events?status=live

# Test past events
curl https://api.notluck.co.uk/collective/events?status=past

# Test single event (replace with real slug)
curl https://api.notluck.co.uk/collective/events/YOUR-EVENT-SLUG
```

---

## Git Workflow

- **main branch** = Live/Production
- **staging branch** = Testing

### Deploy Process
1. Make changes on `staging`
2. Test on staging URL
3. Merge to `main` for live deployment
4. Netlify auto-deploys on push

---

## Contact / Resources

- **Main Website:** cdicollective.co.uk
- **Built by:** NotLuck
- **Tamily** - Key contact at NotLuck

---

## Session Notes

### 2026-01-16 (Session 2)
- **ROOT CAUSE FOUND:** `fetchEvent()` was broken - API doesn't support slug parameter
- Fixed `fetchEvent()` to fetch all events and filter client-side
- Verified API returns `bookingUrl` field correctly
- Created this DOCUMENTATION.md file for context persistence
- Updated documentation with verified API field names

### 2026-01-16 (Session 1)
- Updated logo to white version across all pages
- Moved hero video from homepage to About page with proper player controls
- Fixed button class consistency (btn--primary not btn-primary)
- Added console logging to debug booking URL issue
- Pushed to live (main branch)

---

*This document should be read at the start of each session to maintain context.*
