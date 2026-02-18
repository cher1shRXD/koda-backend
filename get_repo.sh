#!/usr/bin/env bash
set -e

REPO_URL="$1"
TARGET_DIR="$2"

if [ -z "$REPO_URL" ] || [ -z "$TARGET_DIR" ]; then
  echo "Usage: $0 <repo_url> <target_dir>"
  exit 1
fi

mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

TARBALL_URL=$(echo "$REPO_URL" | sed -E 's#https://github.com/#https://api.github.com/repos/#')"/tarball"

curl -sL "$TARBALL_URL" -o repo.tar.gz

tar -xzf repo.tar.gz
rm repo.tar.gz

DIR=$(find . -maxdepth 1 -type d ! -name "." | head -n 1)

if [ -z "$DIR" ]; then
  echo "Extraction failed"
  exit 1
fi

# Generate tree.txt for faster analysis
(cd "$DIR" && tree -a -L 4 -I "node_modules|.git" > tree.txt)

echo "Repository downloaded to: $(pwd)/$DIR"
