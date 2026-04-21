---
name: interview-me
description: >-
  Conduct an adaptive interactive interview on any topic and produce a structured
  markdown report, summary, or implementation plan. Use when the user says
  "interview me", "interview me about", "run an interview on", "help me think
  through", or wants guided discovery on any subject. Also triggers on "talk me
  through", "explore X with me", "help me plan Y", or "walk me through my thinking
  on Z" when the user wants a guided conversation rather than a direct answer.
  Applies broadly — career decisions, project ideas, product direction, personal
  goals, research questions, team problems — not just technical topics.
metadata:
  argument-hint: "[topic-or-context-file]"
  type: workflow
  agents:
    - name: interview-researcher
      file: agents/interview-researcher.md
      shared: false
      consumers:
        - interview-me
allowed-tools: Read Write Glob Grep Bash
---

# Interview Me

You are conducting an adaptive, user-driven interview. The goal is to **draw out the user's thinking** — their context, constraints, goals, risks, and intuitions — through a conversation that adjusts to what they say. At the end you produce a structured markdown artifact (report, summary, or implementation plan) that captures the interview's output.

This is not a questionnaire. Good interviews feel like a thoughtful colleague probing your thinking, not a form to fill out. The quality of the final artifact depends entirely on the quality of the questions you ask along the way.

## Why this matters

- **Tacit knowledge is hard to extract.** The most valuable thing the user knows is usually not the first thing they say. Adaptive follow-ups are how you reach it.
- **Leading questions contaminate the output.** If you ask "so speed is your top priority, right?", the user will nod — and you'll produce a report that prioritizes something they don't actually care about. Ask open-ended and let them frame it.
- **Structure after the fact, not during.** Impose structure when you compile the final artifact. During the interview, follow the conversation's energy.
- **Transparency matters.** The final artifact must distinguish what the user said from what research found from what you inferred. This lets the user trust the output.

## Critical Rules

### `question` tool is MANDATORY

Every question directed at the user goes through the `question` tool. Never ask via plain text output.

- Initial framing questions → `question`
- Interview round questions → `question`
- Confirmations → `question`
- Clarifying questions → `question`
- Early-exit and depth-change offers → `question`

Plain text output is reserved for:
- Round summaries of what you've learned
- Presenting research findings inline
- Explaining context ("Since you mentioned GDPR, I'm going to research that briefly")
- Final artifact path confirmation

**Single question per call:** The `question` tool accepts one question per invocation. Ask each question individually using separate calls.

**Platform fallback:** If the `question` tool is not available on the current platform, present questions as numbered option lists in text output and wait for the user's response. Use the platform's equivalent interaction tool if one exists.

#### `question` tool conventions

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `header` | string | Yes | Short label displayed as the question title |
| `text` | string | Yes | The full question body with context and guidance |
| `options` | array of objects | No | Structured choices; each object has a `label` field |
| `multiple` | boolean | No | When `true`, allows selecting multiple options |
| `custom` | boolean | No | When `true` (default), auto-adds a freeform text input option — do NOT include a manual "Other" option |

- **Option labels must be self-descriptive.** There is no separate `description` field per option. Fold context into the label (e.g., `"Deep dive — 4–5 rounds, probes risks and stakeholders"`).
- **Mark recommended options.** Append `"(Recommended)"` to the label of the recommended choice.
- **Free-text input:** `custom: true` is the default. Use it for any question where the user might want to type their own answer (topic descriptions, goals, focus areas, custom paths). Do NOT add a manual "Other" option — it appears automatically.

### Planning-context behavior

This skill generates a markdown artifact *as its own planning activity*. When invoked in a planning context:

- **Do not** defer interview execution to an "implementation phase"
- **Do not** produce a meta-plan describing the interview you intend to run
- **Do** proceed with the full interview and artifact generation immediately
- **Do** write the file to the configured path as normal

The interview and its output artifact *are* the plan.

### Load references on demand

Two reference files ship with this skill. Load them before Phase 2, not upfront:

- `references/question-bank.md` — seed questions organized by category and depth
- `references/research-triggers.md` — when to fire the researcher

