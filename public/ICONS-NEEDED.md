# Required Icon Files for Push Notifications

## ⚠️ ACTION REQUIRED: Create These Icon Files

For push notifications to work properly on Android and Chrome, you need to create two PNG icon files:

### 1. Main Notification Icon
**File**: `public/orb-icon-192.png`
- **Size**: 192x192 pixels
- **Format**: PNG
- **Content**: Your ORB logo or app icon
- **Background**: Can be colored or transparent
- **Purpose**: Displays as the main icon in notifications

### 2. Badge Icon
**File**: `public/orb-badge-96.png`
- **Size**: 96x96 pixels
- **Format**: PNG
- **Content**: Small monochrome badge (e.g., just "O" symbol or brain icon)
- **Background**: Usually transparent with white icon
- **Purpose**: Shows in the notification tray/status bar

## How to Create These Icons

### Option A: Use Online Tools
1. Go to https://www.favicon-generator.org/ or similar
2. Upload your logo
3. Generate icons in 192x192 and 96x96 sizes
4. Download and rename to match the required names

### Option B: Use Design Software
1. Open your logo in Photoshop/GIMP/Figma
2. Resize to 192x192 px (save as `orb-icon-192.png`)
3. Create a simplified version at 96x96 px (save as `orb-badge-96.png`)
4. Export as PNG with transparency if desired

### Option C: Use the Brain Logo Provided
If you have the brain logo images (as shown in the screenshots), you can:
1. Resize the larger brain logo to 192x192 px → `orb-icon-192.png`
2. Resize the smaller brain logo to 96x96 px → `orb-badge-96.png`
3. Place both files in the `public/` folder

## Verification

After creating the icons, verify they exist:
```bash
ls -la public/orb-icon-192.png
ls -la public/orb-badge-96.png
```

Both files should be present in the `public/` directory for notifications to work properly.

## What Happens Without Icons?

Without these icons:
- ✅ Notifications will still work in the foreground
- ❌ Background notifications on Android/Chrome may not display properly
- ❌ Notifications may show as blank or use browser default icons
- ❌ User experience will be degraded on mobile devices

## Status

- [ ] `orb-icon-192.png` created
- [ ] `orb-badge-96.png` created
- [ ] Icons tested with push notifications
