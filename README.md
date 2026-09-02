# VIA Rail Live Train Tracker

An unofficial map of where VIA Rail's trains are right now, with a timeline for
each one showing how it is doing against its schedule. The site also republishes
what it knows as GTFS and GTFS-Realtime, so the same data is usable outside this
map.

Not affiliated with, endorsed by, or supported by VIA Rail Canada.

## Features

- Live positions for every train VIA's tracker reports, refreshed every 15 seconds
- Follow mode, where the map tracks a selected train as it moves
- Per-stop timelines with scheduled and predicted times, each shown in the stop's own timezone
- Delay badges and VIA's service alerts, in English and French
- Route lines drawn from VIA's own published shapes

## Feeds

| Endpoint | What it is |
| --- | --- |
| `/gtfs-rt/vehicle-positions.pb` | Train positions |
| `/gtfs-rt/trip-updates.pb` | Arrival and departure predictions |
| `/gtfs-rt/alerts.pb` | Service alerts |
| `/gtfs-rt/*.json` | The same messages in protobuf's canonical JSON mapping |
| `/gtfs/viarail.zip`, `/gtfs/*.txt` | VIA's schedule, redistributed unmodified |
| `/gtfs/shapes.geojson` | Route geometry, deduplicated for map use |
| `/gtfs` | A page describing the feeds and their limits |

The protobuf files are the real feed. The JSON mirrors are convenient in a
browser but are not part of the GTFS-Realtime spec, so parse the protobuf if you
have the choice.

## Development

```bash
bun install
bun run dev              # http://localhost:3000
bun run build
bun run test
bun run lint
bun run typecheck
bun run gtfs:build       # regenerate the tables under src/data/gtfs and public/gtfs
bun run fixture:capture  # snapshot VIA's live tracker as a test fixture
```

The schedule lives at `data/gtfs/viarail.zip` and is the source of truth.
`gtfs:build` turns it into the typed tables the app imports and the copy served
under `/gtfs`. Both output directories are committed, and CI fails if they no
longer match the zip.

Tests run against committed snapshots of VIA's tracker rather than the live API,
and `fixture:capture` is how a snapshot gets taken:

```bash
bun run fixture:capture                 # every running train, as all-train-data-<today>.json
bun run fixture:capture rush-hour       # every running train, under another name
bun run fixture:capture odd 5 97 669    # only those trains
bun run fixture:capture --list          # what is running, writing nothing
```

Files land in `src/server/__tests__/fixtures/`. Capturing everything is the
default because a train's oddities are not obvious in advance, and the broad
fixtures have consistently turned out to contain the shapes a hand-picked
capture would have gone looking for. `--list` tags the trains worth a look: a
stop list VIA truncated mid-route, a stop the tracker predicts nothing for, a
pause long enough to print as two rows, a run crossing several timezones.

A capture cannot be repeated. The trains arrive and drop out of the feed, so the
file is the only copy of that moment. When the script finishes it prints the
feed's poll timestamp, which is the instant a test should pin as its `now`;
choose a different one and the trains sit in the wrong places on their own
timelines.

Built with TanStack Start, MapLibre GL, and Tailwind CSS. Deployed to Cloudflare
Workers, with a Stadia Maps hosted style for the basemap.

## Acknowledgments

Live train data comes from VIA Rail's public tracker at
[tsimobile.viarail.ca](https://tsimobile.viarail.ca/). The schedule comes from
[VIA Rail Canada](https://www.viarail.ca/en/developer-resources).

Car counts and equipment types come from [traincar.info](https://traincar.info),
an unofficial community service that reads VIA's reservation system. Neither
GTFS nor the tracker says anything about consists. It is looked up per train and
cached, and the sidebar simply leaves the badge out when there is no answer.

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
