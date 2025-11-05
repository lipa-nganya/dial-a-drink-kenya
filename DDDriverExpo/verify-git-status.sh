#!/bin/bash

# Script to verify git push status
# Usage: ./verify-git-status.sh

cd "$(dirname "$0")/.."

echo "🔍 Verifying Git Push Status"
echo "=============================="
echo ""

# Check if files exist
echo "📁 Checking files exist:"
if [ -f "DDDriverExpo/assets/driver_sound.wav" ]; then
  echo "  ✅ driver_sound.wav exists"
else
  echo "  ❌ driver_sound.wav missing"
fi

if [ -f "DDDriverExpo/assets/icon.png" ]; then
  echo "  ✅ icon.png exists"
else
  echo "  ❌ icon.png missing"
fi

if [ -f "DDDriverExpo/assets/adaptive-icon.png" ]; then
  echo "  ✅ adaptive-icon.png exists"
else
  echo "  ❌ adaptive-icon.png missing"
fi

echo ""
echo "📋 Git Status:"
git status --short

echo ""
echo "📝 Recent Commits:"
git log --oneline -3

echo ""
echo "🔗 Remote Status:"
git remote -v

echo ""
echo "📊 Tracking Status:"
if git ls-files --error-unmatch DDDriverExpo/assets/driver_sound.wav &> /dev/null; then
  echo "  ✅ driver_sound.wav is tracked by git"
else
  echo "  ⚠️  driver_sound.wav is NOT tracked by git"
fi

if git ls-files --error-unmatch DDDriverExpo/assets/icon.png &> /dev/null; then
  echo "  ✅ icon.png is tracked by git"
else
  echo "  ⚠️  icon.png is NOT tracked by git"
fi

echo ""
echo "🔄 Remote Sync Check:"
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse @{u} 2>/dev/null 2>&1)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "  ✅ Local and remote are in sync"
elif [ -z "$REMOTE" ]; then
  echo "  ⚠️  No remote tracking branch set"
else
  echo "  ⚠️  Local and remote may be out of sync"
  echo "  Local:  $LOCAL"
  echo "  Remote: $REMOTE"
fi

echo ""
echo "=============================="

