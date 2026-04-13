# Gmail MCP Setup

This skill needs a Gmail MCP server to read your inbox. Here's how to set one up.

## Option 1: Google Workspace MCP (Recommended)

The simplest path if you use Gmail.

### 1. Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**: APIs & Services > Library > search "Gmail API" > Enable
4. Create OAuth credentials: APIs & Services > Credentials > Create Credentials > OAuth Client ID
   - Application type: **Desktop app** (or Web app if you prefer)
   - Note your **Client ID** and **Client Secret**
5. Configure OAuth consent screen:
   - User type: External (or Internal if on Workspace)
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add yourself as a test user

### 2. Install a Gmail MCP server

Pick one:

```bash
# Option A: google-mcp (if available)
npm install -g @anthropic/google-mcp

# Option B: Community Gmail MCP
npm install -g gmail-mcp-server

# Option C: Use npx (no install)
# Just reference it directly in the config below
```

### 3. Add to Claude Code settings

Open your Claude Code MCP settings and add:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["gmail-mcp-server"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
```

You can add this via:
- Claude Code CLI: `claude mcp add gmail -- npx gmail-mcp-server`
- Or edit `~/.claude/settings.json` directly
- Or use `/settings` in Claude Code

### 4. Authenticate

The first time the MCP server runs, it will open a browser for Google OAuth. Sign in and grant read-only Gmail access.

### 5. Verify

Run `/newsletter-digest` — if it can search your emails, you're good.

## Option 2: IMAP-based MCP

If you don't want to use Google Cloud, some MCP servers support IMAP:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["imap-mcp-server"],
      "env": {
        "IMAP_HOST": "imap.gmail.com",
        "IMAP_PORT": "993",
        "IMAP_USER": "you@gmail.com",
        "IMAP_PASS": "your-app-password"
      }
    }
  }
}
```

For Gmail with IMAP, you'll need an [App Password](https://myaccount.google.com/apppasswords) (requires 2FA enabled).

## Troubleshooting

**"Gmail MCP not found"**
- Check that the MCP server is listed in your settings: `cat ~/.claude/settings.json`
- Restart Claude Code after adding the MCP config

**"Authentication failed"**
- Re-run the OAuth flow or regenerate your app password
- Make sure Gmail API is enabled in Google Cloud Console
- Check that your OAuth consent screen has the gmail.readonly scope

**"No emails found"**
- The MCP server might not have the right permissions
- Try searching manually: use the Gmail MCP search tool with query `newer_than:1d`

## Security Notes

- This skill only needs **read-only** access to Gmail. Never grant write/send permissions.
- Your OAuth tokens are stored locally by the MCP server.
- The preferences file (`~/.claude/newsletter-prefs.json`) stays on your machine.
- No data is sent anywhere except to Claude for analysis during skill execution.
