#!/bin/bash
# Script to convert SVG icons to PNG for push notifications

echo "🎨 Converting SVG icons to PNG for push notifications..."

# Check if ImageMagick or Inkscape is available
if command -v convert &> /dev/null; then
    echo "✓ Using ImageMagick..."
    convert -background none orb-icon-192.svg orb-icon-192.png
    convert -background none orb-badge-96.svg orb-badge-96.png
    echo "✅ Conversion complete with ImageMagick!"
elif command -v inkscape &> /dev/null; then
    echo "✓ Using Inkscape..."
    inkscape orb-icon-192.svg --export-filename=orb-icon-192.png -w 192 -h 192
    inkscape orb-badge-96.svg --export-filename=orb-badge-96.png -w 96 -h 96
    echo "✅ Conversion complete with Inkscape!"
elif command -v rsvg-convert &> /dev/null; then
    echo "✓ Using rsvg-convert..."
    rsvg-convert -w 192 -h 192 orb-icon-192.svg -o orb-icon-192.png
    rsvg-convert -w 96 -h 96 orb-badge-96.svg -o orb-badge-96.png
    echo "✅ Conversion complete with rsvg-convert!"
else
    echo "❌ No SVG converter found!"
    echo ""
    echo "Please install one of the following:"
    echo "  • ImageMagick: sudo apt-get install imagemagick (Linux) or brew install imagemagick (Mac)"
    echo "  • Inkscape: sudo apt-get install inkscape (Linux) or brew install inkscape (Mac)"
    echo "  • rsvg-convert: sudo apt-get install librsvg2-bin (Linux)"
    echo ""
    echo "Or use an online converter:"
    echo "  1. Go to https://cloudconvert.com/svg-to-png"
    echo "  2. Upload orb-icon-192.svg and convert to PNG"
    echo "  3. Upload orb-badge-96.svg and convert to PNG"
    echo "  4. Save the PNG files in the public/ folder"
    exit 1
fi

# Verify the files were created
if [ -f "orb-icon-192.png" ] && [ -f "orb-badge-96.png" ]; then
    echo ""
    echo "📁 Files created successfully:"
    ls -lh orb-icon-192.png orb-badge-96.png
    echo ""
    echo "✅ Push notification icons are ready!"
else
    echo "❌ Conversion failed. Please try manually."
fi
