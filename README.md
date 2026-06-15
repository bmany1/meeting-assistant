# Meeting Assistant 

▐▛███▜▌
▜█████▛▘
▘▘ ▝▝

Turn a pile of messy meeting notes into a verified, ranked list of what to actually do next. Runs entirely inside a Claude chat. No app to install, no account to make, no server, no API key.

## Why this exists

Most people have Claude Chat. Way fewer have Claude Code or Cowork, which are the tools you'd normally reach for to build or run something custom. So if the chat window is all you've got, you're kind of stuck. You can ask Claude things, but you can't really build yourself a tool that remembers your data and does real work for you day to day.

This is proof that you're not stuck.

Meeting Assistant is a full, persistent, AI-powered app that lives entirely inside a single Claude chat. You paste one file in, it renders as an interactive app, you bookmark the link, and that's your tool. It remembers your meetings and to-dos between sessions. It calls Claude to do the heavy lifting. And it pulls all of that off with no server, no hosting, and no secret keys anywhere, because the Claude runtime quietly handles the parts that normally need a backend.

If the chat is all you have, this is for you.

## What it does

You dump your meeting notes in, typed or pasted, in whatever shape they're already in. The app reads them and pulls out three things: your to-dos, the decisions that got made, and any status updates.

Nothing gets treated as fact until you say so. Every item it pulls shows you the exact line from your notes it came from, so you can check it in a second. Anything it had to guess at, like a due date, gets clearly marked as a guess instead of quietly slipped in as the truth.

Everything stacks up two ways: by meeting, so you can follow one recurring sync over time, and by project, so you can see a single theme across every meeting it touched.

Then there's the cockpit. Every time you open the app, it gives you the same clear answer to three questions: what should I work on next, what's due, and what's quietly slipping. That part runs on plain logic, not AI, so you get the exact same answer on every open. No surprises, no drift.

And it stays calm about all of it. When something's overdue or slipping, it tells you in a quiet, matter-of-fact way instead of lighting up red and nagging you. Red shows up for exactly one thing: confirming you actually want to delete something.

## Get it running

The app ships as one file: `meeting-assistant.tsx`. Here's how you turn it into your tool:

1. Open `meeting-assistant.tsx` and copy everything in it.
2. Start a new chat in [claude.ai](https://claude.ai), paste it in, and let it render as an artifact.
3. Turn on the artifact's AI capability, then hit Share to get a link you can bookmark.

That bookmarked link is your app from here on out.

One thing worth knowing: the two best parts, the AI analysis and your saved data, only work inside claude.ai. They won't run if you open the file somewhere else. That's not a bug, it's the whole design. The claude.ai sandbox is the engine.

## Under the hood

This part is for the curious and for anyone who wants to fork it. It gets more technical from here.

### The deployment model

This isn't a normal web app, and that's the interesting bit. The whole product is one `meeting-assistant.tsx` file: a single default-exported React component. To run it for real, you paste it into claude.ai and let it render as an artifact (the three steps up in "Get it running").

The claude.ai sandbox **is** the production runtime. Two consequences follow from that:

- AI analysis and saved data only work inside claude.ai. They don't run locally. That's expected, not a bug.
- There are no secrets anywhere. The runtime injects the credentials for the keyless `fetch`, so there's no API key sitting in the code.

### Architecture highlights

- **Earned trust over automation.** Nothing is presented as fact until verified. Every extracted item shows its verbatim source quote. Inferred fields like due dates are visibly marked as inferred, never silently applied.
- **Per-source records are the source of truth.** A compact `app:ledger` index gets rebuilt wholesale from those records on each accept (never read-modify-merge), which sidesteps the runtime's last-write-wins storage and keeps reads cheap.
- **Deterministic cockpit.** "What's next / due / slipping" is computed locally with no AI variance, so it's the same answer on every open. AI is additive (a once-daily focus narrative), never load-bearing.
- **Quiet by default.** Escalation varies in form (wording, grouping, placement), never volume. Overdue and stale are shown soberly. Red is reserved for destructive confirmation only.
- **Resilient intake.** Chunked extraction for long notes, deterministic quote anchoring, and dismissal tombstones that stop a model paraphrase from resurrecting a dismissed item.

### Constraints (by design)

- **Single file.** Every component, style, helper, and bit of data logic lives in one `.tsx`. No modules and no separate CSS in the shipped artifact.
- **Allowlisted libraries only.** React with hooks plus a small artifact allowlist. This build uses only `react` and `lucide-react`.
- **No browser storage APIs.** `localStorage`, `sessionStorage`, cookies, and IndexedDB aren't available. Persistence runs through the runtime's `window.storage`.
- **No `<form>` elements.** Buttons with `onClick`, inputs with `onChange`.

### Local development

There's a Vite + Vitest harness under `dev/` so you can preview and test the UI on your own machine. It never ships into the artifact. Only `meeting-assistant.tsx` does.

```bash
npm install
npm run dev      # preview the UI in a browser (AI + persistence are non-functional locally)
npm test         # run the unit + render test suite
```

AI calls and real persistence get verified inside a claude.ai artifact, not locally.

### Repository layout

| Path | What it is |
|------|------------|
| `meeting-assistant.tsx` | The single shippable artifact (the whole product) |
| `dev/` | Local Vite + Vitest harness (never shipped) |
| `PRODUCT.md`, `DESIGN.md` | Product identity and the design system |
| `docs/` | Ideation, brainstorm, plan, research, and design specs |
| `meeting-assistant-spec.md` | Authoritative requirements |
| `CLAUDE.md` | Durable build context for AI-assisted development |

## License

Released under the [MIT License](LICENSE).