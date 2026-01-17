/**
 * COLLECTIVE. Shared Components
 * Reusable header, footer, and UI components loaded dynamically
 */

const CollectiveComponents = {
  // New logo URL
  logoUrl: 'https://storage.googleapis.com/msgsndr/JcB0t2fZpGS0lMrqKDWQ/media/68a869c41614bd2d4f9e6688.png',

  /**
   * Generate the navigation HTML
   * @param {string} activePage - Current page identifier (events, speakers, about, past)
   */
  getNavigation(activePage = '') {
    return `
      <nav class="nav">
        <div class="nav-container">
          <a href="/" class="nav-logo">
            <img src="${this.logoUrl}" alt="COLLECTIVE." height="40">
          </a>
          <div class="nav-links">
            <a href="/" class="nav-link ${activePage === 'events' ? 'active' : ''}">Events</a>
            <a href="/speakers" class="nav-link ${activePage === 'speakers' ? 'active' : ''}">Speakers</a>
            <a href="/about" class="nav-link ${activePage === 'about' ? 'active' : ''}">About</a>
          </div>
        </div>
      </nav>
    `;
  },

  /**
   * Generate the footer HTML
   */
  getFooter() {
    return `
      <footer class="footer">
        <div class="footer-content">
          <div class="footer-brand">
            <img src="${this.logoUrl}" alt="COLLECTIVE." height="32">
            <p>Building connections across the East Midlands creative, digital and tech community.</p>
          </div>
          <div class="footer-links">
            <div class="footer-column">
              <h4>Locations</h4>
              <a href="/nottingham">Nottingham</a>
              <a href="/mansfield">Mansfield</a>
              <a href="/chesterfield">Chesterfield</a>
              <a href="/derby">Derby</a>
            </div>
            <div class="footer-column">
              <h4>Explore</h4>
              <a href="/">Events</a>
              <a href="/speakers">Speakers</a>
              <a href="/past">Past Events</a>
            </div>
            <div class="footer-column">
              <h4>About</h4>
              <a href="/about">About Us</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <div class="built-by">
            Proudly built in Notts by <a href="https://notluck.co.uk" target="_blank">NotLuck</a>
          </div>
          <p>&copy; ${new Date().getFullYear()} COLLECTIVE. All rights reserved.</p>
        </div>
      </footer>
    `;
  },

  /**
   * Inject navigation into a placeholder element
   * @param {string} selector - CSS selector for the placeholder
   * @param {string} activePage - Current page identifier
   */
  injectNavigation(selector = '#nav-placeholder', activePage = '') {
    const placeholder = document.querySelector(selector);
    if (placeholder) {
      placeholder.innerHTML = this.getNavigation(activePage);
    }
  },

  /**
   * Inject footer into a placeholder element
   * @param {string} selector - CSS selector for the placeholder
   */
  injectFooter(selector = '#footer-placeholder') {
    const placeholder = document.querySelector(selector);
    if (placeholder) {
      placeholder.innerHTML = this.getFooter();
    }
  },

  /**
   * Initialize components on page load
   * Looks for data-active-page attribute on body to set active nav item
   */
  init() {
    const activePage = document.body.dataset.activePage || '';
    this.injectNavigation('#nav-placeholder', activePage);
    this.injectFooter('#footer-placeholder');
  }
};

// Export for use
if (typeof window !== 'undefined') {
  window.CollectiveComponents = CollectiveComponents;
}
