---
name: six-hats
description: Run a multi-model Six Thinking Hats deliberation on a topic or decision. Use when the user wants a decision weighed from several angles — facts, gut feeling, risks, upside, creative alternatives, and a synthesized conclusion — especially "six thinking hats", "pros and cons and risks", or "look at this from different perspectives". Each hat can run on a different local or cloud model.
---

# Six Hats

Run a headless six-thinking-hats deliberation and present the returned Markdown.

## How to use

Run the CLI and present the Markdown it prints on stdout.

- Installed as a **plugin**: `node "$CLAUDE_PLUGIN_ROOT/bin/six-hats.js" "<the user's topic>"`
- Installed **globally** (`npm i -g .` from the repo): `six-hats "<the user's topic>"`
- From the **six-hats repo** directory: `node bin/six-hats.js "<the user's topic>"`

If `$CLAUDE_PLUGIN_ROOT` is empty, fall back to a globally-installed `six-hats`, or run `node bin/six-hats.js` from the six-hats repo.

Useful flags:
- `--engine <id>` — run every hat on one model (e.g. `--engine claude`); default mixes different local models per hat.
- `--hats white,black,blue` — only run some hats.
- `--json` — machine-readable output.
- `--quiet` — suppress the stderr progress lines.
- `--list-engines` — see what models are available first.

The command prints Markdown (topic → each hat's take with its model → 🔵 blue's synthesis) on stdout; progress goes to stderr. Capture stdout and present it to the user.
