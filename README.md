# Meeting Assistant

A calm, trustworthy personal assistant that turns meeting notes into verified, ranked action.
Paste a note dump, point it at a meeting or a project, and the app extracts to-dos, decisions, and
updates that you verify before anything is treated as fact. Everything aggregates two ways, by
meeting (source) and by project (theme), and a deterministic daily cockpit shows, instantly on every
open, what to work on next, what is due, and what is slipping.

It ships as a **single-file React component** that runs as a [claude.ai](https://claude.ai) Artifact:
no server, no production build step, keyless in-browser AI calls, and key-value persistence provided
by the runtime.

## The unusual part: the deployment model

This is not a normal web app. The deliverable is one `meeting-assistant.tsx` file containing a single
default-exported React component. To run it for real:

1. Open the file and copy its full contents.
2. Paste into a new chat in [claude.ai](https://claude.ai) and let it render as an Artifact.
3. Enable the artifact's AI capability, then Share to get a bookmarkable link.

The claude.ai sandbox **is** the production runtime. Two consequences follow:

- The two most important features, **AI analysis** and **saved data**, only work inside claude.ai.
  They do not run locally. That is expected, not a bug.
- There are no secrets anywhere. The runtime injects API credentials for the keyless `fetch`, so
  there is no API key in the code.

## Architecture highlights

- **Earned trust over automation.** Nothing is presented as fact until verified. Every extracted item
  shows its verbatim source quote; inferred fields like due dates are visibly marked as inferred,
  never silently applied.
- **Per-source records are the source of truth.** A compact `app:ledger` index is rebuilt wholesale
  from those records on each accept (never read-modify-merge), which sidesteps the runtime's
  last-write-wins storage and keeps reads cheap.
- **Deterministic cockpit.** "What's next / due / slipping" is computed locally with no AI variance,
  the same answer on every open. AI is additive (a once-daily focus narrative), never load-bearing.
- **Quiet by default.** Escalation varies in form (wording, grouping, placement), never volume.
  Overdue and stale are shown soberly; red is reserved for destructive confirmation only.
- **Resilient intake.** Chunked extraction for long notes, deterministic quote anchoring, and
  dismissal tombstones that stop a model paraphrase from resurrecting a dismissed item.

## Constraints (by design)

- **Single file.** All components, styles, helpers, and data logic live in one `.tsx`. No modules and
  no separate CSS in the shipped artifact.
- **Allowlisted libraries only.** React with hooks plus a small artifact allowlist; this build uses
  only `react` and `lucide-react`.
- **No browser storage APIs.** `localStorage`, `sessionStorage`, cookies, and IndexedDB are
  unavailable; persistence is through the runtime's `window.storage`.
- **No `<form>` elements.** Buttons with `onClick`, inputs with `onChange`.

## Local development

A Vite + Vitest harness under `dev/` lets you preview and test the UI locally. It never ships into
the artifact; only `meeting-assistant.tsx` does.

```bash
npm install
npm run dev      # preview the UI in a browser (AI + persistence are non-functional locally)
npm test         # run the unit + render test suite
```

AI calls and real persistence are verified inside a claude.ai artifact, not locally.

## Repository layout

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
