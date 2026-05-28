# Nextcloud Talk Integration

This document describes the Nextcloud Talk API integration for OpenClaw.

## Prerequisites

### Bot Setup (Required for Bot Features)

Before using bot features, you need to install a bot on your Nextcloud server:

```bash
# SSH into your Nextcloud server and run:
./occ talk:bot:install \
  --feature webhook --feature response \
  "OpenClaw Bot" "your-shared-secret-123" \
  "https://your-webhook-endpoint.com/nextcloud" \
  "Bot for OpenClaw AI assistant"
```

This creates a bot that:
- Receives chat messages via webhooks (`webhook` feature)
- Can send messages and reactions (`response` feature)

Get the bot ID from the output or list bots with:
```bash
./occ talk:bot:list
```

## API User Configuration

The OpenClaw skill uses your existing Nextcloud API credentials:
- `NEXTCLOUD_URL`: Your Nextcloud instance URL
- `NEXTCLOUD_USER`: Your Nextcloud username
- `NEXTCLOUD_TOKEN`: Your app password (not your account password)

**For bot features**, you can optionally set:
- `NEXTCLOUD_BOT_ID`: The bot's numeric ID from server

## Available Commands

### 1. List Conversations
```bash
node scripts/nextcloud.js talk list
```

### 2. Get Conversation Details
```bash
node scripts/nextcloud.js talk get --token ABC123
```

### 3. Create Conversation
```bash
# Create a group conversation
node scripts/nextcloud.js talk create --name "Project Team" --type group

# Create a public conversation
node scripts/nextcloud.js talk create --name "Community Chat" --type public

# Create with description and password
node scripts/nextcloud.js talk create \
  --name "Secret Project" \
  --type group \
  --description "Private project discussion" \
  --password "secure-password"
```

**Conversation Types:**
- `group` (default): Private group conversation
- `public`: Publicly accessible conversation
- `note-to-self`: Personal notes conversation

### 4. Delete Conversation
```bash
node scripts/nextcloud.js talk delete --token ABC123
```

### 5. List Messages
```bash
# Get last 50 messages
node scripts/nextcloud.js talk messages --token ABC123 --limit 50

# Poll for new messages (lookIntoFuture=1)
node scripts/nextcloud.js talk messages --token ABC123 --look-into-future 1
```

### 6. Send Message
```bash
# Send a basic message
node scripts/nextcloud.js talk send --token ABC123 --message "Hello team!"

# Reply to a specific message
node scripts/nextcloud.js talk send --token ABC123 --message "Me too!" --reply-to 1567
```

### 7. Edit Message
```bash
node scripts/nextcloud.js talk edit-message \
  --token ABC123 \
  --message-id 1567 \
  --message "Updated message content"
```

### 8. Delete Message
```bash
node scripts/nextcloud.js talk delete-message --token ABC123 --message-id 1567
```

### 9. List Bots
```bash
# List all bots on server
node scripts/nextcloud.js talk list-bots

# List bots enabled in a specific room
node scripts/nextcloud.js talk list-bots --token ABC123
```

### 10. Enable Bot in Room
```bash
node scripts/nextcloud.js talk enable-bot --token ABC123 --bot-id 5
```

### 11. Disable Bot in Room
```bash
node scripts/nextcloud.js talk disable-bot --token ABC123 --bot-id 5
```

## Environment Variables

```bash
# Required (standard API credentials)
NEXTCLOUD_URL="https://your-nextcloud.com"
NEXTCLOUD_USER="your-username"
NEXTCLOUD_TOKEN="your-app-password"

# Optional (bot configuration)
NEXTCLOUD_BOT_ID="5"  # Bot ID from server
```

## Example Workflow

### Create a Room and Enable Bot
```bash
# 1. Create a new room
RESULT=$(node scripts/nextcloud.js talk create --name "Project Alpha" --type public)

# 2. Extract token from output and enable bot
node scripts/nextcloud.js talk enable-bot --token <token> --bot-id <bot-id>
```

### Monitor Chat for Messages
```bash
# Poll for new messages
node scripts/nextcloud.js talk messages --token ABC123 --look-into-future 1
```

### Send Message with Bot
```bash
# If bot is enabled, it can also send messages via webhook
# (Requires NEXTCLOUD_BOT_ID to be set on the server)
```

## Bot Auto-Enable

When creating rooms, you can configure the bot to auto-enable:

```bash
# After room creation, enable bot automatically
node scripts/nextcloud.js talk create --name "New Room" --type public
node scripts/nextcloud.js talk list-bots --token <room-token>  # Verify bot is enabled
```

## Notes

- **Permissions**: You need moderator/owner permissions to enable/disable bots in rooms
- **Bot Installation**: Requires admin access via OCC command on the Nextcloud server
- **Webhook URL**: Your bot's webhook URL must be reachable from your Nextcloud server
