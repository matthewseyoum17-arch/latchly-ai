#!/usr/bin/env bash
# scripts/latchly-leads/setup-skills.sh
#
# Idempotent symlink installer. The bespoke demo pipeline spawns
# `claude -p` subprocesses that need to invoke skills by name
# (huashu-design, ui-ux-pro-max, karpathy-guidelines,
# site-content-latchly). The CLI looks at ~/.claude/skills/ first.
# This script finds the plugin-cached skill dirs and symlinks them
# into ~/.claude/skills/ so the subprocess always sees them.
#
# Run once after cloning the repo, and re-run after `claude` plugin
# updates if any skill paths change. Safe to re-run — existing
# correct symlinks are left alone.

set -euo pipefail

SKILLS_DIR="${HOME}/.claude/skills"
PLUGIN_CACHE="${HOME}/.claude/plugins/cache"

mkdir -p "$SKILLS_DIR"

link_skill() {
  local name="$1"
  local target="$SKILLS_DIR/$name"

  # Find the first directory inside the plugin cache that ends with
  # /<name> — plugin paths look like
  # ~/.claude/plugins/cache/<plugin-id>/<version>/.../<skill-name>/
  local source
  source="$(find "$PLUGIN_CACHE" -type d -name "$name" 2>/dev/null | head -n 1 || true)"

  if [[ -z "$source" ]]; then
    echo "[setup-skills] WARN: $name not found in $PLUGIN_CACHE — skipping" >&2
    return 0
  fi

  if [[ -L "$target" ]]; then
    local current
    current="$(readlink "$target")"
    if [[ "$current" == "$source" ]]; then
      echo "[setup-skills] OK: $name already linked → $source"
      return 0
    fi
    rm "$target"
  elif [[ -e "$target" ]]; then
    echo "[setup-skills] WARN: $target exists and is not a symlink — leaving alone" >&2
    return 0
  fi

  ln -s "$source" "$target"
  echo "[setup-skills] linked: $name → $source"
}

link_skill "huashu-design"
link_skill "ui-ux-pro-max"
link_skill "karpathy-guidelines"
link_skill "site-content-latchly"
link_skill "cold-email-latchly"

echo "[setup-skills] done. Skills available in: $SKILLS_DIR"
