# Icon Preparation Guide - Non-Transparent Background

## **Recommended Approach**

Create an icon with a **solid background** instead of transparent background for better Android compatibility.

## **Icon Specifications**

### **Dimensions**
- **Size**: 1024x1024 pixels (minimum)
- **Format**: PNG
- **Background**: Solid color (no transparency)

### **Design Guidelines**

1. **Background Color**: Use your app's theme color `#120f29` (dark purple)
2. **Icon Elements**: 
   - White crescent moon
   - "Dozlo" text in lighter purple
   - Position elements with proper spacing
3. **Safe Zone**: Keep important elements within the center 80% of the square
4. **No Transparency**: Fill the entire square with your background color

## **Design Tools**

You can use any of these tools:
- **Figma** (free, web-based)
- **Adobe Photoshop**
- **GIMP** (free)
- **Canva** (free, web-based)
- **Sketch** (Mac only)

## **Step-by-Step Process**

1. **Create a new 1024x1024 canvas**
2. **Fill with background color** `#120f29`
3. **Add your icon elements** (moon + text)
4. **Export as PNG** with no transparency
5. **Save as** `resources/icon.png`

## **After Creating Your Icon**

Run these commands to regenerate the app icons:

```bash
# Generate new icons
npx @capacitor/assets generate

# Sync changes
npx cap sync android

# Build the app
npx cap build android
```

## **Expected Results**

- ✅ **Consistent sizing** with other app icons
- ✅ **No white borders** or padding issues
- ✅ **Professional appearance** matching your app design
- ✅ **Predictable results** across all Android devices

## **Benefits of This Approach**

1. **Full Control**: You control exactly how the icon looks
2. **Consistency**: Matches behavior of popular apps
3. **No Android Interference**: Android won't add unwanted padding
4. **Better Visual**: Clean, professional appearance
