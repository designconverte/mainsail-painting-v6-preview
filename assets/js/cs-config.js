/* Public module configuration (no secrets). The lead goes to /api/lead.php on the same origin; the server keeps
   the CRM webhook. Tracking: GTM mode (dataLayer only); the container ID is set once the tracking team confirms it. */
window.CS_CONFIG = {
  siteId: 'mainsail-painting',
  lead: {
    endpoint: '/api/lead.php',
    redirect: '/thank-you/',
    smsConsentVersion: 'sms-request-en-v1-2026-11-19'
  },
  serviceArea: { zips: [], outOfArea: 'accept-with-message' },
  tracking: {
    mode: 'gtm',
    ga4: null,
    metaPixel: null,
    googleAds: null,
    gtm: null,
    consentDefault: 'granted',
    leadValue: null,
    debugParam: 'cs_debug'
  }
};

// preview copy: the form is simulated and nothing is tracked
window.CS_CONFIG = Object.assign({}, window.CS_CONFIG, { preview: true });
window.CS_CONFIG.lead = Object.assign({}, window.CS_CONFIG.lead, { endpoint: '/mainsail-painting-v6-preview/api/lead.php', redirect: null });
window.CS_CONFIG.tracking = Object.assign({}, window.CS_CONFIG.tracking, { mode: 'off', ga4: null, metaPixel: null, googleAds: null, gtm: null });
