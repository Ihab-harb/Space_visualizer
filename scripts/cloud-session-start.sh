#!/bin/bash
# SessionStart hook (.claude/settings.json). Runs in cloud sessions only
# (Claude Code on the web); on a local machine it exits at once.
#
# 1. Puts Node 24 on the PATH for the session. The project needs Node >= 24 and
#    cloud machines ship 20-22. The environment's setup script normally installs
#    it in /opt/node24; if it did not, Node 24 is fetched here from nodejs.org.
# 2. Runs `npm ci` when package.json, package-lock.json or this script changed
#    since the last install.
#
# It always exits 0, so a failure is reported but never blocks the session.
# See Space_visualizer/Cloud sessions.md.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
[ "$(uname -s)" = "Linux" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
NODE_DIR=/opt/node24

install_node() {
  local base=https://nodejs.org/dist/latest-v24.x tmp file
  tmp=$(mktemp -d) || return 1
  curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" || return 1
  file=$(grep -o 'node-v24[0-9.]*-linux-x64\.tar\.xz' "$tmp/SHASUMS256.txt" | head -1)
  [ -n "$file" ] || return 1
  curl -fsSL "$base/$file" -o "$tmp/$file" || return 1
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum --check --status) || return 1
  mkdir -p "$NODE_DIR" && tar -xJf "$tmp/$file" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
}

if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "Node 24 not found in $NODE_DIR; installing it from nodejs.org." >&2
  install_node || echo "WARNING: could not install Node 24." >&2
fi

if [ -x "$NODE_DIR/bin/node" ]; then
  export PATH="$NODE_DIR/bin:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
else
  echo "WARNING: Node 24 is missing. The project needs Node >= 24; tests may fail." >&2
fi

hashes=node_modules/.cloud-install.sha256
deps=cached
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if npm ci --no-audit --no-fund; then
    sha256sum package.json package-lock.json scripts/cloud-session-start.sh > "$hashes"
    deps=installed
  else
    deps=FAILED
    echo "WARNING: npm ci failed. Run it by hand and read the error." >&2
  fi
fi

echo "cloud session ready: node $(node --version 2>/dev/null || echo missing), deps $deps"
exit 0
