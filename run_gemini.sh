#!/usr/bin/env bash
set -e

PROMPT_PATH="$1"
OUTPUT_PATH="$2"

# Copy prompt.txt to current directory (repoPath)
if [ ! -f "./prompt.txt" ]; then
  cp "$PROMPT_PATH" ./prompt.txt
fi

# Remove any existing profile.json to avoid confusion
rm -f ./profile.json

# Run gemini, which will write profile.json to the current directory (repoPath)
gemini --model gemini-2.5-flash --prompt ./prompt.txt --approval-mode yolo

# Move the generated profile.json to the requested output path (workOutputDir/profile.json)
if [ -f ./profile.json ]; then
  mv ./profile.json "$OUTPUT_PATH"
fi