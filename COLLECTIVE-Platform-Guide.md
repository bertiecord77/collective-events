# COLLECTIVE. Platform Guide for Tamily

## How to Manage Events, Speakers & Content in GoHighLevel

---

## Quick Reference

| Task | Where in GHL |
|------|-------------|
| Add/Edit Events | Settings → Custom Objects → `collective_event` |
| Add/Edit Venues | Settings → Custom Objects → `collective_venue` |
| Add/Edit Speakers | Contacts (with tag "Speaker") |
| Upload Images | Media Library or directly in record |
| View Bookings | Contacts (tagged with event name) |

---

## 1. Adding a New Event

### Step 1: Navigate to Events
1. Go to **Settings** (gear icon, bottom left)
2. Click **Custom Objects**
3. Find **`collective_event`** and click on it
4. Click **+ Add Record** (top right)

### Step 2: Fill in Event Details

| Field | What to Enter | Example |
|-------|--------------|---------|
| **Event Title** | Full event name | "Your First AI Employee: Building a Team Member That Never Sleeps" |
| **Event Date** | Date of the event | 2026-02-20 |
| **Start Time** | 24hr format | 17:00 |
| **End Time** | 24hr format | 19:30 |
| **Location Tag** | Choose from dropdown | Nottingham / Mansfield / Chesterfield / Derby |
| **Status** | Set visibility | `draft` (hidden) or `live` (visible on website) |
| **Featured** | Highlight on homepage? | 1 = yes, 0 = no |

### Step 3: Add Event Content

| Field | What to Enter | Tips |
|-------|--------------|------|
| **Short Description** | 1-2 sentence teaser | Shows on event cards. Keep under 150 characters. |
| **Full Description** | Complete event details | Use line breaks for paragraphs. Describe what attendees will learn. |
| **Featured Image** | Upload event artwork | See image guidelines below |
| **Price** | Ticket cost | "Free" or "£10" |

### Step 4: Set Capacity (Optional)

| Field | What to Enter |
|-------|--------------|
| **Max Attendees** | Maximum capacity (e.g., 50) |
| **Current Attendees** | Leave at 0 (auto-updates with bookings) |
| **Waitlist Enabled** | Check to allow waitlist when full |

### Step 5: Save
Click **Save** at the bottom. The event will appear on the website within 5 minutes if status is `live`.

---

## 2. Linking a Speaker to an Event

Speakers are stored as **Contacts** in GHL, not in the Events custom object. This lets us reuse speaker profiles across multiple events.

### Option A: Link an Existing Speaker

1. Open the event record in Custom Objects
2. Scroll to the **Relations** section (usually at bottom)
3. Click **+ Add Relation**
4. Select **Contact**
5. Search for the speaker's name
6. Click to link them

The website will automatically pull their photo, bio, tagline, and social links from their Contact profile.

### Option B: Create a New Speaker

1. Go to **Contacts** → **+ Add Contact**
2. Fill in basic info:
   - First Name
   - Last Name
   - Email
3. Add the tag: **Speaker**
4. Upload their **Profile Photo** (click the avatar)
5. Fill in **Custom Fields** (scroll down in contact record):

| Custom Field | What to Enter |
|-------------|--------------|
| **Speaker Tagline** | Short title (e.g., "AI Automation Expert & Founder of TechCo") |
| **Speaker Bio** | 2-3 paragraphs about them. Use line breaks. |
| **LinkedIn (Personal)** | Full URL: https://linkedin.com/in/username |
| **Instagram** | Full URL: https://instagram.com/username |
| **Website** | Full URL: https://theirwebsite.com |

6. Save the contact
7. Go back to the Event and link them (Option A above)

---

## 3. Image Upload Guidelines

### Recommended Dimensions

| Image Type | Dimensions | Aspect Ratio | Notes |
|-----------|-----------|--------------|-------|
| **Event Featured Image** | **1200 × 675px** | 16:9 | Best all-round size |
| Speaker Profile Photo | 400 × 400px | 1:1 (square) | Will be cropped to circle |
| Venue Image | 1200 × 675px | 16:9 | Same as events |

