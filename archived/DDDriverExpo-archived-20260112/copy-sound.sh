#!/bin/bash

# Script to copy driver_sound.wav to assets folder
# Usage: ./copy-sound.sh [path-to-driver_sound.wav]

set -e

SOUND_FILE="${1:-$HOME/Downloads/driver_sound.wav}"
TARGET_DIR="$(dirname "$0")/assets"
TARGET_FILE="$TARGET_DIR/driver_sound.wav"

echo "📁 Copying driver sound file..."

# Check if source file exists
if [ ! -f "$SOUND_FILE" ]; then
  echo "❌ Error: Sound file not found at: $SOUND_FILE"
  echo ""
  echo "Please provide the path to driver_sound.wav:"
  echo "  ./copy-sound.sh /path/to/driver_sound.wav"
  echo ""
  echo "Or place driver_sound.wav in your Downloads folder and run:"
  echo "  ./copy-sound.sh"
  exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Copy the file
cp "$SOUND_FILE" "$TARGET_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Sound file copied successfully to: $TARGET_FILE"
  ls -lh "$TARGET_FILE"
else
  echo "❌ Failed to copy sound file"
  exit 1
fi

echo ""
echo "✅ Setup complete! The sound file is now in assets/driver_sound.wav"

