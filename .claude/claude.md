---
title: StudyBuddy — Claude Config
aliases:
  - StudyBuddy CLAUDE
tags:
  - studybuddy
  - claude-config
  - project-root
cssclasses:
  - claude-config
project: studybuddy
type: claude-config
status: active
related:
  - "[[studybuddy/README]]"
  - "[[studybuddy/Dependencies]]"
---

# StudyBuddy — Claude Config

Local-first AI-powered learning platform. Node.js/Express server with a Python core for intelligent tutoring, quiz generation, concept mapping, and Socratic dialogue. All AI runs via Ollama — zero cloud dependencies.

## Stack
- **Backend:** Node.js + Express (`server.js`, port 3000)
- **AI Agent:** Custom agent loop (`agent/agentLoop.js`) — dynamic taxonomy, smart cache, trie search
- **Python Core:** `python/studybuddy_core.py` — Ollama inference bridge
- **Frontend:** PWA (`public/`) — Service Worker, offline support, Web App Manifest
- **Routes:** `/chat`, `/quiz`, `/progress`, `/agent`, `/socratic`, `/conceptMap`, `/admin`
- **Data:** `data/cache.json`, `data/progress.json`, `data/taxonomy_learned.json`
- **AI Model:** Ollama `localhost:11434`

## Key Files
| Path | Purpose |
|------|---------|
| `server.js` | Express server entry point |
| `agent/agentLoop.js` | Main AI agent orchestrator |
| `agent/tools.js` | Tool definitions for the agent |
| `agent/dynamicTaxonomy.js` | Auto-learning topic taxonomy |
| `agent/smartCache.js` | Response caching layer |
| `agent/trie.js` | Trie-based topic search |
| `python/studybuddy_core.py` | Python ↔ Ollama AI bridge |
| `routes/chat.js` | Chat endpoint |
| `routes/quiz.js` | Quiz generation |
| `routes/socratic.js` | Socratic dialogue mode |
| `routes/conceptMap.js` | Concept map generation |
| `docs/MASTER_BLUEPRINT.md` | Full architecture blueprint |

## Dev Commands
```bash
npm start                          # Production server
npm run dev                        # Nodemon watch mode
node benchmark.js                  # Full benchmark suite
node benchmark.quick.js            # Quick benchmark
python3 python/studybuddy_core.py  # Python AI bridge
pip3 install -r python/requirements.txt  # Python deps
```

## Agent Strategy
Multi-agent architecture for token efficiency:
- **Primary agent:** `agentLoop.js` — routing, context loading, tool dispatch
- **Quiz subagent:** spawned per session with student progress context
- **Socratic subagent:** spawned per dialogue with concept context
- **Concept map subagent:** spawned per map request with taxonomy context

## Active MCPs
| MCP | Role |
|-----|------|
| `memory` | Persists student progress, taxonomy state, session context |
| `github` | Review PRs, check route logic, validate agent tools |
| `filesystem` | File access for routes and data layer |
| `fetch` | Content delivery and external resource fetching |

## Architecture Notes
- **Zero-Cloud:** All AI runs via Ollama at `http://localhost:11434` — never add external AI API calls
- **PWA:** Do NOT break `public/sw.js` or `public/manifest.json` — service worker handles offline
- **Cache:** `data/cache.json` is auto-managed by `smartCache.js` — never manually edit
- **Progress:** `data/progress.json` stores per-student progress — only update via `/progress` route
- **Taxonomy:** `data/taxonomy_learned.json` is auto-updated by `dynamicTaxonomy.js` — read-only

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade, /learn, /context-save, /context-restore.

Sprint order: /office-hours → /autoplan → build → /review → /qa → /ship → /retro
Security: run /cso before any production deploy.
Recovery: use /context-restore to resume interrupted sessions.
