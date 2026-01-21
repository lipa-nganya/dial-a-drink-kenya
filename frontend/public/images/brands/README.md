# Brand Images

This directory contains brand images used on the brands listing page.

## Image Naming Convention

Brand images should be named using a URL-friendly slug format derived from the brand name.

**Format:** `{brand-name-slug}.jpg`

### Examples:
- Brand: "4th Street Wine" → Image: `4th-street-wine.jpg`
- Brand: "Baileys" → Image: `baileys.jpg`
- Brand: "Johnnie Walker" → Image: `johnnie-walker.jpg`
- Brand: "Moet and Chandon" → Image: `moet-and-chandon.jpg`

## Image Requirements

- **Format:** JPG or PNG
- **Recommended Size:** 400x400px or larger (square aspect ratio works best)
- **File Size:** Optimized for web (under 500KB recommended)
- **Background:** Transparent or white background preferred

## Image Paths in Database

Brand images are stored in the database with paths like:
- `/images/brands/4th-street-wine.jpg`
- `/images/brands/baileys.jpg`

The frontend will automatically serve these from the `public/images/brands/` directory.

## Adding New Brand Images

1. Name the image file according to the brand name slug (lowercase, hyphens instead of spaces)
2. Place it in this directory (`frontend/public/images/brands/`)
3. The brand listing page will automatically display the image if it matches the database image path
