import {
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Divider,
  Grid,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Spoiler,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconMapPin,
  IconTrain,
  IconTrainFilled,
} from "@tabler/icons-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useState } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import { useLocation, useParams } from "wouter";
import { getLogger } from "../../shared/utils";
import type { StationTime } from "../../worker/services/viaRailData";
import { useViaRailData } from "../hooks/useViaRailData";

const logger = getLogger("MapRenderer");

const StationIcon = (props: { index: number; stationTime: StationTime; totalStations: number }) => {
  const { index, stationTime, totalStations } = props;
  const hasArrival = "arrival" in stationTime;
  const now = new Date();

  const hasDeparted = stationTime.departure?.estimated ? new Date(stationTime.departure.estimated) < now : false;

  const hasArrived =
    hasArrival && stationTime.arrival?.estimated ? new Date(stationTime.arrival.estimated) < now : false;

  if (index === 0) {
    return hasDeparted ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

  if (index === totalStations - 1) {
    return hasArrived ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

  if (hasDeparted) {
    return <IconCircleCheck size={16} />;
  }

  if (hasArrived) {
    return <IconCircleCheck size={16} />;
  }

  return <IconCircleDashed size={16} />;
};

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

export const IndexPage = () => {
  const params = useParams<{ trainId?: string }>();
  const [, navigate] = useLocation();

  const [viewState, setViewState] = useState<{
    longitude: number;
    latitude: number;
    zoom: number;
  } | null>(null);

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

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 14,
          });
        },
        (error) => {
          logger("warn", "Failed to get geolocation:", error.message);
          setViewState(DEFAULT_VIEW_STATE);
        }
      );
    } else {
      setViewState(DEFAULT_VIEW_STATE);
    }
  }, []);

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

    let currentIndex = selectedTrain.times.length - 1;

    for (let i = 0; i < selectedTrain.times.length; i++) {
      const time = selectedTrain.times[i];

      if (time.departure?.estimated) {
        const departureTime = new Date(time.departure.estimated);
        if (departureTime > now) {
          currentIndex = i;
          break;
        }
      } else if ("arrival" in time && time.arrival?.estimated) {
        const arrivalTime = new Date(time.arrival.estimated);
        if (arrivalTime > now) {
          currentIndex = i;
          break;
        }
      }
    }

    return currentIndex;
  }, [selectedTrain]);

  if (!viewState) {
    return (
      <Center h="100vh" w="100vw">
        <Paper withBorder p="xl" shadow="lg" radius="lg">
          <Text>Loading map...</Text>
        </Paper>
      </Center>
    );
  }

  if (trainError) {
    logger("error", "Failed to load train data:", trainError);
  }

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDelayColor = (diffMin?: number) => {
    if (!diffMin) return "gray";
    if (diffMin > 15) return "red";
    if (diffMin > 5) return "orange";
    return "green";
  };

  return (
    <Grid overflow="hidden" gutter={0}>
      <Grid.Col span={3} style={{ height: "100vh", borderRight: "1px solid var(--mantine-color-default-border)" }}>
        <Stack gap="md" p="md" h="100%">
          <Select
            placeholder="Choose a train to view timeline"
            data={activeTrains.map(([trainId, train]) => ({
              value: trainId,
              label: `Train ${trainId}: ${train.from} → ${train.to}`,
            }))}
            value={selectedTrainId}
            onChange={setSelectedTrainId}
            searchable
            clearable
          />
          {selectedTrain ? (
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap="xs" mb="md">
                <Group justify="space-between">
                  <Text size="lg" fw={600}>
                    <IconTrain size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
                    Train {selectedTrainId}
                  </Text>
                  <Group gap="xs">
                    {selectedTrain.departed && !selectedTrain.arrived && (
                      <Badge color="blue" variant="light">
                        En Route
                      </Badge>
                    )}
                    {selectedTrain.arrived && (
                      <Badge color="green" variant="light">
                        Arrived
                      </Badge>
                    )}
                    {!selectedTrain.departed && (
                      <Badge color="gray" variant="light">
                        Not Departed
                      </Badge>
                    )}
                  </Group>
                </Group>

                <Text size="sm" c="dimmed">
                  {selectedTrain.from} → {selectedTrain.to}
                </Text>

                {selectedTrain.alerts && selectedTrain.alerts.length > 0 && (
                  <Stack gap="xs">
                    {selectedTrain.alerts.map((alert, idx) => (
                      <Alert key={idx} variant="light" color="red" title={alert.header.en} icon={<IconAlertTriangle />}>
                        <Spoiler
                          maxHeight={120}
                          showLabel="More"
                          hideLabel="Hide"
                          styles={(theme) => ({
                            control: {
                              fontSize: theme.fontSizes.sm,
                            },
                          })}
                        >
                          <Text size="sm">{alert.description.en}</Text>
                        </Spoiler>
                      </Alert>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Timeline active={activeTimelineIndex} bulletSize={24} lineWidth={2}>
                {selectedTrain.times.map((time, index) => {
                  const hasArrival = "arrival" in time;

                  return (
                    <Timeline.Item
                      key={`${time.code}-${index}`}
                      bullet={
                        <StationIcon index={index} stationTime={time} totalStations={selectedTrain.times.length} />
                      }
                      title={
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={500}>
                            {time.station}
                          </Text>
                          {time.diffMin !== undefined && time.diffMin > 0 && (
                            <Badge size="xs" color={getDelayColor(time.diffMin)}>
                              +{time.diffMin}m
                            </Badge>
                          )}
                        </Group>
                      }
                    >
                      <Stack gap={4}>
                        {hasArrival && time.arrival && (
                          <Group gap="xs">
                            <Text size="xs" c="dimmed" w={60}>
                              Arrival:
                            </Text>
                            <Text size="xs" fw={500}>
                              {formatTime(time.arrival.scheduled)}
                            </Text>
                            {time.arrival.estimated && (
                              <Text size="xs" c={getDelayColor(time.diffMin)}>
                                (Est: {formatTime(time.arrival.estimated)})
                              </Text>
                            )}
                          </Group>
                        )}
                        {time.departure && (
                          <Group gap="xs">
                            <Text size="xs" c="dimmed" w={60}>
                              Departure:
                            </Text>
                            <Text size="xs" fw={500}>
                              {formatTime(time.departure.scheduled)}
                            </Text>
                            {time.departure.estimated && (
                              <Text size="xs" c={getDelayColor(time.diffMin)}>
                                (Est: {formatTime(time.departure.estimated)})
                              </Text>
                            )}
                          </Group>
                        )}
                        <Text size="xs" c="dimmed">
                          {time.code}
                        </Text>
                      </Stack>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </ScrollArea>
          ) : (
            <Center style={{ flex: 1 }}>
              <Text c="dimmed" size="md">
                Select a train to view its timeline
              </Text>
            </Center>
          )}
          <Divider />
          <Stack gap="4px">
            <Text size="xs">
              GitHub:{" "}
              <Anchor href="https://github.com/alanko0511/viarail-map" target="_blank">
                alanko0511/viarail-map
              </Anchor>
            </Text>
            <Text size="xs">
              Data source:{" "}
              <Anchor href="https://tsimobile.viarail.ca/" target="_blank">
                tsimobile.viarail.ca
              </Anchor>{" "}
              (VIA Rail Canada)
            </Text>
            <Text size="xs">
              The project is not affiliated with VIA Rail Canada. The data is for informational purposes only. Check out{" "}
              <Anchor href="https://www.viarail.ca/" target="_blank">
                viarail.ca
              </Anchor>{" "}
              for the latest news and information about your journey.
            </Text>
          </Stack>
        </Stack>
      </Grid.Col>
      <Grid.Col span={9}>
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
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
          <Map initialViewState={viewState} style={{ width: "100%", height: "100%" }} mapStyle={MAP_STYLES[mapStyle]}>
            {activeTrains.map(([trainId, train]) => (
              <Marker key={trainId} longitude={train.lng!} latitude={train.lat!} anchor="center">
                <Button
                  color={selectedTrainId === trainId ? "blue" : "yellow"}
                  radius="xl"
                  leftSection={<IconTrainFilled size={16} />}
                  onClick={() => setSelectedTrainId(trainId)}
                  style={{ cursor: "pointer" }}
                  size="compact-sm"
                >
                  {trainId}
                </Button>
              </Marker>
            ))}
          </Map>
        </div>
      </Grid.Col>
    </Grid>
  );
};
