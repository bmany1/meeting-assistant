# Meeting Assistant: Build Spec for Claude Code

## How to use this document

You are building a single-file React app that runs as a **claude.ai Artifact**. This is not a normal web app, and it does not deploy to a server, GitHub, or Vercel. The finished product is one `.tsx` file that gets pasted into a claude.ai chat, rendered as an artifact, and shared as a claude.ai link.

Read "Deployment model" and "Hard constraints" before writing any code. Everything you build has to run inside the claude.ai artifact sandbox, which has a specific and limited set of capabilities. When in doubt, pick the simplest approach that fits the constraints below.

The human you are building for is newer to development, so explain your reasoning in plain language as you go, and avoid jargon where a normal word will do.

---

## TL;DR

* **One file.** One default-exported React component. No extra files, no separate CSS.
* **Only React plus the artifact library allowlist.** No other npm packages (no axios, no date-fns, no zustand, no react-router, etc.).
* **No browser storage.** No `localStorage`, `sessionStorage`, cookies, or IndexedDB. Persist with `window.storage` (documented below).
* **The AI runs inside the app** through a keyless `fetch` to the Anthropic API. The claude.ai runtime supplies the credentials. This only works inside claude.ai, so AI features cannot be tested on the local machine.
* **Persistence is tied to the specific artifact.** A new version of the app starts with empty storage, so the app needs an Import feature and a versioned data schema so data can move from one version to the next.
* **No HTML `<form>` tags.** Use `onClick` and `onChange` handlers instead.

---

## Deployment model (this part is unusual, read it)

Here is the full lifecycle so you understand why the constraints exist:

1. We build and refine the code here, locally, with Claude Code.
2. When a version is ready, the output is a single `.tsx` file.
3. The human pastes that file into a new chat in their work instance of Claude and asks Claude to render it as an artifact.
4. The artifact runs inside claude.ai's sandbox. There is no Node server, no build step, and no hosting provider in production. The sandbox is the runtime.
5. The human clicks Share, copies the link, and bookmarks it. Opening that link reopens the live app.

Two consequences fall out of this:

* The app cannot rely on anything that needs a server or a secret. No environment variables, no `process.env`, no backend routes, no API keys in the code.
* The app's two most important features (the AI and the saved data) depend on abilities that only exist inside claude.ai. They will not run locally. This is expected, not a bug.

---

## Hard constraints (the app breaks without these)

These are non-negotiable. Build to them from the first line.

1. **Single file.** All components, styles, helpers, and data logic live in one `.tsx`. Do not split into modules.
2. **Allowed libraries only.** You may import React and its hooks, plus the artifact allowlist:
   `lucide-react` (icons), `recharts`, `chart.js`, `plotly`, `d3`, `lodash`, `mathjs`, `papaparse`, `xlsx` (SheetJS), `tone`, `three`, `mammoth`, `tensorflow`, and `shadcn/ui`.
   Nothing else. If a task seems to need another package, solve it with built-in browser APIs, native `Date`, and React state instead.
3. **No browser storage APIs.** `localStorage`, `sessionStorage`, cookies, and IndexedDB are blocked in artifacts and will fail. Use `window.storage` (below) for anything that needs to persist.
4. **One default-exported React component.** Standard functional component with hooks.
5. **No `<form>` tags.** Use buttons with `onClick` and inputs with `onChange`. This is a hard requirement of the artifact plus in-app-AI environment.
6. **Styling: stay consistent with the current pattern.** The existing app uses inline style objects driven by a `BRAND` token object and `SERIF` / `SANS` font constants. Continue that. If you ever use Tailwind instead, only core utility classes work (there is no compiler for custom values), so inline styles are the safer choice here.

---

## The AI layer: the keyless Anthropic API

The app talks to Claude directly from inside the browser. Normally that requires a secret API key. Inside a claude.ai artifact, the runtime attaches the credentials for you, so there is no key anywhere in the code. This is the single most important runtime-specific detail, so use the exact pattern below.

```js
async function callClaude(prompt, { systemHint } = {}) {
  const body = {
    model: "claude-sonnet-4-20250514", // always Sonnet 4
    max_tokens: 1000,                   // runtime-managed, keep at 1000
    messages: [{ role: "user", content: prompt }],
  };
  if (systemHint) body.system = systemHint;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // no API key, runtime injects it
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);

  const data = await res.json();
  // Responses arrive as an array of content blocks. Collect the text ones.
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
```

Rules for using it:

* **Keep `max_tokens` at 1000.** The runtime manages this value. Do not expect to raise it meaningfully, so design AI outputs to fit inside that budget. If an output risks running long (for example a detailed briefing), tighten the prompt rather than asking for more tokens.
* **When you need structured data, ask for strict JSON and parse defensively.** Tell the model to return only JSON with no preamble and no markdown fences, then run the response through the helpers below. Never assume the response is valid JSON.

