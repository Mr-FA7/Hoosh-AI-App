#!/bin/bash
# FA7 OS - Generate macOS Icon Set

ICON_SRC="assets/icon.png"
ICON_SET="assets/icon.iconset"

mkdir -p "$ICON_SET"

# Check if sips is available
if ! command -v sips &> /dev/null; then
    echo "sips not found. Please run this on macOS."
    exit 1
fi

echo "Generating icon variants..."
sips -z 16 16     "$ICON_SRC" -s format png --out "$ICON_SET/icon_16x16.png"
sips -z 32 32     "$ICON_SRC" -s format png --out "$ICON_SET/icon_16x16@2x.png"
sips -z 32 32     "$ICON_SRC" -s format png --out "$ICON_SET/icon_32x32.png"
sips -z 64 64     "$ICON_SRC" -s format png --out "$ICON_SET/icon_32x32@2x.png"
sips -z 128 128   "$ICON_SRC" -s format png --out "$ICON_SET/icon_128x128.png"
sips -z 256 256   "$ICON_SRC" -s format png --out "$ICON_SET/icon_128x128@2x.png"
sips -z 256 256   "$ICON_SRC" -s format png --out "$ICON_SET/icon_256x256.png"
sips -z 512 512   "$ICON_SRC" -s format png --out "$ICON_SET/icon_256x256@2x.png"
sips -z 512 512   "$ICON_SRC" -s format png --out "$ICON_SET/icon_512x512.png"
sips -z 1024 1024 "$ICON_SRC" -s format png --out "$ICON_SET/icon_512x512@2x.png"

echo "Creating .icns file..."
iconutil -c icns "$ICON_SET"

# Cleanup iconset
rm -rf "$ICON_SET"

echo "Done! assets/icon.icns is ready."
