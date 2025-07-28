# HubSpot Mobile Navigation Hide Guide for ClubOS

## Problem
When ClubOS is embedded in HubSpot on mobile devices, two hamburger menu buttons appear stacked on top of each other - one from HubSpot and one from ClubOS. This creates a confusing user experience.

## Solution
We've implemented multiple approaches to hide the HubSpot navigation on mobile when ClubOS is embedded:

### Method 1: JavaScript PostMessage (Recommended)

**ClubOS Side (Already Implemented):**
- ClubOS automatically detects when it's embedded in an iframe
- On mobile devices (≤768px), it sends a postMessage to hide the parent navigation
- When ClubOS unmounts, it sends a message to restore the navigation

**HubSpot Side:**
1. Add the `hubspot-nav-controller.js` script to your HubSpot page:
   ```html
   <script>
   // Copy contents of scripts/hubspot-nav-controller.js
   </script>
   ```

### Method 2: CSS-Only Solution

1. Add the CSS from `hubspot-mobile-styles.css` to your HubSpot stylesheet
2. Add the detector script from `hubspot-clubos-detector.js` to your page

This method uses CSS to automatically hide navigation when a ClubOS iframe is detected.

### Method 3: Manual Implementation

If you prefer a simpler approach, add this to your HubSpot page template:

```html
<style>
@media (max-width: 768px) {
  /* Hide navigation when on ClubOS page */
  body.clubos-page .header-container,
  body.clubos-page header {
    display: none !important;
  }
}
</style>

<script>
// Add 'clubos-page' class to body on pages with ClubOS
if (window.location.pathname.includes('clubos')) {
  document.body.classList.add('clubos-page');
}
</script>
```

## Implementation Steps

### For HubSpot Administrators:

1. **Navigate to HubSpot Design Manager**
   - Go to Marketing > Files and Templates > Design Tools

2. **Choose Implementation Method:**
   
   **Option A - Page-Specific (Recommended):**
   - Find the page where ClubOS is embedded
   - Add a Custom HTML module
   - Paste the JavaScript from `hubspot-nav-controller.js`
   
   **Option B - Template-Wide:**
   - Edit the page template
   - Add the script before the closing `</body>` tag
   
   **Option C - CSS Method:**
   - Add CSS to your stylesheet
   - Include the detector script

3. **Test the Implementation:**
   - Open the page on a mobile device or using browser dev tools
   - Verify that only the ClubOS navigation appears
   - Check that navigation returns when navigating away

## Troubleshooting

### Navigation Not Hiding:

1. **Check Console for Errors:**
   ```javascript
   // Open browser console and look for:
   // "ClubOS: Using postMessage for nav control"
   // "HubSpot navigation hidden for ClubOS mobile view"
   ```

2. **Verify Selectors:**
   - HubSpot themes may use different CSS classes
   - Inspect your navigation element and add its class to the script

3. **Cross-Origin Issues:**
   - If ClubOS and HubSpot are on different domains, only postMessage will work
   - Ensure the script is added to the HubSpot page, not the iframe

### Navigation Not Restoring:

- The navigation should automatically restore when:
  - Navigating away from the ClubOS page
  - Resizing to desktop view
  - ClubOS component unmounts

## Custom Selectors

If your HubSpot theme uses custom navigation classes, update the selectors array:

```javascript
const selectors = [
  '.your-custom-nav-class',
  '.your-mobile-menu-class',
  // ... existing selectors
];
```

## Security Considerations

- The postMessage implementation accepts messages from any origin (`*`)
- For production, consider restricting to your ClubOS domain:
  ```javascript
  // In hubspot-nav-controller.js
  if (event.origin !== 'https://your-clubos-domain.com') return;
  ```

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify ClubOS is sending messages (check Network tab for frames)
3. Ensure scripts are loading in the correct order
4. Contact support with console logs and screenshots