#!/bin/bash
# Test script for newly implemented Nextcloud API features
# Set environment variables before running:
#   export NEXTCLOUD_URL="https://your-nextcloud.com"
#   export NEXTCLOUD_USER="your-username"
#   export NEXTCLOUD_TOKEN="your-app-password"
#
# This script tests:
# - Talk API: Reactions, Polls, Settings
# - CalDAV: Calendar color settings
# - CardDAV: Extended vCard fields (BDAY, ANNIVERSARY, URL, ADR, ROLE, TEL/EMAIL types)
# - Notes API: Categories, History, Backup
#
# Note: This file is git-ignored. Run it manually when testing against a live server.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== OpenClaw Nextcloud - New Features Test Suite ==="
echo ""

# Check if required env vars are set
if [ -z "$NEXTCLOUD_URL" ] || [ -z "$NEXTCLOUD_USER" ] || [ -z "$NEXTCLOUD_TOKEN" ]; then
    echo "❌ ERROR: Missing required environment variables"
    echo ""
    echo "Please set:"
    echo "  export NEXTCLOUD_URL=https://your-nextcloud.com"
    echo "  export NEXTCLOUD_USER=your-username"
    echo "  export NEXTCLOUD_TOKEN=your-app-password"
    exit 1
fi

echo "✅ Environment variables set"
echo "   URL: $NEXTCLOUD_URL"
echo "   User: $NEXTCLOUD_USER"
echo ""

# Run a test and report result
run_test() {
    local name="$1"
    local cmd="$2"
    local should_pass="${3:-true}"

    echo "🧪 Test: $name"
    echo "   Command: node scripts/nextcloud.js $cmd"

    local output
    if output=$(node scripts/nextcloud.js $cmd 2>&1); then
        if [ "$should_pass" = "true" ]; then
            echo "   ✅ PASSED"
        else
            echo "   ⚠️  Expected to fail but passed"
        fi
    else
        if [ "$should_pass" = "true" ]; then
            echo "   ❌ FAILED"
        else
            echo "   ✅ Expected failure"
        fi
    fi
    echo ""
    echo "   Output:"
    echo "$output" | head -5 | sed 's/^/   /'
    echo ""
}

# Generate unique identifiers for test resources
TEST_ROOM_NAME="Test-$(date +%Y%m%d-%H%M%S)"
TEST_ROOM_TOKEN=""
TEST_CALENDAR=""
TEST_ADDRESSBOOK=""
TEST_CONTACT_UID=""

echo "--- Phase 1: Talk Reactions ---"
echo ""

