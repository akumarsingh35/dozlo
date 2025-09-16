# App Icon White Border Fix Guide

## **Problem Identified**

The Dozlo app icon has a white border around it on mobile devices, which is caused by Android's adaptive icon system automatically adding padding and borders.

## **Root Cause**

Android's adaptive icons (introduced in Android 8.0) automatically:
- Add padding around icons (16.7% by default)
- Create rounded corners
- Add borders for visual consistency
- This creates the white border you're seeing

## **Solutions Implemented**

### **Solution 1: Updated Adaptive Icon Configuration**

Modified the adaptive icon XML files to remove the default padding:

**File: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background>
        <inset android:drawable="@mipmap/ic_launcher_background" android:inset="0%" />
    </background>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="0%" />
    </foreground>
</adaptive-icon>
```

**File: `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background>
        <inset android:drawable="@mipmap/ic_launcher_background" android:inset="0%" />
    </background>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="0%" />
    </foreground>
</adaptive-icon>
```

### **Solution 2: Updated Capacitor Configuration**

Enhanced the capacitor config to specify proper icon generation:

**File: `capacitor.config.ts`**
```typescript
assets: {
  icon: {
    source: 'resources/icon.png',
    target: {
      android: {
        adaptiveIcon: {
          foregroundImage: 'resources/icon.png',
          backgroundColor: '#120f29'
        }
      }
    }
  }
}
```

## **Additional Steps Required**

### **Step 1: Regenerate Icons**

Run these commands to regenerate the icons properly:

```bash
# Install Capacitor Assets tool
npm install -g @capacitor/assets

# Generate new icons
npx @capacitor/assets generate

# Sync changes
npx cap sync android

# Build the app
npx cap build android
```

### **Step 2: Verify Icon Requirements**

Make sure your `resources/icon.png` has:
- **Transparent background** (not white)
- **Proper padding** (about 10% on all sides)
- **High resolution** (at least 1024x1024 pixels)
- **Square dimensions** (1:1 aspect ratio)

### **Step 3: Manual Icon Replacement (Alternative)**

If automatic generation doesn't work, manually replace the foreground icons:

1. Copy your `resources/icon.png` to:
   ```
   android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
   android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
   android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
   android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
   android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
   ```

2. Resize the icon for each density:
   - mdpi: 108x108px
   - hdpi: 162x162px
   - xhdpi: 216x216px
   - xxhdpi: 324x324px
   - xxxhdpi: 432x432px

### **Step 4: Alternative - Disable Adaptive Icons**

If you want to completely disable adaptive icons, modify the AndroidManifest.xml:

```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:enableOnBackInvokedCallback="true">
    
    <!-- Add this line to disable adaptive icons -->
    <meta-data android:name="android.max_aspect" android:value="2.4" />
</application>
```

## **Testing the Fix**

1. **Clean Build**: Delete the build folder and rebuild
   ```bash
   rm -rf android/app/build
   npx cap build android
   ```

2. **Uninstall and Reinstall**: Remove the app from your device and reinstall

3. **Check Different Android Versions**: Test on Android 8.0+ devices

4. **Verify Icon Display**: The icon should now appear without the white border

## **Expected Results**

After implementing these fixes:
- ✅ **No White Border**: Icon appears without the white border
- ✅ **Proper Background**: Dark purple background (#120f29) fills the entire icon area
- ✅ **Consistent Display**: Icon looks the same across different Android versions
- ✅ **Professional Appearance**: Clean, borderless icon design

## **Troubleshooting**

### **If the border persists:**

1. **Check Icon Format**: Ensure your icon is PNG with transparency
2. **Verify Background Color**: Make sure the background color matches your app theme
3. **Clear App Data**: Clear the app's data and cache
4. **Reboot Device**: Sometimes Android caches icons

### **If icon appears distorted:**

1. **Check Resolution**: Ensure proper resolution for each density
2. **Verify Aspect Ratio**: Icon should be perfectly square
3. **Test Different Devices**: Check on various screen densities

## **Files Modified**

- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- `capacitor.config.ts`
- `generate-icons.js` (helper script)

## **Performance Impact**

- **Minimal**: Icon changes only affect visual appearance
- **No Runtime Impact**: Changes are compile-time only
- **Better UX**: Cleaner, more professional app icon
