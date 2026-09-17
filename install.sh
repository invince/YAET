#!/bin/bash

# Configuration
REPO="invince/YAET-RELEASE"
SRC_REPO="invince/YAET"
APP_NAME="YetAnotherElectronTerm"
BINARY_NAME="yet-another-electron-term"
ICON_URL="https://raw.githubusercontent.com/$SRC_REPO/master/src-electron/assets/icons/app-icon.png"

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
echo "Fetching latest release information from GitHub..."
RELEASE_JSON=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")

# Check if the repository has releases
if echo "$RELEASE_JSON" | grep -q "message.*Not Found"; then
    echo -e "${RED}Error: No releases found for $REPO.${NC}"
    echo -e "Please ensure you have pushed a tag (e.g., v3.0.0) and the GitHub build is complete."
    exit 1
fi

TAG=$(echo "$RELEASE_JSON" | grep -m 1 '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

# Method 1: Try to find AppImage URL directly in assets
LATEST_RELEASE_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep -i "\.AppImage" | cut -d '"' -f 4 | head -n 1)

# Method 2: Fallback to latest-linux.yml (as suggested by user)
if [ -z "$LATEST_RELEASE_URL" ]; then
    echo "Direct AppImage link not found, checking latest-linux.yml..."
    YML_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep "latest-linux\.yml" | cut -d '"' -f 4 | head -n 1)
    if [ -n "$YML_URL" ]; then
        APPIMAGE_FILE=$(curl -sL "$YML_URL" | grep "^path: " | cut -d ' ' -f 2 | tr -d '\r')
        if [ -n "$APPIMAGE_FILE" ]; then
            LATEST_RELEASE_URL="https://github.com/$REPO/releases/download/$TAG/$APPIMAGE_FILE"
        fi
    fi
fi

if [ -z "$LATEST_RELEASE_URL" ] || [[ "$LATEST_RELEASE_URL" == *"null"* ]]; then
    echo -e "${RED}Error: Could not find an AppImage for version $TAG.${NC}"
    echo -e "Wait for the GitHub Action build to finish or check: https://github.com/$REPO/releases"
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

# Create headless CLI shim
# NOTE: keep in sync with scripts/yaet (shipped in the asar, used by
# `yaet doctor --fix-shim`). Inlined here so the installer stays
# self-contained (no repo checkout needed).
echo "Creating yaet CLI shim..."
cat > "$HOME/.local/bin/yaet" <<'EOF'
#!/bin/sh
# yaet — headless CLI shim. See scripts/yaet in the YAET repo.
set -u

FLAGS="--no-sandbox --ozone-platform=headless --disable-gpu --disable-logging"

# 1. .deb install
if [ -x /opt/YetAnotherElectronTerm/yet-another-electron-term ]; then
  # shellcheck disable=SC2086
  exec /opt/YetAnotherElectronTerm/yet-another-electron-term $FLAGS "$@"
fi

# 2. user-local AppImage (installed by install.sh)
if [ -x "$HOME/.local/bin/YetAnotherElectronTerm.AppImage" ]; then
  # shellcheck disable=SC2086
  exec "$HOME/.local/bin/YetAnotherElectronTerm.AppImage" $FLAGS "$@"
fi

echo "yaet: no installed YAET binary found (looked in /opt/YetAnotherElectronTerm and ~/.local/bin)." >&2
exit 1
EOF
chmod +x "$HOME/.local/bin/yaet"

echo -e "${GREEN}Installation complete!${NC}"
echo -e "You can now find $APP_NAME in your application menu."
echo -e "Or run it manually: $DOWNLOAD_PATH"
echo -e "Headless CLI is available as: ${BLUE}yaet${NC} (e.g. yaet doctor)"
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo -e "${RED}Note: ~/.local/bin is not on your PATH — add it to your shell profile to use the yaet command.${NC}";;
esac
