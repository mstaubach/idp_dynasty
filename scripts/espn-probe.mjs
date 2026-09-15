#!/usr/bin/env node
// Phase 0 probe for docs/espn-integration-feasibility.md.
//
// The feasibility research could not make a live ESPN call (the research
// sandbox blocked outbound egress), so every endpoint claim in that document is
// from community documentation rather than observation. This script closes that
// gap: run it from a normal network against a real league and it confirms or
// refutes the assumptions before any integration code gets written.
//
//   node scripts/espn-probe.mjs <leagueId> [season]
//
// Private league? Export cookies first (see the doc's auth section):
//   ESPN_S2='...' SWID='{...}' node scripts/espn-probe.mjs <leagueId>
//
// Deliberately dependency-free and outside src/ — this is a throwaway
// diagnostic, not app code.

const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

const [leagueId, seasonArg] = process.argv.slice(2);
const season = seasonArg ?? String(new Date().getFullYear());

if (!leagueId || !/^[0-9]+$/.test(leagueId)) {
  console.error("Usage: node scripts/espn-probe.mjs <leagueId> [season]");
  console.error("       leagueId must be numeric (find it in your ESPN league URL)");
  process.exit(2);
}

const { ESPN_S2, SWID } = process.env;
const authed = Boolean(ESPN_S2 && SWID);
const headers = authed ? { Cookie: `espn_s2=${ESPN_S2}; SWID=${SWID}` } : {};

// Community-documented position IDs. Confirming these against a live IDP league
// is the single most valuable thing this script does — they are the least
// corroborated values in the feasibility doc.
const POSITION_IDS = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST",
  8: "DT", 9: "DE", 10: "LB", 11: "DL", 12: "CB", 13: "S", 14: "DB", 15: "DP",
};

async function get(label, url, extraHeaders = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { ...headers, ...extraHeaders } });
    const ms = Date.now() - started;
    const body = await res.text();
    if (!res.ok) {
      console.log(`  ✗ ${label}: HTTP ${res.status} (${ms}ms) ${body.slice(0, 120)}`);
      return null;
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      console.log(`  ✗ ${label}: HTTP 200 but body is not JSON (${ms}ms) — likely an auth/interstitial page`);
      return null;
    }
    console.log(`  ✓ ${label}: HTTP 200 (${ms}ms, ${(body.length / 1024).toFixed(1)}KB)`);
    return json;
  } catch (err) {
    console.log(`  ✗ ${label}: ${err.message}`);
    return null;
  }
}

console.log(`\nESPN probe — league ${leagueId}, season ${season}`);
console.log(`Auth: ${authed ? "cookies supplied (private-league mode)" : "none (public-league mode)"}\n`);

console.log("1. Core league views");
const league = await get(
  "mSettings+mTeam+mRoster",
  `${BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings&view=mTeam&view=mRoster`,
);

if (!league) {
  console.log(
    "\nCore request failed. If this is a 401, the league is private — either set it\n" +
    "to public in ESPN's league settings or supply ESPN_S2 and SWID. See\n" +
    "docs/espn-integration-feasibility.md for the tradeoff.\n",
  );
  process.exit(1);
}

console.log(`\n2. League shape`);
console.log(`  name:        ${league.settings?.name ?? "(not in response)"}`);
console.log(`  size:        ${league.settings?.size ?? "?"} teams`);
console.log(`  teams found: ${league.teams?.length ?? 0}`);
console.log(`  scoringPeriod: ${league.scoringPeriodId ?? "?"}`);

// Roster slot config tells us whether this is genuinely an IDP league and which
// IDP slots ESPN reports — the thing idp-checker depends on.
const slotCounts = league.settings?.rosterSettings?.lineupSlotCounts ?? {};
const activeSlots = Object.entries(slotCounts).filter(([, n]) => n > 0);
console.log(`\n3. Lineup slots (confirms IDP support + position ID mapping)`);
if (activeSlots.length === 0) {
  console.log("  (no lineupSlotCounts in response — check view=mSettings shape)");
} else {
  for (const [id, count] of activeSlots) {
    const known = POSITION_IDS[id];
    console.log(`  slot ${String(id).padStart(2)}: ${count}x  ${known ?? "*** UNKNOWN ID — update the mapping ***"}`);
  }
}

// Sample real players to verify defaultPositionId values match the table above.
console.log(`\n4. Roster sample (verifies defaultPositionId decoding)`);
const firstTeam = league.teams?.[0];
const entries = firstTeam?.roster?.entries ?? [];
if (entries.length === 0) {
  console.log("  (no roster entries — view=mRoster may need auth for this league)");
} else {
  for (const entry of entries.slice(0, 8)) {
    const p = entry.playerPoolEntry?.player ?? {};
    const pos = POSITION_IDS[p.defaultPositionId] ?? `id:${p.defaultPositionId}?`;
    const injury = p.injuryStatus ? ` [${p.injuryStatus}]` : "";
    console.log(`  ${(p.fullName ?? "?").padEnd(24)} ${pos.padEnd(6)}${injury}`);
  }
  console.log(`  ... ${entries.length} total on team 1`);
  const hasInjuryField = entries.some((e) => e.playerPoolEntry?.player?.injuryStatus);
  console.log(`  injuryStatus present: ${hasInjuryField ? "yes (injury-tracker viable)" : "no"}`);
}

console.log(`\n5. Historical season (leagueHistory array-of-one quirk)`);
const prior = String(Number(season) - 1);
const hist = await get(
  `leagueHistory seasonId=${prior}`,
  `${BASE}/leagueHistory/${leagueId}?seasonId=${prior}&view=mTeam`,
);
if (hist) {
  console.log(`  returns array: ${Array.isArray(hist)} ${Array.isArray(hist) ? `(length ${hist.length})` : "— doc says it should be an array"}`);
}

console.log(`\n6. Transactions (trade-tracker viability)`);
const tx = await get(
  "mTransactions2",
  `${BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mTransactions2`,
);
if (tx) {
  const items = tx.transactions ?? [];
  const trades = items.filter((t) => String(t.type ?? "").includes("TRADE"));
  console.log(`  transactions: ${items.length}, trade-type: ${trades.length}`);
  const emptyTrades = trades.filter((t) => !t.items || t.items.length === 0).length;
  if (trades.length > 0) {
    console.log(`  trades with NO item detail: ${emptyTrades}/${trades.length} ${emptyTrades > 0 ? "— confirms the known lossiness" : ""}`);
  }
}

console.log(`\n7. Player pool (idp-checker viability)`);
const pool = await get(
  "kona_player_info",
  `${BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=kona_player_info`,
  {
    "x-fantasy-filter": JSON.stringify({
      players: { limit: 50, sortPercOwned: { sortAsc: false, sortPriority: 1 } },
    }),
  },
);
if (pool) {
  const players = pool.players ?? [];
  console.log(`  players returned: ${players.length} (x-fantasy-filter ${players.length > 0 ? "works" : "may be malformed"})`);
}

console.log(`\nDone. Record any ✗ or "UNKNOWN ID" lines against`);
console.log(`docs/espn-integration-feasibility.md before writing integration code.\n`);
