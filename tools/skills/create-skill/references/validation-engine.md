# Validation Engine

Complete validation flow, rules, auto-fix behavior, and report formats for generated skill files. Validates against the target platform's specification.

## Validation Trigger Point

After the skill content is fully rendered (SKILL.md and, for Codex, `agents/openai.yaml`), run the full validation pass **before** prompting for the output path. This ensures:
- The user reviews a validated skill, not a potentially broken one
- Auto-fixes are applied before the user sees the content
- Any unfixable issues are surfaced with the skill, not discovered after writing

## Validation Flow

```
Rendered content (SKILL.md + openai.yaml)
    |
    v
[1] Run platform-specific validation rules
    |
    v
[2] Any failures? --No--> [5] Report: PASS
    |
   Yes
    |
    v
[3] Auto-fixable? --Yes--> Apply fixes --> [4] Re-validate
    |                                           |
   No                                     Still failing?
    |                                      /          \
    v                                    No            Yes
[5] Report: WARNING                [5] Report: PASS   [5] Report: WARNING
    (unfixable issues)             (issues fixed)      (partial fix applied)
    |
    v
Present skill with validation report
```

## Platform-Specific Validation Rules

Each platform has its own set of validation rules drawn from the embedded platform knowledge. The validation engine applies the rules matching the target platform.

### Shared Rules (All Platforms)

These rules apply to every generated skill regardless of target platform. See [platform-base.md](platform-base.md) for the full shared validation checklist.

**Frontmatter structure:**
- [ ] File begins with `---` on its own line (frontmatter opening delimiter)
- [ ] Frontmatter closing `---` is present on its own line
- [ ] Content between delimiters is valid YAML
- [ ] Markdown body content follows the closing delimiter

**Required fields:**
- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens)
- [ ] `name` matches the intended parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters

**Optional field constraints (validate only if present):**
- [ ] `compatibility` is 1-500 characters
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names

**Format constraints:**
- [ ] File will be named `SKILL.md` (all caps)
- [ ] Target directory name will match the `name` field

### OpenCode-Specific Rules

See [platform-opencode.md](platform-opencode.md) for the full OpenCode validation checklist. In addition to shared rules:

**Naming:**
- [ ] `name` uses lowercase only (not mixed-case)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it"
- [ ] Description includes specific keywords for agent discoverability

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000

### GAS-Specific Rules

See [platform-gas.md](platform-gas.md) for the full GAS validation checklist. In addition to shared rules:

**Portability checks** (apply when the user chose cross-platform portability during the interview):
- [ ] Only core GAS fields are used in frontmatter
- [ ] Body content does not reference platform-specific tools by name without noting portability implications
- [ ] Skill directory uses `.agents/skills/` path convention

**Extension field validation** (apply when targeting a specific agent implementation):
- [ ] `argument-hint` is a string if provided (Claude Code)
- [ ] `user-invocable` is a boolean if provided (Claude Code)
- [ ] `disable-model-invocation` is a boolean if provided (Claude Code)
- [ ] `arguments` is an array of objects with `name`, `description`, and `required` fields if provided (Claude Code)

**Description quality and content guidelines** (advisory): Same as OpenCode.

### Codex-Specific Rules

See [platform-codex.md](platform-codex.md) for the full Codex validation checklist. In addition to shared rules:

**Frontmatter convention:**
- [ ] Frontmatter contains only `name` and `description`
- [ ] YAML string values are quoted (Codex convention)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it" with explicit scope boundaries
- [ ] All trigger/invocation context is in the description, not in the body

**agents/openai.yaml validation** (validate only if generated):
- [ ] File is valid YAML
- [ ] All string values are quoted
- [ ] `interface.short_description` is 25-64 characters if provided
- [ ] `interface.icon_small` and `interface.icon_large` are relative paths if provided
- [ ] `interface.brand_color` is a valid hex color string if provided
- [ ] `interface.default_prompt` mentions the skill as `$skill-name` if provided
- [ ] `policy.allow_implicit_invocation` is a boolean if provided
- [ ] `dependencies.tools[].type` is `"mcp"` (only supported type) if provided
- [ ] `dependencies.tools[].url` is a valid URL if type is `"mcp"`

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000
- [ ] No extraneous files suggested (README.md, CHANGELOG.md, etc.)

## Ambiguous Spec Requirements

When a platform spec has ambiguous or underspecified requirements, validate conservatively:

- **`allowed-tools` format**: The spec says "space-delimited string" but Claude Code uses YAML lists. Accept both formats without flagging as an error. If generating, use the target platform's preferred format.
- **`compatibility` vocabulary**: No standard vocabulary exists. Accept any non-empty string within the 500-character limit.
- **Body size limits**: The 500-line / 5000-token guidelines are recommendations, not hard limits. Flag as advisory suggestions, not failures.
- **Extension field behavior**: Extension fields are safe (silently ignored by non-supporting implementations). Flag for awareness on GAS portability targets, but never as validation failures.

## Auto-Fix Behavior

When validation finds fixable issues, automatically correct them before presenting the skill to the user. Auto-fixes are silent corrections — they are applied, then the fixed content is re-validated to confirm the fix did not introduce new issues.

