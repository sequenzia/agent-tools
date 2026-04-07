/**
 * Session summary parser — ported from Rust session.rs.
 * Parses session_summary.md for task statistics.
 */
/**
 * Extract the last number from a string.
 */
function extractLastNumber(s) {
    let result = null;
    let current = "";
    for (const ch of s) {
        if (ch >= "0" && ch <= "9") {
            current += ch;
        }
        else {
            if (current.length > 0) {
                result = parseInt(current, 10);
                current = "";
            }
        }
    }
    if (current.length > 0) {
        result = parseInt(current, 10);
    }
    return result;
}
/**
 * Extract the first number from a string.
 */
function extractFirstNumber(s) {
    let current = "";
    let started = false;
    for (const ch of s) {
        if (ch >= "0" && ch <= "9") {
            current += ch;
            started = true;
        }
        else if (started) {
            break;
        }
    }
    return current.length > 0 ? parseInt(current, 10) : null;
}
/**
 * Extract a number that appears near one of the given keywords in a line.
 */
function extractNumberNearKeyword(line, keywords) {
    for (const keyword of keywords) {
        const pos = line.indexOf(keyword);
        if (pos === -1)
            continue;
        // Look for number before the keyword (e.g., "5 passed")
        const before = line.slice(0, pos);
        const beforeNum = extractLastNumber(before);
        if (beforeNum !== null)
            return beforeNum;
        // Look for number after the keyword (e.g., "passed: 5")
        const after = line.slice(pos + keyword.length);
        const afterNum = extractFirstNumber(after);
        if (afterNum !== null)
            return afterNum;
    }
    return null;
}
/**
 * Parse session_summary.md for basic statistics.
 * Looks for patterns like "X passed", "X failed", "X total" or "passed: X".
 */
export function parseSessionSummary(content) {
    let tasksPassed = 0;
    let tasksFailed = 0;
    let tasksTotal = 0;
    // Extract headline: first 3 non-empty lines
    const headline = content
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .slice(0, 3)
        .join("\n");
    for (const line of content.split("\n")) {
        const lower = line.toLowerCase();
        if (lower.includes("passed") || lower.includes("pass")) {
            const n = extractNumberNearKeyword(lower, ["passed", "pass"]);
            if (n !== null)
                tasksPassed = n;
        }
        if (lower.includes("failed") || lower.includes("fail")) {
            const n = extractNumberNearKeyword(lower, ["failed", "fail"]);
            if (n !== null)
                tasksFailed = n;
        }
        if (lower.includes("total")) {
            const n = extractNumberNearKeyword(lower, ["total"]);
            if (n !== null)
                tasksTotal = n;
        }
    }
    // Infer total if not explicitly found
    if (tasksTotal === 0 && (tasksPassed > 0 || tasksFailed > 0)) {
        tasksTotal = tasksPassed + tasksFailed;
    }
    return {
        tasks_passed: tasksPassed,
        tasks_failed: tasksFailed,
        tasks_total: tasksTotal,
        headline,
    };
}
//# sourceMappingURL=session-parser.js.map