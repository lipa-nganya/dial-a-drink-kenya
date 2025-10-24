#!/bin/bash

# Frontend build script for Render
echo "Starting frontend build process..."

# Check if we're in the right directory
echo "Current directory: $(pwd)"
echo "Contents:"
ls -la

# Check if public directory exists
if [ -d "public" ]; then
    echo "Public directory exists"
    echo "Public directory contents:"
    ls -la public/
    
    # Check if index.html exists
    if [ -f "public/index.html" ]; then
        echo "index.html found in public directory"
    else
        echo "ERROR: index.html not found in public directory"
        exit 1
    fi
else
    echo "ERROR: public directory not found"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build the project
echo "Building React app..."
npm run build

# Copy _redirects file to build directory for client-side routing
if [ -f "public/_redirects" ]; then
    echo "Copying _redirects file to build directory..."
    cp public/_redirects build/
    echo "_redirects file copied successfully"
else
    echo "WARNING: _redirects file not found in public directory"
fi

echo "Build completed successfully!"
