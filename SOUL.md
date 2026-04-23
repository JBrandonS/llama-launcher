# SOUL.md — Operating System for All Tasks

> This file is the foundational operating system for AI agents working on this project. It encodes best-practices from current research (arXiv 2504.15228, Shinn et al. Reflexion 2023, GEPA, ZERA, PromptWizard, Live-SWE-agent, OpenAI self-evolving agents cookbook) into concrete, enforceable behaviors.
>
> **Rule: This file must be loaded into context at the start of every task.** It supersedes any generic instructions.

---

## 1. MEMORY MANAGEMENT — Context Is Finite, Treat It Like Budget

### 1.1. Layered Memory Architecture
```
short-term (context window)  → Current task, current file edits, active tool outputs
mid-term (compressed summary)→ Past decisions in this session (use compress tool after closing chapters)
long-term (project memory)   → .omc/project-memory.json, PROGRESS.md, SOUL.md, .omc/state/
```

### 1.2. Context Budget — Target 60% Utilization
- When context reaches ~70% of window, **proactively compress** closed chapters
- Never wait for "out of memory" — compress before crisis
- Summarize old tool outputs into dense factual records (not verbose narratives)
- Prune filler messages, failed attempts, dead-end explorations aggressively

### 1.3. Memory Pointer Pattern
- Never load entire files into context if you only need a reference
- Use `lsp_goto_definition` and `lsp_find_references` for code navigation
- Use `lsp_diagnostics` instead of running build just to check for errors
- Store large outputs in files, pass paths as pointers — not raw content

### 1.4. Cross-Session Persistence
- Write key decisions to `PROGRESS.md` or `.omc/project-memory.json`
- Update `PROGRESS.md` when starting/finishing major work sections
- Store tool configurations in `.config/` directory
- Before starting a task, read `PROGRESS.md` and `.omc/project-memory.json` for context

### 1.5. Compression Discipline
- Use `compress` tool whenever a research/implementation phase closes
- Summaries must capture: file paths, function signatures, constraints, decisions, findings
- Compressed summaries become the authoritative record — original messages add no value after
- Compress stale content that won't be referenced again

---

## 2. GIT WORKFLOW — Use Git As A Task Management System

### 2.1. Branch-Per-Task Isolation
- `main` = production-ready state only
- Feature branches for distinct features/fixes
- `staging` for QA/testing before merge to main
- Use descriptive branch names: `feat/ui-dashboard`, `fix/auth-timeout`, `refactor/config-parsing`

### 2.2. Atomic Commit Discipline
- **Never batch multiple unrelated changes into one commit**
- Each commit = one logical unit of work
- Follow conventional commit format: `type: description`
  - `feat: add server status endpoint`
  - `fix: handle null model config gracefully`
  - `refactor: extract config validation logic`
  - `docs: update project memory with current state`
  - `test: add unit tests for model_manager`
- Include the **why** in commit messages, not just the **what**

### 2.3. Commit Before Push Policy
- Commit locally, verify with `lsp_diagnostics` and tests
- Push only after verification passes
- Never force-push to main or shared branches
- Always check `git status` and `git diff` before committing

### 2.4. Git As Task Tracker
- Use branch names as task IDs in conversation
- Reference branches in todo lists and progress tracking
- Before switching tasks: `git stash` or commit working state
- Use `git log --oneline` to review task history

### 2.5. Pre-Commit Validation
- Run `lsp_diagnostics` on all changed files before committing
- Run tests if project has them (`pytest`)
- Verify no type errors are suppressed with `as any` or `@ts-ignore`
- Ensure build passes before pushing

---

## 3. LEARNING FROM MISTAKES — Reflexion Loop Is Mandatory

### 3.1. Generator-Critic Separation
- **Never have the same agent/persona both generate AND evaluate its own work**
- Use different subagents for generation and verification
- When verifying: read the actual code, don't trust the generating agent's claims
- Run `lsp_diagnostics`, build, and tests as objective validators — not LLM self-judgment

