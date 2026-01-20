#!/bin/bash
# Script to build and deploy the SPA Static Plugin

# IMPORTANT:
# Do NOT "source" this script.
# If sourced, the `set -u` option would leak into your current shell and can break
# prompt integrations (e.g. Warp) and even terminate SSH sessions.
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  echo "ERROR: 請不要用 source 執行 build-spa.sh，請改用：./build-spa.sh"
  return 2
fi

set -euo pipefail

# Options (defaults):
# - Default: build + deploy + restart (what you normally want in development).
# - Use --no-deploy / --no-restart to disable.
DO_DEPLOY=1
DO_RESTART=1

usage() {
  cat <<'EOF'
Usage: ./build-spa.sh [options]

Options:
  --deploy         Copy plugin JAR into idempiere-app (default)
  --no-deploy      Only build JAR, do not docker cp
  --restart        Restart idempiere-app after deploy (default)
  --no-restart     Do not restart idempiere-app after deploy

Notes:
  - If you're on SSH and worry about disconnects, run with: --no-restart
EOF
}

while [ "${1:-}" != "" ]; do
  case "$1" in
    --deploy) DO_DEPLOY=1 ;;
    --no-deploy) DO_DEPLOY=0 ;;
    --restart) DO_RESTART=1 ;;
    --no-restart) DO_RESTART=0 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 2
      ;;
  esac
  shift
done

# Get the directory of the script
PLUGIN_DIR="$(dirname "$(readlink -f "$0")")"
# Assume workspace root is two levels up from plugins/tw.mxp.emui
WORKSPACE_DIR="$(dirname "$(dirname "$PLUGIN_DIR")")"

PLUGIN_NAME="tw.mxp.emui"
PLUGIN_VERSION="1.0.1"
JAR_NAME="${PLUGIN_NAME}-${PLUGIN_VERSION}.jar"

SERVLET_API_JAR="$PLUGIN_DIR/lib/servlet-api.jar"
BUILD_DIR="$PLUGIN_DIR/build"
BUILD_CLASSES_DIR="$BUILD_DIR/classes"
BUILD_WEBINF_DIR="$BUILD_DIR/WEB-INF"
WEB_CONTENT_DIR="$PLUGIN_DIR/web-content"

echo "Building SPA Plugin..."
echo "Plugin Dir: $PLUGIN_DIR"
echo "Workspace Dir: $WORKSPACE_DIR"

# Prefer native toolchain when available
has_cmd() { command -v "$1" >/dev/null 2>&1; }

use_native_toolchain() {
  # User requested: if native environment has java + mvn, don't use Docker.
  # Also require javac/jar (JDK) because we compile and package.
  has_cmd java && has_cmd mvn && has_cmd javac && has_cmd jar
}

run_in_jdk() {
  # Usage: run_in_jdk <cmd...>
  if use_native_toolchain; then
    "$@"
  else
    docker run --rm -v "$WORKSPACE_DIR/plugins:/workspace" -w "/workspace/$PLUGIN_NAME" \
      eclipse-temurin:17-jdk \
      "$@"
  fi
}

# Clean build output to avoid stale classes (e.g. old package names)
if use_native_toolchain; then
  echo "Toolchain: native (java + mvn detected)"
  rm -rf "$BUILD_DIR"
else
  echo "Toolchain: docker (native java+mvn not detected)"
  # NOTE: build/ is often created by Docker (root), so we clean via Docker to avoid permission issues.
  docker run --rm -v "$WORKSPACE_DIR/plugins:/workspace" \
    eclipse-temurin:17-jdk \
    rm -rf "/workspace/$PLUGIN_NAME/build"
fi

# Ensure directories exist
mkdir -p "$PLUGIN_DIR/lib"
mkdir -p "$BUILD_CLASSES_DIR"
mkdir -p "$BUILD_WEBINF_DIR"
mkdir -p "$WEB_CONTENT_DIR"
: > "$WEB_CONTENT_DIR/.gitkeep"

build_ui_if_possible() {
  # Build UI into $WEB_CONTENT_DIR when npm/bun exists.
  # This keeps the plugin packaging deterministic, and avoids needing committed build artifacts.

  # Prefer bun over npm
  local pkg_manager=""
  local install_cmd=""
  local build_cmd=""

  if has_cmd bun; then
    pkg_manager="bun"
    install_cmd="bun install"
    build_cmd="bun run build"
  elif has_cmd npm; then
    pkg_manager="npm"
    install_cmd="npm install"
    build_cmd="npm run build"
  else
    echo "Neither bun nor npm found; skipping UI build"
    return 0
  fi

  echo "Building UI (using $pkg_manager)..."

  # Always install dependencies to ensure new packages are installed
  echo "Installing dependencies..."
  (cd "$PLUGIN_DIR/ui" && $install_cmd)

  echo "Building..."
  (cd "$PLUGIN_DIR/ui" && $build_cmd)

  # Vite emptyOutDir may remove .gitkeep; restore it so the directory stays tracked.
  : > "$WEB_CONTENT_DIR/.gitkeep"
}