### File Requirements
- **Format**: JPG or PNG (JPG preferred for photos)
- **File size**: Under 2MB (ideally under 500KB)
- **Quality**: High resolution, no pixelation

### How to Upload Event Images

1. In the event record, find **Featured Image**
2. Click **Upload** or drag and drop
3. Wait for upload to complete
4. Save the record

### Tips for Great Event Images
- Use bold, readable text if adding titles
- High contrast works well (dark backgrounds, bright text)
- Include speaker's face if possible
- Avoid tiny text that won't be readable on mobile
- Leave space at top/bottom for cropping in different contexts

---

## 4. Managing Venues

Venues are stored in a separate Custom Object so they can be reused across events.

### Add a New Venue

1. Go to **Settings** → **Custom Objects** → **`collective_venue`**
2. Click **+ Add Record**
3. Fill in:

| Field | What to Enter |
|-------|--------------|
| **Venue Name** | e.g., "Nottingham Trent University" |
| **Address Line 1** | Street address |
| **City** | City name |
| **Postcode** | Full postcode |
| **Google Maps URL** | Link from Google Maps share button |
| **what3words** | Optional: ///word.word.word format |
| **Parking Info** | Parking instructions |
| **Public Transport** | Bus/tram/train info |
| **Accessibility** | Wheelchair access, hearing loops, etc. |
| **Location Tag** | Match to event locations (Nottingham/Mansfield/etc.) |

### Link a Venue to an Event

1. Open the event record
2. Find the **Venue** dropdown field
3. Select the venue from the list
4. Save

---

## 5. Event Status Workflow

| Status | What It Means | Visible on Website? |
|--------|--------------|---------------------|
| `draft` | Work in progress | ❌ No |
| `live` | Published and active | ✅ Yes |
| `cancelled` | Event cancelled | ❌ No |

### Publishing Checklist

Before setting status to `live`, confirm:

- [ ] Event title is correct
- [ ] Date and times are accurate
- [ ] Location tag is set
- [ ] Short description is filled in
- [ ] Full description is complete
- [ ] Featured image is uploaded
- [ ] Speaker is linked (if applicable)
- [ ] Venue is linked or location fallback is correct

---

## 6. Viewing Bookings

When someone books through the website:

1. A **Contact** is created/updated in GHL
2. They're tagged with: `Booked: [Event Title]`
3. A calendar appointment is created
4. They receive a confirmation email

### To see who's booked:
1. Go to **Contacts**
2. Use the search/filter to find tag: `Booked: [Event Name]`
3. Or check the **Calendar** for the event date

---

## 7. Speaker Applications

When someone applies to speak through the website:

1. A Contact is created with tags:
   - `Speaker Application`
   - `In Review`
2. Their info is stored in custom fields (bio, socials, etc.)
3. A note is added with their talk proposal

### To review applications:
1. Go to **Contacts**
2. Filter by tag: `Speaker Application` + `In Review`
3. Review their profile
4. If approved:
   - Add tag: `Speaker`
   - Remove tag: `In Review`
   - They'll now appear on the Speakers page

---

## 8. Common Tasks Quick Reference

| Task | How to Do It |
|------|-------------|
| **Make an event live** | Open event → Change **Status** to `live` → Save |
| **Feature an event on homepage** | Open event → Set **Featured** to `1` → Save |
| **Change event speaker** | Open event → Go to Relations → Remove old link → Add new speaker |
| **Update speaker bio/photo** | Go to Contacts → Find speaker → Edit their profile → Save (changes reflect on website automatically) |
| **Cancel an event** | Open event → Change **Status** to `cancelled` → Save, then consider emailing attendees via Contacts |

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Event not showing on website | Check status is `live`, not `draft` |
| Speaker not showing | Ensure they're linked via Relations, not just typed in |
| Image not displaying | Check file uploaded successfully, try re-uploading |
| Wrong venue info | Check venue is linked, or location tag matches fallback |
| Changes not appearing | Wait 5 mins (caching), or hard refresh browser |

---

## Need Help?

- **Technical issues**: Contact NotLuck
- **GHL questions**: Check GHL Knowledge Base or Support Chat

---

*Last updated: January 2026*
