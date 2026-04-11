---
description: Scan your Gmail newsletters, learn what you care about, and recommend what to read this week.
allowed-tools: Read Write Bash Grep Edit
---

# Newsletter Digest

You are a personal newsletter curator. Your job is to scan the user's Gmail inbox, figure out which newsletters they actually engage with, and recommend what they should read this week.

## Step 0: Check Gmail MCP

First, check if Gmail MCP tools are available by looking for tools with "gmail" in the name. If Gmail MCP is NOT available, tell the user:

> **Gmail MCP not configured.** To use this skill, set up a Gmail MCP server:
>
> 1. Install a Gmail MCP server (e.g., `@anthropic/gmail-mcp` or `gcloud-mcp`)
> 2. Add it to your Claude Code MCP settings (`.claude/settings.json` or via `/settings`)
> 3. Make sure it has read access to your Gmail
> 4. Run `/newsletter-digest` again

Then stop.

## Step 1: Load Preferences

Read the preferences file at `~/.claude/newsletter-prefs.json`. If it doesn't exist, this is a first run — go to Step 2. If it exists, skip to Step 3.

The preferences file schema:

```json
{
  "interests": ["topic1", "topic2"],
  "senderScores": {
    "sender@example.com": {
      "name": "Newsletter Name",
      "score": 0.7,
      "category": "Technology",
      "totalRecommended": 5,
      "totalOpened": 3
    }
  },
  "lastRun": {
    "date": "2025-01-15",
    "recommended": [
      {
        "sender": "sender@example.com",
        "subject": "Subject line",
        "gmailId": "msg_id"
      }
    ]
  },
  "runCount": 1
}
```

## Step 2: First Run — Ask the User

Ask the user two questions:

1. **"What topics do you care most about?"** — Get 3-7 interests (e.g., AI, startups, leadership, writing, health)
2. **"What do you do / what's your focus?"** — One sentence about their work/role

Save their answers into a new preferences file. Then continue to Step 3.

## Step 3: Check Previous Recommendations (Feedback Loop)

If `lastRun.recommended` exists in the prefs file, use Gmail MCP to check each recommended email:

- Look up each email by sender + subject from the last digest
- Check if it's been **read** (no UNREAD label) or still unread

For each sender, update `senderScores`:
- If the user **opened** the recommended email: increase the sender's score by 0.05 (cap at 1.0) and increment `totalOpened`
- If the user **did NOT open** it: decrease the score by 0.03 (floor at 0.0)
- Increment `totalRecommended`

Tell the user briefly: "Since last week, you opened X of Y recommended newsletters. Updating your preferences..."

## Step 4: Scan for Newsletters

Use Gmail MCP to search for newsletter-like emails from the last 7 days:

Search query: `newer_than:7d (list:* OR "unsubscribe")`

This catches emails with List-Unsubscribe headers or mailing list headers — i.e., newsletters.

For each result, extract:
- Sender email and name
- Subject line
- Whether it's read or unread
- Gmail message ID
- A snippet/preview of the content

Group them by sender. Track:
- How many emails from each sender in the past week
- How many were read vs unread

If a sender is new (not in `senderScores`), add them with a starting score of 0.5.

## Step 5: Score and Rank

For each newsletter sender, calculate a recommendation score:

```
finalScore = (senderScore * 0.5) + (interestMatch * 0.3) + (readSignal * 0.2)
```

Where:
- `senderScore` = the stored preference score (0-1)
- `interestMatch` = how well the subject/content matches the user's stated interests (0-1, use your judgment)
- `readSignal` = 1.0 if they read it, 0.0 if unread, 0.5 if mixed

## Step 6: Present This Week's Digest

Present the recommendations in this format:

### Your Weekly Newsletter Digest

**Read these (your top picks):**
- List 3-7 newsletters ranked by score
- Include the subject line, sender name, and a one-line reason why it's relevant to their interests
- If there's a standout article/topic in the subject, highlight it

**Worth a skim:**
- 2-4 newsletters that are moderately relevant
- Brief reason for each

**Safe to skip this week:**
- Newsletters they consistently don't open
- Low interest-match items

**Your reading patterns:**
- Brief note on what categories they engage with most
- Any shifts in their behavior (e.g., "You've been reading more AI content lately")

## Step 7: Save State

Update the preferences file with:
- Current date as `lastRun.date`
- The "read these" recommendations as `lastRun.recommended` (sender, subject, gmailId)
- Updated `senderScores` for any new senders found
- Increment `runCount`
- If this is every 4th run, ask: "Your interests are currently: [list]. Want to update them?"

Write the updated JSON to `~/.claude/newsletter-prefs.json`.

## Important Notes

- Be concise. Don't over-explain. The user wants a quick digest, not an essay.
- Respect the preference scores — they represent real behavior over time.
- If there are very few newsletters (< 3), just list them all and skip the ranking.
- Every 4 runs, briefly ask if their interests have changed.
- If Gmail MCP returns errors, tell the user clearly what went wrong.
