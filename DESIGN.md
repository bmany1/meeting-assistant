---
name: Meeting Assistant
description: A calm, trustworthy instrument for turning meeting notes into verified, ranked action — on the design system.
colors:
  indigo: "#2C2A4A"
  indigo-2: "#423D6E"
  indigo-3: "#645CA0"
  indigo-6: "#C6C2E0"
  slate: "#25262B"
  slate-dark: "#565860"
  slate-medium: "#7F8186"
  slate-light: "#D2D4D7"
  slate-xlight: "#F2F3F4"
  secondary-text: "#706C82"
  click-gray: "#4B4564"
  amber: "#F2853C"
  amber-40: "#F8CFB4"
  amber-20: "#FBE7D8"
  rose: "#E96B6E"
  rose-20: "#FBE1E1"
  plum: "#CE5780"
  plum-40: "#EBBBCB"
  plum-20: "#F5DCE4"
  divider: "#F1F2F3"
  stroke: "#C6C2E0"
  service: "#2F77E0"
  error: "#D32F2F"
  white: "#FFFFFF"
typography:
  # Families: brand = Aptos + Aptos Serif.
  # Aptos (Aptos Sans/Serif) is the free embeddable substitute; the sandbox artifact will most
  # likely render Aptos or system fonts, since it cannot load custom brand faces. Scale,
  # tracking, and weights below are the project's own type system.
  display: # Aptos Serif — greeting, project/meeting names, briefing H1.
    fontFamily: '"Aptos Serif", Georgia, "Times New Roman", serif'
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline: # Aptos — "Headline 5" (24/110/-2). View titles.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title: # Aptos Semibold — card/section headings, cockpit group labels.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body: # Aptos — "Body" (16/160/0). The default. Mobile drops to 14px.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  body-strong: # Aptos Semibold — "Body Caption" (16/160 Semibold). Emphasis.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "0"
  reading: # Aptos — "Body Large" (18-20/160). Focus narrative + briefings. Sans, not serif (serif is titles only).
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  label: # Aptos Semibold uppercase — "Table Headline" / "Navigation All Caps" (12/150/+2). Eyebrows, group labels.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.02em"
  meta: # Aptos — "Caption XS" (12/140/0). Metadata, captions.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  button: # Aptos Semibold — "Buttons" (14/-/0 Semibold).
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
  nav: # Aptos Semibold — "Navigation" (16/150/+2 Semibold).
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.02em"
  numeric: # Aptos tabular — "Numbers-Aptos". All dates, counts, ages, figures.
    fontFamily: 'Aptos, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  xs: "2px"
  sm: "4px"
  button: "6px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "9px 16px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.button}"
    padding: "8px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate-dark}"
    rounded: "{rounded.button}"
    padding: "8px 12px"
  input-text:
    backgroundColor: "{colors.white}"
    textColor: "{colors.slate}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  chip-iowe:
    backgroundColor: "{colors.slate-xlight}"
    textColor: "{colors.slate-dark}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  chip-waiting:
    backgroundColor: "{colors.indigo-6}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  pill-stale:
    backgroundColor: "{colors.slate-xlight}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  do-next-marker:
    backgroundColor: "{colors.amber}"
    rounded: "{rounded.full}"
---

# Design System: Meeting Assistant

> Built on **the project's own** design system (Aptos + Aptos Serif type
> from the Typography spec, Aptos as the embeddable substitute; Indigo / Slate /
> Plum-Rose-Amber palette). This is an internal tool for a single operator, so brand
> fidelity wins; the product's behavioral rules are honored *within* the palette.
> Type scale, tracking, and weights are the project's own spec; **component radius/spacing/elevation
> are provisional** (no component spec was supplied).

## 1. Overview

**Creative North Star: "The Instrument"**

A precision instrument wearing a sober institutional brand. Deep Indigo gravitas on a
clean near-white canvas, one warm Amber signal for what needs you now, and everything legible at a
glance. The product's job is to answer "what do I work on next, what is due, what is slipping" the
instant it opens, and to be believed, because the operator verified the inputs. So the interface
recedes: Indigo and a disciplined neutral ramp do the structural work, Amber is spent like
scarce currency, and the one next thing is always obvious.

