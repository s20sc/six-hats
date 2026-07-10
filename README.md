**English** | [中文](README.zh-CN.md)

# Six Hats

A local-first deliberation board built on Edward de Bono's Six Thinking Hats method — six AI personas debate your topic from six angles, then one of them synthesizes the discussion into a conclusion.

_Screenshot coming soon._

## What it is

You give the board a topic. Six hats each respond in character:

| Hat | Role |
|---|---|
| ⚪ White | Facts, data, information gaps — no opinions |
| 🔴 Red | Gut feeling, intuition, emotional reaction |
| ⚫ Black | Caution — risks, flaws, why it might not work |
| 🟡 Yellow | Optimism — value, benefits, feasibility |
| 🟢 Green | Creativity — new ideas, alternatives, lateral thinking |
| 🔵 Blue | Synthesis — reads the other five and gives a conclusion |

Each hat can be driven by a *different* model. Six Hats auto-detects whatever AI engines are available on your machine or in your `.env`, and randomly assigns one engine per hat. You can pin a hat to a specific engine or re-roll the assignment before running.

## How it works

- **Engine pool**: at startup the server probes for local agent CLIs (`claude`, `codex`, `agy`, `hermes`, `openclaw`), local Ollama models, any custom command templates you define in `config.json`, and OpenAI-compatible cloud endpoints (only enabled if their API key is present in `.env`).
- **Local-first**: when assigning engines to hats, local engines (CLI tools, Ollama) are preferred over cloud engines.
- **Cloud fallback**: if no local engines are detected, cloud engines fill in automatically — as long as at least one API key is configured.
- **Blue summary**: the five non-blue hats run first (in parallel), then Blue receives all five contributions and produces a closing synthesis.
- Nothing is required beyond Node.js — cloud keys and Ollama are both optional. If nothing is detected at all, the board tells you no engines are available instead of failing silently.

## Requirements

- Node.js ≥ 18
- Optional: one or more of `claude`, `codex`, `agy`, `hermes`, `openclaw` CLIs on your `PATH`
- Optional: [Ollama](https://ollama.com) running locally with at least one model pulled
- Optional: an API key for an OpenAI-compatible cloud provider (OpenAI, OpenRouter, etc.)

## Quick start

```bash
cp .env.example .env
# optional: cp config.example.json config.json
npm install
npm run build
npm start
```

Open http://localhost:3002.

For development with hot reload:

```bash
npm run dev
```

## Using local agents

If you have any of `claude`, `codex`, `agy`, `hermes`, or `openclaw` installed and on your `PATH`, Six Hats finds them automatically at startup — no configuration needed. If [Ollama](https://ollama.com) is running locally, every pulled model is also added to the pool.

To use `openclaw`, set `openclawAgent` in `config.json` to the agent id you want it to drive (it's `null`/disabled by default, since it needs an explicit agent id):

```json
{ "openclawAgent": "my-agent-id" }
```

## Using cloud engines

Copy `.env.example` to `.env` and fill in any key you have:

```bash
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
```

A cloud provider only becomes available in the engine pool if its key is set — leave it blank to disable it. The providers, base URLs, and model lists come from `config.json` (see `config.example.json`); copy it and edit the `cloud` array to add, remove, or change models.

## Custom CLI template

You can wire up any command-line tool as an engine via the `custom` array in `config.json`. The topic prompt is passed to your command through the `SIXHATS_PROMPT` environment variable, and stdout becomes the hat's response:

```json
{
  "custom": [
    { "name": "my-tool", "cmd": "my-tool --prompt \"$SIXHATS_PROMPT\"", "parse": "raw" }
  ]
}
```

On Windows, the template uses `%SIXHATS_PROMPT%` instead of `"$SIXHATS_PROMPT"`.

## Skins

Rename the hats or change their emoji without touching code, via the `skins` object in `config.json`:

```json
{
  "skins": {
    "white": { "name": "Fact Bot", "emoji": "📄" }
  }
}
```

## License

[MIT](LICENSE)
