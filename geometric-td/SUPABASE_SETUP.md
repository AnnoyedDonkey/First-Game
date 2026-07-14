# Leaderboard backend setup (Supabase) — one time, ~10 min

The shared leaderboard needs somewhere to store scores. GitHub Pages is
static (files only), so we use a free **Supabase** project as the database +
API. The game talks to it with plain `fetch()` — no SDK, no build step.

While `src/config.js` `LEADERBOARD.url` / `anonKey` are blank, the whole
feature is dormant: the menu button is hidden and no network calls happen.
Filling both in turns it on.

## 1. Create a project

1. Go to https://supabase.com and sign up (free tier is plenty).
2. **New project** → give it a name, set a database password (save it
   somewhere; you won't need it for the game), pick the nearest region.
3. Wait ~2 min for it to provision.

## 2. Create the table + rules

Left sidebar → **SQL Editor** → **New query** → paste ALL of this → **Run**:

```sql
-- One row per player per level (their best wave on that level).
create table if not exists public.scores (
  client_id  text        not null,
  level_id   text        not null,
  nickname   text        not null,
  best_wave  integer     not null check (best_wave between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (client_id, level_id)          -- lets the game UPSERT
);

-- Read the board fast, sorted by best wave.
create index if not exists scores_level_wave_idx
  on public.scores (level_id, best_wave desc);

-- Row-Level Security: the anon key can only do what these policies allow.
alter table public.scores enable row level security;

-- Anyone may read the board.
create policy "public read"
  on public.scores for select
  using (true);

-- Anyone may submit a new score...
create policy "public insert"
  on public.scores for insert
  with check (
    char_length(nickname) between 1 and 16
    and best_wave between 1 and 1000
  );

-- ...and update their own row (the upsert path when they beat their best).
create policy "public update"
  on public.scores for update
  using (true)
  with check (
    char_length(nickname) between 1 and 16
    and best_wave between 1 and 1000
  );
```

That's the entire schema. The `check` constraints are the light guardrails —
they reject empty/huge nicknames and absurd wave numbers even if someone
pokes the API directly.

## 3. Copy your two keys into the game

Left sidebar → **Project Settings** → **API**:

- **Project URL** — e.g. `https://abcdefgh.supabase.co`
- **Project API keys → `anon` `public`** — a long string starting `eyJ...`

Open `src/config.js`, find the `LEADERBOARD` block, and paste them in:

```js
export const LEADERBOARD = {
  url: "https://abcdefgh.supabase.co",   // <-- your Project URL, no trailing slash
  anonKey: "eyJhbGciOi...",              // <-- your anon public key
  table: "scores",
  topN: 10,
  maxWave: 1000,
  maxNickLength: 16,
};
```

Save. The `LEADERBOARD` menu button appears automatically once both are set.

## 4. Test it

Serve locally (`serve.ps1`) and open the site. Then either:

- Play an Endless run, set a nickname on the LEADERBOARD page, tap **PUBLISH
  MY SCORES**, and reload — your score should be on the board; **or**
- In the browser console:
  ```js
  const lb = await import('./src/leaderboard.js');
  lb.setNickname('Tester');
  await lb.submitScore('level_001', 12);   // true = success
  await lb.fetchAllBoards();                // { level_001: [{nickname:'Tester', wave:12}] }
  ```

You can view/edit/delete rows anytime in Supabase → **Table Editor → scores**
(handy for wiping test data or removing a troll's entry).

## Feedback table (run telemetry + difficulty ratings) — one time, ~2 min

The balance-feedback system (feedback.js) needs a second table in the SAME
project. Left sidebar → **SQL Editor** → **New query** → paste ALL of this
→ **Run**:

```sql
-- One row per battle: auto-telemetry at battle end, plus the player's
-- optional one-tap difficulty rating (upserted onto the same row).
create table if not exists public.feedback (
  run_id        text primary key,          -- minted per battle; lets the rating UPSERT
  client_id     text not null,             -- same anonymous id as the leaderboard
  level_id      text not null,
  mode          text not null check (mode in ('campaign', 'endless')),
  outcome       text not null check (outcome in ('won', 'lost', 'forfeit')),
  app_version   text,
  waves_cleared integer,
  total_waves   integer,
  core_health   integer,
  duration_sec  integer,
  rating        text check (rating in ('too_easy', 'just_right', 'too_hard')),
  note          text check (char_length(note) <= 200),
  details       jsonb,                     -- towers/levels/gear, skills, kills, leaks…
  created_at    timestamptz not null default now()
);

-- Analyze one level's runs fast, newest first.
create index if not exists feedback_level_idx
  on public.feedback (level_id, created_at desc);

alter table public.feedback enable row level security;

-- Anyone may read (used for the balance analysis pulls).
create policy "public read"
  on public.feedback for select
  using (true);

-- Anyone may submit a run...
create policy "public insert"
  on public.feedback for insert
  with check (
    char_length(run_id) between 1 and 64
    and char_length(client_id) between 1 and 64
  );

-- ...and the rating upsert may overwrite a row (keyed by run_id).
create policy "public update"
  on public.feedback for update
  using (true)
  with check (
    char_length(run_id) between 1 and 64
    and char_length(client_id) between 1 and 64
  );
```

No config keys to copy — feedback.js reuses `LEADERBOARD.url`/`anonKey` and
is on while `config.js FEEDBACK.enabled` is true. Until this SQL has run,
submissions fail silently (console warning only); the game is unaffected.

Test in the browser console after a battle, or directly:

```js
const fb = await import('./src/feedback.js');
await fb.submitRun({ level_id: 'level_001', mode: 'campaign', outcome: 'won',
  waves_cleared: 5, total_waves: 5, core_health: 20, duration_sec: 300,
  details: { test: true } });                    // true = success
await fb.submitRating('just_right', 'test note'); // true = success
```

Rows land in **Table Editor → feedback** (delete test rows there).

## Notes / limits

- **Free tier:** 500 MB DB + 5 GB egress/month. Scores are tiny rows; you
  won't come close.
- **It's a friendly board, not cheat-proof.** The anon key is visible in the
  page source (unavoidable on a static site), so a determined person could
  submit a fake score via the API. The `check` constraints and one-row-per-
  client cap the damage. If it ever becomes a problem, the upgrade path is a
  tiny serverless function (Cloudflare Worker / Supabase Edge Function) that
  validates submissions — no game rewrite needed, just point `submitScore` at
  it.
- **Idle eviction:** Supabase pauses a free project after ~1 week of zero
  activity; the first request after that wakes it (a few seconds). Normal play
  keeps it warm.