Time pressure is shown quietly. Overdue and slipping items speak through a muted Secondary-text gray,
through position and weight and plain words, never through red, badges, or volume. Red exists in
exactly one place: confirming something destructive. There is no green in the palette, so
"done" and "confirmed" are signaled by an Indigo check and a solid-vs-muted treatment, never by an
invented success color.

This system explicitly rejects three things. It is not a loud nagging productivity app: no red
badges, no notification counts, no streaks, nothing that escalates by getting louder. It is not a
generic SaaS dashboard: no hero-metric template, no gradient text, no identical card grids, no glassy
decoration. It is not a cluttered enterprise tool: no density without hierarchy where everything is
visible and nothing is prioritized.

**Key Characteristics:**
- Calm, trustworthy, precise, in a sober institutional voice.
- Indigo is the structural brand; Amber is the one scarce signal; the rest is a Slate ramp.
- Quiet by default: time pressure shown through tone, placement, and words, never alarm.
- Flat and precise: hairline borders, small radius, near-zero shadow.
- Aptos two-voice type: Aptos Sans operates, Aptos Serif narrates.
- Motion conveys state in 150 to 250ms, never choreography; full reduced-motion alternatives.
- Responsive and phone-first: the cockpit is read on a phone between meetings.

## 2. Colors

the palette: an Indigo-purple primary, a Slate neutral ramp, and warm Plum / Rose /
Amber accents. No greens, no teals; warm accents are sparing and one-at-a-time.

### Primary
- **Indigo** (`#2C2A4A`): The structural brand color. Primary buttons (white text), active
  navigation, links and interactive text, identity headings, dark header/rail surfaces. It carries
  institutional gravitas and reads as authority, not alarm. Tints **Indigo 2** (`#423D6E`, hover),
  **Indigo 3** (`#645CA0`), through **Indigo 6** (`#C6C2E0`, the lightest, used as the
  "waiting-for" pill and emphasis stroke).

### Secondary (the single scarce signal)
- **Amber** (`#F2853C`): THE one scarce signal. The do-next row marker, the active/selected
  highlight, the single warm pop that means "this is what needs you." It is pale (2.3:1 on white), so
  it lives as a marker, a dot, or a soft fill under Slate text, never as text itself. That physics
  is the point: it forces rarity. Soft tints **Amber 40** (`#F8CFB4`) and **20** (`#FBE7D8`) back
  do-next emphasis. Used on at most 10% of any screen.

### Tertiary (quiet accents, never status)
- **Plum** (`#CE5780`) and **Rose** (`#E96B6E`): Warm category and editorial accents only, in
  their soft tints (**Plum 40/20** `#EBBBCB`/`#F5DCE4`, **Rose 20** `#FBE1E1`) for project-tag
  color-coding and quiet zoning. Never urgency, never status. Rose in particular is forbidden from
  meaning "overdue", its red-adjacency must not be confused with alarm. Amber is excluded from
  category use so it stays the scarce signal.
- **Service** (`#2F77E0`): System/informational accent (info icons, system links) used sparingly. Not
  the primary link color (Indigo is); large/icon use only, since it is marginal as small text.

### Neutral
- **Slate** (`#25262B`): Body text and primary ink. 15.2:1 on white.
- **Slate Dark** (`#565860`): Strong secondary text, ghost-button labels. 7:1.
- **Secondary Text** (`#706C82`): Muted secondary text, metadata, placeholders, AND the
  inferred-value and stale/slipping treatment. 4.7:1, never fainter for text.
- **Slate Medium** (`#7F8186`): Icons, disabled text, decorative only (3.85:1, not for body text).
- **Slate Light** (`#D2D4D7`): Input borders, disabled fills, stronger dividers.
- **Slate Extra Light** (`#F2F3F4`) / **Divider** (`#F1F2F3`): The page canvas and hairline
  dividers. Cards sit in **White** (`#FFFFFF`) on this near-white ground.
- **Stroke** (`#C6C2E0`): The emphasis/focus border (a light Indigo lavender), used on focus and
  selected states.

### System
- **Errors** (`#D32F2F`): Destructive confirmation and true error states ONLY. Never overdue, never
  stale, never a nudge.

### Named Rules
**The One Voice Rule.** Amber appears on at most 10% of any given screen, and only ever means
"this is what's next / active." Primary actions and brand are Indigo, not Amber. If two things
are Amber, neither is "next."

