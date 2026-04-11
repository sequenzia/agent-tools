# Naming Report: SDD Skills Rebrand

## Context

The SDD (Spec-Driven Development) skills in `plugins/sdd/` form a **complete software development lifecycle purpose-built for AI coding agents**. The pipeline transforms ideas into verified, tested code through five stages:

```
Idea → Spec Creation → Spec Analysis → Task Decomposition → Parallel Execution → Verified Code
```

**What makes it unique:**
- Adaptive interview-driven spec creation (3 depth levels, complexity detection, 9-domain recommendations)
- 4-dimension spec quality analysis with structured scoring
- Deterministic layer-pattern task decomposition with automatic dependency inference
- Wave-based parallel agent execution with cross-task knowledge sharing
- Structured verification against acceptance criteria (functional, edge cases, error handling, performance)
- Harness-agnostic file-based task state machine (works with any AI coding agent)
- Producer-consumer detection for context injection between dependent tasks

**Positioning statement:** *"The full software development lifecycle, purpose-built for AI agents."*

**Key constraint from user:** The name should explicitly reference AI agents or the concept of "agentic" development.

---

## Competitive Landscape Summary

### Names That Are Taken
All obvious compound names are heavily contested:
- **AgentForge** — 5+ competing products
- **AgentFlow** — 3+ products
- **AgentCraft** — 6+ products
- **CodeForge** — 5+ products
- **SpecFlow** — Trademarked by Tricentis
- **DevForge** — devforge.pro exists
- **Blueprint** — Taken by Pega, NVIDIA, Mozilla, others
- **Conductor** — 4+ products including a coding agent orchestrator
- **AgentOps** — Taken (observability platform)
- **Agentforce** — Taken by Salesforce

### Naming Patterns That Are Played Out
- Any `Agent-` or `Code-` prefix + `Forge/Flow/Pilot/AI` suffix
- Appending `-AI` to anything (feels 2023-era)
- The "forge" metaphor generally (massively overused)
- "Copilot" / "Pilot" compounds

### What Works in the Market
The most valuable brands (Cursor $10B, Lovable $6.6B, Bolt rapid growth) use **short, distinctive, ownable names**. None contain "agent," "code," or "AI" in the brand. However, the user *wants* an agent reference, so we should find ways to include it that don't feel generic.

---

## Naming Candidates

### Category 1: Agent-Forward Names
Names that explicitly reference AI agents or the agentic concept.

#### **1. Agentura**
*Latin/European: "an organized body of agents; an agency"*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | Literally means "an organized body of agents" in several European languages. Implies structure, delegation, and coordinated action. |
| **Tone** | Elegant, authoritative, slightly exotic. Feels like a premium platform. |
| **Pronunciation** | ah-jen-TOOR-ah (4 syllables) |
| **Memorability** | High — distinctive, rolls off the tongue, feels like a real word because it is one |
| **Agent reference** | Strong — "agent" is literally embedded, but elevated by the Latin suffix |
| **Lifecycle fit** | Good — an "agentura" is an organization with defined roles and procedures |
| **CLI ergonomics** | `agentura create-spec` works but is long; could shorten to `agt` (already used in this repo!) |
| **Domain potential** | agentura.dev, agentura.ai likely available |
| **Risks** | 4 syllables is on the long side. Some association with espionage ("agentura" is used for spy networks in Russian). Could be a feature (covert agents doing work) or a bug. |
| **Searchability** | Excellent — very distinctive, minimal noise |

#### **2. Agentik**
*Stylized spelling of "agentic"*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | A branded take on "agentic" — of or relating to agents acting autonomously |
| **Tone** | Modern, technical, buzzy. Feels like a category-defining product. |
| **Pronunciation** | ah-JEN-tik (3 syllables) |
| **Memorability** | High — close to a word people already know, distinctive K ending |
| **Agent reference** | Very strong — *is* the word "agentic" with a twist |
| **Lifecycle fit** | Moderate — signals agent-native but doesn't convey lifecycle |
| **CLI ergonomics** | `agentik create-spec` — clean, good length |
| **Domain potential** | agentik.dev, agentik.ai likely available |
| **Risks** | Very tied to the "agentic" buzzword cycle. If the industry moves past "agentic" terminology, the name ages poorly. The -ik suffix could feel gimmicky. |
| **Searchability** | Good — distinctive spelling differentiates from generic "agentic" |

