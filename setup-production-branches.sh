#!/bin/bash
# Setup Git Branches for Production
# This script helps set up the branch structure where:
# - develop branch → Development environment
# - main branch → Production environment

set -e

echo "🌿 Setting Up Git Branches for Production"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. Rename current 'main' branch to 'develop'"
echo "  2. Create new 'main' branch for production"
echo "  3. Update remote branches"
echo ""
echo "⚠️  IMPORTANT: Make sure you have:"
echo "  - Committed all current changes"
echo "  - Pushed all changes to remote"
echo "  - Backup of your repository"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on 'main' branch (currently on '$CURRENT_BRANCH')"
    read -p "Switch to main branch? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
    else
        echo "Aborted. Please switch to main branch first."
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   Please commit or stash them before continuing"
    exit 1
fi

# Pull latest changes
echo ""
echo "📥 Pulling latest changes from remote..."
git pull origin main

# Step 1: Rename main to develop locally
echo ""
echo "🔄 Step 1: Renaming 'main' to 'develop' locally..."
git branch -m main develop
echo "✅ Renamed locally"

# Step 2: Push develop to remote
echo ""
echo "📤 Step 2: Pushing 'develop' branch to remote..."
git push origin develop
git push origin -u develop
echo "✅ Pushed 'develop' branch"

# Step 3: Create new main branch from develop
echo ""
echo "🆕 Step 3: Creating new 'main' branch for production..."
git checkout -b main
echo "✅ Created new 'main' branch"

# Step 4: Push main to remote
echo ""
echo "📤 Step 4: Pushing 'main' branch to remote..."
git push origin main
git push origin -u main
echo "✅ Pushed 'main' branch"

# Step 5: Instructions for GitHub
echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Local branch setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps (Manual):"
echo ""
echo "1. Update GitHub Default Branch:"
echo "   - Go to: https://github.com/<YOUR_REPO>/settings/branches"
echo "   - Change default branch from 'develop' to 'main'"
echo "   - Or use: gh repo edit --default-branch main"
echo ""
echo "2. Update Netlify Deployments:"
echo "   - Development sites: Set branch to 'develop'"
echo "   - Production sites: Set branch to 'main'"
echo ""
echo "3. Update Cloud Build Triggers (if used):"
echo "   - Development: Use 'develop' branch"
echo "   - Production: Use 'main' branch"
echo ""
echo "4. Protect Branches (Recommended):"
echo "   - Protect 'main' branch (require PR reviews)"
echo "   - Protect 'develop' branch (optional)"
echo ""
echo "📚 See SETUP_GIT_BRANCHES.md for detailed instructions"
echo ""