**The No-Alarm Rule.** Overdue, slipping, and stale states are forbidden from using Errors-red, Rose,
or any accent. Red means "you are about to destroy something." Time pressure is carried by
Secondary-text gray, by moving the item up, and by plain wording ("waiting 9 days"), never by alarm
color, badge counts, or saturation.

**The Inferred Ink Rule.** A value the model inferred but the user has not confirmed renders in
Secondary-text gray with a dotted underline and a small "inferred" tag. A confirmed value renders
solid in Slate with a small Indigo check. There is no success-green; trust is signaled by
weight, the check, and the tag, never by hue alone.

## 3. Typography

**Body / UI Font:** Aptos, with system-ui fallbacks
**Display / Editorial Font:** Aptos Serif, with Georgia fallbacks

**Character:** a two-typeface system. Aptos, a humanist sans, is the
workhorse for everything the operator clicks, types, and reads as data: headlines, body, navigation,
buttons, tables, numerals. A refined editorial serif (Aptos Serif) is reserved narrowly for the
identity moments: large titles, project and meeting
names, the cockpit greeting, and big display numbers. Aptos (Aptos Sans / Aptos
Serif) is freely embeddable and present via Microsoft 365, so the shipped artifact will most likely
render in Aptos or, where it is unavailable, system fonts.
The identity therefore rides on the SCALE and TRACKING, not the exact face. Hierarchy comes from size
and tight negative tracking on large type, with only Regular (400) and Semibold (600) weights, never
heavy black.

### Hierarchy
> Values from the project's Typography spec (desktop; sizes step down at tablet/mobile). Letter-spacing
> in em (% of em: -4% = -0.04em). All numerals use tabular figures.
- **Display** (Aptos Serif, 400, 1.875rem/30px, 1.2, -0.01em): Cockpit greeting,
  empty-state hero, briefing H1, meeting and project names. The editorial identity voice
  ("Headline Caption 4").
- **Headline** (Aptos, 400, 1.5rem/24px, 1.1, -0.02em): View titles ("Headline 5").
- **Title** (Aptos Semibold, 1.125rem/18px, 1.3): Card and section headings, cockpit group
  labels.
- **Body** (Aptos, 400, 1rem/16px, 1.6): The default. To-do text, notes, form values. Drops to
  14px on phone.
- **Body strong** (Aptos Semibold, 1rem/16px, 1.6): Emphasis within body ("Body Caption").
- **Reading** (Aptos, 400, 1.125rem/18px, 1.6, -0.01em): Narrated prose, the focus narrative and
  briefings ("Body Large"). Sans, not serif, capped at 65 to 75ch.
- **Label** (Aptos Semibold, 0.75rem/12px, 1.5, +0.02em, UPPERCASE): Eyebrows, group labels,
  table headers ("Table Headline" / "Navigation All Caps"). Uppercase only for four words or fewer.
- **Meta** (Aptos, 0.75rem/12px, 1.4): Metadata and captions ("Caption XS").
- **Button** (Aptos Semibold, 0.875rem/14px): Button labels ("Buttons").
- **Nav** (Aptos Semibold, 1rem/16px, 1.5, +0.02em): Navigation items.
- **Numeric** (Aptos, `font-variant-numeric: tabular-nums`): All dates, counts, ages, and
  figures ("Numbers-Aptos"), so columns align and digits do not jitter.

### Named Rules
**The Two-Voice Rule.** Aptos operates; Aptos Serif narrates. Anything the user clicks,
types into, or reads as data, including the daily focus prose, is Aptos. Aptos Serif
appears only in large titles, project/meeting names, and big display numbers. A serif label on a
control, or serif running body, is forbidden.

**The Provenance Inset Rule.** Every verbatim source quote (the provenance under an extracted item)
sits in a tinted inset block (Slate Extra Light) in Slate Dark italic, visually distinct from
the model's paraphrased item text in Aptos above it. Provenance must look quoted and literal.

## 4. Elevation

