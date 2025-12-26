import {
  Alert,
  Anchor,
  Badge,
  Center,
  Divider,
  Group,
  List,
  ScrollArea,
  Select,
  Spoiler,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconMapPin, IconTrain } from "@tabler/icons-react";
import { hasArrivedAtStation, hasDepartedFromStation } from "../../shared/utils";
import type { StationTime, Train } from "../../worker/services/viaRailData";

const StationIcon = (props: { index: number; stationTime: StationTime; totalStations: number }) => {
  const { index, stationTime, totalStations } = props;
  const now = new Date();
  const isFirstStation = index === 0;
  const isLastStation = index === totalStations - 1;

  // For the first station, check if we've departed
  if (isFirstStation) {
    return hasDepartedFromStation(stationTime, now) ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

  // For the last station, check if we've arrived
  if (isLastStation) {
    return hasArrivedAtStation(stationTime, now) ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

  // For intermediate stations, check if we've arrived
  return hasArrivedAtStation(stationTime, now) ? <IconCircleCheck size={16} /> : <IconCircleDashed size={16} />;
};

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

export const TimelineDetails = (props: {
  activeTrains: [string, Train][];
  selectedTrainId: string | null;
  onTrainSelect: (trainId: string | null) => void;
  selectedTrain: Train | null;
  activeTimelineIndex: number;
}) => {
  const { activeTrains, selectedTrainId, onTrainSelect, selectedTrain, activeTimelineIndex } = props;

  return (
    <Stack gap="md" p="md" h="100%">
      <Select
        placeholder="Choose a train to view timeline"
        data={activeTrains.map(([trainId, train]) => ({
          value: trainId,
          label: `Train ${trainId}: ${train.from} → ${train.to}`,
        }))}
        value={selectedTrainId}
        onChange={onTrainSelect}
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
                  bullet={<StationIcon index={index} stationTime={time} totalStations={selectedTrain.times.length} />}
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
                    {hasArrival && time.arrival ? (
                      // Final station with arrival object
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
                    ) : index > 0 ? (
                      // Intermediate stations: top-level fields are arrival times
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" w={60}>
                          Arrival:
                        </Text>
                        <Text size="xs" fw={500}>
                          {formatTime(time.scheduled)}
                        </Text>
                        {time.estimated && (
                          <Text size="xs" c={getDelayColor(time.diffMin)}>
                            (Est: {formatTime(time.estimated)})
                          </Text>
                        )}
                      </Group>
                    ) : null}
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
        <Text size="xs">Data source:</Text>
        <List size="xs">
          <List.Item>
            <Anchor href="https://tsimobile.viarail.ca/" target="_blank" size="xs">
              VIA Rail Canada
            </Anchor>{" "}
            (live train data)
          </List.Item>
          <List.Item>
            <Anchor href="https://map.railfans.ca/" target="_blank" size="xs">
              RailFansMap
            </Anchor>{" "}
            (route data)
          </List.Item>
        </List>

        <Text size="xs">
          The project is not affiliated with VIA Rail Canada. Check out{" "}
          <Anchor href="https://www.viarail.ca/" target="_blank">
            viarail.ca
          </Anchor>{" "}
          for the latest news and information about your journey.
        </Text>
      </Stack>
    </Stack>
  );
};