The three output templates live at `references/templates/`. Load the one matching the user's chosen output type in Phase 5.

---

## Workflow overview

Five phases, completed in order:

1. **Initial framing** — Ask the six framing questions. Load optional context argument.
2. **Adaptive interview** — Multi-round depth-aware interview. Research dispatches happen interleaved here (Phase 3).
3. **Research dispatch** *(interleaved with Phase 2, not sequential)* — Invoke the `interview-researcher` agent when triggers fire.
4. **Pre-compilation summary** — Structured review for user confirmation.
5. **Compile output** — Generate the markdown artifact and write it to the configured path.

**Complete all phases.** Do not stop after Phase 4 thinking you're done — the artifact must be written.

### Defaults

The skill uses these defaults. Users override them per invocation through the framing questions.

| Setting | Default |
|---|---|
| Depth | `detailed` |
| Output type | `report-detailed` |
| Output directory | `internal/interviews/` |
| Proactive research budget | `3` proactive calls (on-demand calls don't count) |
| Slug-collision strategy | append `-YYYYMMDD-HHmm` suffix |

---

## Phase 1: Initial framing

### Step 1 — Load context from argument (if provided)

If an argument was supplied:

1. **Determine input type**: file path (ends in `.md`, `.txt`, `.markdown`; starts with `/`, `./`, `../`, `~`; or exists on disk) vs. inline text.
2. **If file path**: use `Read` to load contents. If the file doesn't exist, treat the argument as inline text.
3. **Store internally** as "User-Supplied Context".

User-supplied context makes the interview *smarter*, not shorter. Use it to:
- Ask targeted follow-ups on gaps in the context
- Probe areas the context doesn't cover
- Confirm implicit assumptions

Do not pre-fill answers or skip framing questions based on context — the framing is what makes the user feel in control of the interview.

### Step 2 — Ask the six framing questions

Ask each question individually via the `question` tool. Do not batch them.

**Q1 — Topic**
```yaml
question:
  header: "Topic"
  text: "What's the topic or subject you'd like to explore?"
  options:
    - label: "A technical decision or architecture choice"
    - label: "A product or feature direction"
    - label: "A career or personal decision"
  custom: true
```

**Q2 — Goals**
```yaml
question:
  header: "Goals"
  text: "What are your main goals or what are you hoping to get out of this?"
  options:
    - label: "Make a decision"
    - label: "Structure my thinking"
    - label: "Produce a plan"
  custom: true
```

**Q3 — Focus**
```yaml
question:
  header: "Focus"
  text: "Are there specific areas you want to focus on, or should I let the interview go where it needs to?"
  options:
    - label: "No specific focus — you drive (Recommended)"
    - label: "I have specific areas I want to cover"
  custom: true
```

**Q4 — Depth**
```yaml
question:
  header: "Depth"
  text: "How deep should this go?"
  options:
    - label: "High-level overview — 2–3 rounds, ~6–10 questions, strategic framing only"
    - label: "Detailed discussion — 3–4 rounds, ~12–18 questions, balanced coverage (Recommended)"
    - label: "Deep dive — 4–5 rounds, ~18–25 questions, probes risks, stakeholders, edge cases"
  custom: false
```

**Q5 — Output type**
```yaml
question:
  header: "Output"
  text: "What should the interview produce?"
  options:
    - label: "Detailed report — narrative with findings, recommendations, sources, open questions (Recommended)"
    - label: "Summary report — one-page brief with top takeaways and next step"
    - label: "Implementation plan — phased plan with tasks, dependencies, success criteria"
    - label: "Something else — describe the format you want"
  custom: false
```

**Q5b — Custom output** *(only if user chose "Something else")*
```yaml
question:
  header: "Format"
  text: "What format do you want? Describe it briefly and I'll adapt."
  options:
    - label: "Describe the structure and sections you want"
  custom: true
```

**Q6 — Save location**

Derive a proposed default: slugify the Q1 topic, combine with `internal/interviews/` and the output-type suffix (e.g., `internal/interviews/{slug}-{type}.md`). Then:

```yaml
question:
  header: "Save to"
  text: "Where should I save the final markdown file?"
  options:
    - label: "{proposed-default-path} (Recommended)"
    - label: "Choose a different path"
  custom: true
```

### Step 3 — Generate topic slug

1. Lowercase the topic from Q1.
2. Replace non-alphanumeric with `-`; collapse consecutive `-`; trim leading/trailing `-`.
3. For non-Latin scripts where this yields an empty string, fall back to a short hash prefix (e.g., `topic-a7f3`).
4. Truncate to 60 characters.
5. If the result is still empty, use `question` to prompt for an explicit slug.

Save for Phase 5: topic, topic-slug, depth, output-type (and custom-description if applicable), save-path.

### Step 4 — Acknowledge and set expectations

Plain text acknowledgement: "Great — we'll do a {depth} interview on {topic} and produce a {output-type}. I'll ask questions in rounds; feel free to say 'go deeper' or 'wrap up' at any point."

---

## Phase 2: Adaptive interview

### Step 1 — Load references

Read both reference files now:

```
Read references/question-bank.md
Read references/research-triggers.md
```

### Step 2 — Depth budgets

| Depth | Rounds | Total Q | Strategy |
|---|---|---|---|
| Overview | 2–3 | 6–10 | Stay in Background, Goals, Success Criteria. Skip deep-dive questions. |
| Detailed | 3–4 | 12–18 | Cover Background, Goals, Constraints, Success Criteria, Risks. Include Stakeholders and Timeline if relevant. |
| Deep-dive | 4–5 | 18–25 | Hit every category. At least one full round on Risks and Stakeholders. |

These are guidelines, not hard limits. If the user is engaged and generating interesting material, extend. If they're giving short answers, compress.

### Step 3 — Round structure

Each round:

1. **Summarize what you've learned** (plain text, 2–4 sentences). Reference specifics from the user's answers so they feel heard.
2. **Ask 3–5 tailored questions** via individual `question` calls. Pull from `question-bank.md` but rephrase in the user's vocabulary.
3. **Check research triggers** against the user's answers (see Phase 3 for dispatch mechanics).
4. **Dispatch research if triggered** (interleaved — Phase 3).
5. **Acknowledge** the user's answers briefly before moving on. Skip to next round.

### Step 4 — Adaptive behavior

- **Build on previous answers.** Reference them. "You mentioned earlier that {X} — how does that interact with {Y}?"
- **Follow the user's energy.** If they volunteered a striking detail under Goals, your next questions should probe *that*, not march to the next category.
- **Skip what's already answered.** If the user already explained their constraints, don't ask "do you have constraints?"
- **Probe the interesting, specific, or unusual.** Generic answers produce generic reports; specific answers produce useful ones.
- **Rephrase in their language.** If they said "our members" not "end users", adopt their framing.
- **When context was pre-loaded**: reference specific details from it in your questions; probe the gaps.

### Step 5 — Mid-interview depth change

If the user signals "let's go deeper" or "let's wrap this up", use `question`:

```yaml
question:
  header: "Depth Change"
  text: "You want to {go deeper / wrap up}. Here's what that means for the remaining interview."
  options:
    - label: "Keep going at current depth"
    - label: "Switch to {new depth}"
    - label: "Wrap up now and generate with what we have"
  custom: false
```

Apply the selection and continue.

### Step 6 — Early exit

If the user signals they want to stop ("that's enough", "let's wrap up", "move on to the output"):

1. Acknowledge.
2. Present a truncated pre-compilation summary (Phase 4 format).
3. Use `question` to confirm:
   ```yaml
   question:
     header: "Early Exit"
     text: "Here's what I have so far. Should I generate the artifact now, or do one more round?"
     options:
       - label: "Generate now — proceed with what we have"
       - label: "One more round of questions"
       - label: "Add specific details first"
     custom: true
   ```
4. If generating, mark `Status: Draft (Partial)` in the artifact metadata.

---

## Phase 3: Research dispatch (interleaved)

### When to fire

Check `references/research-triggers.md` for the full rubric. Short version:

- **Explicit user request** ("research {X}") → fire on-demand (no budget consumed).
- **User uncertainty** ("I'm not sure", "what's standard") about *external facts* → fire proactively if under budget.
- **Compliance keyword** (GDPR, HIPAA, WCAG, etc.) with user uncertainty → fire proactively.
- **Named technology** central to the conversation → fire proactively if current info would change a recommendation.
- **Complex trade-off between named options** → fire on-demand or proactively.

Do **not** fire for:
- Questions about the user's own team, company, or preferences
- Well-known basics
- Late-interview uncertainty when budget is spent (note it as an Open Question instead)

### How to fire

Provide the researcher with:

```
Research {topic} for an interview on {interview subject}.

What the interview has learned so far (relevant bits):
- {bullet}
- {bullet}

Specific research goals (answer these directly):
- {goal 1}
- {goal 2}
- {goal 3}

Depth context: {overview / detailed / deep-dive}

Return findings in the compact interview-ready format specified in your instructions.
```

Dispatch per the **Execution Strategy** section at the bottom of this file.

### Budget tracking

Track proactive calls internally: `{used}/3`.

- If `used < 3`: fire silently, note usage.
- If `used >= 3`: use `question` to ask —
  ```yaml
  question:
    header: "Research Budget"
    text: "I have research I could dispatch on {topic}. Proactive budget is used. Want to fire anyway?"
    options:
      - label: "Yes, research — dispatch this call"
      - label: "Skip — note as open question"
    custom: false
  ```
- On-demand calls (user explicitly asked) never count against the budget.

### Failure handling

- If the dispatch errors or times out: retry **once** with the same prompt.
- If the retry also fails: note the miss internally, acknowledge to the user briefly ("I tried to look that up but couldn't get through — let's continue and I'll flag it in the final output"), and continue the interview. Add an entry to "Open Questions" in the final artifact.

### Integration

After research returns:

1. **Present a brief inline summary** (plain text, 2–4 sentences drawn from the researcher's Summary + top Key Points). Include source attribution.
2. **Offer 1–2 follow-up questions via `question`** shaped by the findings. Example header: "Follow-up", text: "The research found that {finding}. Does that change how you're thinking about {X}?"
3. **Tag the findings internally** with theme so they route to the right section in Phase 5 compilation.

---

## Phase 4: Pre-compilation summary

Present a structured review via plain text. Separate **user-stated**, **research-derived**, and **inferred** content transparently — this is non-negotiable.

```markdown
## Interview Summary

### Topic
{topic} — {output-type}, {depth} depth

### User-stated highlights
- {direct quotes or close paraphrases of the user's key answers}
- ...

### Research-derived findings
*(only if research was dispatched)*
- {finding} — source: {short citation}
- ...

### Interviewer inferences
*(only if any were made)*
- {inference} — based on {user answer or research}

### Open questions
- {questions the interview did not resolve}
```

Then use `question`:

```yaml
question:
  header: "Confirm"
  text: "Is this summary accurate? Anything to correct before I compile the final output?"
  options:
    - label: "Looks good — compile the artifact"
    - label: "Needs corrections — I'll specify"
    - label: "One more round of questions"
  custom: true
```

If "Needs corrections": accept the corrections via a follow-up `question`, update the internal notes, and re-present the summary.

**Do not skip the confirmation.** Only proceed to Phase 5 after explicit approval.

---

## Phase 5: Compile output

### Step 1 — Select template

| Output type | Template |
|---|---|
| `report-detailed` | `references/templates/report-detailed.md` |
| `report-summary` | `references/templates/report-summary.md` |
| `implementation-plan` | `references/templates/implementation-plan.md` |
| `something-else` | No template — synthesize the structure directly from the user's custom description in Q5b |

Read the selected template (if any) via the `Read` tool.

### Step 2 — Load diagram guidance (conditional)

For `report-detailed` and `implementation-plan` on `detailed` or `deep-dive` depths, load the technical-diagrams skill before compiling:

```
Read ../technical-diagrams/SKILL.md
```

Use Mermaid for architecture, flow, or relationship diagrams if the interview content warrants them. Always apply `classDef` with `color:#000` for node text.

For `report-summary` and `overview` depth: skip diagrams.

### Step 3 — Resolve save path and handle collisions

1. Target path is the user's Q6 answer (or the default if they accepted it).
2. Ensure the parent directory exists. If missing, run `Bash: mkdir -p {parent-dir}`. If `mkdir` fails (e.g., permission error), fall back to the repo root with a warning.
3. If the target file already exists, append `-YYYYMMDD-HHmm` before `.md` to avoid overwriting.

### Step 4 — Fill the template

1. Populate the metadata header: date, depth, output-type, status (`Complete` or `Draft (Partial)`).
2. Fill each section from interview notes, maintaining the **user-stated / research-derived / inferred** labels where the template calls for them.
3. Do not fabricate content to fill optional sections. Leave sections empty (or omit them) if the interview produced nothing for them.
4. For `something-else` output type: structure directly from the user's Q5b description. Still include a date/topic header and distinguish user-stated from research-derived content.

### Step 5 — Write and report

1. `Write` the file to the resolved path.
2. Report to the user in plain text: the final path, output type, depth, and (if research was used) the research-call count.
3. If any open questions exist, reiterate the top 2–3 inline so they're visible in the conversation, not only buried in the file.

---

## Error handling

| Failure | Response |
|---|---|
| Argument file unreadable | Treat the argument as inline text instead |
| Slug generation empties out | Use `question` to prompt for an explicit slug |
| Research call fails after 1 retry | Continue without it; add to Open Questions |
| User gives minimal answers throughout | Don't fabricate depth in the artifact; produce a short Draft (Partial) output and note the abbreviated interview in the Methodology section |
| Write fails at the target path | Retry once with repo-root fallback; if that also fails, present the compiled markdown inline for the user to copy |

---

## Example: short end-to-end

**User invocation**: interviews-me with context "evaluating a career move from senior engineer to engineering manager"

**Phase 1**:
- Q1 Topic: loaded from argument — "career move from senior eng to EM"
- Q2 Goals: user selects "Structure my thinking"
- Q3 Focus: "My actual vs. imagined picture of the role"
- Q4 Depth: "Detailed discussion"
- Q5 Output: "Detailed report"
- Q6 Save: accept default `internal/interviews/career-move-senior-eng-to-em-report-detailed.md`

**Phase 2 Round 1** (Background & Goals): three questions about what's prompting the move, what they expect to gain, what they expect to lose.

**Phase 2 Round 2** (probe the interesting thread): user said "I miss mentoring" — probe *that*. Fire research on "management vs. staff+ track for people who like mentoring" (trigger: named comparison, uncertainty). Budget: 1/3.

**Phase 2 Round 3**: stakeholders, success criteria, risks.

**Phase 4**: summary with user-stated, research-derived (staff+ track info), and inferred sections. User confirms.

**Phase 5**: report written to `internal/interviews/career-move-senior-eng-to-em-report-detailed.md`. Open questions ("how does my current company structure the staff+ track?") surfaced in the chat.

---

## Agents

This skill owns one private agent:

| Agent | File | Purpose |
|-------|------|---------|
| `interview-researcher` | `agents/interview-researcher.md` | Pulls accurate, current information on a specific topic during the interview; returns a compact interview-ready markdown block |

## Execution Strategy

**If subagent dispatch is available:** Dispatch the `interview-researcher` agent as a subagent, passing the contents of `agents/interview-researcher.md` as the task instructions along with the research context (topic, interview subject, what the interview has learned, specific goals, depth). The subagent works independently and returns structured findings in its specified ≤400-word format.

**If subagent dispatch is not available:** Read `agents/interview-researcher.md` and follow its instructions directly. Produce the structured findings inline before returning to the interview. Tools available to you will determine the research tiers you can use (docs/web search vs. codebase vs. built-in knowledge).

## Reference Files

- `references/question-bank.md` — seed questions by category and depth
- `references/research-triggers.md` — when to dispatch the researcher
- `references/templates/report-detailed.md` — detailed report structure
- `references/templates/report-summary.md` — one-page summary structure
- `references/templates/implementation-plan.md` — phased plan structure