Flat and precise. Depth is built from the canvas-to-card tonal step (Slate Extra Light page, White
cards) and hairline borders (Divider, Slate Light), not shadow. The system is near-shadow-
less and architectural, so a cockpit row, a card, a field all sit flat and are separated by a 1px
hairline or a half-step of tone. Shadow is permitted only on elements that genuinely float above the
page: the destination picker, popovers, dropdowns, and modals, and even then it stays soft.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgba(40,37,37,0.12), 0 2px 6px rgba(40,37,37,0.07)`): The
  destination picker, dropdowns, popovers.
- **Modal** (`box-shadow: 0 16px 48px rgba(40,37,37,0.18)`): Centered modal dialogs.
- **Lift-hover** (`box-shadow: 0 1px 3px rgba(40,37,37,0.08)`): The only at-rest-to-hover shadow, a
  whisper on an interactive card. Optional, never on static content.

### Named Rules
**The Flat & Precise Rule.** Surfaces are flat at rest with a small radius (2 to 8px, architectural,
not pill-soft). If an element is not a popover, dropdown, or modal, it has no drop shadow. Depth
between a row and its background is one tonal step plus a hairline, never a shadow.

## 5. Components

### Buttons
- **Shape:** Small radius (6px), precise, not pill-shaped.
- **Primary:** Indigo fill (`#2C2A4A`), white text, 9px/16px padding, weight 500. Hover lightens
  to Indigo 2 (`#423D6E`); pressed darkens; focus shows a 2px Stroke (`#C6C2E0`) ring offset 2px.
  Amber is NOT a button color; keeping primary actions Indigo is what keeps Amber scarce.
- **Secondary:** White fill, Indigo text, 1px Slate Light border. Hover fills to Slate
  Extra Light.
- **Ghost:** Transparent, Slate Dark text. Hover fills to Slate Extra Light. Low-emphasis inline
  actions.
- **Destructive:** Secondary shape with Errors text; only the final confirm step fills Errors
  (`#D32F2F`) with white text. Always behind an inline confirm, never a one-tap destroy.

### Chips and Pills
- **Owner pills:** "I owe" is a quiet Slate-Extra-Light pill with Slate Dark text and a downward
  icon; "waiting-for" is an Indigo 6 (`#C6C2E0`) pill with Indigo text, an outward icon, and
  the person's name. They read apart by hue, icon, and label, not color alone.
- **Status pills:** Active/do-next emphasis uses an Amber marker, not a filled badge. Stale is a
  Slate-Extra-Light pill with Secondary-text gray and the duration in words ("9 days"). Done is a
  struck row with an Indigo check, no color.
- **Project tag:** A small Slate-Extra-Light pill with a soft accent dot (Plum, Rose, or a
  Indigo tint, never Amber) and the project name; clickable to the project view.
- **Inferred mark:** Not a pill, a dotted underline under the value plus a 12px "inferred" Label in
  Secondary-text gray. Tapping it offers confirm or edit; confirming adds an Indigo check.

### Cards and Containers
- **Corner Style:** 8px (md) for cards and rows, 12px (lg) for modals.
- **Background:** White cards on the Slate-Extra-Light canvas. Recessed inputs use Slate Extra
  Light.
- **Shadow Strategy:** None at rest. Interactive rows may take Lift-hover on hover.
- **Border:** 1px Divider or Slate Light. No colored side-stripes, ever.
- **Internal Padding:** 16px (md) standard; 12px on dense rows; 24px (lg) on the cockpit shell.

### Inputs and Fields
- **Style:** White or Slate-Extra-Light fill, 1px Slate Light border, 4px radius. The capture
  textarea is the one large recessed well, the visual front door.
- **Focus:** Border shifts to Indigo with a 2px Stroke (`#C6C2E0`) ring; no glow, no scale.
- **Error:** Border shifts to Errors with a Secondary-text helper line below; the field keeps its
  value.
- **Placeholder:** Secondary-text gray (`#706C82`), never fainter.

### Navigation
- **Style:** Three destinations, Cockpit / Meetings / Projects, plus a persistent Capture entry. On
  desktop, a slim Indigo left rail or a light top bar; the active item carries an Amber marker
  and Indigo label, inactive items are Secondary-text gray. On phone, a bottom tab bar with the
  same three plus a prominent center Capture action. Same vocabulary on both; structure collapses,
  type does not shrink.
- **Capture is always one tap away.** It is the loop's front door.

