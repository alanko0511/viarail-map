import { Button, Grid, SegmentedControl, Tooltip, useMantineTheme } from "@mantine/core";
import { useHover, useMediaQuery } from "@mantine/hooks";
import { IconArrowUp } from "@tabler/icons-react";
import type { FeatureCollection } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useState } from "react";
import Map, { GeolocateControl, Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import { useLocation, useParams } from "wouter";
import { getLogger, isStationCompleted } from "../../shared/utils";
import type { Train } from "../../worker/services/viaRailData";
import { TimelineDetails } from "../components/TimelineDetails";
import { useViaRailData } from "../hooks/useViaRailData";

const logger = getLogger("MapRenderer");

const MAP_STYLES = {
  street: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-v9",
} as const;

type MapStyleType = keyof typeof MAP_STYLES;

// VIA Rail route files
const VIARAIL_ROUTES = [
  { id: "canadian", name: "Canadian", file: "/viarail/canadian.json" },
  { id: "churchill", name: "Churchill", file: "/viarail/churchill.json" },
  { id: "corridor", name: "Corridor", file: "/viarail/corridor.json" },
  { id: "jonquiere", name: "Jonquière", file: "/viarail/jonquiere.json" },
  { id: "montrealmaintenance", name: "Montreal Maintenance", file: "/viarail/montrealmaintenance.json" },
  { id: "ocean", name: "Ocean", file: "/viarail/ocean.json" },
  { id: "rupert", name: "Rupert", file: "/viarail/rupert.json" },
  { id: "senneterre", name: "Senneterre", file: "/viarail/senneterre.json" },
  { id: "torontomaintenance", name: "Toronto Maintenance", file: "/viarail/torontomaintenance.json" },
  { id: "vancouvermaintenance", name: "Vancouver Maintenance", file: "/viarail/vancouvermaintenance.json" },
  { id: "whiteriver", name: "White River", file: "/viarail/whiteriver.json" },
  { id: "winnipegmaintenance", name: "Winnipeg Maintenance", file: "/viarail/winnipegmaintenance.json" },
] as const;

const DEFAULT_VIEW_STATE = {
  longitude: -75.695,
  latitude: 45.424721,
  zoom: 14,
} as const;

const TrainMarker = (props: {
  trainId: string;
  train: Train;
  isSelected: boolean;
  onSelect: (trainId: string) => void;
}) => {
  const { trainId, train, isSelected, onSelect } = props;
  const { current: map } = useMap();
  const { hovered, ref } = useHover();

  const handleClick = () => {
    onSelect(trainId);
    if (train.lat && train.lng && map) {
      map.flyTo({
        center: [train.lng, train.lat],
        zoom: 14,
        duration: 1500,
      });
    }
  };

  return (
    <Marker longitude={train.lng!} latitude={train.lat!} anchor="center">
      <Tooltip
        label={train.speed ? `${Math.round(train.speed)} km/h` : ""}
        disabled={!train.speed}
        opened={hovered || isSelected}
        withArrow
      >
        <Button
          ref={ref}
          color={isSelected ? "blue" : "yellow"}
          radius="sm"
          onClick={handleClick}
          style={(theme) => ({
            cursor: "pointer",
            boxShadow: theme.shadows.sm,
            border: `1px solid ${theme.colors.yellow[8]}`,
          })}
          size="compact-xs"
          rightSection={
            train.direction && (
              <IconArrowUp
                size={14}
                style={{
                  transform: `rotate(${train.direction}deg)`,
                  transition: "transform 0.3s ease",
                }}
              />
            )
          }
        >
          {props.trainId}
        </Button>
      </Tooltip>
    </Marker>
  );
};

const MapController = (props: {
  selectedTrainId: string | null;
  viaRailData: Record<string, Train> | null | undefined;
}) => {
  const { selectedTrainId, viaRailData } = props;
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || !selectedTrainId || !viaRailData) return;

    // Fly to the selected train whenever it changes
    const train = viaRailData[selectedTrainId];
    if (train?.lat && train?.lng) {
      map.flyTo({
        center: [train.lng, train.lat],
        zoom: 14,
        duration: 1500,
      });
    }
  }, [map, selectedTrainId, viaRailData]);

  return null;
};

type ViaRailGeoJSON = FeatureCollection & {
  metadata?: {
    id?: string;
    color?: string;
    name?: string;
    [key: string]: unknown;
  };
};

