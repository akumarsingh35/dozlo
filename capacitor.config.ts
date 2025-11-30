import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dozlo.app',
  appName: 'Dozlo',
  webDir: 'www',
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
  },
  plugins:{
    StatusBar:{
      overlaysWebView: false,
      style: 'dark',
      backgroundColor: '#120f29',
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
    FirebaseAnalytics: {
      collectionEnabled: true
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
      languageCode: 'en',
      tenantId: '',
      useEmulator: false,
      disableAutoSignIn: false,
      disableAutoSignInWithCredential: true
    },
    BackgroundMode: {
      title: 'Dozlo Audio',
      text: 'Playing audio in background',
      icon: 'ic_launcher',
      color: '#120f29',
      hidden: false,
      silent: false
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#120f29'
    }
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
    },
    // Note: google-services.json must be placed at android/app/google-services.json
    // Do NOT set a non-standard 'googleServicesFile' property here — it is not part of CapacitorConfig
  }
};

export default config;

// Verified: google-services.json should be at android/app/google-services.json and package_name must match appId 'io.ionic.starter'

