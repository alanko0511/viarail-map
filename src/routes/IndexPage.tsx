import { Button, Grid, SegmentedControl, Tooltip, useMantineTheme } from "@mantine/core";
import { useHover, useMediaQuery } from "@mantine/hooks";
import { IconArrowUp } from "@tabler/icons-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useState } from "react";
import Map, { GeolocateControl, Marker, useMap } from "react-map-gl/maplibre";
import { useLocation, useParams } from "wouter";
import { getLogger, isStationCompleted } from "../../shared/utils";
import type { Train } from "../../worker/services/viaRailData";
import { TimelineDetails } from "../components/TimelineDetails";
import { useViaRailData } from "../hooks/useViaRailData";

const logger = getLogger("MapRenderer");

const MAP_STYLES = {
  openstreetmap: `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_SECRET_KEY}`,
  satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${import.meta.env.VITE_MAPTILER_SECRET_KEY}`,
} as const;

type MapStyleType = keyof typeof MAP_STYLES;

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
          style={{
            cursor: "pointer",
          }}
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

export const IndexPage = () => {
  const params = useParams<{ trainId?: string }>();
  const [, navigate] = useLocation();
  const theme = useMantineTheme();
  const isMdAndAbove = useMediaQuery(`(min-width: ${theme.breakpoints.md})`);

  const [mapStyle, setMapStyle] = useState<MapStyleType>("openstreetmap");
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
              { label: "Street", value: "openstreetmap" },
              { label: "Hybrid", value: "satellite" },
            ]}
            style={(theme) => ({
              position: "absolute",
              top: theme.spacing.md,
              left: theme.spacing.md,
              zIndex: 1,
            })}
          />
          <Map
            initialViewState={DEFAULT_VIEW_STATE}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLES[mapStyle]}
          >
            <MapController selectedTrainId={selectedTrainId} viaRailData={viaRailData} />
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