#### **3. AgentArc**
*Agent + Arc (lifecycle arc, story arc)*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | The complete arc of agentic development — from beginning to end, a full trajectory |
| **Tone** | Clean, modern, balanced between technical and evocative |
| **Pronunciation** | AY-jent-ark (3 syllables, crisp) |
| **Memorability** | High — two simple words, clear mental image of a complete arc/journey |
| **Agent reference** | Explicit — "Agent" is right there |
| **Lifecycle fit** | Excellent — "arc" directly conveys a full lifecycle/journey from start to finish |
| **CLI ergonomics** | `agentarc create-spec` or shortened `arc create-spec` |
| **Domain potential** | agentarc.dev, agentarc.ai |
| **Risks** | "Agent" prefix puts it in the crowded Agent-X namespace. "Arc" is used by Arc browser. Two-word compound may feel less premium than a single coined word. |
| **Searchability** | Good — compound is distinctive enough |

#### **4. AgentLoom**
*Agents weaving parallel threads into cohesive code*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | A loom weaves parallel threads (warp and weft) into unified fabric. Agents as parallel threads being woven into a cohesive codebase. |
| **Tone** | Evocative, creative, slightly poetic. Unique in the dev tools space. |
| **Pronunciation** | AY-jent-loom (3 syllables) |
| **Memorability** | High — vivid imagery, unexpected metaphor |
| **Agent reference** | Explicit |
| **Lifecycle fit** | Good — weaving implies taking many inputs and producing unified output |
| **CLI ergonomics** | `agentloom create-spec` or `loom create-spec` |
| **Domain potential** | agentloom.dev, agentloom.ai |
| **Risks** | "Loom" is taken by the screen recording tool ($1.5B company). The weaving metaphor may not immediately signal "developer tool" to newcomers. |
| **Searchability** | Good but "Loom" alone is contested |

