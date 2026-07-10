# Six Hats — Portable Open-Source Redesign

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan

## 1. Problem

`six-hats-v2` is a "Six Thinking Hats" multi-agent deliberation board: a user enters
a topic and several AI personas each give an opinion. The current backend
(`server.js`) does not call any cloud API as its primary path — it `spawn`s the
author's **local CLI tools** (`openclaw agent`, `acpx exec`, `gemini`) to generate
each agent's turn, with a MiniMax API call only as a fallback.

This makes the project unrunnable on any machine but the author's. Concrete blockers:

1. Backend shells out to `openclaw` / `acpx` / `gemini` CLIs that do not exist elsewhere.
2. Hardcoded `/opt/homebrew/bin/gemini` (Apple-Silicon + Homebrew only).
3. Hardcoded `HOME: '/Users/qinxue'` fallback.
4. State file hardcoded to `/tmp/...` (no `/tmp` on Windows).
5. The 10 agents are the author's private openclaw workspace agents (双儿, 沐剑屏, …).
6. No README, no `.env.example`, no run instructions, no license.

## 2. Goal

Turn it into an open-source, cross-platform (macOS / Windows / Linux) app that
**anyone can run with `npm install`**. Core principle: **prefer locally installed
AI agents, fall back to a cloud model API**. The six hats speak with (optionally
different, optionally random) models. The blue hat auto-summarizes the others.

Out of scope for this iteration: packaging as an agent-invocable Skill (planned as a
future second shell over the same kernel).

## 3. Architecture

```
Frontend (Vite + React, existing UI adapted)
  └─ engine-detection panel · topic input · six hat cards (assign / pin / re-roll)
     · timeline · blue-hat summary

Backend (Node / Express)
  ├─ engines/
  │   ├─ detect.js        which-probe CLIs · probe Ollama · read cloud config
  │   ├─ adapters/        claude · codex · agy · openclaw · hermes · ollama
  │   │                   · openai-compat · custom(template)
  │   └─ (each adapter)   run(prompt, {model}) -> Promise<string>   // unified interface
  ├─ hats.js             six hat personas (system prompts) + skin/theme support
  ├─ assign.js           engine→hat assignment (random to concrete model / allow
  │                       reuse / manual pin)
  ├─ orchestrate.js      white/red/black/yellow/green in parallel → blue summarizes
  └─ server.js           routes + static hosting

Config
  ├─ .env                PORT + cloud API keys (a provider is enabled only if key present)
  ├─ config.json         cloud endpoint list · custom CLI templates · skins · prompt overrides
  └─ .env.example · README (EN + zh) · LICENSE (MIT)
```

## 4. Engine pool (detection + local-first)

An **engine** is anything that takes a prompt and returns text, exposing a single
`run(prompt, { model }) -> Promise<string>` interface. Three families:

- **CLI engine** — wraps a local command, detected via `which`. Built-in adapters:
  `claude`, `codex`, `agy` (antigravity, replaces gemini), `openclaw`, `hermes`.
  Each uses that CLI's headless one-shot invocation (exact flags verified against a
  real local install during implementation).
- **Ollama engine** — `GET http://localhost:11434/api/tags` enumerates local models;
  each model becomes its own engine. Calls via Ollama HTTP API.
- **Cloud engine** — OpenAI-compatible. Registered only when a key is present in
  `.env` / `config.json`. Covers OpenAI, DeepSeek, MiniMax, Moonshot, Groq,
  OpenRouter, etc. Claude/Gemini reachable via their OpenAI-compatible endpoints.
- **Custom engine** — a user-defined command template in `config.json`
  (`{ name, cmd: 'mytool -p {prompt}', parse: 'json:.text' | 'raw' }`) for any CLI
  not built-in.

Startup detection builds the pool. The frontend shows what was found, e.g.
`claude ✅ · agy ✅ · hermes ✅ · ollama (qwen2.5, llama3) ✅ · OpenAI ❌ no key`.

**Priority:** assignment prefers local engines; cloud is used only when no local
engine exists. If nothing is available, the UI prompts the user to add a key in `.env`.

## 5. Hat personas + assignment

- Classic De Bono six: White (facts), Red (intuition/emotion), Black (caution/risk),
  Yellow (optimism/value), Green (creativity), Blue (process/synthesis). Each is a
  system prompt.
- **Blue is special:** its input is the topic **plus the other five hats' outputs**;
  its output is the synthesized conclusion.
- **Skins:** `config.json` may override each hat's display name / avatar (default =
  classic). Personas (the prompts) stay; only presentation changes.
- **Assignment:** default = random **to concrete model** (so six hats can be six
  distinct voices, including different Ollama models). **Reuse allowed** (if the pool
  is smaller than six, engines repeat). A hat can be **pinned** to a chosen engine;
  the rest stay random. A **re-roll** re-randomizes unpinned hats.

## 6. Run flow

1. User enters topic (optionally picks a skin) → Run.
2. `assign` maps engines → six hats (random / pinned).
3. White/Red/Black/Yellow/Green run **in parallel**, each `engine.run(hatPrompt + topic)`.
4. Results collected → Blue runs `engine.run(bluePrompt + topic + five outputs)` → summary.
5. Results streamed to the frontend; state persisted to `os.tmpdir()` (cross-platform,
   replacing the hardcoded `/tmp`).

## 7. Error handling

- A single hat's failure is **isolated**: that card shows the error; the others proceed.
- Blue summarizes only the hats that succeeded.
- An engine failure may **fall back to cloud** if a cloud key is configured.

## 8. Portability fixes (mapped to §1 blockers)

| Blocker | Fix |
|---|---|
| spawn hard-deps on openclaw/acpx/gemini | detection-based engine pool, graceful when absent |
| `/opt/homebrew/bin/gemini` | resolve binaries via `PATH` |
| hardcoded `HOME` | removed |
| `/tmp` state file | `os.tmpdir()` |
| private workspace agents | six hat personas |
| no docs/license | README (EN+zh) · `.env.example` · MIT LICENSE |

## 9. Testing

- `assign.js`: random distribution, pinning, reuse when pool < 6.
- `hats`: all six personas present and well-formed; blue receives others' outputs.
- `detect`: mocked `which` / Ollama probe / cloud-key presence.
- adapters: output parsing (JSON extraction, text cleanup) per family.
- one end-to-end smoke test with a stub engine.

## 10. Deliverables

Cross-platform: `npm install → npm run build → npm start` (prod), `npm run dev` (dev).
Bilingual README (EN + 中文). `.env.example`. MIT LICENSE. No hardcoded machine paths.

## 11. Open items deferred

- Skill shell (agent-invocable) — future iteration over the same kernel.
- Native Anthropic / Gemini adapters — only if their OpenAI-compat endpoints prove
  insufficient.
- Streaming token-by-token UI — current design updates per-hat on completion.
