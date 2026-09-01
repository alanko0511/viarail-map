/**
 * Captures live trains from VIA's tracker into a test fixture.
 *
 * Test fixtures here are moments on the wire: a train with an overnight
 * layover, a stop list VIA truncated mid-route, an arrival with no prediction.
 * Those shapes cannot be invented convincingly and cannot be fetched again
 * later — the train has arrived and left the feed. So the fixtures are real
 * payloads, copied verbatim, and this script is how they get copied.
 *
 * Run with: bun run fixture:capture [name] [train...]
 *
 *   bun run fixture:capture              every train, as all-train-data-<today>
 *   bun run fixture:capture rush-hour    every train, under another name
 *   bun run fixture:capture odd 5 97 669 just those trains
 *   bun run fixture:capture --list       what is running, writing nothing
 *
 * Writes src/server/__tests__/fixtures/<name>-<today>.json and prints the poll
 * timestamp, which is the `NOW` a test should pin so statuses land where they
 * really did.
 *
 * The whole network is the default because that is what makes a fixture worth
 * committing: all-train-data-2026-08-30.json turned out to already hold every
 * odd shape a hand-picked capture would have gone looking for. Name trains
 * only when one specific shape is worth keeping and the rest is dead weight,
 * and check first whether a committed fixture already covers it - usually it
 * does. `--list` is there to go looking; cross-check a candidate against
 * https://tsimobile.viarail.ca/#<train> before committing it, and say in the
 * test what VIA showed.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import type { Train } from "../src/server/schemas/train"
import { fetchAllTrainData } from "../src/server/trains"

// fileURLToPath, not URL.pathname: a checkout under a directory with a space
// keeps the %20 in a pathname and every write below would miss.
const ROOT = fileURLToPath(new URL("..", import.meta.url))
const FIXTURES = join(ROOT, "src/server/__tests__/fixtures")

const args = process.argv.slice(2)
const listing = args[0] === "--list"

// Bare invocation captures the whole network under the name the existing broad
// fixtures use.
const [name = "all-train-data", ...requested] = listing ? [] : args

/**
 * What makes a train interesting to render. Not exhaustive — it is a prompt to
 * go looking, not a verdict.
 */
function shapes(train: Train): Array<string> {
  const stops = train.times
  const found: Array<string> = []

  // A list that opens with an arrival began somewhere other than the trip's
  // origin: VIA published only part of the run.
  if (stops.length > 0 && stops[0].arrival) found.push("starts-midroute")
  if (stops.some((stop) => !stop.arrival && !stop.departure)) {
    found.push("stop-with-no-times")
  }
  if (
    stops.some(
      (stop) =>
        (stop.arrival && !stop.arrival.estimated) ||
        (stop.departure && !stop.departure.estimated)
    )
  ) {
    found.push("missing-estimate")
  }

  const zones = new Set(stops.map((stop) => stop.tz))
  if (zones.size > 1) found.push(`${zones.size}-timezones`)

  // A gap this long is a servicing or crew stop, and it renders as two rows.
  const layover = stops.some((stop) => {
    if (!stop.arrival?.scheduled || !stop.departure?.scheduled) return false
    const gap =
      Date.parse(stop.departure.scheduled) - Date.parse(stop.arrival.scheduled)
    return gap > 7 * 60 * 1000
  })
  if (layover) found.push("layover")

  if (train.alerts?.length) found.push("alert")
  if (stops.length > 40) found.push("long")

  return found
}

const trains = await fetchAllTrainData()

if (listing) {
  const rows = Object.entries(trains)
    .map(([key, train]) => ({
      key,
      stops: train.times.length,
      route: `${train.from} -> ${train.to}`,
      shapes: shapes(train),
    }))
    .sort((a, b) => b.shapes.length - a.shapes.length)

  for (const row of rows) {
    console.log(
      `${row.key.padEnd(12)} ${String(row.stops).padStart(3)} stops  ` +
        `${row.route.padEnd(32)} ${row.shapes.join(" ")}`
    )
  }
  console.log(
    `\n${rows.length} trains running. ` +
      "Run without --list to capture them all, or name the ones you want."
  )
  process.exit(0)
}

// No train numbers means the whole network. Insertion order is VIA's, which
// groups the multi-day long-distance trains apart from the corridor; sorting
// would only churn the diff on a refresh.
const wantsAll = requested.length === 0
const keys = wantsAll ? Object.keys(trains) : requested

const missing = keys.filter((key) => !(key in trains))
if (missing.length > 0) {
  // Multi-day trains are keyed "1 (08-30)", so an exact key is required and a
  // near miss is worth spelling out rather than silently dropping.
  console.error(`\n  not running right now: ${missing.join(", ")}`)
  const hints = Object.keys(trains).filter((key) =>
    missing.some((want) => key.startsWith(want))
  )
  if (hints.length > 0) {
    console.error(`  did you mean: ${hints.join(", ")}`)
  }
  console.error("\n  bun run fixture:capture --list  shows what is running\n")
  process.exit(1)
}

const picked = Object.fromEntries(keys.map((key) => [key, trains[key]]))

const today = new Date().toISOString().slice(0, 10)
const path = join(FIXTURES, `${name}-${today}.json`)

// Compact, like the fixtures already here: nobody reads these by eye, and the
// pretty-printed form is four times the size in the diff.
//
// "wx" refuses to clobber. Two captures on one day land on the same filename,
// and the payload the first one holds is gone from the feed by then, so an
// overwrite would destroy the only copy.
try {
  writeFileSync(path, JSON.stringify(picked), { encoding: "utf8", flag: "wx" })
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  console.error(
    `\n  ${path} already exists.\n` +
      "  Capture under another name, or delete that file if you mean to replace it.\n"
  )
  process.exit(1)
}

// Every train carries the instant it was last polled, and they poll
// independently, so a capture spans a minute or two rather than one instant.
// The latest is the `NOW` to pin: it is the only one no train is ahead of.
const polls = Object.values(picked)
  .map((train) => train.poll)
  .filter((poll) => poll !== undefined)
  .sort()
const latest = polls.at(-1)

console.log(`\nwrote ${path} (${keys.length} trains)`)
for (const key of keys) {
  const train = picked[key]
  const found = shapes(train)
  // A whole-network capture is 60-odd lines of this; only the trains carrying
  // an unusual shape are worth reading back.
  if (wantsAll && found.length === 0) continue
  console.log(
    `  ${key.padEnd(12)} ${String(train.times.length).padStart(3)} stops  ` +
      found.join(" ")
  )
}
if (latest) {
  const spread = new Set(polls).size
  console.log(
    `\npoll: ${latest}` +
      (spread > 1 ? `  (latest of ${spread}, spanning ${polls[0]})` : "")
  )
  console.log("pin that instant as the test's NOW.\n")
} else {
  console.log("\nno train reported a poll time; pick a NOW by hand.\n")
}