```js
function stripJSONFences(s) {
  return (s || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function safeParseJSON(text, fallback) {
  try {
    return JSON.parse(stripJSONFences(text));
  } catch {
    const m = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/); // grab first object or array
    if (m) {
      try { return JSON.parse(m[1]); } catch {}
    }
    return fallback;
  }
}
```

* **Fail gracefully and never lose user input.** Wrap every AI call so a failure shows a small inline error and leaves the user's data intact. The current app already does this well: it saves a note first, then runs analysis, so a failed analysis does not cost the user their note. Keep that ordering.
* **This call will not run locally.** On the local machine there is no key and the request will fail. The only place to test AI behavior is inside a claude.ai artifact. Plan the dev loop around that (see "Local development vs claude.ai testing").

### MCP connectors (optional, future)

The same in-app API can call approved MCP servers by adding an `mcp_servers` array to the request body. The human currently has two connectors available in their work instance: **Context7** and **Atlassian**. Atlassian could later let the app read Jira issues directly. Two caveats: each user has to authenticate an MCP connector on first use, and the org admin controls which connectors are allowed. Treat this as a lever for later, not a dependency for the core build. Do not add MCP calls unless the human asks for them.

---

## The persistence layer: window.storage

`window.storage` is a small key-value store that claude.ai gives to artifacts so data survives between sessions. It is how the app remembers meetings, notes, todos, and so on. Wrap it exactly like the current app does:

```js
const storage = {
  async get(key) {
    try {
      const r = await window.storage.get(key, false); // false = private to this user
      return r ? r.value : null;
    } catch {
      return null; // a missing key can throw, so treat that as "no value"
    }
  },
  async set(key, value) {
    try {
      const v = typeof value === "string" ? value : JSON.stringify(value);
      await window.storage.set(key, v, false);
      return true;
    } catch (e) {
      console.error("storage.set failed", key, e);
      return false;
    }
  },
  async delete(key) {
    try { await window.storage.delete(key, false); return true; }
    catch { return false; }
  },
  async getJSON(key) {
    const v = await storage.get(key);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  },
};
```

Rules and limits:

* **Values are strings.** `JSON.stringify` on the way in, `JSON.parse` on the way out. The wrapper above handles this.
* **Always pass the `shared` flag explicitly.** `false` means the data is private to the current user, which is what this app wants. (`true` would expose it to everyone using the artifact. Do not use `true` here.)
* **Reading a missing key can throw rather than return null.** The wrapper catches this and returns null, so always go through the wrapper.
* **Key format:** keep keys under 200 characters with no spaces, slashes, or quotes. Use a simple namespace pattern like `meetings:list`, `meeting:{id}`, `app:insights`.
* **Values cap at about 5MB per key, and writes are rate limited.** Batch related data into a single key instead of writing many keys in a row. For example, store a meeting's notes, todos, and decisions under one `meeting:{id}` object rather than three separate writes.
* **Last write wins.** There is no merging, so read, modify, then write the whole object back (the current app already does this).

### The migration gotcha (important)

Storage is tied to the **specific artifact**. When we ship a new version, the human pastes new code, Claude makes a brand-new artifact, and that new artifact starts with **empty storage**. The old data does not follow automatically. To handle this cleanly, build two things into the app now:

1. **Import to match the existing Export.** The current app has an Export button (`exportJSON`) that downloads everything as a JSON file, but it has no way to read that file back in. Add an Import feature: a file input that reads the JSON text, validates it, and writes it into `window.storage`. This is what lets data move from version 1 to version 2.
2. **A schema version.** Write a small meta record (for example `app:meta` holding `{ schema_version: 1 }`) and include `schema_version` in the export payload. On import, check the version so future changes to the data shape can be migrated instead of silently breaking.

---

## Local development vs claude.ai testing

Because the AI call and `window.storage` only exist inside claude.ai, the dev loop looks like this:

* **In Claude Code (local):** build and refine the UI, the data logic, the components, and anything that does not depend on the two claude.ai-only features. This is most of the code and most of the work.
* **In a claude.ai artifact (testing):** paste the single `.tsx`, render it, and test the AI features and the saving/loading there. This is the only place those two things actually run.

To keep the UI from crashing during local development, you may add this small optional shim near the top of the file. It only activates when the real `window.storage` is missing (so it never runs in production), and it stores data in memory only, which is fine because real persistence is verified inside claude.ai. Do not use `localStorage` for this.

```js
// Optional local-dev fallback. Skipped in claude.ai, where window.storage already exists.
if (typeof window !== "undefined" && !window.storage) {
  const mem = new Map();
  window.storage = {
    get: async (k) => (mem.has(k) ? { key: k, value: mem.get(k) } : null),
    set: async (k, v) => { mem.set(k, v); return { key: k, value: v }; },
    delete: async (k) => { mem.delete(k); return { key: k, deleted: true }; },
    list: async (prefix = "") => ({ keys: [...mem.keys()].filter((k) => k.startsWith(prefix)) }),
  };
}
```

---

## Functional requirements (preserve these)

The current app already does the following. Keep all of it working as the stable foundation. The human will direct new features separately.

**Dashboard view**

