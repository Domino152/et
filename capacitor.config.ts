import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.expensetracker.app',
  appName: 'Expense Tracker',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      saveToGallery: false
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