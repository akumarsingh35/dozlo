# Back Button Testing Setup

## Quick Test Instructions

1. **Build and Run the App**
   ```bash
   npm run build
   npx cap sync android
   npx cap run android
   ```

2. **Test the Back Button Functionality**
   - Navigate to different pages in the app
   - Press the Android back button on each page
   - Verify the expected behavior:
     - Home/Explore/Library/Profile → Exit app
     - Sign-in/Privacy/Terms/About/Help/Data Usage → Go to home
     - Other pages → Go to previous page

3. **Use the Test Page**
   - Navigate to `/back-button-test` in the app
   - Use the test buttons to navigate between pages
   - Monitor the navigation state display
   - Test the programmatic back button

4. **Console Logging**
   - Open browser dev tools or Android Studio console
   - Look for navigation logs:
     - `🧭 Navigation state updated:`
     - `🔙 Back button pressed. Current state:`
     - `🏠 Navigating to home`
     - `🚪 Exiting app`

## Expected Behavior

### Exit App Routes
- `/home` - Back button exits app
- `/explore` - Back button exits app  
- `/library` - Back button exits app
- `/profile` - Back button exits app

### Navigate to Home Routes
- `/sign-in` - Back button goes to home
- `/privacy-policy` - Back button goes to home
- `/terms-of-use` - Back button goes to home
- `/about` - Back button goes to home
- `/help-support` - Back button goes to home
- `/data-usage` - Back button goes to home

### Previous Page Navigation
- `/see-all/*` - Back button goes to previous page
- `/back-button-test` - Back button goes to previous page
- Any other page - Back button goes to previous page

## Troubleshooting

If the back button is not working:

1. **Check Console Logs**
   - Look for navigation service initialization
   - Check for back button event logs

2. **Verify Platform Detection**
   - Ensure the app is running on Android
   - Check if `platform.is('android')` returns true

3. **Check Service Injection**
   - Verify `NavigationService` is injected in `AppComponent`
   - Ensure the service is properly initialized

4. **Test on Physical Device**
   - Some emulators may not properly simulate the back button
   - Test on a physical Android device for best results

## Debug Mode

To enable detailed logging, check the console for:
- Navigation state updates
- Back button press events
- Navigation decisions and routing logic
- Error messages and fallbacks

## Performance Notes

- Navigation history is limited to 10 entries
- Memory usage is optimized
- Subscriptions are properly cleaned up
- No memory leaks should occur

