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
bun --bun run dev        # http://localhost:3000
bun --bun run build
bun run test
bun --bun run lint
bun --bun run typecheck
bun run gtfs:build       # regenerate the tables under src/data/gtfs and public/gtfs
```

The schedule lives at `data/gtfs/viarail.zip` and is the source of truth.
`gtfs:build` turns it into the typed tables the app imports and the copy served
under `/gtfs`. Both output directories are committed, and CI fails if they no
longer match the zip.

Built with TanStack Start, MapLibre GL, and Tailwind CSS. Deployed to Cloudflare
Workers, with a Stadia Maps hosted style for the basemap.

## Acknowledgments

Live train data comes from VIA Rail's public tracker at
[tsimobile.viarail.ca](https://tsimobile.viarail.ca/). The schedule comes from
[VIA Rail Canada](https://www.viarail.ca/en/developer-resources).

Contains information licensed under the
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
