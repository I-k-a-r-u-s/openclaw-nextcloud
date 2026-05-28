# Testing the Talk Integration

## Quick Test

1. Set your environment variables:
```bash
export NEXTCLOUD_URL="https://your-nextcloud.com"
export NEXTCLOUD_USER="your-username"
export NEXTCLOUD_TOKEN="your-app-password"
```

2. Test listing conversations:
```bash
node scripts/nextcloud.js talk list
```

3. Test creating a conversation:
```bash
node scripts/nextcloud.js talk create --name "Test Room" --type group
```

4. Test sending a message:
```bash
node scripts/nextcloud.js talk send --token <token> --message "Hello from OpenClaw!"
```

## Automated Test Script

Run the test script:
```bash
# Set env vars first
export NEXTCLOUD_URL="https://your-nextcloud.com"
export NEXTCLOUD_USER="your-username"
export NEXTCLOUD_TOKEN="your-app-password"

# Run tests
./test-talk.sh
```

This will:
- List all conversations
- Create a test conversation
- List messages
- Send a test message
- Get conversation details
- List bots
- Clean up by deleting the test conversation

## Expected Output

### List Conversations
```json
{
  "status": "success",
  "data": [
    {
      "id": 42,
      "token": "abc123",
      "name": "Project Team",
      ...
    }
  ]
}
```

### Create Conversation
```json
{
  "status": "success",
  "data": {
    "id": 43,
    "token": "xyz789",
    "name": "Test Room",
    "type": 2,
    ...
  }
}
```

### Send Message
```json
{
  "status": "success",
  "data": {
    "id": 1567,
    "token": "xyz789",
    "message": "Hello from OpenClaw!",
    ...
  }
}
```

## Troubleshooting

### "Missing configuration" error
Make sure all three env vars are set:
- `NEXTCLOUD_URL`
- `NEXTCLOUD_USER`
- `NEXTCLOUD_TOKEN`

### "HTTP 401 Unauthorized"
Check your app password is correct and has not expired.

### "HTTP 403 Forbidden" on bot commands
You need moderator/owner permissions in the conversation to enable/disable bots.
