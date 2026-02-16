const GA_MEASUREMENT_ID = 'G-9T30TN8LPC';

// Initialize Google Analytics
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());

gtag('config', GA_MEASUREMENT_ID, {
    'send_page_view': false // We handle page views manually if needed, or just let default run if we want basic
});
// Default config usually sends page_view, but for SPA we might want more control. 
// For now, let's stick to default behavior + custom events.

// Load the script dynamically if not present (optional, but clean for keeping HTML tidy if we want)
// For now, we will add the script tag in HTML as per standard practice, this file just holds the logic.

function trackEvent(eventName, params = {}) {
    if (typeof gtag !== 'function') return;

    // Add common parameters if needed
    const finalParams = { ...params };

    // Always include app version if available globally
    if (typeof APP_VERSION !== 'undefined') {
        finalParams.app_version = APP_VERSION;
    }

    gtag('event', eventName, finalParams);
    console.log(`[GA] Tracked ${eventName}`, finalParams);
}

// Track page views for "virtual" pages (tabs)
function trackPageView(pageTitle, pageLocation) {
    if (typeof gtag !== 'function') return;
    gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: pageLocation || window.location.href
    });
}
