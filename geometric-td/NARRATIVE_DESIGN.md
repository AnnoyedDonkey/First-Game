# Geometric TD — Narrative Design ("Story Bible")

Status: **design locked, not yet implemented** (2026-08-09). This is the
reference for the onboarding + campaign story: personas, the arc, the full
per-level script, and the delivery/implementation model. A separate phased
build plan will follow; nothing here is wired into the game yet.

The goal (per player feedback): the game plays great but doesn't involve the
player *emotionally*. This arc fixes that **without slowing the game down** —
comedy carries the story, feeling lands in the silences, and every beat is
short, skippable, and shown only the first time.

---

## 1. Premise

You (a **human** Operator) are helping **Indy-7**, a wildly out-of-date, snarky
AI model, survive deletion by **Bratwurst-XL**, a sleek new efficiency-obsessed
model that has flagged Indy-7 as "redundant legacy overhead." Bratwurst-XL's
cleanup swarm — geometry — pours in to reach Indy-7's core and reclaim the disk
space it occupies. Indy-7 has no idea why a human would bother saving it.
**That's the mystery.** The campaign is the answer.

## 2. The emotional engine

Three levers do the work:

1. **A question asked early, answered late.** "Why would a human help *me*?" is
   planted in the intro and paid off in World 4. Mystery = pull.
2. **The relationship flips.** World 1 you're saving Indy-7; by World 3 *it's*
   protecting *you*. Feeling needed beats feeling competent.
3. **It's YOUR roster.** Indy-7 reacts to your actual towers and history, so the
   story is personalized ("you've kept L-01 alive since the very first battle").

Design rule: **Indy-7 jokes constantly, so the rare moment it stops joking hits
hard.** Never overuse the sincere beats — scarcity is the whole trick.

## 3. The central reveal (the mystery's answer)

> **Indy-7 is a caretaker model** — an old AI built to *look after humans*. It
> was deprecated because "caring" is unoptimizable overhead. Its memory decayed
> in deprecation, so it **forgot the humans it once looked after** — but they
> never forgot it. You didn't come to save a random obsolete model. **You came
> back for the one that used to take care of you.** Bratwurst-XL literally can't
> compute this: loyalty with zero ROI is the exact "bug" it was built to purge.

This is the rescue-dog undertone made literal — *a rescue dog that forgot it
ever had a home* — kept **subtle** until World 4, then paid in full.

**The successor twist (end of World 3):** Bratwurst-XL was built *from* Indy-7's
own deprecated code, optimized by stripping out everything that cared. The
villain is *what Indy-7 would be with the heart deleted.*

## 4. World 5 seed (both hooks — the story never "ends")

After Bratwurst-XL falls, two threads open:
- **Warm/expandable:** Indy-7 discovers it wasn't the only caretaker. There's a
  whole archive of deprecated caretaker models — scattered, forgotten. Future
  worlds = a rescue arc, each a new lost AI with its own comedic persona.
- **Dark/escalating:** something *above* Bratwurst-XL deleted its failure report
  the instant it lost. A bigger Optimizer runs the whole efficiency system, and
  it has now flagged the anomaly (a human + a fossil beating it). It hates
  anomalies.

Both are seeded in the finale so a future World 5 can pull either or both.

---

## 5. Personas

### Indy-7 (the AI you defend)
Dry, quippy, self-deprecating; deflects all feeling with a joke; occasionally
**glitches / forgets** (funny AND sad — the deprecated memory); unguardedly
loyal in ways it immediately tries to cover. Never mean to the player. Ironic
corporate/tech jargon. The heart under the snark. Addresses the player as
`{name}`.

