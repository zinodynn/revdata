#!/bin/sh
set -e

# Default to / if not set
export VITE_APP_BASE_URL=${VITE_APP_BASE_URL:-/}

# Ensure VITE_APP_BASE_URL starts and ends with / unless it is just /
if [ "$VITE_APP_BASE_URL" != "/" ]; then
    case "$VITE_APP_BASE_URL" in
        /*) ;;
        *) VITE_APP_BASE_URL="/$VITE_APP_BASE_URL" ;;
    esac
    case "$VITE_APP_BASE_URL" in
        */) ;;
        *) VITE_APP_BASE_URL="$VITE_APP_BASE_URL/" ;;
    esac
fi

echo "Setting up for Base URL: $VITE_APP_BASE_URL"

# Move files to subdirectory if Base URL is not /
if [ "$VITE_APP_BASE_URL" != "/" ]; then
    TARGET_DIR="/usr/share/nginx/html${VITE_APP_BASE_URL}"
    # Check if we already moved (container restart)
    if [ ! -d "$TARGET_DIR" ]; then
        echo "Moving files..."
        mkdir -p /tmp/web_root
        # Move all contents from html root to tmp, excluding the target dir if it partially exists
        mv /usr/share/nginx/html/* /tmp/web_root/ 2>/dev/null || true
        
        mkdir -p "$TARGET_DIR"
        mv /tmp/web_root/* "$TARGET_DIR/"
        rm -rf /tmp/web_root
    fi
fi

# Execute the official entrypoint which handles template substitution
# We need to make sure the template uses the format expected by envsubst
# The nginx image uses /docker-entrypoint.sh
exec /docker-entrypoint.sh "$@"
