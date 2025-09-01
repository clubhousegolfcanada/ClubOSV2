/**
 * ClubOS Detector for HubSpot
 * 
 * This script adds a class to the body element when a ClubOS iframe is detected.
 * Use with hubspot-mobile-styles.css for CSS-based navigation hiding.
 * 
 * Installation:
 * 1. Add this script before the closing </body> tag in your HubSpot template
 * 2. Make sure it runs after the iframe is loaded
 */

(function() {
  'use strict';
  
  function checkForClubOS() {
    // Look for ClubOS iframe
    const clubosIframe = document.querySelector('iframe[src*="clubos"], iframe[src*="localhost:3000"]');
    
    if (clubosIframe) {
      // Add class to body for CSS targeting
      document.body.classList.add('clubos-embedded');
      
      // Also add a data attribute
      document.body.setAttribute('data-clubos', 'true');
      
      console.log('ClubOS iframe detected - mobile navigation will be hidden');
    }
  }
  
  // Check on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForClubOS);
  } else {
    checkForClubOS();
  }
  
  // Also check after a delay in case iframe loads dynamically
  setTimeout(checkForClubOS, 1000);
  setTimeout(checkForClubOS, 3000);
  
  // Watch for dynamic iframe additions
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        checkForClubOS();
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();