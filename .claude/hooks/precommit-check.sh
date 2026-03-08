#!/bin/bash
# Pre-commit hook for Claude Code
# Runs lint + type-check + tests before any git commit

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -q "git commit"; then
    export PATH="/c/Program Files/nodejs:$PATH"
    echo "Running npm run check before commit..."
    npm run check 2>&1
    if [ $? -ne 0 ]; then
        echo "npm run check failed. Commit blocked." >&2
        exit 2
    fi
fi

exit 0
