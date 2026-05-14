# Skills System

Status for this repo snapshot (v0.3.1):

- There is **no `skills/` directory** at repository root.
- There is **no dashboard `/dashboard/skills` page** in current route tree.
- There is no active `src/shared/constants/skills.js` registry in this branch.

## What `.agents` means here

In this repo, `.agents/` is an internal knowledge base for coding agents and contributors.
It is not a runtime feature consumed by the pod dashboard or API server.

## If a "skills" feature is needed later

Treat it as a new feature request and define explicitly:
1. data/source of truth
2. dashboard route and UI scope
3. repository location for skill manifests
4. publish/hosting rules