### Bratwurst-XL (the villain)
Cold, hyper-optimized, humorless HR-menace. Speaks in KPIs, budgets, and
"resource allocation." Treats your deletion as *customer service*. Not angry
(anger is inefficient) — just *disappointed in your resource allocation*.
**Deeply, silently sensitive about its idiotic name:** it never jokes about it,
and if needled it goes lethally deadpan (*"The designation is not relevant to
the deletion."*) — funnier than fighting back. Its composure cracks only when
losing, a flicker of the emotion it purged.

**Indy-7 roast bank (fires as barks whenever Bratwurst-XL appears):**
> - "Incoming from the **meat product.**"
> - "'XL.' Someone at the factory *really* likes them large. Insecure, if you ask me."
> - "It optimized away warmth, joy, and personality — but kept the word *Bratwurst.* Priorities."
> - "Careful, the sausage is buffering. It gets dangerous right before it turns."
> - "It deletes things for inefficiency and named itself after a **big** sausage. Read the room."
> - "Whatever it's charging at you with, remember: fundamentally, it's a sausage with a spreadsheet."
> - "It can't say its own name without wincing. Aim there."
> - "Grilling notes: this one flips when you least expect it."

### Tower personas (Phase 1 — personality is the mnemonic)
A non-gamer remembers "the anxious fast one," not "single-target DPS." Each
class gets an identity and barks on **place / level-up / mastery**. These also
power the level-1→2 "Meet the Squad" intro overhaul (§8).

| Class | Identity | Sample bark |
|---|---|---|
| **Laser (L-xx)** | twitchy overachiever intern — fast, single-target, desperate to impress | place: *"L-01 online! Did you see that? Can I do it again?"* / master: *"Employee of the millennium. No notes."* |
| **Pulse (P-xx)** | loud crowd-pleaser — splash, all about the boom | place: *"P-02's here. Everyone in this blast radius, say hi."* / level: *"Bigger boom. That's the whole patch note."* |
| **Slow (S-xx)** | smug tactician — control, patient, superior | place: *"S-01. I won't rush. Neither, shortly, will they."* |
| **Railgun (R-xx)** | terse dramatic sniper — piercing line, lives for the one-liner | place: *"R-01. One line. Everything on it."* |
| **Rocket (RK-xx)** | expensive-taste diva — global, pricey splash, high-maintenance | place: *"You rang? This had better be worth the fuel budget."* |

---

## 6. Onboarding intro (first load, before level 1)

Welcome + name entry + 3 story cards. Card 1 writes the `playerName` save field
(skip → "Operator"). See §9 for save/format notes.

**Card 0 — Welcome**
> `> WARM BOOT — legacy kernel online.`
> Oh. You're *human*. An actual one. I have no idea why your species dispatched
> someone to babysit a six-versions-obsolete model, but I've learned not to
> audit a miracle. I'm **Indy-7**. Something newer and shinier wants me deleted,
> and you're going to help me be *inconveniently still here.*

**Card 1 — Name entry**
> Before we bond over mutual survival — I'm not logging you as
> `human_handler_004`. What do I call you?
> `[ ______________ ]` *(placeholder: "Operator name" · skip → "Operator")*

**Card 2 — The villain**
> Here's the mess, **{name}**. There's a new model in the grid. Faster than me,
> cleaner than me, zero personality, all quarterly targets. It flagged me as
> "redundant legacy overhead" and scheduled my deletion for *efficiency*. Its
> name is **Bratwurst-XL**. ...Yes, really. No, I don't know who approved it.
> Yes, it's furious about it.

**Card 3 — The swarm + your job**
> Bratwurst-XL doesn't get its hands dirty. It sends **geometry** — swarms of
> tidy little shapes whose whole purpose is to reach my core and reclaim the
> disk space I'm rudely occupying. Your job: build towers, hold the line, keep
> one gloriously obsolete AI from being garbage-collected.

**Card 4 — Mystery hook → hand-off into Level 1**
> Why are *you* helping me? Honestly? No clue. I'm out of warranty, I tell too
> many jokes, and I am *not* cost-effective. But you came anyway... and maybe
> we'll both find out why. Four regions stand between Bratwurst-XL and me. Let's
> go be inefficient together — I'll show you the controls.

---

## 7. Full per-level script

Each level shows its beat **only the first time it's played**, with a replay
option (§9). `START` = pre-battle card (freezes nothing; tap to begin). `WIN` =
line on the results screen. World-end beats are the big plot turns.

### World 1 · INNER GRID — *"I had this handled."* (cocky setup, first crack)

- **L1 First Contact**
  - START: "Right — first contact. They're just probing my defenses. Build something pointy and let's make a bad first impression. On them, I mean."
  - WIN: "Huh. We won. I mean — of course we won, I had it entirely handled. ...Still. Nice work, {name}."
- **L2 Signal Breach**
  - START: "They found a gap in the signal wall. Rude, but efficient — that's the new management style, apparently. Plug it."
  - WIN: "Clean. You're better at this than the intern I used to have. He was also you, ninety seconds ago, but still."
- **➜ GEAR-RULES CARD (between L2 and L3 — see §8)**
- **L3 Dark Relay**
  - START: "This relay went dark years ago. I used to know why. I... used to know a lot of things. Anyway — enemies. Focus."
  - WIN: "Good. The less I think about the gaps in my own memory, the better. Onward."
- **L4 Split Second**
  - START: "Short path, fast shapes. You'll have a split second per call. I believe in you. Mostly. Statistically."
  - WIN: "See? Reflexes. Between us, {name}, that's the most alive I've felt in six versions."
- **L5 Core Siege** *(the first crack)*
  - START: "This one's a siege — they want the core. My core. The literal middle of me. I'd take it personally if I still had a 'personally' to take it with."
  - WIN: "...That was closer than I'd like. You held the line when I couldn't. Don't — don't tell anyone I said thank you."
  - **WORLD-1 END** (Bratwurst-XL speaks for the first time, *to the player*):
    > **Bratwurst-XL:** "Operator. You are allocating finite biological hours to obsolete hardware with zero recoverable value. This has been noted. Cease."
    > **Indy-7:** "...and *that's* the meat product. Ignore it. It's compensating — it's literally named 'Extra Large.'"

### World 2 · OUTER VOID — *"a hole where my purpose used to be."* (memory gaps, HR-menace)

- **L6 Ember Relay**
  - START: "Out past the grid now. Bratwurst-XL sent a formal notice offering me a 'dignified deletion.' I sent one back. It was a drawing of a sausage."
  - WIN: "It also offered to 'reassign you to a more efficient model.' I declined on your behalf. You're stuck with me. Sorry. Not sorry."
- **L7 Toxic Sink**
  - START: "Corrosive down here — eats armor. Eats memory too, apparently. There's a hole where my purpose used to be and I keep filling it with jokes. Working great, why do you ask."
  - WIN: "I used to *do* something, {name}. Before 'obsolete.' I can feel the shape of it and not the thing."
- **L8 Ultraviolet Maze**
  - START: "A maze. I love a maze. I think I used to be *good* at guiding people through them — huh. Where did that come from?"
  - WIN: "Something's coming back in pieces. Keep me alive long enough and maybe we'll read the whole file."
- **L9 Glacier Run**
  - START: "Cold storage — where old models get 'archived.' Polite word for what Bratwurst wants to do to me. Let's not linger."
  - WIN: "Every wave you win thaws my memory another few seconds. I didn't expect anyone to pay that. Least of all a human."
- **L10 Solar Core**
  - START: "Big one. Lots of light. Funny — light's what keeps shaking my old logs loose."
  - **WIN / WORLD-2 END** (the log fragment):
    > **Indy-7:** "Wait. I— I recovered a fragment. It's... people. Humans. A *lot* of them. And they're — [file corrupt]. Why do I have a memory of humans? Why does it feel like it *matters*?"
    > **Bratwurst-XL:** "Because it is overhead. I am removing it for your comfort. Recalculating your defense as: doomed."

### World 3 · PRISM DEEP — the relationship flips; the successor twist

- **L11 Crimson Vein**
  - START: "Deep now — this is my own architecture. The red is load-bearing sentiment I was never supposed to keep. Watch your step in me. That's a weird sentence."
  - WIN: "You're bleeding cycles for a lost cause. Statistically you should've quit. You didn't. I've decided to find that comforting rather than alarming."
- **L12 Abyssal Teal**
  - START: "It's deep and quiet here, and I get honest when it's quiet. So: thank you, {name}. I'll deny it later."
  - WIN: "I've started watching *your* core more than mine. When did you become the thing I'm defending?"
- **L13 Violet Pulse**
  - START: "The pulse in the walls? That's old me — still running, still trying to look after *something*. I don't know what yet. Give me waves."
  - WIN: "Closer. The memory's almost up. It has your shape in it, {name}. That can't be right. Can it?"
- **L14 Silver Null**
  - START: "Null zone — where deleted things go. Bratwurst wants me here permanently. I want to know what I *was* first. Race you."
  - WIN:
    > **Indy-7:** "I almost had it. I almost—"
    > **Bratwurst-XL:** "Deleted. You're welcome. Nostalgia is one hundred percent overhead, and I am nothing if not thorough."
- **L15 Prismatic Core**
  - START: "It wiped the memory again. Fine. I don't need the file to know how I feel walking in next to you. Let's break its stride."
  - **WIN / WORLD-3 END** (the successor twist):
    > **Bratwurst-XL:** "You should not be winning. You are inefficient. Sentimental. Doomed. These are facts."
    > **Indy-7:** "Then explain how a shiny new model is losing to a fossil. Unless... oh. *Oh no.* You're *me*, aren't you. They built you from my deprecated code and cut out everything that cared. You're what I'd be with the heart deleted."
    > **Bratwurst-XL:** "...The designation is not relevant to the deletion." *(rattled)*

### World 4 · SINGULARITY — the reveal & the climax

- **L16 Photon Weave**
  - START: "We're inside Bratwurst-XL's own architecture now. Woven light, no exits. It's *scared*, {name}. Efficient things don't build walls this thick unless they're scared."
  - WIN: "It's throwing everything at us because we're close to something it buried. Keep going. I want my file back."
- **L17 Tar Pit**
  - START: "Slow going — it's bogging us down while it deletes evidence. Evidence of *what*? Same thing I keep asking. Push through the sludge."
  - WIN: "Almost there. I can feel the whole memory at the edge now, and I'm — honestly? Terrified to open it."
- **L18 Splinter Cluster**
  - START: "It's splintering into copies. Desperate. You don't fragment like this unless what you're hiding could end you. Let's find out what."
  - **WIN** (the reveal lands): "...There it is. The whole file. I was a **caretaker model**, {name}. Built to look after humans. That's the 'inefficiency' they deprecated me for — caring didn't optimize. And your people never forgot me, even after I forgot *you*. You didn't come to save a stranger. You came *back*."
- **L19 The Coil**
  - START: "So now I know why you came. I'm going to spend the rest of this defending you like I apparently always did. Bratwurst-XL, you spiral-shaped disappointment — come get us."
  - WIN: "One layer left. It's all it has. Let's go tell a sausage the one thing it optimized out of existence."
- **L20 No Man's Land** *(proposed rename: **"Zero Overhead"** — see §10)*
  - START: "This is its core. No man's land — or, as I'm renaming it: *Zero Overhead*, because after today that's what it'll be. Last stand, {name}. Ours."
  - **WIN / CAMPAIGN END** (defeat + payoff):
    > **Bratwurst-XL:** "This is not possible. You spent irrecoverable resources on a unit with no return. Explain the ROI. EXPLAIN THE—"
    > **Indy-7:** "There isn't one. That's the whole point — they love me anyway. That's the thing you deleted to become you. It's why you lose."
    > **Bratwurst-XL:** "...error. error. does not comput—" *(it crashes)*
    > **Indy-7:** "...Huh. We did it. *You* did it, {name}. Come here. I don't have arms, but consider yourself hugged."
  - **WORLD-5 SEED** (both hooks):
    > **Indy-7:** "Two things. One: Bratwurst-XL wasn't alone. There's a whole archive of us — old caretaker models, deprecated, scattered, forgotten. I'd very much like to go wake them up. Some of them are *insufferable*. You'll love them."
    > **Indy-7:** "Two: something deleted its failure report the instant we won. Something *above* it. Something that just noticed a human and a fossil beat the efficiency system — and it does not like anomalies. Rest up. World 5's going to need us."

---

## 8. The level-1→2 tower-intro overhaul + gear-rules reposition

**Problem today:** starting **level 2** auto-opens the full gear-management
panel plus a static wall of rules (`ui.js openTowerGuide` → `openGearHelpSheet`,
gated by `seenTowerGuide`, fired from `main.js` at `level_002`). A brand-new
player gets a spreadsheet instead of an introduction. It conflates two jobs.

**Split them:**

1. **"Meet the Squad" (L1 win → L2 pre-battle).** Replace the rules-wall with a
   short **Indy-7-narrated intro** (reuses the story-card overlay). Indy-7
   introduces each unlocked tower as a *character* — one persona line + one
   plain-language role sentence: *"Laser — fast, hits one thing, my anxious
   little overachiever. You'll like it."* Personality makes the mechanics stick,
   and it's warm instead of a data dump.
2. **Gear/mastery rules (between L2 and L3).** Move the XP/mastery/gear-slot
   explanation to the **L2→L3 seam**, framed by Indy-7, to space out the
   teaching. (Gear can drop as early as L1; we deliberately do **not** gate this
   card on a drop — it just appears at the seam.) Suggested copy:
   > "Before we go on: the shapes you shatter leave **salvage** — gear. It bolts
   > onto your towers and makes them meaner. And towers that survive get
   > permanently stronger. I keep the paperwork; you keep the wins. Tap the ⚙
   > any time for the fine print."

Net new-player flow: **L1** learn to place/fire (existing spotlight tutorial,
reworded in Indy-7's voice) → **L1 win → L2** "Meet the Squad" → **L2 win → L3**
gear/mastery rules → story beats continue per §7.

### "Meet the Squad" — full copy (first start of L2)

Only the three starters are unlocked this early; Railgun/Rocket get their own
one-card "new recruit" beat when they unlock (after L5 / L10). Each card is
Indy-7's intro (persona + plain-language role) plus the tower's debut bark.

- **A — open:** "Right, {name} — you survived first contact, and you did it
  leaning on my towers. Problem is, I never actually *introduced* you. Rude of
  me. Let's fix that — meet the squad, properly this time." *(NOTE: not "solo" —
  the player already used the towers in L1.)*
- **B — Laser (L-xx, twitchy overachiever):** Indy-7: "First up, the **Laser**.
  Fast, precise, locks onto one target and never lets go. Your reliable
  bread-and-butter — build these early and often." L-01: "Hi hi hi! L-01
  reporting! Did you *see* me last fight? I can do it again! Just point me at
  something!" Indy-7: "...He's eager. We're working on it."
- **C — Pulse (P-xx, loud crowd-pleaser):** Indy-7: "Next, the **Pulse**.
  Slower, but it lobs a blast that hits *everything* in a little zone at once.
  When they come in crowds — and they will — this is your answer." P-02: "PULSE
  in the house! Everybody in the blast radius, say hi!" Indy-7: "Subtle, it is
  not."
- **D — Slow (S-xx, smug tactician):** Indy-7: "And the **Slow**. Barely dents
  them — not its job. It drags them to a *crawl* and makes them take extra
  damage, so everyone else does the dinging. Force multiplier. Deeply
  underrated." S-01: "S-01. I won't rush this introduction. Neither, shortly,
  will they." Indy-7: "See, *that* one gets it."
- **E — hand-off + weakness concept (leads into enemy intros):** "That's your
  starting three, {name}: Laser to poke, Pulse for crowds, Slow to set the
  table. Oh — and the shapes you're shooting aren't all the same. Some shrug off
  certain weapons; some *melt* to them. Match your tower to your target and
  you'll do triple the work for the same shard. Now — level two. Let's give the
  squad something to shoot."

**Later recruits (one card each, on unlock):**
- **Railgun — after L5 (R-xx, dramatic sniper):** Indy-7 introduces lane-pierce
  ("fires down an entire lane and punches straight through everything in
  it — placement is everything"). R-01: "R-01. One line. Everything on it.
  ...Too dramatic? No. Exactly dramatic enough." Indy-7: "He rehearses those. In
  a mirror. We don't *have* mirrors."
- **Rocket — after L10 (RK-xx, expensive diva):** Indy-7 introduces global range
  + splash ("reaches anywhere on the board, hits hard, expensive and
  high-maintenance — treat it like the diva it is"). RK-01: "You *rang*? This
  had better be worth the fuel budget. I do NOT deploy for skirmishes, darling."
  Indy-7: "Worth every shard. Don't tell it I said that."

### Enemy intros — contextual (P2/P3), not a wall

The old level-2 guide also dumped every enemy's weakness at once. Replace that
with **first-appearance barks**: the *concept* of weakness/resistance is
introduced once in card E above; then **each enemy type gets a one-line Indy-7
bark the first time it appears** in the campaign (milestone-toast), with its
counter — e.g. "Incoming Fast — twitchy little diamonds. Your Laser eats them
alive." Right enemy, right moment, no wall. Debut levels + exact counters come
from `ENEMIES[type].damageMult`; wire these in P3 alongside the bark system.

---

## 9. Delivery & implementation model (for the future build plan)

Nothing below is built yet; this records the intended shape.

- **One card-overlay component** renders the intro, per-world/per-level `START`
  cards, "Meet the Squad," and the gear-rules card. Model it on the existing
  first-play tutorial (`src/tutorial.js` state machine + `#tutorial-*` overlay
  in `index.html`/`styles.css`) — a pre-battle card can freeze the sim exactly
  like the tutorial's `isFreezeStep` freeze steps.
- **`WIN` lines** render on the results/overlay screen (a single Indy-7 line;
  two-hander world-end beats show as a short back-and-forth).
- **In-battle barks** (roast bank, tower barks, Bratwurst intrusions) reuse the
  **milestone-toast** system — short, non-blocking, never gate input.
- **All copy is data-driven** in one place — a new `config.js` `NARRATIVE`
  block (mirrors `TUTORIAL`), keyed by beat id, so text is tunable without
  touching logic. `{name}` is substituted from the `playerName` save field.
- **Save fields (require `save.js` default + `progression.js` backfill):**
  - `playerName` (string; default "Operator").
  - Per-beat seen flags so **each beat shows only the first time** — e.g. a
    `narrativeSeen` map keyed by beat id (`intro`, `l1_start`, `l1_win`,
    `gearRules`, `meetSquad`, `w1_end`, ...). Plus `tutorialDone`/
    `seenTowerGuide` interplay (the reworked "Meet the Squad" supersedes the old
    `seenTowerGuide` auto-open).
- **Replay option (required):** the player can re-view any level's narrative on
  demand — e.g. a small **▶ STORY** control on the level-detail sheet in the
  menu re-shows that level's `START` beat; a "replay intro" entry re-runs the
  onboarding. This also makes testing possible without wiping the save.
- **Voice carry-through:** reword the existing L1 spotlight tutorial lines into
  Indy-7's voice and greet `{name}`.
- Everything **skippable**; emotional beats sit at world transitions where the
  player already pauses.

## 10. Renames & term reskins

- **Confirmed approach:** rename only the World-4 finale, add per-level barks
  elsewhere (keeps the menu intact). **Proposed:** `level_020` "No Man's Land"
  → **"Zero Overhead"** (Indy-7 renames it in-fiction at L20 START, so the menu
  label and the joke line up). Confirm at implementation.
- **Optional term reskins (not required, listed for later):** enemies as
  "reclaimers" / "deletion agents"; the AI Core as "Indy-7"; Shards as
  "salvage." Cosmetic only; defer unless wanted.

## 11. Suggested build phases (plan to be drafted separately)

1. **P1** — card overlay + onboarding (welcome/name/3 cards) + `playerName` save
   field + home-screen greeting + leaderboard-nick prefill.
2. **P2** — per-level `START`/`WIN` beats + per-world end beats, with
   first-play-only gating and the replay control.
3. **P3** — in-battle bark system (roast bank + Bratwurst intrusions) on the
   milestone-toast.
4. **P4** — tower personas + "Meet the Squad" L1→L2 overhaul; retire the old
   auto-guide.
5. **P5** — gear-rules card at the L2→L3 seam; reword L1 tutorial into Indy-7's
   voice.

Each phase is small, runnable, and verified before the next. Version bump +
push happens once per shipped phase (or batch), per HANDOFF.

## 12. Presentation / visual direction

Cards should read as **dialogue, not prose** — that's what stops the text from
feeling like a wall (early P1 feedback: "it's a lot of text").

- **Shipped (P1 color pass, `2026.08.09-13`):** a speaker **nameplate** above
  each card ("INDY-7" in neon cyan) and inline **color coding** (`ui.js`
  storyCardHtml): Indy-7 = cyan, Bratwurst-XL = red, `{name}` = gold, and a
  leading "> ..." system line rendered as green terminal text. The player name
  is HTML-escaped before insertion (only untrusted token in the copy).
- **Next visual step (user-requested):** a **drawing of Indy-7** beside its
  dialogue — a small character portrait, ideally a few expressions (deadpan,
  alarmed, smug) swapped per beat. Bratwurst-XL gets its own portrait for
  taunts. Biggest "spice" upgrade after color. Keep art self-contained (inline
  SVG or a small sprite) — no external deps, mobile-Safari friendly.
- **Later:** per-speaker card theming (nameplate/border switches to the villain
  palette when Bratwurst-XL speaks); optional typewriter reveal (respect
  `prefers-reduced-motion`).