### Auto-Fixable Issues

| Issue | Auto-Fix | Re-validation Check |
|-------|----------|-------------------|
| `name` contains uppercase characters | Convert to lowercase | Confirm name still matches regex after lowering |
| `name` contains spaces | Replace spaces with hyphens, then lowercase | Confirm name matches regex; confirm no consecutive hyphens introduced |
| `name` starts or ends with hyphen | Trim leading/trailing hyphens | Confirm name is non-empty after trimming |
| `name` contains consecutive hyphens | Collapse `--` to `-` | Confirm name matches regex |
| `description` exceeds 1024 characters | Truncate to 1024 characters at the last complete sentence boundary | Confirm description is non-empty and under limit |
| `compatibility` exceeds 500 characters | Truncate to 500 characters at the last complete word boundary | Confirm string is non-empty and under limit |
| Missing frontmatter opening delimiter | Prepend `---\n` to file content | Confirm frontmatter parses as valid YAML |
| Missing frontmatter closing delimiter | Insert `---\n` after frontmatter content | Confirm body content follows the delimiter |
| Codex: unquoted YAML string values | Add double quotes around string values in frontmatter | Confirm YAML still parses correctly |
| Codex: `default_prompt` missing `$skill-name` | Append ` Use $skill-name.` to the default_prompt | Confirm the `$skill-name` reference is present |

### Re-Validation After Fixes

After applying any auto-fix:
1. Re-run the full validation pass on the fixed content
2. If the re-validation passes, the fix is accepted
3. If the re-validation finds new issues introduced by the fix, revert the fix and treat the original issue as unfixable
4. Report both the original issue and the failed fix attempt in the validation report

## Unfixable Issues

Issues that cannot be auto-fixed are reported as warnings. The skill is still presented to the user, but with clear annotations about the issues.

Unfixable issues include:
- Missing `name` field entirely (no reasonable default can be generated without user input)
- Missing `description` field entirely (cannot generate a meaningful description automatically)
- Invalid YAML that cannot be parsed (structural corruption beyond delimiter issues)
- `agents/openai.yaml` with fundamentally invalid structure
- Body content that is empty (no instructions to present)

## Validation Report Formats

### PASS (all checks passed, no issues)

> **Validation: PASS**
> The generated skill passes all structural checks for {platform name}.

### PASS with fixes (issues found and auto-fixed)

> **Validation: PASS** (after auto-fixes)
> The following issues were detected and automatically corrected:
> - {description of issue and fix applied}
> - {description of issue and fix applied}
>
> The skill now passes all structural checks for {platform name}.

### WARNING (unfixable issues present)

> **Validation: WARNING**
> The generated skill has structural issues that could not be automatically resolved:
> - {description of unfixable issue}
> - {description of unfixable issue}
>
> The skill is presented as-is. Please review and address these issues manually before using it.

## Quality Suggestions

Regardless of pass/fail status, include quality suggestions for optional fields and best practices that would enhance the skill. These are never marked as failures — they are recommendations.

Format quality suggestions as a separate section after the validation status:

> **Quality suggestions:**
> - Consider adding a `license` field to specify usage terms
> - The description could include more specific trigger keywords for better agent discoverability
> - Consider adding `agents/openai.yaml` with a `display_name` and `short_description` for better Codex UI integration
> - SKILL.md body exceeds 500 lines; consider moving reference material to a `references/` subdirectory

**Which suggestions to surface** (by platform):

- **OpenCode**: Suggest `license`, `compatibility`, `metadata` fields if not present and they would add value. Suggest description improvements if trigger context is missing. Suggest progressive disclosure if body is long.
- **GAS**: Same as OpenCode, plus suggest extension fields if targeting a specific agent. Suggest the `.agents/skills/` path for maximum portability.
- **Codex**: Suggest `agents/openai.yaml` if not generated (especially `interface.display_name` and `interface.short_description`). Suggest moving extra frontmatter fields to `openai.yaml`. Suggest scope boundaries in description if missing.

## Integration with Stage 4

The validation engine is invoked at a specific point in the Stage 4 pipeline:

1. **4.2 / 4.X: Rendering** — Generate the skill content
2. **Structural Validation** — Run the validation engine on the rendered content
3. **4.3: Output Path Selection** — Prompt for the output path (user sees validation results here)
4. **4.4: File Writing** — Write the validated (and possibly auto-fixed) content
5. **4.5: Post-Generation Summary** — Include validation status in the summary

The validation report is presented immediately after rendering and before the output path prompt, giving the user visibility into the structural quality of the skill before deciding where to save it. The post-generation summary (4.5) references the validation status in its "Validation note" section.

## Validation Failure Does Not Block Output

Validation failures (warnings) never prevent the skill from being presented or written. The purpose of validation is to inform, not to gate. If validation finds unfixable issues:

1. The skill content is presented to the user with the WARNING report
2. The user can still choose an output path and write the file
3. The post-generation summary notes the outstanding issues
4. The user is responsible for manual correction of unfixable issues

This ensures that edge cases in platform specs or unusual skill requirements do not prevent the user from getting their skill file. The validation engine is a quality safeguard, not a blocker.