### Signature: The Capture and Destination Picker
A large recessed textarea with a single control to choose the destination: an existing meeting, a new
meeting, an existing project, or a new project. The picker is a floating menu (Float shadow) that
escapes clipping, with type-to-filter fuzzy match, NOTHING selected by default (the human always
picks, the model never infers the destination), grouped Recent / Meetings / Projects with explicit
"Create new" rows. Suggestions carry quiet disambiguating metadata (cadence, last-met, open-todo
count). "Save and analyze" is the Indigo primary button; the note is saved before extraction runs.

### Signature: The Verification Row
Where trust is earned. Each extracted proposal is a row: item text in Aptos Sans on top, the verbatim
source quote in a tinted inset italic beneath (The Provenance Inset Rule), inferred fields
dotted-underlined (The Inferred Ink Rule), owner and project as inline pills, and quiet inline
controls (edit, delete, flip owner, retag) that make zero AI calls. An **unanchored** proposal (quote
not found in the note) shows a quiet "source not found, check before accepting" state in
Secondary-text, never auto-deleted. A proposal that fuzzy-matches a dismissed item renders
**ghosted/collapsed** ("matches a dismissed item, tap to restore") with Accept-anyway and
Dismiss-again. Nothing commits until accept.

### Signature: The Cockpit Do-Next Row and the Quiet Escalation Ladder
The holy-grail surface. Four calm groups (do-next, due-soon, waiting-on-others, slipping); do-next is
capped at five rows by ranking, overflow shows a quiet "more in due-soon" line. A do-next row leads
with an Amber marker and the single next action, with its project tag, owner, and a quiet
due/age label in tabular figures. The escalation ladder varies *form*, never *volume*: a freshly
stale item gets a quiet "since [date]" note; an older one moves up its group and gains a one-line
plain-language prompt; an older one is regrouped to the top of slipping. It never gets a louder color,
a badge, or a pulse. Snoozed and recently-ignored items do not reappear next open. One-tap done /
snooze / dismiss; dismiss asks one quiet reason (done / redundant / wrong) with a 5-second undo.

## 6. Do's and Don'ts

### Do:
- **Do** keep Amber under 10% of any screen and only for "what's next / active" (The One Voice
  Rule); make primary buttons Indigo, not Amber.
- **Do** show time pressure with Secondary-text gray, upward placement, and plain words ("waiting 9
  days").
- **Do** put every verbatim source quote in a tinted inset, italic; mark every inferred value with a
  dotted underline + "inferred" tag, and confirmed values with an Indigo check.
- **Do** keep surfaces flat with hairline borders and small radius; reach for shadow only on the
  destination picker, popovers, and modals.
- **Do** distinguish owner type, inferred-vs-confirmed, and stale state by icon, label, and weight,
  not hue alone (WCAG AA, color-vision safe).
- **Do** set all dates, counts, and figures in tabular numerals so columns align.
- **Do** give every animation a `prefers-reduced-motion: reduce` alternative; transitions 150 to
  250ms, ease-out, state-only.
- **Do** hold all text to AA: body and placeholders at Secondary-text (`#706C82`) or darker, never
  Slate Medium for small text.

### Don't:
- **Don't** build a loud nagging productivity app: no red badges, no notification counts, no streaks,
  no overdue shaming. Escalation varies form, never volume.
- **Don't** use Errors-red or Rose for overdue, slipping, or stale, ever. Red is destructive-confirm
  only; Rose's red-adjacency is a category accent, not an alarm (The No-Alarm Rule).
- **Don't** invent a success-green; the palette has none. "Done/confirmed" is an Indigo
  check plus a solid-vs-muted treatment.
- **Don't** build a generic SaaS dashboard: no hero-metric template, no gradient text, no identical
  card grids, no glassmorphism.
- **Don't** build a cluttered enterprise tool: never show everything at one density with nothing
  prioritized; the do-next cap and grouping exist to prevent this.
- **Don't** use a colored `border-left`/`border-right` stripe on cards, rows, or callouts; use full
  hairline borders, tonal fills, or a leading dot.
- **Don't** put Aptos Serif on any control the user operates (The Two-Voice Rule); serif narrates,
  sans operates.
- **Don't** stack drop shadows on at-rest surfaces; depth is the tonal step plus hairlines.
- **Don't** add cute or gamified flourishes; this is a trust-first institutional instrument.
- **Don't** use em dashes in any user-facing copy (a standing product rule).
