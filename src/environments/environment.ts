export const environment = {
  production: false,
  // ─────────────────────────────────────────────────────────────────────────────
  // REQUIRED: Replace the value below with your real Google OAuth 2.0 Client ID.
  // Steps to get it:
  //   1. Go to https://console.cloud.google.com/
  //   2. Create (or select) a project → APIs & Services → Credentials
  //   3. Create an OAuth 2.0 Client ID → Application type: "Web application"
  //   4. Set Authorised redirect URI to:  http://localhost:8100
  //   5. Enable the Google Drive API for the project
  //   6. Copy the generated Client ID and paste it below
  // ─────────────────────────────────────────────────────────────────────────────
  googleClientId: '225196660392-96enaf92bukrp6rfc5hppkvfmkdm3vab.apps.googleusercontent.com',

  // OAuth scopes needed: read/write files + identify the user
  googleScopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',

  // Google Drive API base URL
  driveApiUrl: 'https://www.googleapis.com/drive/v3',
  driveUploadUrl: 'https://www.googleapis.com/upload/drive/v3'
};
