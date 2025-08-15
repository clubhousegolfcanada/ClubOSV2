# How to Get UniFi Session Cookie

Since automated login is blocked by CloudFlare, the easiest way to get door control working is to use your browser session.

## Steps to Get Your Session Cookie

1. **Open Chrome/Safari/Firefox**

2. **Log into UniFi**
   - Go to https://unifi.ui.com
   - Sign in with your UniFi account
   - Make sure you can see your consoles/devices

3. **Open Developer Tools**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Go to the **Network** tab

4. **Make a Test Request**
   - While logged in, navigate to any UniFi page
   - Or refresh the current page

5. **Find the Cookie**
   - Look for any request to `unifi.ui.com`
   - Click on the request
   - Go to **Headers** tab
   - Find **Request Headers** section
   - Look for `Cookie:` header
   - Copy the ENTIRE cookie string (it will be long!)

6. **Add to Your .env File**
   ```bash
   # Add this to your .env file
   UNIFI_SESSION_COOKIE="paste-your-entire-cookie-string-here"
   ```

## Example Cookie Format
Your cookie will look something like this (but much longer):
```
TOKEN=eyJhbGciOiJIUzI1NiIs...; csrf_token=abc123...; unifises=def456...
```

## Test Your Cookie

After adding the cookie to .env, run:
```bash
npm run test:session
```

## Cookie Lifetime
- Session cookies typically last 24-48 hours
- You'll need to refresh it periodically
- Consider automating this with a browser automation tool later

## Security Notes
- Keep your session cookie SECRET
- Never commit it to git
- Treat it like a password
- Regenerate if compromised