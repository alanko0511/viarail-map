import { createFileRoute } from "@tanstack/react-router"

import { feedInfo } from "@/data/gtfs"

export const Route = createFileRoute("/gtfs")({
  head: () => ({
    meta: [{ title: "GTFS feeds — VIA Rail Map" }],
  }),
  component: GtfsDocs,
})

function Endpoint({ path, note }: { path: string; note: string }) {
  return (
    <li className="mb-1">
      <a href={path} className="font-mono underline hover:text-foreground">
        {path}
      </a>{" "}
      <span className="text-muted-foreground">{note}</span>
    </li>
  )
}

function GtfsDocs() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="mb-2 text-2xl font-semibold">GTFS feeds for VIA Rail</h1>
      <p className="mb-8 text-muted-foreground">
        Unofficial and community maintained. Not affiliated with, endorsed by,
        or supported by VIA Rail Canada.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-medium">Realtime</h2>
      <p className="mb-3">
        Built from VIA's public train tracker. The protobuf files are the real
        feed. The JSON files hold the same message in protobuf's canonical JSON
        mapping, which is convenient for browsers but is not part of the
        GTFS-Realtime spec, so parse the protobuf if you have a choice.
      </p>
      <ul className="mb-3 list-none">
        <Endpoint
          path="/gtfs-rt/vehicle-positions.pb"
          note="where the trains are"
        />
        <Endpoint
          path="/gtfs-rt/trip-updates.pb"
          note="arrival and departure predictions"
        />
        <Endpoint path="/gtfs-rt/alerts.pb" note="service alerts, en and fr" />
        <Endpoint path="/gtfs-rt/vehicle-positions.json" note="JSON mirror" />
        <Endpoint path="/gtfs-rt/trip-updates.json" note="JSON mirror" />
        <Endpoint path="/gtfs-rt/alerts.json" note="JSON mirror" />
      </ul>
      <p className="mb-3">
        Upstream refreshes roughly every 15 seconds. Polling faster than that
        gets you the same bytes.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-medium">Schedule</h2>
      <p className="mb-3">
        VIA publishes its own GTFS schedule. This is a copy, redistributed byte
        for byte, so that the realtime feeds above have something to reference.
        Get it from{" "}
        <a
          href="https://www.viarail.ca/en/developer-resources"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          VIA directly
        </a>{" "}
        if you only need the schedule.
      </p>
      <ul className="mb-3 list-none">
        <Endpoint path="/gtfs/viarail.zip" note="the feed as published" />
        <Endpoint
          path="/gtfs/shapes.geojson"
          note="route geometry, deduplicated for map use"
        />
      </ul>
      <p className="mb-3 text-muted-foreground">
        Copy valid {feedInfo.start} to {feedInfo.end}. Retrieved{" "}
        {feedInfo.builtAt}. sha256 {feedInfo.sourceSha256.slice(0, 16)}…
      </p>

      <h2 className="mt-8 mb-2 text-lg font-medium">Licence</h2>
      <p className="mb-3">
        VIA releases its GTFS schedule under the Open Government Licence –
        Canada version 2, which is what allows the copy above and the realtime
        feeds derived from it. If you use either, the same terms reach you, so
        carry the attribution on.
      </p>
      <p className="mb-3">
        Contains information licensed under the{" "}
        <a
          href="https://open.canada.ca/en/open-government-licence-canada"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Open Government Licence – Canada
        </a>
        .
      </p>
      <p className="mb-3">
        The realtime feeds are a different matter. They are built by reading
        VIA's public train tracker, which publishes no terms at all, so nothing
        here grants you rights over that data and none are implied. Treat the
        realtime endpoints as a best effort favour rather than something to
        build a business on.
      </p>
      <p className="mb-3">
        Everything is served as is. VIA warrants none of it and neither do I.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-medium">
        What the feed cannot tell you
      </h2>
      <p className="mb-3">
        The tracker was built to draw one train on one page, so a few things
        that GTFS-Realtime can express simply are not in the source data.
      </p>
      <ul className="mb-3 ml-4 list-disc">
        <li className="mb-1">
          Long distance trains publish a moving window of stops rather than the
          whole trip. The Canadian often shows 25 of its 67 stops. Missing stops
          mean "no information", never "skipped".
        </li>
        <li className="mb-1">
          There is no cancellation flag. A cancelled train disappears from the
          tracker, which looks identical to one that has not been published yet,
          so no trip is ever marked CANCELED here. Individual cancelled stops do
          come through as SKIPPED.
        </li>
        <li className="mb-1">
          Roughly a third of trains report a position at any given moment. The
          rest run to schedule with no GPS.
        </li>
        <li className="mb-1">
          Where a stop carries both, trust <code>delay</code> over{" "}
          <code>time</code>. VIA computes lateness within the service day, so a
          train whose departure slipped to the next day reports a sensible delay
          alongside a timestamp that is off by exactly 24 hours. Predicted times
          that disagree with the delay are dropped rather than published.
        </li>
        <li className="mb-1">
          A handful of stops in the tracker are absent from the published
          schedule and get dropped, because there is no stop_id to attach them
          to.
        </li>
      </ul>

      <h2 className="mt-8 mb-2 text-lg font-medium">Using it</h2>
      <p className="mb-3">
        CORS is open and there is no key. Be reasonable about how often you ask.
        If you build something on this, it would be nice to hear about it.
      </p>
      <p className="mb-8">
        <a href="/" className="underline hover:text-foreground">
          Back to the map
        </a>
      </p>
    </main>
  )
}