ensure_servlet_api_jar() {
  if [ -f "$SERVLET_API_JAR" ]; then
    return 0
  fi

  # 1) Non-Docker / local iDempiere: try to locate an existing servlet-api bundle in $WORKSPACE_DIR/plugins.
  local local_source=""
  for f in \
    "$WORKSPACE_DIR"/plugins/org.eclipse.jetty.servlet-api_*.jar \
    "$WORKSPACE_DIR"/plugins/*servlet-api*.jar; do
    if [ -f "$f" ]; then
      local_source="$f"
      break
    fi
  done

  if [ -n "$local_source" ]; then
    echo "servlet-api.jar not found; using local: $local_source"
    cp "$local_source" "$SERVLET_API_JAR"
    return 0
  fi

  # 2) Prefer downloading a stable javax.servlet API JAR (does not touch running containers).
  # iDempiere plugin code uses javax.servlet.*, so we use javax.servlet-api.
  echo "servlet-api.jar not found; downloading javax.servlet-api via Docker..."
  mkdir -p "$PLUGIN_DIR/lib"

  # Use a Maven container without needing a local JDK/Maven.
  # Store the jar as lib/servlet-api.jar (strip version for stable classpath).
  docker run --rm \
    -v "$PLUGIN_DIR/lib:/out" \
    maven:3.9-eclipse-temurin-17 \
    bash -lc "mvn -q -Dmaven.repo.local=/tmp/.m2 -Dtransitive=false dependency:get -Dartifact=javax.servlet:javax.servlet-api:3.1.0 && cp /tmp/.m2/repository/javax/servlet/javax.servlet-api/3.1.0/javax.servlet-api-3.1.0.jar /out/servlet-api.jar"

  if [ -f "$SERVLET_API_JAR" ]; then
    echo "Downloaded: $SERVLET_API_JAR"
    return 0
  fi

  # 3) Last resort: copy from running container
  if ! use_native_toolchain; then
    echo "servlet-api.jar download failed; copying from running idempiere-app container..."
    local jar_path
    jar_path="$(docker exec idempiere-app sh -c 'for f in /opt/idempiere/plugins/org.eclipse.jetty.servlet-api_*.jar; do echo \"$f\"; break; done')"

    if [ -z "$jar_path" ]; then
      echo "ERROR: Could not locate org.eclipse.jetty.servlet-api_*.jar in idempiere-app"
      exit 1
    fi

    docker cp "idempiere-app:$jar_path" "$SERVLET_API_JAR"
    return 0
  fi

  echo "ERROR: servlet-api.jar not found."
  echo "       Put a servlet-api jar into: $SERVLET_API_JAR"
  exit 1
}

ensure_servlet_api_jar

# 0. Build UI (if available)
build_ui_if_possible

# 1. Compile Java Source
echo "Compiling Java sources..."
if use_native_toolchain; then
  javac -cp "$SERVLET_API_JAR" -d "$BUILD_CLASSES_DIR" \
    "$PLUGIN_DIR/src/tw/mxp/emui/SpaFilter.java" \
    "$PLUGIN_DIR/src/tw/mxp/emui/SpaServlet.java"
else
  run_in_jdk javac -cp lib/servlet-api.jar -d build/classes \
    src/tw/mxp/emui/SpaFilter.java \
    src/tw/mxp/emui/SpaServlet.java
fi

# 2. Prepare Config
echo "Preparing configuration..."
cp "$PLUGIN_DIR/WEB-INF/web.xml" "$BUILD_WEBINF_DIR/"

# 3. Create JAR
echo "Creating JAR..."
# Prefer direct web root (web-content/). Keep legacy fallback to web-content/dist if present.
WEB_CONTENT_SOURCE="web-content"
if [ -f "$WEB_CONTENT_DIR/index.html" ]; then
  WEB_CONTENT_SOURCE="web-content"
elif [ -f "$WEB_CONTENT_DIR/dist/index.html" ]; then
  WEB_CONTENT_SOURCE="web-content/dist"
else
  echo "ERROR: web content not found. Expected $WEB_CONTENT_DIR/index.html (or legacy $WEB_CONTENT_DIR/dist/index.html)."
  echo "       Please run: (cd \"$PLUGIN_DIR/ui\" && npm ci && npm run build)"
  exit 1
fi

echo "Using web content from: $WEB_CONTENT_SOURCE"

# Build jar args for web content (exclude dotfiles like .gitkeep)
WEB_CONTENT_HOST_DIR="$PLUGIN_DIR/$WEB_CONTENT_SOURCE"
WEB_CONTENT_CONTAINER_DIR="$WEB_CONTENT_SOURCE"

web_content_jar_args_host=(-C "$WEB_CONTENT_HOST_DIR" index.html)
web_content_jar_args_container=(-C "$WEB_CONTENT_CONTAINER_DIR" index.html)

if [ -d "$WEB_CONTENT_HOST_DIR/assets" ]; then
  web_content_jar_args_host+=(-C "$WEB_CONTENT_HOST_DIR" assets)
  web_content_jar_args_container+=(-C "$WEB_CONTENT_CONTAINER_DIR" assets)
fi

# -C build/classes .  -> Puts com/... at root
# -C build WEB-INF    -> Puts WEB-INF/web.xml at WEB-INF/web.xml
# -C web-content/...  -> Puts index.html etc at root
if use_native_toolchain; then
  jar cvfm "$WORKSPACE_DIR/plugins/$JAR_NAME" "$PLUGIN_DIR/META-INF/MANIFEST.MF" \
    -C "$BUILD_CLASSES_DIR" . \
    -C "$BUILD_DIR" WEB-INF \
    "${web_content_jar_args_host[@]}"
else
  run_in_jdk jar cvfm "../$JAR_NAME" META-INF/MANIFEST.MF -C build/classes . -C build WEB-INF "${web_content_jar_args_container[@]}"
fi

# 4. Deploy
echo "Deploying to iDempiere..."
if use_native_toolchain; then
  echo "Built JAR: $WORKSPACE_DIR/plugins/$JAR_NAME"
  echo "Please restart your iDempiere instance to load the plugin."
  exit 0
fi

# Docker toolchain path
if [ "$DO_DEPLOY" -eq 1 ]; then
  docker cp "$WORKSPACE_DIR/plugins/$JAR_NAME" idempiere-app:/opt/idempiere/plugins/
  echo "Deployed: $JAR_NAME -> idempiere-app:/opt/idempiere/plugins/"
else
  echo "Skipping deploy (--no-deploy). Built JAR: $WORKSPACE_DIR/plugins/$JAR_NAME"
fi

if [ "$DO_DEPLOY" -eq 1 ] && [ "$DO_RESTART" -eq 1 ]; then
  echo "Restarting iDempiere..."
  docker restart idempiere-app

  # Wait for iDempiere to be ready (max 30 seconds)
  echo "Waiting for iDempiere to start..."
  MAX_WAIT=30
  WAIT_INTERVAL=2
  ELAPSED=0
  HEALTH_URL="http://localhost:8080/api/v1/auth"

  # Initial wait for container to start
  sleep $WAIT_INTERVAL
  ELAPSED=$WAIT_INTERVAL

  while [ $ELAPSED -le $MAX_WAIT ]; do
    echo "  checking... (${ELAPSED}s / ${MAX_WAIT}s)"
    
    # Use curl with short timeout; capture HTTP code only
    HTTP_CODE=""
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 5 "$HEALTH_URL" 2>/dev/null) || true
    
    # Check if we got a valid HTTP response (3 digits, not 000/502/503)
    if [ -n "$HTTP_CODE" ] && [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "502" ] && [ "$HTTP_CODE" != "503" ]; then
      echo "✓ iDempiere is ready! (HTTP $HTTP_CODE after ${ELAPSED}s)"
      echo ""
      echo "Access at http://localhost:8080/emui/"
      exit 0
    fi

    sleep $WAIT_INTERVAL
    ELAPSED=$((ELAPSED + WAIT_INTERVAL))
  done

  echo "⚠ Timeout: iDempiere did not respond within ${MAX_WAIT}s"
  echo "  Check logs: docker logs -f idempiere-app"
  echo "  URL: http://localhost:8080/emui/"
  exit 1
else
  if [ "$DO_RESTART" -eq 0 ]; then
    echo "Skipping restart (SSH detected or --no-restart)."
  else
    echo "Skipping restart (deploy disabled)."
  fi
  echo "If needed, restart manually: docker restart idempiere-app"
fi