* A list of recurring meetings shown as cards. Each card shows name, cadence, purpose, last and next meeting dates, and a count of open todos.
* A "Brief me" action on each card that jumps into that meeting and generates a pre-meeting briefing.
* A cross-meeting Insights panel: the app sends a summary of all meetings to Claude and gets back 3 to 5 short observations about patterns, overlaps, and risks across meetings. Insights are cached in storage and can be refreshed.
* Search across meetings.
* Export (download all data as JSON). **Add Import alongside it** (see migration gotcha).
* Create a new meeting.

**Meeting view**

* A box to paste raw meeting notes, with a "Save and analyze" action. Analysis sends the note (plus the rolling summary, recent notes, and current open todos for context) to Claude and gets back structured JSON: extracted todos (with priority, an inferred due date, and a short source snippet), extracted decisions, inferred completions of existing todos, and an updated rolling summary.
* A notes list with view, edit, and delete.
* A todos list with create, edit, complete, delete, and priority. Todos can be auto-completed by analysis when a note shows they are done.
* A talking points list with create, edit, mark discussed, and delete.
* A decisions log.
* A per-meeting chat ("Ask") that answers questions using that meeting's context (summary, recent notes, open todos, talking points).
* "Brief me" generates a markdown briefing with these sections: Since last time, Open with you, Suggested talking points, Questions to ask.

**Meeting setup**

* Create and edit meetings through a modal: name, cadence (Weekly, Biweekly, Monthly, Ad hoc), purpose, key people, next meeting date. Delete with confirmation.

**General**

* Everything persists through `window.storage`.
* The layout is responsive and has mobile tab handling. Keep it usable on a phone.

---

## Data model (keep stable)

Storage keys and the shapes behind them. Keep these stable so Import and any future migration have a fixed target.

```
meetings:list  ->  Meeting[]

Meeting = {
  id, name, cadence,            // cadence: "Weekly" | "Biweekly" | "Monthly" | "Ad hoc"
  purpose, people,
  last_meeting_date, next_meeting_date, created_at
}

meeting:{id}  ->  MeetingData

MeetingData = {
  summary,                      // rolling AI summary
  notes: Note[],
  todos: Todo[],
  decisions: Decision[],
  talking_points: TalkingPoint[],
  chat: ChatMsg[]
}

Note         = { id, timestamp, content }
Todo         = { id, text, priority, due_date, source_meeting_id,
                 source_note_id, source_snippet, status,            // priority: "High"|"Medium"|"Low", status: "open"|"completed"
                 created_at, completed_at, auto_completed }
Decision     = { id, text, source_note_id, timestamp }
TalkingPoint = { id, text, status, created_at }                     // status: "open" | "discussed"
ChatMsg      = { role, content, timestamp }                         // role: "user" | "assistant"

app:insights  ->  { items: string[], last_refreshed }
app:meta      ->  { schema_version }   // add this
```

Helpers the current app uses and you should keep: `uid(prefix)` for ids and `nowISO()` for timestamps.

---

## Enhancement backlog (user-driven, to be defined)

The human will define the specific "more robust" features in conversation with you. Do not invent scope here. The only concrete near-term additions that are already decided:

* **Import feature** to match Export (required for version-to-version data migration).
* **Schema version** in storage and in the export payload.

Treat everything in "Functional requirements" as the foundation to extend, and ask the human before adding anything that changes the data model.

---

## Code conventions

* Match the existing patterns: inline style objects, a single `BRAND` color token object, `SERIF` and `SANS` font constants, and small reusable UI atoms (buttons, cards, inline confirm, inline error, spinner).
* **Every AI prompt must instruct the model to avoid em dashes.** The human strongly dislikes them. The current prompts already include this. Keep it in every prompt that generates text the user will read.
* Keep AI prompts that need structure returning strict JSON, parsed with the `safeParseJSON` fallback. Never trust raw output to be valid JSON.
* Wrap every AI and storage call so failures are caught, shown as a small inline message, and never destroy user data.
* Keep the layout responsive and phone-friendly.

---

## Will not work (do not attempt)

* No server-side code, Node backend, API routes, environment variables, or `process.env`.
* No external API calls that require a key, except the keyless Anthropic call the runtime handles and any approved MCP servers the human explicitly asks for.
* No `localStorage`, `sessionStorage`, cookies, or IndexedDB.
* No file system access beyond the Export download (a Blob plus a temporary anchor) and the Import read (a file input reading text).
* No multiple files and no separate CSS files.
* No `<form>` elements.
* No npm packages outside the allowlist in "Hard constraints."

---

## Human handoff checklist (for shipping a version)

1. Claude Code outputs the final single `.tsx`.
2. Paste the full code into a new chat in the work instance of Claude and ask it to render as an artifact.
3. Make sure the AI-powered capability is on for the artifact.
4. Test the AI features and the saving/loading inside the artifact.
5. Click Share, then Share and copy link. Bookmark the new link.
6. To carry data over from a previous version: Export from the old artifact, then Import into the new one.