#### **5. Agencia**
*Spanish/Portuguese for "agency" — an organized body that acts*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | An organized group that acts with purpose. Implies coordination, delegation, structure. |
| **Tone** | Warm, international, accessible. Feels modern and inclusive. |
| **Pronunciation** | ah-HEN-see-ah (4 syllables) |
| **Memorability** | High — familiar-sounding, easy to remember |
| **Agent reference** | Strong — "agent/agency" is embedded |
| **Lifecycle fit** | Moderate — implies organization but not specifically lifecycle |
| **CLI ergonomics** | `agencia create-spec` — works well |
| **Domain potential** | agencia.dev likely available (agencia.com is taken — it's a common Spanish word) |
| **Risks** | Very common word in Spanish/Portuguese — could cause confusion in those markets. Hard to own as a trademark. |
| **Searchability** | Poor — too common a word in Romance languages |

---

### Category 2: Abstract/Coined Names (with Agent Nod)
Names that hint at autonomy or orchestration without spelling out "agent."

#### **6. Dirigent**
*German/Latin: "conductor" — the one who directs the orchestra*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | The conductor of an orchestra — directing many performers through a complete piece. From Latin *dirigere* (to direct, to align). |
| **Tone** | Authoritative, cultured, technical. Feels like serious infrastructure. |
| **Pronunciation** | DEER-i-jent (3 syllables) |
| **Memorability** | High — sounds like a real word (it is), unusual in English |
| **Agent reference** | Subtle — conducting/directing agents is implied, not stated |
| **Lifecycle fit** | Good — a conductor leads from overture to finale (full arc) |
| **CLI ergonomics** | `dirigent create-spec` — distinctive, professional |
| **Domain potential** | dirigent.dev, dirigent.ai likely available |
| **Risks** | May be hard to spell for English speakers. The agent reference is too subtle — user wants explicit. Musical metaphor may not land for everyone. |
| **Searchability** | Excellent — very distinctive |

#### **7. Fabrica**
*Latin: "workshop, place of skilled making" — root of "fabricate" and "fabric"*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | A place where things are skillfully made. Root of both "fabricate" (to construct) and "fabric" (woven material). Captures both the manufacturing and weaving metaphors. |
| **Tone** | Classical, premium, authoritative. Feels like a serious platform. |
| **Pronunciation** | FAB-ri-ka (3 syllables) |
| **Memorability** | High — sounds familiar, easy to say, elegant |
| **Agent reference** | None — this is purely about the process, not the actors |
| **Lifecycle fit** | Excellent — a fabrica is where raw materials become finished goods through defined process |
| **CLI ergonomics** | `fabrica create-spec` — works well |
| **Domain potential** | fabrica.dev, fabrica.ai |
| **Risks** | No agent reference at all. Could be any dev tool. Some existing uses (Fabrica is a company name in other industries). |
| **Searchability** | Good — distinctive enough in tech context |

#### **8. Opifex**
*Latin: "maker, creator, craftsman" — opus (work) + facere (to make)*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | "One who creates works" — a craftsman who produces finished artifacts from raw materials. The emphasis is on skilled creation, not raw labor. |
| **Tone** | Scholarly, distinctive, premium. Feels like a tool for serious builders. |
| **Pronunciation** | OH-pi-fex (3 syllables) |
| **Memorability** | Medium — unusual word, may need to hear it twice |
| **Agent reference** | None directly, but "maker" implies autonomous creation |
| **Lifecycle fit** | Good — opifex creates complete works, not fragments |
| **CLI ergonomics** | `opifex create-spec` — distinctive but unfamiliar |
| **Domain potential** | opifex.dev, opifex.ai likely available |
| **Risks** | Hard to spell, unfamiliar word, no agent reference. May feel pretentious. |
| **Searchability** | Excellent — extremely distinctive, zero noise |

---

### Category 3: Hybrid Names (Creative + Agent Reference)
Names that combine creative metaphors with clear agent positioning.

#### **9. AgentForge**
*The most literal option — agents forging code from specs*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | A forge where AI agents transform specifications into working code through heat and pressure (rigor, verification). |
| **Tone** | Strong, direct, industrial. Immediately communicable. |
| **Pronunciation** | AY-jent-forj (3 syllables) |
| **Memorability** | Very high — two simple, powerful words |
| **Agent reference** | Maximum — it's half the name |
| **Lifecycle fit** | Good — forging implies transformation from raw material to finished product |
| **CLI ergonomics** | `agentforge create-spec` or `forge create-spec` |
| **Domain potential** | Contested — 5+ existing products use this name |
| **Risks** | **Heavily contested namespace.** 5+ products already use "AgentForge." "Forge" is the most overused metaphor in dev tools. May feel generic rather than distinctive. |
| **Searchability** | Poor — too many competing results |

#### **10. Forja**
*Spanish/Portuguese for "forge" — short, warm, international*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | "Forge" — transformation through heat and skilled effort. |
| **Tone** | Warm, approachable, international. Short and punchy. |
| **Pronunciation** | FOR-ha (2 syllables) |
| **Memorability** | High — short, unique in English, easy to say |
| **Agent reference** | None — would need tagline/branding to connect to agents |
| **Lifecycle fit** | Good — forging is transformation |
| **CLI ergonomics** | `forja create-spec` — excellent, short |
| **Domain potential** | forja.dev, forja.ai likely available |
| **Risks** | No agent reference. Spanish speakers will just hear "forge" — may not feel branded. |
| **Searchability** | Good — distinctive in English tech context |

#### **11. Agentic Forge**
*Two words: the agentic way to forge software*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | A forge that operates agentically — AI agents autonomously forging code through structured process. |
| **Tone** | Descriptive, clear, professional. No ambiguity about what it is. |
| **Pronunciation** | ah-JEN-tik FORJ (4 syllables total) |
| **Memorability** | High — two real words, immediately parseable |
| **Agent reference** | Maximum — "Agentic" is the defining adjective |
| **Lifecycle fit** | Good — forge implies complete transformation |
| **CLI ergonomics** | `agentic-forge create-spec` — long; could shorten to `af` or `forge` |
| **Domain potential** | agenticforge.dev, agenticforge.ai |
| **Risks** | Two-word names feel less "brand-y." Tied to the "agentic" buzzword. "Forge" is overused. |
| **Searchability** | Good — the compound is distinctive |

#### **12. AgentCursus**
*Agent + Latin "cursus" (course, defined path, lifecycle)*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | The defined course/path that agents follow — from spec to verified code. *Cursus* in Latin means a running course, a career, a defined journey. |
| **Tone** | Technical, classical, intellectual. Signals methodology. |
| **Pronunciation** | AY-jent-KUR-sus (4 syllables) |
| **Memorability** | Medium — "cursus" is unfamiliar to most |
| **Agent reference** | Explicit |
| **Lifecycle fit** | Excellent — "cursus" literally means lifecycle/course |
| **CLI ergonomics** | `agentcursus` is too long; would need shortening |
| **Domain potential** | agentcursus.dev likely available |
| **Risks** | Too long, "cursus" is obscure. Academic feel may alienate casual users. |
| **Searchability** | Excellent — very distinctive |

#### **13. AgentSpec**
*Agents + Specifications — the spec-driven approach*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | Specifications that agents execute. The spec is the contract, agents are the builders. |
| **Tone** | Clean, technical, descriptive. Immediately clear. |
| **Pronunciation** | AY-jent-spek (3 syllables) |
| **Memorability** | High — simple, descriptive, easy to remember |
| **Agent reference** | Explicit |
| **Lifecycle fit** | Partial — emphasizes the spec phase more than the full lifecycle |
| **CLI ergonomics** | `agentspec create-spec` — clean |
| **Domain potential** | agentspec.dev, agentspec.ai |
| **Risks** | Emphasizes specs over the full lifecycle (execution, verification). May sound like a spec-writing tool rather than a complete lifecycle product. |
| **Searchability** | Good |

#### **14. Tekton**
*Greek: "builder, craftsman" — the master builder*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | Master builder/craftsman. In ancient Greek, a *tektōn* was a skilled worker who could build anything. Root of "architect" (*archē* + *tektōn* = chief builder). |
| **Tone** | Technical, strong, classical. Feels like serious infrastructure. |
| **Pronunciation** | TEK-ton (2 syllables) |
| **Memorability** | Very high — short, punchy, easy to spell |
| **Agent reference** | Subtle — builder implies autonomy, but no explicit agent reference |
| **Lifecycle fit** | Good — a tektōn builds complete structures from plans |
| **CLI ergonomics** | `tekton create-spec` — excellent |
| **Domain potential** | **Conflict: Tekton Pipelines** is a Kubernetes CI/CD project by Google |
| **Risks** | Major conflict with Tekton Pipelines (Kubernetes). Same space (CI/CD, build pipelines). Would cause significant confusion. |
| **Searchability** | Poor — dominated by Tekton Pipelines results |

---

### Category 4: Bold/Ambitious Names

#### **15. Konstrukt**
*German-influenced spelling of "construct" — building from structured plans*

| Attribute | Assessment |
|-----------|------------|
| **Meaning** | To construct — building something from a structured plan/blueprint. The K spelling adds distinctiveness and a tech edge. |
| **Tone** | Bold, technical, precise. The Germanic spelling signals engineering rigor. |
| **Pronunciation** | kon-STRUKT (2 syllables) |
| **Memorability** | High — familiar word with distinctive spelling |
| **Agent reference** | None — would need branding to connect to agents |
| **Lifecycle fit** | Good — construction implies a full build process |
| **CLI ergonomics** | `konstrukt create-spec` — distinctive, good length |
| **Domain potential** | konstrukt.dev, konstrukt.ai |
| **Risks** | No agent reference. "K for C" substitution is a common branding trick that some find cliché. Might be confused with OOP "construct/constructor" concepts. |
| **Searchability** | Good — K spelling differentiates |

---

## Top Recommendations

Based on all research, here are my **top 5 recommendations** ranked by overall fit:

### Rank 1: **Agentura**
> *"An organized body of agents"*

**Why it's the best fit:**
- Embeds "agent" naturally without feeling like another `Agent-X` compound
- The Latin suffix elevates it from buzzword to brand
- Literally means what the product is: an organized system of agents working together
- Distinctive, ownable, zero namespace conflicts in dev tools
- The slight espionage connotation (covert agents executing missions) adds intrigue
- Works at all audience levels: individual devs find it cool, enterprises find it authoritative
- Tagline writes itself: *"Agentura — the agentic development lifecycle"*

**Concerns:** 4 syllables (mitigated by CLI shortening to `agt`, which you already use). Espionage association may not appeal to everyone.

### Rank 2: **AgentArc**
> *"The complete arc of agentic development"*

**Why it's strong:**
- "Arc" perfectly captures the lifecycle emphasis (beginning → middle → end)
- Clear, immediate, no explanation needed
- Two simple syllables after "Agent" keeps it crisp
- Works as both brand and concept: "the agent arc" = the full journey
- Good CLI: `arc create-spec` feels natural

**Concerns:** "Agent-X" compound puts it in a crowded namespace. "Arc" is used by Arc browser, though different domain. Less distinctive than coined words.

### Rank 3: **Agentik**
> *"The agentic development platform"*

**Why it's strong:**
- Directly references "agentic" — the exact term the user wants
- The -ik suffix makes it ownable and brandable (vs. generic "agentic")
- Short, punchy, modern
- Category-defining ambition — "agentik" could become synonymous with the approach

**Concerns:** Heavily tied to the "agentic" buzzword cycle. If industry terminology shifts, the name ages. The -ik suffix is somewhat gimmicky.

### Rank 4: **AgentLoom**
> *"Weaving parallel agent threads into cohesive code"*

**Why it's strong:**
- The loom metaphor is genuinely perfect for this product (parallel threads → unified fabric)
- "Text" and "textile" share the same Latin root (*textere* = to weave) — code is literally text being woven
- Vivid, memorable imagery that stands out from forge/flow/pilot metaphors
- Captures the wave-based parallel execution model beautifully

**Concerns:** "Loom" is a major brand (screen recording, $1.5B). The weaving metaphor requires a moment of explanation — not instantly obvious as a dev tool.

### Rank 5: **Dirigent**
> *"The conductor — directing agents through the full score"*

**Why it's strong:**
- Fresh, distinctive, zero conflicts in dev tools
- Musical conductor metaphor maps perfectly: directing many performers through a complete piece with defined movements (phases)
- Phonetically strong — sounds authoritative
- Ages well — not tied to any buzzword

**Concerns:** Agent reference is too subtle for the user's stated preference. May be hard to spell. Musical metaphor may not resonate with all developers.

---

## Comparison Matrix

| Name | Agent Ref | Lifecycle Fit | Uniqueness | Memorability | CLI Feel | Longevity | Risk |
|------|-----------|--------------|------------|-------------|----------|-----------|------|
| **Agentura** | Strong | Good | Excellent | High | `agt` | Strong | Low |
| **AgentArc** | Explicit | Excellent | Good | High | `arc` | Moderate | Medium |
| **Agentik** | Maximum | Moderate | Good | High | `agentik` | Weak | Medium |
| **AgentLoom** | Explicit | Good | Good | High | `loom` | Strong | Medium |
| **Dirigent** | Subtle | Good | Excellent | High | `dirigent` | Excellent | Low |
| **Fabrica** | None | Excellent | Good | High | `fabrica` | Excellent | Low |
| **AgentForge** | Explicit | Good | Poor | Very High | `forge` | Moderate | High |
| **Konstrukt** | None | Good | Good | High | `konstrukt` | Strong | Low |
| **AgentSpec** | Explicit | Partial | Good | High | `agentspec` | Moderate | Low |
| **Forja** | None | Good | Good | High | `forja` | Strong | Low |

---

## Tagline Ideas (for top candidates)

| Name | Tagline Options |
|------|-----------------|
| **Agentura** | "The agentic development lifecycle" / "From idea to verified code" / "Your agents, organized" |
| **AgentArc** | "The complete arc" / "Idea to code, verified" / "The full arc of agentic development" |
| **Agentik** | "Build software the agentic way" / "Spec. Decompose. Execute. Verify." |
| **AgentLoom** | "Weaving code from specs" / "Parallel agents, unified code" |
| **Dirigent** | "Conducting agentic development" / "Direct your agents" |

---

## Implementation Notes

Once a name is chosen, the following files would need updating:
- `plugins/sdd/` — directory rename to `plugins/{new-name}/`
- `plugins/manifest.json` — update the SDD section
- All SKILL.md frontmatter references to "SDD" or "Spec-Driven Development"
- `CLAUDE.md` — project documentation references
- `apps/task-manager/` — any SDD references in the UI
- Memory files referencing SDD

The skill command names (`/create-spec`, `/analyze-spec`, `/create-tasks`, `/execute-tasks`) could remain unchanged since they describe actions, not the brand. The brand name would be the *collection* name, not the individual skill names.
