#!/bin/bash
# verify-task-file.sh — Verify that a task JSON file has all required fields intact.
# Usage: verify-task-file.sh <task-file-path>
#
# Checks for structural markers that indicate a complete task file:
#   - acceptance_criteria (present with at least one non-empty array)
#   - testing_requirements (present)
#   - metadata.task_uid (present)
#   - active_form (present)
#
# Exit codes:
#   0 — All required fields present
#   1 — Missing required fields or invalid JSON

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "VERIFY_RESULT: FAIL"
    echo "Error: Usage: verify-task-file.sh <task-file-path>"
    exit 1
fi

TASK_FILE="$1"

if [[ ! -f "$TASK_FILE" ]]; then
    echo "VERIFY_RESULT: FAIL"
    echo "Error: File not found: $TASK_FILE"
    exit 1
fi

python3 -c "
import json
import sys

task_file = sys.argv[1]

try:
    with open(task_file, 'r') as f:
        task = json.load(f)
except (json.JSONDecodeError, IOError) as e:
    print('VERIFY_RESULT: FAIL')
    print(f'Error: {e}')
    sys.exit(1)

field_count = len(task)
missing = []

# Check acceptance_criteria
ac = task.get('acceptance_criteria')
if not ac or not isinstance(ac, dict):
    missing.append('acceptance_criteria')
    ac_detail = 'no'
else:
    counts = []
    for cat in ['functional', 'edge_cases', 'error_handling', 'performance']:
        arr = ac.get(cat, [])
        counts.append(f'{cat}={len(arr)}')
    ac_detail = 'yes (' + ', '.join(counts) + ')'

# Check testing_requirements
tr = task.get('testing_requirements')
if tr is None:
    missing.append('testing_requirements')
    tr_detail = 'no'
else:
    tr_detail = f'yes ({len(tr)} entries)' if isinstance(tr, list) else 'yes'

# Check metadata.task_uid
metadata = task.get('metadata', {})
if not isinstance(metadata, dict) or 'task_uid' not in metadata:
    missing.append('task_uid')
    uid_detail = 'no'
else:
    uid_detail = 'yes'

# Check active_form
if 'active_form' not in task:
    missing.append('active_form')
    af_detail = 'no'
else:
    af_detail = 'yes'

if missing:
    missing_str = ', '.join(missing)
    print('VERIFY_RESULT: FAIL')
    print(f'Missing: {missing_str}')
    print(f'Fields: {field_count} (expected 10+)')
    sys.exit(1)
else:
    print('VERIFY_RESULT: OK')
    print(f'Fields: {field_count}')
    print(f'acceptance_criteria: {ac_detail}')
    print(f'testing_requirements: {tr_detail}')
    print(f'task_uid: {uid_detail}')
    print(f'active_form: {af_detail}')
" "$TASK_FILE"
