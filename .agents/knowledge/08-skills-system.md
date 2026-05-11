# Skills System

Two distinct things share the name "skills":

## (a) `skills/` directory at repo root

Markdown specs (`SKILL.md`) for AI agents (Claude Code, Cursor, ChatGPT) to consume. Each agent platform has its own way of installing skills; they all fetch the raw `SKILL.md` from GitHub.

### Layout

```
skills/
├── README.md                ← index
├── 9router/SKILL.md         ← entry skill (configures NINEROUTER_URL/KEY)
├── 9router-chat/SKILL.md
├── 9router-image/SKILL.md
├── 9router-tts/SKILL.md
├── 9router-stt/SKILL.md
├── 9router-embeddings/SKILL.md
├── 9router-web-search/SKILL.md
└── 9router-web-fetch/SKILL.md
```

### Frontmatter

```yaml
---
name: <skill-name>
description: <one-liner>
---
```

### Entry skill instructs reader to:

1. Set env vars `NINEROUTER_URL` (e.g. `http://localhost:20128`) and `NINEROUTER_KEY` (API key)
2. Hit `/v1/...` OpenAI-compat endpoints
3. Discover models via `/v1/models{,/image,/tts,/embedding,/web,/stt,/image-to-text}`

## (b) Dashboard "Skills" page

Live at `/dashboard/skills` — `src/app/(dashboard)/dashboard/skills/page.js`.

Reads metadata from **`src/shared/constants/skills.js`**:

```js
SKILLS_RAW_BASE = "https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills"
SKILLS = [
  { id, name, description, endpoint, icon, isEntry? },
  ...
]
getSkillRawUrl(id) → ${BASE}/${id}/SKILL.md
getSkillBlobUrl(id) → GitHub web URL
```

Page renders the list, lets user copy/preview the raw `SKILL.md` URL.

## Adding a new skill

1. Create `skills/<id>/SKILL.md` with YAML frontmatter
2. Add entry to `SKILLS` array in `src/shared/constants/skills.js:12-70`
3. **Commit + push to `decolua/9router@master`** for the raw URL to resolve

⚠️ **For 9router**, `SKILLS_RAW_BASE` points at the upstream repo. New skills committed only to 9router won't be reachable via the dashboard until either:
- Skills are mirrored to `decolua/9router@master`, OR
- `SKILLS_RAW_BASE` is changed to `lazuardytech/9router`

Coordinate before adding skills to avoid dead links.
