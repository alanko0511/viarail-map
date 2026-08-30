# GTFS schedule source

- **File**: `viarail.zip`
- **Publisher**: VIA Rail Canada
- **Downloaded from**: https://www.viarail.ca/en/developer-resources
- **Retrieved**: 2026-08-30
- **sha256**: `50d96c9f361c8b91fad292f8aa8db727fb7c62110895d1ffc9534235335eb339`
- **Feed validity** (`feed_info.txt`): 2026-08-17 → 2026-12-17

## Refreshing

VIA publishes updated feeds periodically. To adopt a new one:

1. Download the new zip and replace `viarail.zip`.
2. Update the sha256 and validity dates above.
3. Run `bun run gtfs:build`.
4. Commit the regenerated `src/data/gtfs/` and `public/gtfs/` artifacts.

The build script asserts a set of invariants (unique stop codes, 19 distinct
shapes, a feed that does not expire within 30 days) and fails loudly if VIA
restructures the feed, so a silent regression is unlikely.

## Licence

VIA releases this feed under the [Open Government Licence –
Canada](https://open.canada.ca/en/open-government-licence-canada) version 2.
Downloading the file accepts those terms, as VIA's developer page states.

The licence permits copying, modifying and redistributing the data, including
commercially, on one condition: acknowledge the source and link the licence.
VIA specifies no attribution wording of its own, so the licence's own fallback
applies and must appear verbatim wherever this data is served:

> Contains information licensed under the Open Government Licence – Canada.

That statement lives on the `/gtfs` page and in the app sidebar. Do not remove
it. Compliance is not optional bookkeeping: the licence terminates
automatically if its conditions go unmet.
