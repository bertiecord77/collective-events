/**
 * Dynamic Sitemap Generator
 * Generates XML sitemap including all static pages and dynamic event/speaker pages
 */

const API_BASE = 'https://notluck-api.netlify.app';
const SITE_URL = 'https://collective-events.netlify.app';

// Static pages with their priorities and change frequencies
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/speakers', priority: '0.8', changefreq: 'weekly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/past', priority: '0.6', changefreq: 'weekly' },
  { path: '/nottingham', priority: '0.7', changefreq: 'weekly' },
  { path: '/mansfield', priority: '0.7', changefreq: 'weekly' },
  { path: '/chesterfield', priority: '0.7', changefreq: 'weekly' },
  { path: '/derby', priority: '0.7', changefreq: 'weekly' },
];

/**
 * Fetch events from API
 */
async function fetchEvents() {
  try {
    const response = await fetch(`${API_BASE}/collective/events?status=all&limit=100`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Failed to fetch events for sitemap:', error);
    return [];
  }
}

/**
 * Generate URL-safe slug from text
 */
function generateSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build XML sitemap
 */
function buildSitemap(staticPages, events) {
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Add event pages
  const speakerSlugs = new Set();

  for (const event of events) {
    const eventSlug = event.slug || generateSlug(event.title);
    if (eventSlug) {
      const isUpcoming = new Date(event.date) > new Date();
      xml += `  <url>
    <loc>${SITE_URL}/event/${eventSlug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${isUpcoming ? 'weekly' : 'monthly'}</changefreq>
    <priority>${isUpcoming ? '0.9' : '0.5'}</priority>
  </url>
`;
    }

    // Collect unique speaker slugs
    if (event.speaker?.name) {
      const speakerSlug = generateSlug(event.speaker.name);
      if (speakerSlug && event.speaker.contactId) {
        speakerSlugs.add(speakerSlug);
      }
    }
  }

  // Add speaker pages
  for (const slug of speakerSlugs) {
    xml += `  <url>
    <loc>${SITE_URL}/speaker/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

export const handler = async (event, context) => {
  try {
    // Fetch events from API
    const events = await fetchEvents();

    // Build sitemap XML
    const sitemap = buildSitemap(STATIC_PAGES, events);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: sitemap
    };
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return {
      statusCode: 500,
      body: 'Error generating sitemap'
    };
  }
};
