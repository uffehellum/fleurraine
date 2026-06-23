# PWA Setup Guide

Fleurraine is configured as a Progressive Web App (PWA), allowing users to install it on their iPhone/iPad home screen for a native app-like experience.

## What's Configured

### 1. App Icons
Located in `web/public/icons/`:
- `favicon-16.png` & `favicon-32.png` - Browser favicons
- `apple-touch-icon.png` (180x180) - iPhone/iPad home screen icon
- `icon-192.png` & `icon-512.png` - Android home screen and splash screen

All icons are generated from the transparent Fleurraine logo (`fleurraine-logo-transparent.png`).

### 2. Web App Manifest
`web/public/manifest.json` defines the PWA configuration:
- App name: "Fleurraine"
- Display mode: standalone (full-screen, no browser UI)
- Theme color: `#2d5016` (forest green)
- Orientation: portrait
- Icons for various platforms

### 3. HTML Meta Tags
`web/index.html` includes:
- PWA manifest link
- Apple-specific meta tags for iOS
- Theme color for mobile browsers
- App title and description

### 4. Install Prompt Component
`web/src/components/InstallPrompt.tsx` provides:
- Automatic detection of iOS devices
- Detection of standalone mode (already installed)
- Step-by-step installation instructions
- Dismissible banner (shown once per session)
- Only appears on iOS devices that haven't installed the app

## How Users Install the App

### On iPhone/iPad (Safari)

1. Visit https://fleurraine.fly.dev in Safari
2. A banner will appear with installation instructions
3. Follow the steps:
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add" in the top right corner
4. The Fleurraine icon will appear on the home screen
5. Tap the icon to launch the app in full-screen mode

### On Android (Chrome)

1. Visit https://fleurraine.fly.dev in Chrome
2. Chrome will show an "Add to Home Screen" prompt
3. Tap "Add" or "Install"
4. The app icon will appear on the home screen

## Features When Installed

- **Full-screen experience** - No browser UI, feels like a native app
- **Home screen icon** - Quick access with the Fleurraine logo
- **Offline capability** - (Can be enhanced with service workers)
- **Faster loading** - App resources are cached
- **Native feel** - Smooth transitions and mobile-optimized UI

## Testing Locally

To test the PWA installation locally:

1. Make sure the frontend is running: `cd web && npm run dev`
2. Access the app on your iPhone via your computer's local IP:
   - Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Visit `http://YOUR_IP:5173` on your iPhone
3. The install prompt should appear after 2 seconds
4. Follow the installation steps

**Note:** PWA features work best over HTTPS. Local testing over HTTP has limitations.

## Production Deployment

The PWA is fully configured for production at https://fleurraine.fly.dev:

1. All icons are included in the build
2. Manifest is served with correct MIME type
3. HTTPS is enabled (required for PWA)
4. Theme colors match the app design

## Customization

### Changing the App Icon

1. Replace `fleurraine-logo-transparent.png` with your new logo
2. Run the icon generation script:
   ```bash
   source .venv/bin/activate
   python3 create_pwa_icons.py
   ```
3. Icons will be regenerated in `web/public/icons/`

### Changing Theme Color

Update the theme color in:
- `web/public/manifest.json` - `theme_color` field
- `web/index.html` - `<meta name="theme-color">` tag

### Customizing Install Prompt

Edit `web/src/components/InstallPrompt.tsx`:
- Change the delay before showing (currently 2 seconds)
- Modify the instruction text
- Adjust styling and positioning
- Add/remove steps

## Browser Support

- ✅ **iOS Safari** - Full support (primary target)
- ✅ **Android Chrome** - Full support
- ⚠️ **Desktop browsers** - Limited PWA features
- ❌ **Privacy browsers** (DuckDuckGo, Brave) - May block some features

## Future Enhancements

Consider adding:
- **Service Worker** - For offline functionality and caching
- **Push Notifications** - For order updates and new flower alerts
- **Background Sync** - For offline order submission
- **App Shortcuts** - Quick actions from home screen icon

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