const ViaRailRoutes = () => {
  const [routesData, setRoutesData] = useState<Record<string, ViaRailGeoJSON>>({});

  useEffect(() => {
    // Load all GeoJSON files
    const loadRoutes = async () => {
      const loaded: Record<string, ViaRailGeoJSON> = {};

      for (const route of VIARAIL_ROUTES) {
        try {
          const response = await fetch(route.file);
          const data = (await response.json()) as ViaRailGeoJSON;
          loaded[route.id] = data;
        } catch (error) {
          logger("error", `Failed to load route ${route.id}:`, error);
        }
      }

      setRoutesData(loaded);
    };

    loadRoutes();
  }, []);

  return (
    <>
      {Object.entries(routesData).map(([routeId, data]) => {
        const routeColor = "#fab005";

        return (
          <Source key={routeId} id={routeId} type="geojson" data={data}>
            {/* Rail line layer */}
            <Layer
              id={`${routeId}-line`}
              type="line"
              filter={["==", ["get", "type"], "alignment"]}
              paint={{
                "line-color": routeColor,
                "line-width": 4,
                "line-opacity": 0.8,
              }}
            />

            <Layer
              id={`${routeId}-tracks`}
              type="line"
              filter={["==", ["get", "type"], "tracks"]}
              paint={{
                "line-color": routeColor,
                "line-width": 2,
                "line-opacity": 0.2,
              }}
            />

            {/* Station markers layer */}
            <Layer
              id={`${routeId}-stations`}
              type="circle"
              filter={["==", ["get", "type"], "station-label"]}
              paint={{
                "circle-radius": 4,
                "circle-color": routeColor,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              }}
            />

            {/* Station labels layer */}
            <Layer
              id={`${routeId}-labels`}
              type="symbol"
              filter={["==", ["get", "type"], "station-label"]}
              minzoom={7}
              layout={{
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                "text-size": 12,
                "text-offset": [0, 0],
                "text-anchor": "top",
              }}
              paint={{
                "text-color": "#333333",
                "text-halo-color": "#ffffff",
                "text-halo-width": 2,
              }}
            />
          </Source>
        );
      })}
    </>
  );
};

export const IndexPage = () => {
  const params = useParams<{ trainId?: string }>();
  const [, navigate] = useLocation();
  const theme = useMantineTheme();
  const isMdAndAbove = useMediaQuery(`(min-width: ${theme.breakpoints.md})`);

  const [mapStyle, setMapStyle] = useState<MapStyleType>("street");
  const selectedTrainId = params.trainId ?? null;

  const { data: viaRailData, error: trainError } = useViaRailData();

  const setSelectedTrainId = (trainId: string | null) => {
    if (trainId) {
      navigate(`/${trainId}`);
    } else {
      navigate("/");
    }
  };

  const activeTrains = useMemo(() => {
    return viaRailData
      ? Object.entries(viaRailData).filter(([, train]) => train.lat !== undefined && train.lng !== undefined)
      : [];
  }, [viaRailData]);

  const selectedTrain = selectedTrainId && viaRailData ? viaRailData[selectedTrainId] : null;

  const activeTimelineIndex = useMemo(() => {
    if (!selectedTrain) return 0;
    if (!selectedTrain.departed) return 0;
    if (selectedTrain.arrived) return selectedTrain.times.length - 1;

    const now = new Date();
    let lastCompletedIndex = 0;

    for (let i = 0; i < selectedTrain.times.length; i++) {
      if (isStationCompleted(selectedTrain.times[i], i, selectedTrain.times.length, now)) {
        lastCompletedIndex = i;
      }
    }

    return lastCompletedIndex;
  }, [selectedTrain]);

  if (trainError) {
    logger("error", "Failed to load train data:", trainError);
  }

  return (
    <Grid overflow="hidden" gutter={0}>
      <Grid.Col span={{ md: 8, lg: 9 }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isMdAndAbove ? "100vh" : "20vh",
          }}
        >
          <SegmentedControl
            value={mapStyle}
            onChange={(value) => setMapStyle(value as MapStyleType)}
            data={[
              { label: "Street", value: "street" },
              { label: "Light", value: "light" },
              { label: "Satellite", value: "satellite" },
            ]}
            style={(theme) => ({
              position: "absolute",
              top: theme.spacing.md,
              left: theme.spacing.md,
              zIndex: 1,
            })}
          />
          <Map
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
            initialViewState={DEFAULT_VIEW_STATE}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLES[mapStyle]}
          >
            <MapController selectedTrainId={selectedTrainId} viaRailData={viaRailData} />
            <ViaRailRoutes />
            <GeolocateControl
              position="bottom-left"
              trackUserLocation={false}
              onError={(e) => logger("warn", "Failed to get geolocation:", e)}
            />
            {activeTrains.map(([trainId, train]) => (
              <TrainMarker
                key={trainId}
                trainId={trainId}
                train={train}
                isSelected={selectedTrainId === trainId}
                onSelect={setSelectedTrainId}
              />
            ))}
          </Map>
        </div>
      </Grid.Col>
      <Grid.Col
        span={{ md: 4, lg: 3 }}
        style={{
          height: isMdAndAbove ? "100vh" : "80vh",
          borderRight: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <TimelineDetails
          activeTrains={activeTrains}
          selectedTrainId={selectedTrainId}
          onTrainSelect={setSelectedTrainId}
          selectedTrain={selectedTrain}
          activeTimelineIndex={activeTimelineIndex}
        />
      </Grid.Col>
    </Grid>
  );
};
