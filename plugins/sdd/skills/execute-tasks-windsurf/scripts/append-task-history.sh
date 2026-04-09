#!/bin/bash
# append-task-history.sh — Append a task history entry to execution_context.md.
#
# Reads the execution context file, locates the ## Task History section,
# appends a formatted entry, and writes the complete updated file.
#
# Usage: append-task-history.sh <execution-context-path> <<'ENTRY'
# task_id: task-003
# title: Add input validation
# status: PASS
# files_modified: src/validation.ts, src/validation.test.ts
# learnings: Project uses zod for validation
# issues: None
# ENTRY
#
# The entry is read from stdin as simple key: value pairs.
# All fields are required. Multi-line values are not supported.
#
# Exit codes:
#   0 — Entry appended and verified
#   1 — Error (file unchanged)

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "HISTORY_RESULT: FAIL"
    echo "Error: Usage: append-task-history.sh <execution-context-path> <<'ENTRY' ... ENTRY"
    exit 1
fi

CONTEXT_PATH="$1"

# Read stdin
STDIN_CONTENT=$(cat)

if [[ -z "$STDIN_CONTENT" ]]; then
    echo "HISTORY_RESULT: FAIL"
    echo "Error: No entry data provided on stdin"
    exit 1
fi

python3 -c "
import os
import sys
import re

context_path = sys.argv[1]
stdin_content = sys.argv[2]

# Parse stdin for key: value pairs
fields = {}
for line in stdin_content.strip().split('\n'):
    line = line.strip()
    if ':' in line:
        key, _, value = line.partition(':')
        fields[key.strip()] = value.strip()

# Validate required fields
required = ['task_id', 'title', 'status']
missing = [f for f in required if f not in fields]
if missing:
    missing_str = ', '.join(missing)
    print('HISTORY_RESULT: FAIL')
    print(f'Error: Missing required fields: {missing_str}')
    sys.exit(1)

task_id = fields['task_id']
title = fields['title']
status = fields['status']
files_modified = fields.get('files_modified', 'None')
learnings = fields.get('learnings', 'None')
issues = fields.get('issues', 'None')

# Format the entry
entry = f'''
### Task [{task_id}]: {title} - {status}
- Files modified: {files_modified}
- Key learnings: {learnings}
- Issues encountered: {issues}
'''

# Template for new execution_context.md files
TEMPLATE = '''# Execution Context

## Project Patterns
<!-- Discovered coding patterns, conventions, tech stack details -->

## Key Decisions
<!-- Architecture decisions, approach choices made during execution -->

## Known Issues
<!-- Problems encountered, workarounds applied, things to watch out for -->

## File Map
<!-- Important files discovered and their purposes -->

## Task History
<!-- Brief log of task outcomes with relevant context -->
'''

# Read existing file or create from template
if os.path.exists(context_path):
    with open(context_path, 'r') as f:
        content = f.read()
else:
    # Create parent directory if needed
    parent = os.path.dirname(context_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    content = TEMPLATE

# Find the Task History section and append
task_history_pattern = r'(## Task History[^\n]*\n)'
match = re.search(task_history_pattern, content)

if match:
    # Find the end of the Task History section (next ## header or end of file)
    section_start = match.end()
    next_section = re.search(r'\n## ', content[section_start:])

    if next_section:
        insert_pos = section_start + next_section.start()
        updated = content[:insert_pos] + entry + content[insert_pos:]
    else:
        # No next section — append at end of file
        if not content.endswith('\n'):
            content += '\n'
        updated = content + entry
else:
    # No Task History section — add it at end
    if not content.endswith('\n'):
        content += '\n'
    updated = content + '\n## Task History\n' + entry

# Write the complete updated file
with open(context_path, 'w') as f:
    f.write(updated)

# Verify the entry was written
with open(context_path, 'r') as f:
    verification = f.read()

if task_id in verification and title in verification:
    print('HISTORY_RESULT: OK')
    print(f'Appended: Task [{task_id}]: {title} - {status}')
    print(f'File: {context_path}')
else:
    print('HISTORY_RESULT: FAIL')
    print(f'Error: Entry not found in file after write')
    sys.exit(1)
" "$CONTEXT_PATH" "$STDIN_CONTENT"
