# Fix Gradle JDK Configuration

## Quick Fix (Recommended)

1. **Open Android Studio**
2. **Go to Settings/Preferences:**
   - Mac: `Android Studio` → `Settings` (or `Preferences`)
   - Windows/Linux: `File` → `Settings`
3. **Navigate to:**
   - `Build, Execution, Deployment` → `Build Tools` → `Gradle`
4. **Under "Gradle JDK":**
   - Select **"Embedded JDK"** from the dropdown
   - Or browse to: `/Applications/Android Studio.app/Contents/jbr/Contents/Home`
5. **Click "Apply" then "OK"**
6. **Sync Gradle:**
   - `File` → `Sync Project with Gradle Files`

## Alternative: Set JAVA_HOME

If you prefer to use a system-wide Java installation:

### For zsh (macOS default):
```bash
echo 'export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"' >> ~/.zshrc
source ~/.zshrc
```

### For bash:
```bash
echo 'export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"' >> ~/.bash_profile
source ~/.bash_profile
```

Then restart Android Studio.

## Verify

After setting, verify it works:
```bash
echo $JAVA_HOME
java -version
```

The embedded JDK path is: `/Applications/Android Studio.app/Contents/jbr/Contents/Home`


