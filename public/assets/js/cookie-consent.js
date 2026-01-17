/**
 * Cookie Consent Banner
 * GDPR/PECR compliant - only loads tracking scripts after consent
 */
(function() {
  const CONSENT_KEY = 'collective_cookie_consent';

  // Check if consent already given
  const consent = localStorage.getItem(CONSENT_KEY);

  if (consent === 'accepted') {
    loadTrackingScripts();
    return;
  }

  if (consent === 'rejected') {
    return; // Don't show banner, don't load scripts
  }

  // Show banner
  showConsentBanner();

  function showConsentBanner() {
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
      <div class="cookie-banner-content">
        <p>We use cookies to analyse site traffic and improve your experience. By clicking "Accept", you consent to our use of cookies.</p>
        <div class="cookie-banner-actions">
          <a href="/privacy" class="cookie-link">Privacy Policy</a>
          <button id="cookie-reject" class="cookie-btn cookie-btn-secondary">Reject</button>
          <button id="cookie-accept" class="cookie-btn cookie-btn-primary">Accept</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #cookie-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #1a1a1a;
        border-top: 1px solid #333;
        padding: 1rem;
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
      }
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .cookie-banner-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .cookie-banner-content p {
        margin: 0;
        color: #a0a0a0;
        font-size: 0.9rem;
        flex: 1;
        min-width: 280px;
      }
      .cookie-banner-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
      }
      .cookie-link {
        color: #a0a0a0;
        font-size: 0.85rem;
        text-decoration: underline;
        margin-right: 0.5rem;
      }
      .cookie-link:hover {
        color: #e1ff00;
      }
      .cookie-btn {
        padding: 0.5rem 1.25rem;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }
      .cookie-btn-secondary {
        background: transparent;
        border: 1px solid #444;
        color: #fff;
      }
      .cookie-btn-secondary:hover {
        border-color: #666;
        background: rgba(255,255,255,0.05);
      }
      .cookie-btn-primary {
        background: #e1ff00;
        color: #000;
      }
      .cookie-btn-primary:hover {
        background: #c8e600;
      }
      @media (max-width: 600px) {
        .cookie-banner-content {
          flex-direction: column;
          text-align: center;
        }
        .cookie-banner-actions {
          width: 100%;
          justify-content: center;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('cookie-accept').addEventListener('click', function() {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      banner.remove();
      loadTrackingScripts();
    });

    document.getElementById('cookie-reject').addEventListener('click', function() {
      localStorage.setItem(CONSENT_KEY, 'rejected');
      banner.remove();
    });
  }

  function loadTrackingScripts() {
    // Google Analytics 4
    // Replace GA_MEASUREMENT_ID with your actual GA4 ID (e.g., G-XXXXXXXXXX)
    if (window.GA_MEASUREMENT_ID) {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${window.GA_MEASUREMENT_ID}`;
      document.head.appendChild(gaScript);

      gaScript.onload = function() {
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', window.GA_MEASUREMENT_ID);
      };
    }

    // Hotjar
    // Replace HOTJAR_ID with your actual Hotjar Site ID
    if (window.HOTJAR_ID) {
      (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:window.HOTJAR_ID,hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
    }
  }
})();
