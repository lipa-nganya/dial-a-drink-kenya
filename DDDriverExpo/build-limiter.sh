#!/bin/bash
# Build limiter - Maximum 1 build per day
# This prevents excessive EAS builds and costs
# Usage: source ./build-limiter.sh (returns 1 if limit reached, 0 if allowed)

BUILD_LOCK_FILE=".build-lock"
TODAY=$(date +%Y-%m-%d)

# Check if a build was done today
if [ -f "$BUILD_LOCK_FILE" ]; then
    LAST_BUILD_DATE=$(cat "$BUILD_LOCK_FILE")
    
    if [ "$LAST_BUILD_DATE" == "$TODAY" ]; then
        echo "❌ Build limit reached!"
        echo ""
        echo "A build was already created today ($TODAY)."
        echo "Maximum allowed: 1 build per day."
        echo ""
        echo "To override this limit, run:"
        echo "  ./manage-build-limit.sh reset"
        echo ""
        echo "Or wait until tomorrow to build again."
        return 1 2>/dev/null || exit 1
    fi
fi

# If we get here, it's safe to build
echo "✅ Build allowed - no builds today yet"
echo ""

# Record this build date (before actual build starts)
echo "$TODAY" > "$BUILD_LOCK_FILE"
echo "📝 Build lock file updated: $BUILD_LOCK_FILE"
echo ""

# Return success (this script is sourced, so return allows calling script to continue)
return 0 2>/dev/null || exit 0

