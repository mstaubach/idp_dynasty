# ESPN Integration — Feasibility Assessment

**Status:** Research spike. No code changes proposed yet.
**Question:** Can IDP Dynasty HQ read leagues from ESPN the way it reads them from Sleeper?

---

## Verdict

**Partially — and the split falls along a hard line.**

The four *read-the-current-state* tools (standings, idp-checker, injury-tracker,
roster-management) port to ESPN cleanly. The three *dynasty-asset* tools
(trade-tracker, taxi-filler, and the draft-slot provenance half of
draft-history) **cannot** be ported, because ESPN's platform does not model the
concepts they are built on. This is not an API gap that better scraping fixes —
the data does not exist because the feature does not exist.

Recommended: ship ESPN support for the portable tools, scoped to **public**
ESPN leagues first, and treat private-league support as a separate decision
because it breaks the app's "no auth, no secrets" constraint.

---

## What was verified, and what was not

Honest accounting, because it affects how much weight to put on this document:

| Claim | How it was established |
| --- | --- |
| Endpoint shapes, view names, auth model, historical-season quirks | Community documentation (ffscrapr, `espn-api`, Steven Morse's v3 writeup) — consistent across independent sources |
| ESPN does not support future draft-pick trading | ESPN's own support articles |
| ESPN has no taxi squad | Multiple dynasty-community sources, no contradicting source |
| Live request/response against ESPN | **Not verified.** See below |

The sandbox this research ran in blocks outbound egress to
`lm-api-reads.fantasy.espn.com` at the network proxy — and also to
`api.sleeper.app`, so it is a blanket policy, not an ESPN-specific block. No
live call was made from here. Every endpoint below should be confirmed with a
single `curl` from a normal network before any code is written. That is a
five-minute task and it is the correct first step.

---

## The ESPN API

ESPN has no official public fantasy API. There is a stable, widely-used,
**undocumented** v3 JSON API behind the fantasy web app. Every third-party
fantasy tool uses it.

**Base (current seasons):**

```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{leagueId}
```

**Historical (2017 and earlier):**

```
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{leagueId}?seasonId={season}
```

Note the quirk: the historical endpoint returns a **one-element array**, not an
object. Easy to miss, and it will bite once.

The base host moved from `fantasy.espn.com` to `lm-api-reads.fantasy.espn.com`
around April 2024. Older tutorials still show the old host.

**Data is selected via `?view=` parameters**, which compose:

| View | Contains | Maps to our tool |
| --- | --- | --- |
| `mSettings` | Scoring, roster slots, league config | all |
| `mTeam` | Records, points for/against, standings | standings |
| `mRoster` | Rosters with lineup slots, injury status | idp-checker, roster-management, injury-tracker |
| `mMatchup` / `mBoxscore` | Weekly results | standings |
| `mDraftDetail` | Completed draft picks | draft-history |
| `mTransactions2` | Trades, waivers, free agents | trade-tracker (see caveats) |
| `kona_player_info` | Full player universe | idp-checker |

`kona_player_info` requires an `x-fantasy-filter` request header containing a
JSON filter object — it will not return the player pool without it.

---

## Authentication — the fork in the road

**Public leagues:** no credentials. Plain GET works. This is the path that
preserves the app's current architecture exactly.

**Private leagues:** require two cookies, `espn_s2` and `SWID`, taken from a
logged-in browser session. There is no programmatic way to obtain them; the
user copies them out of devtools.

Most ESPN leagues are private by default, so this matters. Two things to weigh:

1. **`espn_s2` is a personal session credential.** It is not a scoped API key —
   it is the user's ESPN login. Anything holding it can act as that user across
   ESPN. Accepting these into a web app means building a credential story:
   transport, storage, scope, rotation, and a clear disclosure to the user.
   Today this app has **no auth, no API keys, no database** (per `CLAUDE.md`).
   Private-league support breaks that constraint permanently.
2. **The cheap alternative:** ESPN leagues have a visibility setting. If you set
   your two leagues to public/viewable, no credentials are needed at all and the
   app's current architecture is untouched. **Strongly recommend trying this
   first** — it may make the whole auth question moot for your use case.

---

## Tool-by-tool assessment

| Tool | ESPN viable? | Notes |
| --- | --- | --- |
| `/standings` | **Yes** | `mTeam` gives W/L/T and points. `leagueHistory` gives prior seasons. Champion detection needs playoff bracket from `mMatchup` rather than Sleeper's `winners_bracket` shape. |
| `/idp-checker` | **Yes** | `kona_player_info` for the pool, `mRoster` for rostered players; difference is free agents. ESPN does support IDP roster slots. |
| `/injury-tracker` | **Yes** | `injuryStatus` ships on player entries in `mRoster`. Currently a placeholder anyway — ESPN is as good a first target as Sleeper. |
| `/roster-management` | **Partial** | Lineup slots and starters map fine. The taxi-squad column has no ESPN equivalent and must be conditionally hidden. |
| `/draft-history` | **Partial** | `mDraftDetail` gives completed picks, so the draft board renders. But slot *provenance* — "this pick originally belonged to franchise X" — is meaningless without pick trading. |
| `/taxi-filler` | **No** | ESPN has no taxi squad. The tool has no reason to exist for an ESPN league. |
| `/trade-tracker` | **No (as designed)** | See below. |
| Profile (username → leagues) | **No clean path** | Sleeper exposes `/user/{name}/leagues`. ESPN's equivalent (`fan` API) requires an authenticated SWID. ESPN leagues would have to be added by pasting a league ID. |

### Why trade-tracker does not port

This is the most important finding, and it is worth being blunt about because
trade-tracker is the most sophisticated thing in this codebase.

`src/lib/trade-tracker/resolve.ts` is built on one premise: dynasty managers
trade **future draft picks**, and each pick can be traced from the franchise
that originally owned it through to the player eventually selected. The whole
two-pass engine — indexing selections by `${season}:${round}:${originalRoster}`,
resolving to `drafted` / `pending` / `unknown`, the giver → asset → outcome
Sankey view — is pick-chain machinery.

**ESPN does not support trading future draft picks.** Per ESPN's own support
documentation, draft-pick trades are available only if the league manager
enables them, apply only to the **current** season's picks, and can only be made
**before** that season's draft. There is no future-pick asset in the system, so
there is nothing for the resolver to resolve.

A secondary problem compounds it: ESPN's `mTransactions2` emits `TRADE_ACCEPT`
rows that frequently **omit the players involved** for trades that do not belong
to the authenticated cookie owner. Even reconstructing plain player-for-player
trade history reliably requires cross-referencing the activity feed, and is
known to be lossy.

What *could* be built for ESPN is a much simpler player-trade timeline. That is
a different feature wearing the same name, and it should be scoped as new work
rather than as "porting trade-tracker."

---

## Codebase impact

The good news: `CLAUDE.md`'s existing rule — per-tool namespacing, two
deliberately unshared Sleeper clients — is exactly the right shape for this. A
second provider extends the established pattern instead of fighting it. Add
`src/lib/<tool>/espn.ts` next to each `sleeper.ts`, with its own `types.ts`
entries. **Do not** build a unified provider abstraction over both; that is the
"deduplicate the two clients" mistake the project already decided against, at
larger scale.

Concrete items:

1. **League IDs collide.** `src/lib/sleeper-id.ts` validates with `/^[0-9]+$/`.
   ESPN league IDs are *also* numeric. The ID alone cannot tell you which
   platform a league belongs to, so routes like `/standings/[leagueId]` become
   ambiguous the moment ESPN is added. This needs an explicit provider token in
   the route (`/standings/espn/[leagueId]`) or in stored profile entries —
   decided **before** any client code is written, because it changes the URL
   shape and the saved-league schema in `src/lib/profile/types.ts`.
2. **Player identity.** ESPN player IDs are integers unrelated to Sleeper's
   string IDs. Anything cross-platform needs name-based reconciliation — and
   `src/lib/idp-checker/matcher.ts` already does exactly this well, so it is
   reusable.
3. **Position encoding.** ESPN uses numeric position IDs, not strings. Offense:
   `1=QB, 2=RB, 3=WR, 4=TE, 5=K, 16=D/ST`. IDP lineup slots:
   `8=DT, 9=DE, 10=LB, 11=DL, 12=CB, 13=S, 14=DB, 15=DP`. A translation layer to
   the existing `IDP_POSITIONS` / `POSITION_GROUPS` vocabulary is required.
   **These IDs are from community documentation and must be confirmed against a
   live IDP league response** — IDP slot IDs are the least-corroborated values in
   this document.
4. **Caching.** ESPN responses are large. The existing `unstable_cache` 2MB
   limit lesson (see the comments in both `sleeper.ts` files) will recur —
   slim ESPN responses at the fetch boundary from day one.
5. **Profile flow.** `ProfileContext` assumes a Sleeper username resolves to a
   league list. ESPN leagues must be added by ID, so the profile model needs a
   per-league provider field.

---

## Risk register

- **No ToS grant.** This is a private, undocumented API. ESPN can change or
  restrict it without notice — as it did in the 2019 v2→v3 migration and the
  2024 host change. Sleeper's API is public and documented; ESPN's is not. Any
  ESPN feature carries standing breakage risk that Sleeper features do not.
- **Server-side IP reputation.** Requests will originate from a datacenter IP
  (Vercel), not a residential browser. Rate-limiting and bot-mitigation behavior
  under that condition is **unverified** and is the single largest unknown for a
  deployed app. Test early with real request volume, not a single curl.
- **Cookie expiry.** If private-league support is built, `espn_s2` rotates on
  logout and password change. Expect support burden: "it stopped working" will
  be the most common user report.
- **Silent lossiness.** ESPN's transaction data is incomplete in ways that do
  not surface as errors. Wrong data renders as confidently as right data.

---

## Recommendation

**Phase 0 — one hour, do this before anything else.**
Set one of your two ESPN leagues to public. From a normal network, `curl` the
league endpoint with `?view=mSettings&view=mTeam&view=mRoster`. Confirm: it
returns without cookies, IDP positions appear as expected, and the position IDs
above are correct. This single test validates or invalidates most of this
document.

**Phase 1 — highest value, lowest risk.**
ESPN support for `/standings` and `/idp-checker`, public leagues only. These are
the two tools with clean data mappings and no architectural conflict. Decide the
provider-token routing question first.

**Phase 2.**
`/injury-tracker` (ESPN is arguably the better source) and `/roster-management`
with the taxi column conditionally hidden.

**Phase 3 — only with a deliberate decision.**
Private-league cookie support. This is a security and product decision, not a
technical one. Do not drift into it.

**Not recommended.**
Porting `/taxi-filler` or `/trade-tracker`'s pick-resolution engine. The
underlying platform concepts do not exist. If ESPN trade visibility matters,
scope a separate, simpler player-trade timeline.

---

## Sources

- ESPN Fan Support — [Draft Pick Trades](https://support.espn.com/hc/en-us/articles/360000141091-Draft-Pick-Trades), [Enable/Disable Draft Pick Trading](https://support.espn.com/hc/en-us/articles/360000090752-Enable-Disable-Draft-Pick-Trading)
- [ffscrapr — ESPN: Get Endpoint](https://ffscrapr.ffverse.com/articles/espn_getendpoint.html) and [ESPN: Private Leagues](https://ffscrapr.ffverse.com/articles/espn_authentication.html)
- [Steven Morse — Using ESPN's new Fantasy API (v3)](https://stmorse.github.io/journal/espn-fantasy-v3.html)
- [cwendt94/espn-api](https://github.com/cwendt94/espn-api) — reference implementation, incl. [transactions discussion](https://github.com/cwendt94/espn-api/discussions/555)
- [nntrn — List of ESPN API endpoints](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c)
- [Onyx Mueller — Accessing Fantasy Football Data Through ESPN's API](https://onyxmueller.net/2022/12/28/accessing-fantasy-football-data-through-espns-api/)
