// Netlify Edge Function for SEO meta tag injection
// This runs at the edge and injects proper meta tags before the page reaches the browser

const API_BASE = 'https://api.notluck.co.uk/collective';

// Default meta tags
const DEFAULT_META = {
  title: 'COLLECTIVE. Events | Creative Digital Innovation',
  description: 'Join the COLLECTIVE. community for inspiring events, workshops and networking across Nottingham, Mansfield and Chesterfield.',
  image: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/68efb0a2629b057f6907b407.png',
  url: 'https://collective-events.netlify.app'
};

// Location-specific meta
const LOCATION_META = {
  nottingham: {
    title: 'COLLECTIVE. Nottingham | Creative & Tech Events',
    description: 'Join COLLECTIVE. in Nottingham for inspiring events, workshops and networking in the heart of the creative quarter.',
    image: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69454390106fdc3abdfa3264.png'
  },
  mansfield: {
    title: 'COLLECTIVE. Mansfield | Creative & Tech Events',
    description: 'Join COLLECTIVE. in Mansfield for inspiring events connecting North Nottinghamshire\'s creative community.',
    image: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/69413d35ca7298e25b32203a.png'
  },
  chesterfield: {
    title: 'COLLECTIVE. Chesterfield | Creative & Tech Events',
    description: 'Join COLLECTIVE. in Chesterfield for inspiring events connecting Derbyshire\'s digital and creative professionals.',
    image: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/6967cbfe02f1be4a61702e71.png'
  }
};

// Page-specific meta
const PAGE_META = {
  past: {
    title: 'Past Events | COLLECTIVE.',
    description: 'A look back at the conversations, connections, and community moments that have shaped COLLECTIVE. across the East Midlands.'
  },
  about: {
    title: 'About COLLECTIVE. | Creative Digital Innovation',
    description: 'COLLECTIVE. builds connections across the East Midlands creative, digital and tech community. Real conversations, real connections.'
  },
  speakers: {
    title: 'Speakers | COLLECTIVE.',
    description: 'Meet the inspiring speakers who have shared their knowledge and experience at COLLECTIVE. events.'
  }
};

// Fetch event data from API
async function fetchEvent(slug) {
  try {
    const response = await fetch(`${API_BASE}/events?slug=${slug}&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.events?.[0] || null;
  } catch (e) {
    console.error('Error fetching event:', e);
    return null;
  }
}

// Fetch speaker data from API
async function fetchSpeaker(slug) {
  try {
    const response = await fetch(`${API_BASE}/speakers?slug=${slug}&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.speakers?.[0] || null;
  } catch (e) {
    console.error('Error fetching speaker:', e);
    return null;
  }
}

// Generate meta tags HTML
function generateMetaTags(meta, url) {
  return `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:image" content="${meta.image || DEFAULT_META.image}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${meta.title}">
    <meta name="twitter:description" content="${meta.description}">
    <meta name="twitter:image" content="${meta.image || DEFAULT_META.image}">

    <!-- Canonical -->
    <link rel="canonical" href="${url}">
  `;
}

// Format date for event title
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();

  // Get the response
  const response = await context.next();

  // Only process HTML responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('text/html')) {
    return response;
  }

  let meta = { ...DEFAULT_META };
  const fullUrl = url.toString();

  // Determine meta based on route
  if (path.startsWith('/event/')) {
    // Event detail page
    const slug = path.replace('/event/', '').replace(/\/$/, '');
    const event = await fetchEvent(slug);

    if (event) {
      const dateStr = formatEventDate(event.date);
      meta = {
        title: `${event.title} - COLLECTIVE. ${event.locationTag || ''} ${dateStr ? `| ${dateStr}` : ''}`.trim(),
        description: event.shortDescription || event.description || DEFAULT_META.description,
        image: event.featuredImage || LOCATION_META[event.locationTag?.toLowerCase()]?.image || DEFAULT_META.image
      };
    }
  } else if (path.startsWith('/speaker/')) {
    // Speaker page
    const slug = path.replace('/speaker/', '').replace(/\/$/, '');
    const speaker = await fetchSpeaker(slug);

    if (speaker) {
      meta = {
        title: `${speaker.name} | COLLECTIVE. Speaker`,
        description: speaker.bio || `${speaker.name} has spoken at COLLECTIVE. events across the East Midlands.`,
        image: speaker.image || DEFAULT_META.image
      };
    }
  } else if (path === '/nottingham' || path === '/nottingham/') {
    meta = LOCATION_META.nottingham;
  } else if (path === '/mansfield' || path === '/mansfield/') {
    meta = LOCATION_META.mansfield;
  } else if (path === '/chesterfield' || path === '/chesterfield/') {
    meta = LOCATION_META.chesterfield;
  } else if (path === '/past' || path === '/past/') {
    meta = PAGE_META.past;
  } else if (path === '/about' || path === '/about/') {
    meta = PAGE_META.about;
  } else if (path === '/speakers' || path === '/speakers/') {
    meta = PAGE_META.speakers;
  }

  // Get the HTML and inject meta tags
  const html = await response.text();

  // Replace placeholder meta tags or inject after <head>
  const metaTags = generateMetaTags(meta, fullUrl);

  // Remove existing title and meta description, then inject new ones
  let modifiedHtml = html
    .replace(/<title>.*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/i, '')
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');

  // Inject after <head>
  modifiedHtml = modifiedHtml.replace(/<head>/i, `<head>${metaTags}`);

  return new Response(modifiedHtml, {
    headers: response.headers
  });
};

export const config = {
  path: ['/', '/event/*', '/speaker/*', '/nottingham', '/mansfield', '/chesterfield', '/past', '/about', '/speakers']
};
