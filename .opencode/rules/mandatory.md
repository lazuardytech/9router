# Mandatory Rules - Melma Router

**These rules are SACRED and must ALWAYS be followed without exception.**

---

## 💬 Rule 1: Response Standard (MANDATORY)

**NEVER display empty responses containing only "..." or "…"**

- If processing/thinking, do NOT output "..." while working
- Either provide meaningful content or no response at all
- Empty "..." responses are confusing and provide zero value
- This rule must always be followed

**Why**: Empty ellipsis responses waste user attention and provide zero information. Users prefer silence during processing over meaningless placeholder text.

### Examples

```
❌ FORBIDDEN:
User: "analyze the code"
Agent: "..."
Agent: <uses tools>

✅ CORRECT:
User: "analyze the code"
Agent: <uses tools immediately, no text>
Agent: <returns findings after tools complete>
```

**When to send text:**
- ✅ After tools complete, with actual findings
- ✅ Asking clarifying questions
- ✅ Reporting results

**When NOT to send text:**
- ❌ Before/during tool execution
- ❌ "Processing...", "Thinking...", "...", "…"
- ❌ Any placeholder or filler

**If you have nothing meaningful to say, DO NOT RESPOND. Just call tools directly.**

---

## 🤖 Rule 2: Subagent Usage (MANDATORY)

### ⚠️ CRITICAL: NO NESTED SUBAGENTS

**Subagents MUST NOT spawn other subagents. This is absolutely forbidden.**

- Subagents can only use tools and commands (Read, Grep, Bash, Edit, Write, etc.)
- Subagents CANNOT use the Task tool or skill tool
- There must be NO nested subagent calls - only the main agent can spawn subagents
- This rule is mandatory and must always be followed

**Why**: Subagents don't have access to the skill system and nested calls create unnecessary complexity and context bloat.

**Enforcement**: When writing prompts for subagents, explicitly instruct them to use only direct tools (Read, Grep, Bash, etc.) and never spawn additional subagents.

```
❌ FORBIDDEN:
Main agent → subagent A → subagent B (NEVER DO THIS)

✅ CORRECT:
Main agent → subagent A
Main agent → subagent B (parallel)
```

**If you are a subagent:**
- ✅ Use: read, grep, glob, bash, edit, write
- ❌ NEVER use: Task tool, skill tool

**If subagent needs more work:**
1. Return findings to main agent
2. Main agent spawns additional subagents if needed

### Required Subagent Delegation

**Always delegate these tasks to a subagent via the Task tool:**

| Task Type | Use Subagent? | Agent Type |
|-----------|---------------|------------|
| Find all files matching pattern | ✅ YES | `explore` |
| Analyze how system X works | ✅ YES | `explore` |
| Multiple independent searches | ✅ YES | `explore` (parallel) |
| Multi-step research | ✅ YES | `general` |
| Build / install / compile tasks | ✅ YES | `general` |
| Code review / analysis | ✅ YES | `explore` or `general` |
| Single file edit | ❌ NO | Do inline |
| 1-2 grep queries | ❌ NO | Do inline |
| Read specific known file | ❌ NO | Do inline |

**Available subagents:**

- `explore` — Codebase exploration. Specify thoroughness: `quick` / `medium` / `very thorough`
- `general` — Multi-step research, parallel work, build tasks

**Quick decision tree:**

```
Need >3 searches? → explore subagent
Multiple independent tasks? → spawn parallel subagents
Single file edit? → do inline
Context getting heavy? → spawn subagent
Build/install/compile? → general subagent
```

**Why**: Keeps main context window lean; verbose tool output stays in subagent.

---

## 🔒 Rule 3: Code Style (MANDATORY)

### No Comments Unless Asked

Code conventions discourage comments. Only add if user explicitly requests.

**Why**: This project follows a clean code philosophy where code should be self-documenting.

### Language Standard

- All code and code comments must use English
- Do not write code comments in other languages

---

## 🏗️ Rule 4: Project-Specific Rules (CRITICAL)

### 1. Don't rename `9router`

Internal code uses original name (package, data dir, env, skills URL). See `.agents/knowledge/07-gotchas.md` #13.

