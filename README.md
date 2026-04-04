# Expense Tracker — Ionic + Angular + Capacitor (Android)

A mobile app to track expenses and purchases by capturing receipt photos and uploading them to Google Drive.

---

## Project Structure

```
expense-tracker/
├── src/
│   ├── app/
│   │   ├── home/                   # Home page (navigation hub)
│   │   │   ├── home.module.ts
│   │   │   ├── home.page.ts
│   │   │   ├── home.page.html
│   │   │   └── home.page.scss
│   │   ├── expense/                # Expense page
│   │   │   ├── expense.module.ts
│   │   │   ├── expense.page.ts
│   │   │   ├── expense.page.html
│   │   │   └── expense.page.scss
│   │   ├── purchase/               # Purchase page (+ payment type)
│   │   │   ├── purchase.module.ts
│   │   │   ├── purchase.page.ts
│   │   │   ├── purchase.page.html
│   │   │   └── purchase.page.scss
│   │   ├── services/
│   │   │   ├── auth.service.ts     # Google OAuth 2.0
│   │   │   ├── camera.service.ts   # Capacitor Camera
│   │   │   └── drive.service.ts    # Google Drive API
│   │   ├── app.module.ts
│   │   ├── app-routing.module.ts
│   │   ├── app.component.ts
│   │   └── app.component.html
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   ├── theme/variables.scss
│   ├── global.scss
│   ├── index.html
│   ├── main.ts
│   └── polyfills.ts
├── android-setup/                  # Reference files for Android config
│   ├── AndroidManifest.xml
│   ├── file_paths.xml
│   └── network_security_config.xml
├── capacitor.config.ts
├── angular.json
├── tsconfig.json
└── package.json
```

---

## Prerequisites

Install these globally before starting:

```bash
node --version    # Requires Node 18+
npm --version     # Requires npm 9+

npm install -g @ionic/cli @angular/cli
npm install -g @capacitor/cli
```

Also required:
- **Android Studio** (latest) — https://developer.android.com/studio
- **Java JDK 17** — https://adoptium.net/
- A physical Android device OR an Android emulator (API 22+)

---

## Step 1 — Install dependencies

```bash
cd expense-tracker
npm install
```

---

## Step 2 — Configure Google OAuth 2.0

### 2a. Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Click **Select a project → New Project**, give it a name (e.g. `expense-tracker`)
3. In the left menu go to **APIs & Services → Library**
4. Search for **Google Drive API** and click **Enable**

### 2b. Create OAuth credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. If prompted, configure the **OAuth consent screen** first:
   - User type: External
   - App name: Expense Tracker
   - Add your email as a test user
   - Scopes to add:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/userinfo.email`
3. Back in **Create OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:8100`
   - Authorized redirect URIs: `http://localhost:8100`
4. Click **Create** and copy the **Client ID**

### 2c. Paste the Client ID into the app

Open `src/environments/environment.ts` and replace:

```typescript
googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
```

Do the same in `src/environments/environment.prod.ts`.

---

## Step 3 — Build the web app

```bash
ionic build --prod
```

This outputs the compiled app to the `www/` folder.

---

## Step 4 — Add Android platform

```bash
npx cap add android
```

This creates the `android/` directory with a native Android project.

---

## Step 5 — Apply Android configuration files

After `cap add android`, copy the reference files from `android-setup/` into the Android project:

### AndroidManifest.xml
```bash
# Replace the generated manifest with the one that includes camera permissions
cp android-setup/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
```

### file_paths.xml (for FileProvider / camera on Android 7+)
```bash
mkdir -p android/app/src/main/res/xml
cp android-setup/file_paths.xml android/app/src/main/res/xml/file_paths.xml
```

### network_security_config.xml
```bash
cp android-setup/network_security_config.xml \
   android/app/src/main/res/xml/network_security_config.xml
```

> **Note:** After running `cap sync` or `cap update` these files may be overwritten.
> Re-apply them if the camera stops working.

---

## Step 6 — Sync Capacitor

Every time you rebuild the web app, sync the native project:

```bash
npx cap sync android
```

---

## Step 7 — Open in Android Studio and run

```bash
npx cap open android
```

In Android Studio:
1. Wait for Gradle to finish syncing
2. Connect a physical device via USB (enable **USB Debugging** in Developer Options) or start an emulator
3. Click the green ▶ **Run** button
4. Select your device

The app will be installed and launched automatically.

---

## Development workflow (live reload on device)

```bash
ionic capacitor run android --livereload --external
```

This serves the app over your local network and refreshes the device when you save files.
Your device must be on the same Wi-Fi network as your development machine.

---

## Available npm scripts

| Script | Description |
|---|---|
| `npm start` | Serve in browser for quick UI testing |
| `npm run build` | Build for production |
| `npm run build:android` | Full pipeline: build → cap sync → open Android Studio |

---

## App Features

### Home Page
- Sign in / Sign out with Google
- Two navigation buttons: **Expense** and **Purchase**
- Shows "how it works" guide

### Expense Page
- Date picker (Ionic datetime wheel)
- Camera capture using Capacitor Camera plugin
- Image preview with option to retake
- Description textarea (3–500 characters)
- Uploads to **Expense** folder on Google Drive

### Purchase Page
- All Expense Page features, plus:
- **Payment method** dropdown (Paid by Myself / Paid by Company)
- Uploads to **Purchase** folder on Google Drive

---

## Services

### AuthService (`auth.service.ts`)
- Uses Google Identity Services (GIS) for OAuth 2.0 implicit grant
- Caches the access token in memory with expiry check
- Fetches user email from the `/userinfo` endpoint

### CameraService (`camera.service.ts`)
- Wraps Capacitor `Camera.getPhoto()`
- Handles permission check and request
- Returns `base64Data`, `dataUrl`, `mimeType`, `format`
- Provides `base64ToBlob()` utility for multipart upload

### DriveService (`drive.service.ts`)
- Looks up or creates the target folder (`Expense` / `Purchase`) in Google Drive
- Caches folder IDs in memory to avoid redundant API calls
- Uploads the image as a **multipart/related** body (metadata + binary)
- File name format: `Expense_2025-01-15T10-30-00-000Z.jpg`
- Stores date, description, and payment type in the Drive file's `description` field

---

## Troubleshooting

### Camera not working on device
- Make sure `android.permission.CAMERA` is in `AndroidManifest.xml`
- Make sure `file_paths.xml` is at `android/app/src/main/res/xml/`
- Check that the `FileProvider` authority in the manifest matches `${applicationId}.fileprovider`

### Google Sign-in popup doesn't appear
- Confirm the Client ID in `environment.ts` is correct
- Verify `http://localhost:8100` is listed in Authorized JavaScript Origins
- On a physical device, use `ionic capacitor run android --livereload --external` and add your machine's local IP (e.g. `http://192.168.1.10:8100`) to the allowed origins

### Upload fails with 403
- The OAuth consent screen scopes must include `drive.file`
- Your Google account must be listed as a **test user** if the app is in "Testing" mode

### `google is not defined` error
- The GIS script `<script src="https://accounts.google.com/gsi/client">` must be in `index.html`
- On Android (Capacitor), the WebView needs internet access — check `INTERNET` permission

---

## Production / Release Build

1. Generate a signing keystore:
   ```bash
   keytool -genkey -v -keystore release.keystore \
     -alias expense-tracker -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `android/app/build.gradle`

3. Build a signed APK in Android Studio:
   **Build → Generate Signed Bundle / APK → APK → Release**

4. For Google Play, use **Android App Bundle (.aab)** instead of APK.
