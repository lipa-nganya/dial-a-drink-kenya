# Building DDDriver APK

## Prerequisites

1. **Android Studio** - Install Android Studio and Android SDK
2. **Java JDK** - Install JDK 11 or higher
3. **Node.js** - Already installed (18+)
4. **React Native CLI** - Install globally: `npm install -g react-native-cli`

## Setup Steps

### 1. Install Dependencies

```bash
cd driver-app
npm install
```

### 2. Configure Android SDK

Set environment variables (add to `~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 3. Configure API URL

Edit `src/services/api.js` based on your setup:

**For Android Emulator:**
```javascript
return 'http://10.0.2.2:5001/api';
```

**For Physical Device (Ngrok):**
```javascript
return 'https://your-ngrok-url.ngrok-free.dev/api';
```

**For Physical Device (Local Network):**
```javascript
return 'http://192.168.1.XXX:5001/api';
```

### 4. Build Debug APK

```bash
cd driver-app/android
./gradlew assembleDebug
```

APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Build Release APK (for production)

#### Step 1: Generate Keystore

```bash
cd driver-app/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore dddriver-release-key.keystore -alias dddriver-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Password (remember this!)
- Name, organization, etc.

#### Step 2: Configure Gradle

Create/update `android/gradle.properties`:

```properties
DDDRIVER_RELEASE_STORE_FILE=dddriver-release-key.keystore
DDDRIVER_RELEASE_KEY_ALIAS=dddriver-key-alias
DDDRIVER_RELEASE_STORE_PASSWORD=your-password-here
DDDRIVER_RELEASE_KEY_PASSWORD=your-password-here
```

Update `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('DDDRIVER_RELEASE_STORE_FILE')) {
                storeFile file(DDDRIVER_RELEASE_STORE_FILE)
                storePassword DDDRIVER_RELEASE_STORE_PASSWORD
                keyAlias DDDRIVER_RELEASE_KEY_ALIAS
                keyPassword DDDRIVER_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### Step 3: Build Release APK

```bash
cd driver-app/android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Installing APK

### Method 1: Direct Install (Physical Device)

1. Enable "Install from Unknown Sources" in Android settings
2. Transfer APK to device
3. Open APK file on device
4. Install

### Method 2: ADB Install

```bash
adb install app-debug.apk
# or
adb install app-release.apk
```

## Testing

1. **First Time:**
   - Open app
   - Enter phone number (must be added in admin dashboard first)
   - Receive OTP via SMS
   - Enter OTP
   - Set PIN (4 digits)
   - Confirm PIN
   - Access dashboard

2. **Subsequent Logins:**
   - Enter PIN
   - Access dashboard

## Troubleshooting

### Build Fails

```bash
cd android
./gradlew clean
cd ..
npm install
cd android
./gradlew assembleDebug
```

### "SDK not found"

- Install Android SDK via Android Studio
- Set ANDROID_HOME environment variable

### "Command not found: gradlew"

```bash
cd android
chmod +x gradlew
./gradlew assembleDebug
```

### Network Errors in App

- Verify backend is running: `curl http://localhost:5001/api/health`
- Check API URL in `src/services/api.js`
- For physical device, test URL in browser first

## File Locations

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Keystore: `android/app/dddriver-release-key.keystore` (keep this secure!)



