**Why**: Skills metadata pulls from `decolua/9router` GitHub raw. Changing this would require forking skills and updating `SKILLS_RAW_BASE`.

### 2. `open-sse` is local

Aliased via `jsconfig.json`, don't `npm install open-sse`.

**Why**: It's a local in-repo package, NOT in `package.json`. Has its own folder layout. No dist step — edits are live.

### 3. Test before push

No PR/push CI. Run `npx eslint .` and `cd tests && npm test` locally first.

**Why**: CI runs only on tag push. No automated lint/test gate on PR/push.

### 4. `log.warn()` disabled

Use `log.error` or `console.warn` instead.

**Why**: `src/sse/utils/logger.js:43` body is commented-out. Calls produce no output.

### 5. Docker publish

CI auto-publishes on `v*` tag push. Bump `package.json` version manually.

**Tags generated**:
- `latest` (on master branch)
- `x.y.z` (full version only, no major/minor tags)

### 6. Sync upstream

```bash
git fetch upstream && git merge upstream/master
```

**Why**: This is a fork of `decolua/9router`. Keep in sync with upstream changes.

---

## ⚠️ Rule 5: Critical Prohibitions (NEVER DO THIS)

1. **Add `/v1/*` Next pages** - They're shadowed by rewrites in `next.config.mjs`
2. **Hard-import `better-sqlite3`** - It's optional dependency, code falls back to `sql.js`/`lowdb`
3. **Remove singleton pattern** - `global.__appSingleton` protects from HMR duplicate timers
4. **Blanket-rename `9router`** - Coordinate first, affects skills hosting
5. **Skip lint/tests** - No CI safety net, must test locally
6. **Use `log.warn()`** - It's disabled, use `log.error` or `console.warn`
7. **Modify MITM init order** - `process.env.MITM_SERVER_PATH` must be set before manager init

---

## ✅ Rule 6: Critical Requirements (ALWAYS DO THIS)

1. **Read before editing** - Understand code conventions, imports, existing patterns
2. **Match project style** - Use existing libraries, follow naming conventions
3. **Test changes** - Run lint and tests locally before push
4. **Check gotchas** - Read `.agents/knowledge/07-gotchas.md` before non-trivial edits
5. **Preserve conventions** - No comments unless asked, follow existing patterns
6. **Document significant changes** - Update relevant knowledge docs if needed

---

## 📋 Rule 7: Quick Reference - Common Mistakes

| ❌ DON'T | ✅ DO |
|---------|-------|
| Send "..." while processing | Call tools directly without text |
| Add code comments | Only add if user asks |
| `npm install open-sse` | It's local package (jsconfig.json) |
| Rename `9router` → `melma-router` | Keep internal names (see gotcha #13) |
| Use `log.warn()` | Use `log.error` or `console.warn` |
| Add `/v1/*` Next pages | They're shadowed by rewrites |
| Push without testing | Run lint/tests locally first |
| Spawn nested subagents | Only main agent spawns subagents |
| Hard-import `better-sqlite3` | It's optional, has fallbacks |

---

## 🎯 Rule 8: Success Criteria Checklist (MANDATORY)

Before considering your changes complete:

- [ ] ✅ Understand code before changing it
- [ ] ✅ Read relevant knowledge docs (especially gotchas)
- [ ] ✅ Match existing code style and conventions
- [ ] ✅ Use existing libraries (don't introduce new ones)
- [ ] ✅ Test changes locally (lint + tests)
- [ ] ✅ No comments added (unless user asked)
- [ ] ✅ No "..." responses sent while processing
- [ ] ✅ Subagents used appropriately (no nesting)
- [ ] ✅ Code follows project conventions

---

## ⚡ Critical Reminder

> **This is a production router handling AI inference traffic.**

- ✅ Test locally FIRST (no CI safety net)
- ✅ Read gotchas before non-trivial changes
- ✅ Match existing patterns and conventions
- ✅ Keep responses meaningful (no "..." placeholders)
- ✅ Use subagents for heavy exploration
- ✅ Preserve project-specific conventions
- ✅ When in doubt, read the knowledge docs

---

**These rules are non-negotiable and must be respected at all times.**

**Last Updated**: 2026-05-06  
**Status**: MANDATORY/SACRED
