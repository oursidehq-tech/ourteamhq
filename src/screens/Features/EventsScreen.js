import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CalendarDays,
  Plus,
  MapPin,
  Clock3,
  Trash2,
  Repeat,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { FAB } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { subscribeToEvents, deleteEvent } from "../../services/eventService";

const formatEventDate = (event) => {
  if (!event?.date) return "Date TBC";
  const d = new Date(`${event.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return event.date;
  const dateLabel = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return event.startTime ? `${dateLabel} • ${event.startTime}` : dateLabel;
};

export default function EventsScreen({ navigation }) {
  const { activeClubId, userRole } = useClub();
  const isLeader = userRole === "Owner" || userRole === "Admin";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClubId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToEvents(activeClubId, (rows) => {
      setEvents(rows || []);
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, [activeClubId]);

  const nonMatchEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (events || [])
      .filter((event) => {
        const type = (event.type || "").toLowerCase();
        return type !== "game" && type !== "match";
      })
      .filter((event) => !event.date || event.date >= today)
      .sort((a, b) => {
        const aKey = `${a.date || ""} ${a.startTime || ""}`;
        const bKey = `${b.date || ""} ${b.startTime || ""}`;
        return aKey.localeCompare(bKey);
      });
  }, [events]);

  const removeEvent = (eventId) => {
    if (!activeClubId || !isLeader) return;
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(activeClubId, eventId);
          } catch {
            Alert.alert("Error", "Could not delete this event right now.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text variant="h2">Events</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Training, meetings, and club activities
          </Text>
        </View>
        <View style={styles.headerIconWrap}>
          <CalendarDays color={theme.colors.primary} size={20} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl * 2 }}
          />
        ) : nonMatchEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarDays color={theme.colors.border} size={48} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md }}
            >
              No upcoming events.
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4, textAlign: "center" }}
            >
              Use this area to organize training sessions, meetings, and social
              activities.
            </Text>
          </View>
        ) : (
          nonMatchEvents.map((event) => (
            <Card key={event.id} style={styles.eventCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text variant="h4">{event.title || "Club Event"}</Text>
                  <View style={styles.metaRow}>
                    <Clock3 color={theme.colors.textSecondary} size={14} />
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginLeft: 6 }}
                    >
                      {formatEventDate(event)}
                    </Text>
                  </View>
                  {event.location ? (
                    <View style={styles.metaRow}>
                      <MapPin color={theme.colors.textSecondary} size={14} />
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginLeft: 6 }}
                      >
                        {event.location}
                      </Text>
                    </View>
                  ) : null}
                  {event.recurringRule ? (
                    <View style={styles.metaRow}>
                      <Repeat color={theme.colors.primary} size={14} />
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        style={{ marginLeft: 6 }}
                      >
                        Recurring
                      </Text>
                    </View>
                  ) : null}
                  {event.description ? (
                    <Text
                      variant="body"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: theme.spacing.sm, lineHeight: 20 }}
                    >
                      {event.description}
                    </Text>
                  ) : null}
                </View>

                {isLeader ? (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => removeEvent(event.id)}
                  >
                    <Trash2 color={theme.colors.error} size={18} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {isLeader ? (
        <FAB
          icon={<Plus color={theme.colors.white} size={24} />}
          onPress={() =>
            navigation.navigate("CreateItem", {
              title: "Create Event",
              type: "Event",
            })
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.md,
  },
  eventCard: {
    marginBottom: theme.spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
