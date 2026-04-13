# /newsletter-curator

A Claude Code skill that scans your Gmail, inventories all your newsletter subscriptions, and curates what's actually worth reading each week.

## What It Does

**First run (diagnosis):**
1. Scans your Gmail for every newsletter you're subscribed to
2. Categorizes each one by how it presents itself (Tech/AI, Business, News, etc.)
3. Shows you open rates, subscription age, and frequency for each
4. Asks what you want to learn about and what you do
5. Compares your inbox against your stated interests — shows matches, mismatches, and gaps
6. Recommends what to keep, drop, and what's missing

**Every run after (weekly curation):**
1. Checks if you read last week's recommendations (feedback loop)
2. Scans this week's newsletters
3. Scores and ranks by your preferences + actual behavior
4. Gives you a "read these / skim these / skip these" curation
5. Updates your preference scores based on what you actually open over time

## Install

**Option A — In any repo:**
```bash
# Clone or copy this directory into your project
cp -r newsletter-curator/ .claude/commands/newsletter-curator/
```

**Option B — Global install (available everywhere):**
```bash
./install.sh
```

**Option C — Just grab the skill file:**
```bash
mkdir -p ~/.claude/commands/newsletter-curator
curl -o ~/.claude/commands/newsletter-curator/SKILL.md <raw-url>
curl -o ~/.claude/commands/newsletter-curator/SETUP.md <raw-url>
```

## Prerequisites

You need a **Gmail MCP server** configured in Claude Code. The skill will detect this automatically and guide you through setup if it's missing.

See [SETUP.md](SETUP.md) for detailed instructions.

## Usage

```
/newsletter-curator          # Run the full flow
/loop 7d /newsletter-curator # Auto-run every 7 days
```

## How It Learns

- **Open rate tracking:** Each run checks which recommended emails you actually opened in Gmail
- **Score adjustment:** Senders you engage with get higher scores over time, ignored ones decay
- **Interest matching:** Your stated interests are compared against newsletter content
- **No external services:** Everything stays local in `~/.claude/newsletter-curator.json`

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | The skill prompt — this is what Claude executes |
| `SETUP.md` | Gmail MCP setup instructions |
| `install.sh` | Copies the skill to `~/.claude/commands/` |
| `README.md` | This file |

## Data Storage

Preferences are stored at `~/.claude/newsletter-curator.json`. This file contains:
- Your stated interests and role
- Newsletter inventory (names, categories, scores)
- Engagement history (open rates, recommendation follow-through)
- Last run timestamps

No data leaves your machine except during skill execution (sent to Claude for analysis).
