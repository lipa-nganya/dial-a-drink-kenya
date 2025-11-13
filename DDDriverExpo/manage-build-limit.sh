#!/bin/bash
# Helper script to manage build limit

cd "$(dirname "$0")"

BUILD_LOCK_FILE=".build-lock"

case "$1" in
    check)
        if [ -f "$BUILD_LOCK_FILE" ]; then
            LAST_BUILD_DATE=$(cat "$BUILD_LOCK_FILE")
            TODAY=$(date +%Y-%m-%d)
            
            if [ "$LAST_BUILD_DATE" == "$TODAY" ]; then
                echo "❌ Build limit reached - A build was done today ($TODAY)"
                exit 1
            else
                echo "✅ Build allowed - Last build was on $LAST_BUILD_DATE"
                exit 0
            fi
        else
            echo "✅ Build allowed - No builds recorded yet"
            exit 0
        fi
        ;;
    
    reset)
        if [ -f "$BUILD_LOCK_FILE" ]; then
            rm "$BUILD_LOCK_FILE"
            echo "✅ Build limit reset - You can build again now"
        else
            echo "ℹ️  No build lock file found - Build limit is already clear"
        fi
        ;;
    
    status)
        if [ -f "$BUILD_LOCK_FILE" ]; then
            LAST_BUILD_DATE=$(cat "$BUILD_LOCK_FILE")
            TODAY=$(date +%Y-%m-%d)
            
            echo "📅 Last build date: $LAST_BUILD_DATE"
            echo "📅 Today's date: $TODAY"
            
            if [ "$LAST_BUILD_DATE" == "$TODAY" ]; then
                echo "❌ Status: Build limit reached (1 build per day)"
            else
                echo "✅ Status: Build allowed"
            fi
        else
            echo "✅ Status: No builds recorded - Build allowed"
        fi
        ;;
    
    *)
        echo "Build Limit Manager"
        echo ""
        echo "Usage: $0 {check|reset|status}"
        echo ""
        echo "Commands:"
        echo "  check   - Check if build is allowed (returns 0 if yes, 1 if no)"
        echo "  reset   - Reset the build limit (allows building again today)"
        echo "  status  - Show current build limit status"
        echo ""
        exit 1
        ;;
esac

