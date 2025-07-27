# Embedding ClubOS on Your Website

## Simple iFrame Embed

Since ClubOS is already hosted on Railway, you can embed it directly into your HubSpot website page using an iFrame. Here's how:

### 1. Basic iFrame Embed Code

```html
<!-- ClubOS Embedded Interface -->
<iframe 
  src="https://clubosv1-production.up.railway.app"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
  title="ClubOS Management System">
</iframe>
```

### 2. Responsive Full-Height Version

```html
<style>
  .clubos-container {
    position: relative;
    width: 100%;
    height: calc(100vh - 100px); /* Adjust based on your header height */
    overflow: hidden;
  }
  
  .clubos-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
</style>

<div class="clubos-container">
  <iframe 
    src="https://clubosv1-production.up.railway.app"
    title="ClubOS Management System"
    allowfullscreen>
  </iframe>
</div>
```

### 3. With Loading State

```html
<style>
  .clubos-wrapper {
    position: relative;
    width: 100%;
    min-height: 800px;
    background: #f5f5f5;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .clubos-loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  
  .clubos-wrapper iframe {
    width: 100%;
    height: 800px;
    border: none;
  }
</style>

<div class="clubos-wrapper">
  <div class="clubos-loader" id="clubos-loader">
    <div style="margin-bottom: 10px;">
      <!-- Simple CSS spinner -->
      <div style="border: 3px solid #f3f3f3; border-top: 3px solid #0066cc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
    </div>
    <p>Loading ClubOS...</p>
  </div>
  
  <iframe 
    src="https://clubosv1-production.up.railway.app"
    title="ClubOS Management System"
    onload="document.getElementById('clubos-loader').style.display='none';"
    style="display: block;">
  </iframe>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
```

## Direct Links for Different Access Points

Instead of embedding, you might want to provide direct links:

### For Facility Admins/Operators:
```html
<a href="https://clubosv1-production.up.railway.app" target="_blank" class="clubos-login-button">
  Access ClubOS Dashboard
</a>
```

### For Kiosk Mode:
```html
<a href="https://clubosv1-production.up.railway.app/kiosk" target="_blank" class="clubos-kiosk-button">
  Launch Kiosk Mode
</a>
```

## HubSpot Page Setup

### In HubSpot:

1. **Create a new page** or edit existing one
2. **Add a Custom HTML module**
3. **Paste one of the embed codes above**
4. **Adjust the styling** to match your site

### Recommended Page Settings:

- **Page Title**: "ClubOS Management System"
- **URL**: `/clubos` or `/app`
- **Template**: Full-width or minimal header/footer
- **Access**: Password protected or behind login if needed

## Security Considerations

### Option 1: Public Access
- Anyone can access the login page
- Users still need credentials to log in
- Good for facilities to bookmark

### Option 2: Password Protected Page
- Use HubSpot's page password feature
- Share password with facilities
- Adds extra security layer

### Option 3: Behind HubSpot Membership
- Require HubSpot portal login first
- Create accounts for each facility
- Most secure option

## Custom Domain Option

If you want it on your own domain like `app.yourcompany.com`:

1. Add a CNAME record pointing to Railway
2. Configure custom domain in Railway settings
3. Update the iframe src to your custom domain

## Tracking Usage

Add this to track when facilities access ClubOS:

```javascript
<script>
// Track page views
if (window._hsq) {
  window._hsq.push(['trackPageView']);
  window._hsq.push(['trackEvent', {
    id: 'ClubOS-Access',
    value: 1
  }]);
}

// Track time spent
let startTime = Date.now();
window.addEventListener('beforeunload', function() {
  let timeSpent = Math.round((Date.now() - startTime) / 1000);
  if (window._hsq) {
    window._hsq.push(['trackEvent', {
      id: 'ClubOS-Time-Spent',
      value: timeSpent
    }]);
  }
});
</script>
```

## Mobile Considerations

For mobile access, consider redirecting to the direct URL instead of embedding:

```javascript
<script>
if (window.innerWidth < 768) {
  // Redirect mobile users to full ClubOS site
  window.location.href = 'https://clubosv1-production.up.railway.app';
}
</script>
```

Or show a message:

```html
<div class="mobile-message" style="display: none;">
  <p>For the best experience, access ClubOS on a tablet or desktop.</p>
  <a href="https://clubosv1-production.up.railway.app" class="button">
    Open ClubOS in New Tab
  </a>
</div>

<script>
if (window.innerWidth < 768) {
  document.querySelector('.mobile-message').style.display = 'block';
  document.querySelector('.clubos-container').style.display = 'none';
}
</script>
```