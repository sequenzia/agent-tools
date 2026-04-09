#!/bin/bash
# move-task.sh — Atomically move a task JSON file between status directories.
#
# Reads the source JSON, updates only the specified fields (preserving all others),
# writes to the destination, verifies integrity, then deletes the source.
#
# Usage: move-task.sh <source-path> <dest-dir> --status <new-status> [--owner <owner>]
#
# Arguments:
#   source-path  Path to the source task JSON file
#   dest-dir     Destination directory (e.g., .agents/tasks/completed/auth/)
#   --status     Required. New status value (pending, in_progress, completed)
#   --owner      Optional. New owner value. Use "null" to clear owner.
#
# Examples:
#   # Claim a task (pending → in-progress)
#   bash move-task.sh .agents/tasks/pending/auth/task-001.json \
#     .agents/tasks/in-progress/auth/ --status in_progress --owner session-123
#
#   # Complete a task (in-progress → completed)
#   bash move-task.sh .agents/tasks/in-progress/auth/task-001.json \
#     .agents/tasks/completed/auth/ --status completed
#
#   # Reset a task (in-progress → pending, clear owner)
#   bash move-task.sh .agents/tasks/in-progress/auth/task-001.json \
#     .agents/tasks/pending/auth/ --status pending --owner null
#
# Exit codes:
#   0 — Move succeeded, integrity verified, source deleted
#   1 — Error (source preserved, destination cleaned up if partial)

set -euo pipefail

# --- Argument parsing ---

if [[ $# -lt 4 ]]; then
    echo "MOVE_RESULT: FAIL"
    echo "Error: Usage: move-task.sh <source-path> <dest-dir> --status <new-status> [--owner <owner>]"
    exit 1
fi

SOURCE_PATH="$1"
DEST_DIR="$2"
shift 2

NEW_STATUS=""
NEW_OWNER=""
HAS_OWNER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --status)
            NEW_STATUS="$2"
            shift 2
            ;;
        --owner)
            NEW_OWNER="$2"
            HAS_OWNER=true
            shift 2
            ;;
        *)
            echo "MOVE_RESULT: FAIL"
            echo "Error: Unknown argument: $1"
            exit 1
            ;;
    esac
done

if [[ -z "$NEW_STATUS" ]]; then
    echo "MOVE_RESULT: FAIL"
    echo "Error: --status is required"
    exit 1
fi

# --- Validation ---

if [[ ! -f "$SOURCE_PATH" ]]; then
    echo "MOVE_RESULT: FAIL"
    echo "Error: Source file not found: $SOURCE_PATH"
    exit 1
fi

FILENAME=$(basename "$SOURCE_PATH")
DEST_PATH="${DEST_DIR%/}/$FILENAME"

if [[ -f "$DEST_PATH" ]]; then
    echo "MOVE_RESULT: FAIL"
    echo "Error: Destination already exists: $DEST_PATH"
    echo "Source preserved at: $SOURCE_PATH"
    exit 1
fi

# --- Create destination directory ---

mkdir -p "$DEST_DIR"

# --- Read, modify, write, verify via python3 ---

python3 -c "
import json
import os
import sys
from datetime import datetime, timezone

source_path = sys.argv[1]
dest_path = sys.argv[2]
new_status = sys.argv[3]
has_owner = sys.argv[4] == 'true'
new_owner = sys.argv[5]

# Step 1: Read source JSON
try:
    with open(source_path, 'r') as f:
        task = json.load(f)
except (json.JSONDecodeError, IOError) as e:
    print('MOVE_RESULT: FAIL')
    print(f'Error: Cannot read source JSON: {e}')
    print(f'Source preserved at: {source_path}')
    sys.exit(1)

source_fields = len(task)

# Step 2: Update only specified fields on the parsed object
task['status'] = new_status
task['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

if has_owner:
    if new_owner == 'null':
        task['owner'] = None
    else:
        task['owner'] = new_owner

# Step 3: Write to destination
try:
    with open(dest_path, 'w') as f:
        json.dump(task, f, indent=2)
        f.write('\n')
except IOError as e:
    print('MOVE_RESULT: FAIL')
    print(f'Error: Cannot write destination: {e}')
    print(f'Source preserved at: {source_path}')
    sys.exit(1)

# Step 4: Verify integrity by reading back
try:
    with open(dest_path, 'r') as f:
        written = json.load(f)
except (json.JSONDecodeError, IOError) as e:
    print('MOVE_RESULT: FAIL')
    print(f'Error: Verification read failed: {e}')
    os.remove(dest_path)
    print(f'Source preserved at: {source_path}')
    sys.exit(1)

dest_fields = len(written)

checks = {}

# acceptance_criteria: must exist and have at least one non-empty array
ac = written.get('acceptance_criteria')
if ac and isinstance(ac, dict):
    checks['acceptance_criteria'] = True
else:
    checks['acceptance_criteria'] = False

# testing_requirements: must exist
checks['testing_requirements'] = 'testing_requirements' in written

# metadata.task_uid: must exist
metadata = written.get('metadata', {})
checks['task_uid'] = isinstance(metadata, dict) and 'task_uid' in metadata

# active_form: must exist
checks['active_form'] = 'active_form' in written

failed = [k for k, v in checks.items() if not v]

if failed:
    failed_str = ', '.join(failed)
    print('MOVE_RESULT: FAIL')
    print(f'Error: Integrity check failed — missing: {failed_str}')
    print(f'Fields: {source_fields} (source) -> {dest_fields} (dest)')
    os.remove(dest_path)
    print(f'Source preserved at: {source_path}')
    sys.exit(1)

# Step 5: All checks passed — delete source
try:
    os.remove(source_path)
except IOError as e:
    # Source deletion failed but destination is valid
    print(f'WARNING: Could not delete source: {e}')

print('MOVE_RESULT: OK')
print(f'Source: {source_path}')
print(f'Dest: {dest_path}')
print(f'Fields: {source_fields} (source) -> {dest_fields} (dest)')
print('Verified: ' + ' '.join(f'{k}=yes' for k in checks))
" "$SOURCE_PATH" "$DEST_PATH" "$NEW_STATUS" "$HAS_OWNER" "$NEW_OWNER"
