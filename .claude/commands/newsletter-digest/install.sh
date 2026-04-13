#!/bin/bash
# Newsletter Digest Skill Installer
# Copies the skill into your Claude Code commands directory

set -e

SKILL_DIR="$HOME/.claude/commands/newsletter-digest"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Newsletter Digest skill..."

# Create target directory
mkdir -p "$SKILL_DIR"

# Copy skill files
cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"
cp "$SCRIPT_DIR/SETUP.md" "$SKILL_DIR/SETUP.md"

echo ""
echo "Installed to $SKILL_DIR"
echo ""
echo "Usage:"
echo "  /newsletter-digest     — Run diagnosis + recommendations"
echo "  /loop 7d /newsletter-digest  — Run weekly on autopilot"
echo ""
echo "Prerequisites:"
echo "  You need a Gmail MCP server configured."
echo "  See SETUP.md for instructions, or run the skill and it will guide you."
echo ""
echo "Done."
