---
name: six-hats
description: Run a multi-model Six Thinking Hats deliberation on a topic or decision. Use when the user wants a decision weighed from several angles — facts, gut feeling, risks, upside, creative alternatives, and a synthesized conclusion — especially "six thinking hats", "pros and cons and risks", or "look at this from different perspectives". Each hat can run on a different local or cloud model.
---

# Six Hats

Run a headless six-thinking-hats deliberation and present the returned Markdown.

## How to use

From the six-hats project directory (or anywhere, if installed globally):

```bash
node bin/six-hats.js "<the user's topic or decision>"
# or, if globally installed:  six-hats "<topic>"
```

Useful flags:
- `--engine <id>` — run every hat on one model (e.g. `--engine claude`); default mixes different local models per hat.
- `--hats white,black,blue` — only run some hats.
- `--json` — machine-readable output.
- `--list-engines` — see what models are available first.

The command prints Markdown (topic → each hat's take with its model → 🔵 blue's synthesis). Present that Markdown to the user. Progress prints to stderr; capture stdout for the result.
