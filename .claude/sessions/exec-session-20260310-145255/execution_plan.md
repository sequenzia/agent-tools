# Execution Plan

Task Execution ID: exec-session-20260310-145255
Tasks to execute: 19
Retry limit: 3 per task
Max parallel: 5 per wave

## WAVE 1 (5 tasks)
1. [#24] Create mr-reviewer skill file scaffold with GAS frontmatter (unblocks 4)
2. [#20] Perform systematic analysis of the mr-reviewer-skill spec
3. [#21] Generate analysis report (.analysis.md)
4. [#22] Generate interactive HTML review (.analysis.html)
5. [#23] Present findings and ask user for review mode

## WAVE 2 (4 tasks)
1. [#26] Write codebase understanding subagent section — after [#24]
2. [#27] Write code quality analysis subagent section — after [#24]
3. [#28] Write git history examination subagent section — after [#24]
4. [#25] Write MR selection and input handling section — after [#24]

## WAVE 3 (4 tasks)
1. [#29] Write subagent output schema and finding merge/deduplication section — after [#26, #27, #28]
2. [#36] Write configurable analysis depth section — after [#26]
3. [#37] Write large MR detection and file prioritization section — after [#25]
4. [#31] Write error handling and retry strategy section — after [#26, #27, #28]

## WAVE 4 (3 tasks)
1. [#30] Write structured review report generation section — after [#29]
2. [#33] Write line-level GitLab comment posting section — after [#29]
3. [#34] Write summary note posting section — after [#29]

## WAVE 5 (2 tasks)
1. [#35] Write comment error handling and fallback section — after [#33, #34]
2. [#32] Write output action selection section — after [#30]

## WAVE 6 (1 task)
1. [#38] Create reference documentation files — after [#35, #36, #37]
