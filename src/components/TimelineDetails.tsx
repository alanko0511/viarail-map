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
import type { NormalizedStationTime, NormalizedTrain } from "../../shared/types";

const StationIcon = (props: { stationTime: NormalizedStationTime }) => {
  const { stationTime } = props;
  const now = new Date();

  if (stationTime.position === "first") {
    return hasDepartedFromStation(stationTime, now) ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

  if (stationTime.position === "last") {
    return hasArrivedAtStation(stationTime, now) ? <IconCircleCheck size={16} /> : <IconMapPin size={16} />;
  }

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

const getDelayColor = (minutes: number | null) => {
  if (!minutes) return "gray";
  if (minutes > 15) return "red";
  if (minutes > 5) return "orange";
  return "green";
};

export const TimelineDetails = (props: {
  activeTrains: NormalizedTrain[];
  selectedTrainId: string | null;
  onTrainSelect: (trainId: string | null) => void;
  selectedTrain: NormalizedTrain | null;
  activeTimelineIndex: number;
}) => {
  const { activeTrains, selectedTrainId, onTrainSelect, selectedTrain, activeTimelineIndex } = props;

  return (
    <Stack gap="md" p="md" h="100%">
      <Select
        placeholder="Choose a train to view timeline"
        data={activeTrains.map((train) => ({
          value: train.id,
          label: `Train ${train.id}: ${train.route.from} → ${train.route.to}`,
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
                {selectedTrain.status.departed && !selectedTrain.status.arrived && (
                  <Badge color="blue" variant="light">
                    En Route
                  </Badge>
                )}
                {selectedTrain.status.arrived && (
                  <Badge color="green" variant="light">
                    Arrived
                  </Badge>
                )}
                {!selectedTrain.status.departed && (
                  <Badge color="gray" variant="light">
                    Not Departed
                  </Badge>
                )}
              </Group>
            </Group>

            <Text size="sm" c="dimmed">
              {selectedTrain.route.from} → {selectedTrain.route.to}
            </Text>

            {selectedTrain.alerts.length > 0 && (
              <Stack gap="xs">
                {selectedTrain.alerts.map((alert, idx) => (
                  <Alert key={idx} variant="light" color="red" title={alert.header} icon={<IconAlertTriangle />}>
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
                      <Text size="sm">{alert.description}</Text>
                    </Spoiler>
                  </Alert>
                ))}
              </Stack>
            )}
          </Stack>

          <Timeline active={activeTimelineIndex} bulletSize={24} lineWidth={2}>
            {selectedTrain.times.map((time, index) => (
              <Timeline.Item
                key={`${time.code}-${index}`}
                bullet={<StationIcon stationTime={time} />}
                title={
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500}>
                      {time.station}
                    </Text>
                    {time.delay.minutes !== null && time.delay.minutes > 0 && (
                      <Badge size="xs" color={getDelayColor(time.delay.minutes)}>
                        +{time.delay.minutes}m
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Stack gap={4}>
                  {time.arrival && (
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Arrival:
                      </Text>
                      <Text size="xs" fw={500}>
                        {time.arrival.scheduled && formatTime(time.arrival.scheduled)}
                      </Text>
                      {time.arrival.estimated && (
                        <Text size="xs" c={getDelayColor(time.delay.minutes)}>
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
                        {time.departure.scheduled && formatTime(time.departure.scheduled)}
                      </Text>
                      {time.departure.estimated && (
                        <Text size="xs" c={getDelayColor(time.delay.minutes)}>
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
            ))}
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
