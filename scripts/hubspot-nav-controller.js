/**
 * HubSpot Navigation Controller for ClubOS
 * 
 * Add this script to your HubSpot page where ClubOS is embedded.
 * It listens for messages from the ClubOS iframe to control navigation visibility on mobile.
 * 
 * Installation:
 * 1. Copy this script to your HubSpot Design Manager
 * 2. Add it to the page template where ClubOS is embedded
 * 3. Or add it as a Custom HTML module on the specific page
 */

(function() {
  'use strict';
  
  // Listen for messages from ClubOS iframe
  window.addEventListener('message', function(event) {
    // Verify the message is from ClubOS
    if (event.data && event.data.type === 'clubos-hide-nav') {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Common HubSpot navigation selectors
        const selectors = [
          '.header-container',
          '.header__container', 
          '.mobile-nav',
          '.navbar',
          '.navigation-primary',
          'header',
          '[role="navigation"]',
          '.hs-menu-wrapper',
          '.header'
        ];
        
        if (event.data.action === 'hide') {
          // Hide navigation elements
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              el.style.display = 'none';
              el.setAttribute('data-clubos-hidden', 'true');
            });
          });
          
          // Also hide any fixed/sticky headers
          const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"]');
          fixedElements.forEach(el => {
            if (el.offsetTop < 100) { // Likely a header
              el.style.display = 'none';
              el.setAttribute('data-clubos-hidden', 'true');
            }
          });
          
          console.log('HubSpot navigation hidden for ClubOS mobile view');
          
        } else if (event.data.action === 'show') {
          // Restore navigation elements
          const hiddenElements = document.querySelectorAll('[data-clubos-hidden="true"]');
          hiddenElements.forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-clubos-hidden');
          });
          
          console.log('HubSpot navigation restored');
        }
      }
    }
  });
  
  // Also check on resize
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      const isMobile = window.innerWidth <= 768;
      
      if (!isMobile) {
        // Restore navigation on desktop
        const hiddenElements = document.querySelectorAll('[data-clubos-hidden="true"]');
        hiddenElements.forEach(el => {
          el.style.display = '';
          el.removeAttribute('data-clubos-hidden');
        });
      }
    }, 250);
  });
})();