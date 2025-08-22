#!/bin/bash
# Usage: ./update-gitignore.sh [prod|dev]
# Updates .gitignore and removes/keeps files as specified.

set -e


MODE="$1"
FILES=("index.html" "plugins-data.json")
GITIGNORE=".gitignore"


# Helper: check if a file is in .gitignore
is_ignored() {
  grep -Fxq "$1" "$GITIGNORE"
}

if [[ "$MODE" == "dev" ]]; then
  # Add files to .gitignore if not present
  for f in "${FILES[@]}"; do
    if ! is_ignored "$f"; then
      echo "$f" >> "$GITIGNORE"
      echo "Added $f to $GITIGNORE"
    fi
    # Remove file from repo if tracked
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git rm --cached "$f"
      echo "Removed $f from repo index"
    fi
    # Remove file from working directory if present
    if [[ -f "$f" ]]; then
      rm "$f"
      echo "Deleted $f from working directory"
    fi
  done
elif [[ "$MODE" == "prod" ]]; then
  # Remove files from .gitignore if present
  TMP=$(mktemp)
  cp "$GITIGNORE" "$TMP"
  for f in "${FILES[@]}"; do
    grep -Fxv "$f" "$TMP" > "$TMP.new" && mv "$TMP.new" "$TMP"
  done
  if ! cmp -s "$TMP" "$GITIGNORE"; then
    mv "$TMP" "$GITIGNORE"
    echo "Updated $GITIGNORE (removed dev ignores)"
  else
    rm "$TMP"
    echo "$GITIGNORE already conforms (prod)"
  fi
else
  echo "Invalid mode: $MODE"
  echo "Usage: ./update-gitignore.sh [prod|dev]"
  exit 1
fi