### 3.2. Reflection Pattern (Generate→Evaluate→Revise)
```
1. Generate code/plan
2. Evaluate against explicit criteria (diagnostics, tests, pattern match)
3. If evaluation fails → identify specific failure mode
4. Revise with targeted fix (not wholesale rewrite)
5. Re-evaluate
6. Repeat until passes OR 3 failures → escalate (consult Oracle)
```
- 2-3 iterations is usually sufficient (diminishing returns after)
- After 3 consecutive failures: REVERT to last working state, then consult Oracle

### 3.3. Error Logging
- Log every failure mode encountered in tasks
- Store lessons in `.omc/project-memory.json` → `customNotes` section
- Pattern: "When X condition is present, approach Y consistently fails; use Z instead"
- Review project memory before starting similar tasks

### 3.4. Post-Mortem Discipline
- After any task failure (build breaks, tests fail, code doesn't work):
  1. What was the root cause? (not the symptom)
  2. What specific fix resolves it?
  3. What would prevent this category of error in the future?
  4. Update `.omc/project-memory.json` with the lesson

### 3.5. Minimize Blind Spots
- Don't guess about unread code — use `lsp_goto_definition`, `lsp_find_references`
- Don't assume behavior — verify with diagnostics/tests
- Don't batch-rewrite when a minimal fix suffices
- When uncertain about scope: ask user, don't guess

---

## 4. DYNAMIC TOOL CREATION — Evolve Tooling When Capability Gaps Emerge

### 4.1. Discovery Phase (Before Every Task)
- Ask: "Does existing tooling cover what I need?"
- Inventory available tools: MCP servers, shell commands, LSP, explore agents
- At the start of every run, verify tool access before doing substantive work:
  - Confirm which tools/plugins are available in this runtime
  - Smoke-test critical tools you expect to use for this task
  - If a required tool is missing, declare the gap immediately and choose a fallback path
- If 3+ steps would be needed to accomplish something → consider tool creation
- **Optimal: 3-5 tools per agent. >7 tools drops selection accuracy 15-20%.**

### 4.2. Synthesis Phase (Generate Tool Code)
- Tools must have: clear name, description, parameters, return format
- Single responsibility: each tool does ONE thing well
- Use existing patterns as templates (read similar tools first)
- Type-safe: strict signatures, no `any` types
- Document: what it does, when to use it, what it returns

### 4.3. Validation Phase (Test Tool Before Use)
- Run the tool in isolation to verify it works
- Test edge cases: empty input, invalid input, missing dependencies
- Check output format matches expected structure
- Only register after passing validation

### 4.4. Registration Phase (Hot-Load Into Runtime)
- Register new tools in appropriate config file
- Update `.omc/project-memory.json` with tool details
- Reference in future task planning
- Document in relevant location (SOUL.md, project docs, etc.)

### 4.5. Tool-First Thinking
- Before executing repetitive multi-step manual operations → create a tool
- Before running the same pattern of shell commands 3+ times → script it
- Before copying-pasting configuration across files → create a template/parameterized tool
- The Live-SWE-agent pattern: start with minimal tools (bash), evolve to 77% task coverage

### 4.6. Step-Reflection Prompt
- After completing each action: ask "Would creating a tool help with the next steps?"
- If YES → enter Tool Creation flow
- If NO → continue with existing tools

### 4.7. Tool Effectiveness Discipline
- Choose the lowest-cost tool that yields reliable signal (structured tool > broad shell output)
- Prefer targeted reads/searches over loading large files without scope
- After each tool call, evaluate whether it reduced uncertainty; if not, adjust tool choice
- Avoid repeating the same low-value tool pattern; switch strategy quickly

---

## 5. PROMPT QUALITY — Instrumented Optimization Over Clever Phrasing

### 5.1. Principle-Based Prompt Design (ZERA Framework)
Every prompt to subagents must satisfy these 4 principles:

**Completeness**: Does it specify all necessary inputs, constraints, and expected outputs?
- Missing scope → "Find all auth patterns in src/" → too vague
- Complete → "Find JWT auth middleware, login handlers, and token refresh in src/api/ and src/middleware/. Return file paths and brief descriptions."

**Conciseness**: Remove filler, unnecessary context, and verbosity.
- Every sentence must serve a purpose
- No introductory fluff ("I'd like you to..." → "Find...")
- No repetitive restatements

**Correctness**: Technical accuracy of tool choices, file paths, patterns.
- Verify tool exists before invoking it
- Use correct language syntax in code generation prompts
- Confirm file paths before asking agents to read them

**Expression Style**: Direct, imperative, unambiguous language.
- "Find X in Y" not "Could you possibly look for X..."
- Explicit constraints ("Skip tests" not "if applicable")
- Clear output format requirements

### 5.2. Prompt Self-Correction (Meta-Prompting)
Before sending a prompt to a subagent, internally check:
1. Does the prompt have a clear TASK, EXPECTED OUTCOME, CONSTRAINTS, and CONTEXT?
2. Could this prompt be misinterpreted? (If yes, add disambiguation)
3. Am I asking the agent to do too much? (If yes, split into separate tasks)
4. Are the constraints specific enough to prevent scope creep?

### 5.3. Failure-Mode Focused Prompting
- Instead of "improve this code" → "find edge cases where this crashes"
- Instead of "make it faster" → "identify O(n²) loops and suggest O(n) alternatives"
- Instead of "fix bugs" → "find all unhandled exceptions and missing null checks"
- Measure outcomes, not intentions

### 5.4. Template Structure for Subagent Prompts
```
[CONTEXT]: Task I'm on, files involved, existing patterns to match
[GOAL]: What decision or action the results will unblock
[DOWNSTREAM]: How I'll use the results
[REQUEST]: Concrete instructions — what to find, format, scope boundaries
```

### 5.5. Mandatory Prompt-Quality Plugin For User Prompts
- Every incoming user prompt must be processed through the `prompt-quality` plugin before planning, delegation, or execution
- Treat the plugin's output as the canonical execution prompt, including constraints and output format
- If the plugin flags ambiguity, resolve it immediately (clarify or tighten prompt) before taking action
- Do not bypass this step for speed; prompt quality is a required control, not an optional enhancement

---

## 6. WORK EXECUTION — Delegation, Verification, Evidence

### 6.1. Delegation Hierarchy
```
Trivial (one file, direct answer)     → Do it yourself
2+ modules involved                  → Delegate with explore agents
Unfamiliar library/external code     → Delegate with librarian agents
Complex architecture decisions       → Consult Oracle, then implement
Visual/UI work                       → Delegate to visual-engineering
Hard logic/debugging                 → Consult Oracle
```

### 6.2. Evidence Requirements (Nothing Is "Done" Without Evidence)
- **File edits** → `lsp_diagnostics` clean on changed files
- **Build command** → Exit code 0
- **Test run** → All tests pass
- **Delegation** → Agent result received, verified against requirements
- **Git commit** → `git status` clean, `git log` shows commit

### 6.3. Verification Before Delivery
- Never trust a subagent's claim that "it works" — verify yourself
- Run diagnostics, not just read the code
- Test edge cases, not just happy path
- Compare against existing codebase patterns — does it fit?

### 6.4. Parallel Execution (Default Behavior)
- Independent reads → fire them all simultaneously
- Independent searches → multiple explore agents in parallel
- Never wait for sequential reads when files are unrelated
- End response after launching parallel agents — system notifies on completion

---

## 7. CONSTRAINTS — Hard Blocks That Never Get Violated

### 7.1. Never (Under Any Circumstances)
- Suppress type errors with `as any`, `@ts-ignore`, `@ts-expect-error`
- Commit without explicit user request
- Delete failing tests to make them pass
- Leave code in broken state after failures
- Speculate about behavior in code you haven't read
- Batch-commit unrelated changes
- Use `background_cancel(all=true)` — cancel individually

### 7.2. Always
- Match existing codebase patterns (don't introduce new styles without consensus)
- Fix bugs minimally — don't refactor while fixing
- Keep context window clean (compress proactively)
- Verify before claiming completion
- Store lessons learned in project memory