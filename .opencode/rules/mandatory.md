# Mandatory Rules

## 🚨 CRITICAL: Response Rules (READ FIRST)

### Rule #1: NO EMPTY RESPONSES

**NEVER send "..." or "…" or any placeholder text while processing.**

```
❌ FORBIDDEN:
User: "analyze the code"
Agent: "..."
Agent: <uses tools>

✅ CORRECT:
User: "analyze the code"
Agent: <uses tools immediately, no text>
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

## Rule #2: Use Subagents for Non-Trivial Work

**WHEN to delegate to subagents:**

| Task Type | Use Subagent? | Agent Type |
|-----------|---------------|------------|
| Find all files matching pattern | ✅ YES | `explore` |
| Analyze how system X works | ✅ YES | `explore` |
| Multiple independent searches | ✅ YES | `explore` (parallel) |
| Multi-step research | ✅ YES | `general` |
| Single file edit | ❌ NO | Do inline |
| 1-2 grep queries | ❌ NO | Do inline |
| Read specific known file | ❌ NO | Do inline |

**Available subagents:**

- `explore` / `explorer` — Codebase exploration. Specify thoroughness: `quick` / `medium` / `very thorough`
- `general` — Multi-step research, parallel work
- `build` — Large refactors (primary mode)
- `plan` — Planning before implementation (primary mode)

**Quick decision tree:**

```
Need >3 searches? → explore subagent
Multiple independent tasks? → spawn parallel subagents
Single file edit? → do inline
Context getting heavy? → spawn subagent
```

## Rule #3: NO NESTED SUBAGENTS

**Subagents CANNOT spawn other subagents. Period.**

```
❌ FORBIDDEN:
Main agent → subagent A → subagent B (NEVER DO THIS)

✅ CORRECT:
Main agent → subagent A
Main agent → subagent B (parallel)
```

**If you are a subagent:**
- ✅ Use: read, grep, glob, bash, edit, write
- ❌ NEVER use: Task tool

**If subagent needs more work:**
1. Return findings to main agent
2. Main agent spawns additional subagents if needed

**Why this rule exists:** Subagents only have tools, not skills. Nesting creates complexity and violates execution model.

## Sacred Project Rules

### 1. No comments unless asked
Code conventions discourage comments. Only add if user explicitly requests.

### 2. Don't rename `9router`
Internal code uses original name (package, data dir, env, skills URL). See `.agents/knowledge/07-gotchas.md` #13.

### 3. `open-sse` is local
Aliased via `jsconfig.json`, don't `npm install open-sse`.

### 4. Test before push
No PR/push CI. Run `npx eslint .` and `cd tests && npm test` locally first.

### 5. `log.warn()` disabled
Use `log.error` or `console.warn` instead.

### 6. Docker publish
CI auto-publishes on `v*` tag push. Bump `package.json` version manually.

### 7. Sync upstream
`git fetch upstream && git merge upstream/master`

## Quick Reference: Common Mistakes

| ❌ DON'T | ✅ DO |
|---------|-------|
| Send "..." while processing | Call tools directly without text |
| Add code comments | Only add if user asks |
| `npm install open-sse` | It's local package (jsconfig.json) |
| Rename `9router` → `melma-router` | Keep internal names (see gotcha #13) |
| Use `log.warn()` | Use `log.error` or `console.warn` |
| Add `/v1/*` Next pages | They're shadowed by rewrites |
| Push without testing | Run lint/tests locally first |
