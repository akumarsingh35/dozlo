import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
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
    }
  }
};

export default config;
