# Product

## Register

product

## Users

A single operator (Bryan) who runs many recurring meetings and a set of cross-cutting
projects, and currently keeps meeting notes scattered across OneNote with no view that
connects across them. He opens the app multiple times a day, on both desktop and phone,
usually time-pressured and between meetings.

His job to be done: "Tell me what to work on next, what is due, and what is slipping,
across every meeting and project, and let me trust it because I verified the inputs."

A defining trait of this user: he does not trust AI to extract his notes correctly on the
first pass. Any system that silently ingests notes and presents results as fact loses his
trust immediately. Earned trust in the captured data is the precondition for trusting
anything built on top of it.

## Product Purpose

A note-intake-to-action loop. Bryan pastes a note dump into one inbox and points it at a
meeting or a project; the model extracts to-dos, decisions, and updates that he verifies
and corrects; everything aggregates two ways, by meeting (source) and by project (theme);
and a daily prioritization cockpit shows, instantly on every open, what to work on next,
what is due, and what is slipping, backed by owner-tagged commitments that resurface as
they go stale.

It runs as a single-file claude.ai artifact: no server, keyless in-browser AI calls capped
at a small output budget, key-value persistence, and everything proactive computed when the
app opens rather than pushed. Those constraints are documented in `CLAUDE.md`,
`meeting-assistant-spec.md`, and the plan; this document is about who it serves and why, not
how it is built.

Success looks like: Bryan opens the app at any moment and instantly sees a trustworthy,
ranked view of what is next, due, and slipping across everything, and he believes it,
because he verified what went in.

## Brand Personality

Calm, trustworthy, precise. Three words, in that priority order.

The visual identity uses a calm, premium financial-instrument design system built for this tool.
The brand is anchored by a deep indigo with warm rose and lavender accents on a clean neutral ramp.
A sober financial-instrument identity aligns directly with calm/trustworthy/precise; the product's
binding rules (one scarce signal, quiet non-alarm escalation, red reserved for destructive only) are
honored *within* the palette, not in spite of it. Exact tokens and role mapping live in `DESIGN.md`.

- **Voice:** sober and plain-spoken. Says what a thing is and what an action will do. No
  hype, no marketing buzzwords, no exclamation, no em dashes (a standing user rule).
- **Emotional goal:** relief and quiet confidence ("I can see everything and I trust it"),
  never urgency, guilt, or pressure. The tool is a steady instrument, not a taskmaster.
- **Posture:** the interface is an instrument that recedes so the work is what you see. It
  earns attention by being right, not by being loud.

## Anti-references

What this must NOT look or feel like (user-confirmed):

- **Loud nagging productivity apps.** Red badges, notification counts, streaks, overdue
  shaming, anything that escalates by getting louder. This directly contradicts the
  product's binding behavior: surfacing varies in form, never in volume, and overdue/stale
  styling stays quiet.
- **Generic SaaS dashboards.** Hero-metric template (big number + small label + gradient
  accent), gradient text, identical icon-heading-text card grids repeated endlessly, glassy
  decoration. The AI-slop default.
- **Cluttered enterprise tools.** Jira-style density without hierarchy, where everything is
  visible and nothing is prioritized. The cockpit's entire job is to make the one next
  thing obvious.

Also implicitly out of bounds (not selected but inconsistent with the identity):
cute/gamified consumer styling (mascots, confetti, achievement badges).

## Design Principles

1. **Earned trust over automation.** Nothing is presented as fact until verified. Show the
   work: verbatim provenance on every extracted item, inferred fields visibly marked as
   inferred (not confirmed), and no silent action ever. Trust in the inputs is the whole
   product.

2. **Quiet by default; signal, not noise.** Escalation varies form (wording, grouping,
   placement), never volume. Overdue and slipping are shown soberly. The hard "do-next" cap
   exists so the today-view never overflows. Attention is a budget the tool spends sparingly
   and only when it has earned the right.

3. **The deterministic floor is sacred.** The cockpit is instant and stable on every open,
   computed locally with no AI variance, same answer every glance. AI is additive (a
   once-daily focus narrative that frames consequences), never load-bearing for "what's
   next." Reliability is felt as sameness.

4. **Recede so the work shows.** Density serves the task; hierarchy makes the next thing
   obvious; the chrome disappears. Earned familiarity over invented affordances. The tool
   should feel like Things or Linear's calm side, not a place you admire, a place you act.

5. **Never lose the user's input.** Every AI or storage failure degrades to a small inline
   message and leaves data intact. The raw note is saved before analysis runs; a failed
   analysis never costs a note; a failed focus pass never blocks the cockpit.

## Accessibility & Inclusion

- **WCAG 2.1 AA.** Body text >= 4.5:1 against its background; large text (>= 18px, or bold
  >= 14px) >= 3:1. Placeholder text held to the same 4.5:1, never a faint gray. This matters
  even with a single user: the cockpit is read at a glance, often on a phone in variable
  light, and the calm/quiet palette must not become low-contrast-and-hard-to-read.
- **Reduced motion is not optional.** Every animation needs a `prefers-reduced-motion:
  reduce` alternative (crossfade or instant). Motion conveys state, never decoration.
- **Keyboard navigable** end to end; visible focus states on every interactive element.
- **State-distinguishable beyond color.** Owner type, inferred-vs-confirmed, and
  stale/escalation states must read without relying on hue alone (icon, label, or weight),
  so the quiet palette stays legible for color-vision differences.
- **Responsive and phone-friendly** is a functional requirement, not a nicety; the app is
  opened on a phone between meetings.
