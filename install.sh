#!/bin/bash

# Configuration
REPO="invince/YAET"
APP_NAME="YetAnotherElectronTerm"
BINARY_NAME="yet-another-electron-term"
ICON_URL="https://raw.githubusercontent.com/$REPO/main/src-electron/assets/icons/app-icon.png"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting installation of $APP_NAME...${NC}"

# Check for dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed. Please install it and try again.${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${BLUE}Note: jq is not installed. Attempting to install latest version without specific check...${NC}"
fi

# Create directories
mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons"

# Fetch latest release data
echo "Fetching latest release information..."
LATEST_RELEASE_URL=$(curl -s https://api.github.com/repos/$REPO/releases/latest | grep "browser_download_url.*AppImage" | cut -d '"' -f 4)

if [ -z "$LATEST_RELEASE_URL" ]; then
    echo -e "${RED}Error: Could not find the latest AppImage release.${NC}"
    exit 1
fi

DOWNLOAD_PATH="$HOME/.local/bin/$APP_NAME.AppImage"

# Download AppImage
echo -e "${BLUE}Downloading latest AppImage from: $LATEST_RELEASE_URL${NC}"
curl -L "$LATEST_RELEASE_URL" -o "$DOWNLOAD_PATH"
chmod +x "$DOWNLOAD_PATH"

# Download Icon
echo "Downloading icon..."
curl -L "$ICON_URL" -o "$HOME/.local/share/icons/$BINARY_NAME.png"

# Create .desktop entry
echo "Creating desktop entry..."
cat > "$HOME/.local/share/applications/$BINARY_NAME.desktop" <<EOF
[Desktop Entry]
Name=$APP_NAME
Exec="$DOWNLOAD_PATH"
Icon=$BINARY_NAME
Type=Application
Categories=Utility;TerminalEmulator;
Comment=Yet Another Electron Terminal
Terminal=false
EOF

echo -e "${GREEN}Installation complete!${NC}"
echo -e "You can now find $APP_NAME in your application menu."
echo -e "Or run it manually: $DOWNLOAD_PATH"
