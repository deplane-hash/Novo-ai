#!/usr/bin/env bash
set -e

BASE="https://freedomhub.at"
TAR="$BASE/dl/nova-0.1.0.tgz"

echo "  ⚡ Nova — AI workspace client"
echo "  Installing for this machine..."

if ! command -v node >/dev/null 2>&1; then
  echo "  • Node.js not found, installing LTS..."
  if command -v brew >/dev/null 2>&1; then
    brew install node@22
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm nodejs npm
  else
    echo "  Please install Node.js 18+ from https://nodejs.org and rerun." >&2
    exit 1
  fi
fi
command -v npm >/dev/null 2>&1 || { echo "  npm missing. Install Node.js 18+ and rerun." >&2; exit 1; }

TMP="$(mktemp -d)"
echo "  • Downloading client..."
curl -fsSL -o "$TMP/nova.tgz" "$TAR"
echo "  • Installing..."
npm i -g "$TMP/nova.tgz" >/dev/null

echo ""
echo "  ✔ Nova installed!"
echo "  Run it with:  nova"
echo "  (opens your browser; add your API key on first launch)"