/**
 * Fails when the committed GTFS zip has gone stale.
 *
 * VIA republishes its schedule regularly and the feed the site serves is a
 * committed snapshot, so nothing forces a refresh on its own. This turns that
 * into a CI failure: once the zip is more than MAX_AGE_DAYS old, the build goes
 * red until someone downloads a new one and reruns `bun run gtfs:build`.
 *
 * The age comes from `builtAt` in the generated feed-info.json, which
 * build-gtfs.ts only advances when the zip's sha256 changes.
 *
 * Run with: bun run gtfs:check-freshness
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const MAX_AGE_DAYS = 14

const ROOT = join(new URL("..", import.meta.url).pathname)
const FEED_INFO = join(ROOT, "src/data/gtfs/feed-info.json")

const { builtAt } = JSON.parse(readFileSync(FEED_INFO, "utf8")) as {
  builtAt?: string
}

if (!builtAt) {
  console.error("\n  feed-info.json has no builtAt — run bun run gtfs:build\n")
  process.exit(1)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const ageDays = Math.floor(
  (Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) -
    Date.parse(`${builtAt}T00:00:00Z`)) /
    MS_PER_DAY
)

if (Number.isNaN(ageDays)) {
  console.error(`\n  feed-info.json has an unreadable builtAt: ${builtAt}\n`)
  process.exit(1)
}

// A future date would make the feed look perpetually fresh, which is the one
// thing this check exists to prevent.
if (ageDays < 0) {
  console.error(
    `\n  feed-info.json claims the feed was retrieved ${builtAt}, which is in the future.\n` +
      `  Fix the date or rerun: bun run gtfs:build\n`
  )
  process.exit(1)
}

if (ageDays > MAX_AGE_DAYS) {
  console.error(
    `\n  The GTFS feed was retrieved ${builtAt}, ${ageDays} days ago (limit ${MAX_AGE_DAYS}).\n` +
      `  Download a fresh copy from https://www.viarail.ca/en/developer-resources\n` +
      `  to data/gtfs/viarail.zip, then run: bun run gtfs:build\n`
  )
  process.exit(1)
}

console.log(`gtfs-freshness: feed retrieved ${builtAt}, ${ageDays} days ago`)