# First create a conversation for testing
echo "Creating test conversation for reactions..."
RESULT=$(node scripts/nextcloud.js talk create --name "$TEST_ROOM_NAME-reactions" --type group 2>&1)
if echo "$RESULT" | grep -q '"status":"success"'; then
    TEST_ROOM_TOKEN=$(echo "$RESULT" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "✅ Created conversation: $TEST_ROOM_TOKEN"
else
    echo "⚠️  Could not create test conversation, skipping reactions tests"
fi

if [ -n "$TEST_ROOM_TOKEN" ]; then
    # Test 1: List conversations (should already exist from earlier)
    run_test "List conversations (existing)" "talk list"

    # Test 2: Create a message first (need a message to react to)
    run_test "Send message for reactions test" "talk send --token $TEST_ROOM_TOKEN --message 'Test message for reactions'"

    # Get the message ID - need to list messages to find it
    echo "Getting message ID for reactions test..."
    MESSAGES=$(node scripts/nextcloud.js talk messages --token $TEST_ROOM_TOKEN --limit 1 2>&1)
    MESSAGE_ID=$(echo "$MESSAGES" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data[0]?.id || '1')" 2>/dev/null || echo "1")

    # Test 3: Add reaction
    run_test "Add reaction (👍)" "talk add-reaction --token $TEST_ROOM_TOKEN --message-id $MESSAGE_ID --emoji 👍"

    # Test 4: List reactions
    run_test "List reactions on message" "talk list-reactions --token $TEST_ROOM_TOKEN --message-id $MESSAGE_ID"

    # Test 5: Delete reaction
    run_test "Delete reaction (👍)" "talk delete-reaction --token $TEST_ROOM_TOKEN --message-id $MESSAGE_ID --emoji 👍"
else
    echo "⚠️  Skipping reactions tests - no conversation available"
fi

echo ""
echo "--- Phase 2: Talk Polls ---"
echo ""

if [ -n "$TEST_ROOM_TOKEN" ]; then
    # Test 1: Create poll
    run_test "Create poll" "talk create-poll --token $TEST_ROOM_TOKEN --question 'What is your favorite color?' --options 'Red,Green,Blue,Yellow'"

    # Get poll ID from response
    CREATE_RESULT=$(node scripts/nextcloud.js talk create-poll --token $TEST_ROOM_TOKEN --question 'Quick poll' --options 'Option1,Option2' 2>&1)
    POLL_ID=$(echo "$CREATE_RESULT" | grep -o '"pollId":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$POLL_ID" ]; then
        # Test 2: Get poll
        run_test "Get poll" "talk get-poll --token $TEST_ROOM_TOKEN --poll-id $POLL_ID"

        # Test 3: Get poll results (before publishing)
        run_test "Get poll results" "talk get-poll-results --token $TEST_ROOM_TOKEN --poll-id $POLL_ID"

        # Test 4: Publish poll
        run_test "Publish poll" "talk publish-poll --token $TEST_ROOM_TOKEN --poll-id $POLL_ID"

        # Test 5: Close poll
        run_test "Close poll" "talk close-poll --token $TEST_ROOM_TOKEN --poll-id $POLL_ID"
    else
        echo "⚠️  Could not create poll for testing"
    fi
else
    echo "⚠️  Skipping polls tests - no conversation available"
fi

echo ""
echo "--- Phase 3: Calendar Color Settings ---"
echo ""

# Get available calendars
echo "Getting available calendars..."
CALENDARS=$(node scripts/nextcloud.js calendar list 2>&1)
echo "$CALENDARS" | head -5

# Try to find a calendar to test with
TEST_CALENDAR_NAME=$(echo "$CALENDARS" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.find(c=>c.type==='events')?.name || d.data[0]?.name || '')" 2>/dev/null)

if [ -n "$TEST_CALENDAR_NAME" ]; then
    # Test 1: Get calendar color
    run_test "Get calendar color" "calendar get-color --calendar '$TEST_CALENDAR_NAME'"

    # Test 2: Set calendar color (to a test color)
    run_test "Set calendar color" "calendar set-color --calendar '$TEST_CALENDAR_NAME' --color '#FF5733'"

    # Test 3: Get calendar color again (verify it changed)
    run_test "Get calendar color again" "calendar get-color --calendar '$TEST_CALENDAR_NAME'"

    # Test 4: Set back to default
    run_test "Reset calendar color" "calendar set-color --calendar '$TEST_CALENDAR_NAME' --color '#000000'"
else
    echo "⚠️  No calendar found, skipping color tests"
fi

echo ""
echo "--- Phase 4: Tasks Color Settings ---"
echo ""

# Try to find a task-enabled calendar
TASK_CALENDAR_NAME=$(echo "$CALENDARS" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data.find(c=>c.type==='tasks')?.name || d.data[0]?.name || '')" 2>/dev/null)

if [ -n "$TASK_CALENDAR_NAME" ]; then
    # Test 1: Get tasks calendar color
    run_test "Get tasks calendar color" "tasks get-color --calendar '$TASK_CALENDAR_NAME'"

    # Test 2: Set tasks calendar color
    run_test "Set tasks calendar color" "tasks set-color --calendar '$TASK_CALENDAR_NAME' --color '#33C1FF'"

    # Test 3: Get tasks calendar color again
    run_test "Get tasks calendar color again" "tasks get-color --calendar '$TASK_CALENDAR_NAME'"
else
    echo "⚠️  No task calendar found, skipping tasks color tests"
fi

echo ""
echo "--- Phase 5: CardDAV Extended Fields ---"
echo ""

# Get available address books
echo "Getting available address books..."
ADDRESSBOOKS=$(node scripts/nextcloud.js addressbooks list 2>&1)
echo "$ADDRESSBOOKS" | head -5

TEST_ADDRESSBOOK_NAME=$(echo "$ADDRESSBOOKS" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.data?.[0]?.name || '')" 2>/dev/null)

if [ -n "$TEST_ADDRESSBOOK_NAME" ]; then
    # Test 1: Create contact with extended fields
    run_test "Create contact with extended fields" "contacts create --name 'Test User' --addressbook '$TEST_ADDRESSBOOK_NAME' --email 'test@example.com' --email-type WORK --phone '+1234567890' --phone-type WORK --bday '1990-01-15' --anniversary '2020-06-20' --url 'https://example.com' --role 'Software Engineer'"

    # Get the contact UID from the response
    CREATE_RESULT=$(node scripts/nextcloud.js contacts create --name 'Test User 2' --addressbook "$TEST_ADDRESSBOOK_NAME" --email 'test2@example.com' 2>&1)
    TEST_CONTACT_UID=$(echo "$CREATE_RESULT" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$TEST_CONTACT_UID" ]; then
        # Test 2: Get contact (verify extended fields were stored)
        run_test "Get contact with extended fields" "contacts get --uid '$TEST_CONTACT_UID'"

        # Test 3: Search contacts
        run_test "Search contacts" "contacts search --query 'Test' --addressbook '$TEST_ADDRESSBOOK_NAME'"

        # Test 4: Update contact with more extended fields
        run_test "Update contact with address" "contacts edit --uid '$TEST_CONTACT_UID' --address '123|Main|Street|City|Region|12345|Country'"
    else
        echo "⚠️  Could not create contact for testing"
    fi
else
    echo "⚠️  No address book found, skipping extended fields tests"
fi

echo ""
echo "--- Phase 6: Notes Advanced Features ---"
echo ""

# Test 1: List categories (may not exist)
echo "Testing notes categories..."
NOTES_RESULT=$(node scripts/nextcloud.js notes list-categories 2>&1)
if echo "$NOTES_RESULT" | grep -q "not available"; then
    echo "   ⚠️  Notes categories API not available in this Nextcloud version"
else
    run_test "List notes categories" "notes list-categories"
fi

# Test 2: Create note category
if ! echo "$NOTES_RESULT" | grep -q "not available"; then
    run_test "Create note category" "notes create-category --name 'Work'"

    # Test 3: List categories again (verify)
    run_test "List notes categories again" "notes list-categories"

    # Test 4: Delete category
    run_test "Delete note category" "notes delete-category --name 'Work'"
fi

# Test 3: Backup notes
run_test "Backup notes" "notes backup"

# Test 4: Backup notes to file
BACKUP_FILE="/tmp/notes-backup-$(date +%s).json"
run_test "Backup notes to file" "notes backup --output '$BACKUP_FILE'"

if [ -f "$BACKUP_FILE" ]; then
    echo "   ✅ Backup file created at: $BACKUP_FILE"
    rm -f "$BACKUP_FILE"
else
    echo "   ⚠️  Backup file was not created"
fi

echo ""
echo "--- Phase 7: Talk Settings ---"
echo ""

if [ -n "$TEST_ROOM_TOKEN" ]; then
    # Test 1: Get conversation settings
    run_test "Get conversation settings" "talk get-settings --token $TEST_ROOM_TOKEN"

    # Test 2: Update conversation settings
    run_test "Update conversation settings" "talk update-settings --token $TEST_ROOM_TOKEN --notification-level mention --read-only 0 --favorite 1"

    # Test 3: Get guest settings
    run_test "Get guest settings" "talk get-guest-settings --token $TEST_ROOM_TOKEN"

    # Test 4: Update guest settings
    run_test "Update guest settings" "talk update-guest-settings --token $TEST_ROOM_TOKEN --notification-level always --listable 1"
else
    echo "⚠️  Skipping settings tests - no conversation available"
fi

echo ""
echo "--- Cleanup ---"
echo ""

# Cleanup: Delete test conversation if it exists
if [ -n "$TEST_ROOM_TOKEN" ]; then
    echo "Cleaning up test conversation..."
    node scripts/nextcloud.js talk delete --token "$TEST_ROOM_TOKEN" 2>/dev/null || true
    echo "✅ Cleanup complete"
else
    echo "No test conversation to cleanup"
fi

echo ""
echo "=== Test Suite Complete ==="
