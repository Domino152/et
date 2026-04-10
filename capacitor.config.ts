import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.costtrack.app',
  appName: 'CostTrack',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: true
  },

  plugins: {
    Camera: {
      saveToGallery: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#d4af37',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4f46e5'
    },
    GoogleAuth: {
      scopes: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file'
      ],
      clientId: '225196660392-96enaf92bukrp6rfc5hppkvfmkdm3vab.apps.googleusercontent.com',
      serverClientId: '225196660392-96enaf92bukrp6rfc5hppkvfmkdm3vab.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;