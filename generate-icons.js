const fs = require('fs');
const path = require('path');

// This script helps ensure proper icon generation
console.log('🎨 Icon Generation Helper');
console.log('');
console.log('To fix the white border issue:');
console.log('');
console.log('1. Make sure your icon.png has:');
console.log('   - Transparent background');
console.log('   - Proper padding (about 10% on all sides)');
console.log('   - High resolution (at least 1024x1024)');
console.log('');
console.log('2. Run these commands:');
console.log('   npm install -g @capacitor/assets');
console.log('   npx @capacitor/assets generate');
console.log('');
console.log('3. Or manually copy your icon to:');
console.log('   android/app/src/main/res/mipmap-*/ic_launcher_foreground.png');
console.log('');
console.log('4. Rebuild the app:');
console.log('   npx cap sync android');
console.log('   npx cap build android');
console.log('');

// Check if icon exists
const iconPath = path.join(__dirname, 'resources', 'icon.png');
if (fs.existsSync(iconPath)) {
  console.log('✅ Icon found at:', iconPath);
} else {
  console.log('❌ Icon not found at:', iconPath);
}
