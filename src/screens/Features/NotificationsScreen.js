import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Bell, BellDot } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/notificationService";

export default function NotificationsScreen({ navigation }) {
  const { activeClubId } = useClub();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!activeClubId || !user?.uid) return;
    const unsub = subscribeToNotifications(
      activeClubId,
      user.uid,
      setNotifications,
    );
    return () => unsub();
  }, [activeClubId, user?.uid]);

  const markAllRead = () => {
    if (activeClubId && user?.uid) {
      markAllNotificationsRead(activeClubId, user.uid);
    }
  };

  const toggleRead = (id) => {
    if (activeClubId) {
      markNotificationRead(activeClubId, id);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const diff = Date.now() - timestamp.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={28} />
          </TouchableOpacity>
          <Text variant="h2">Notifications</Text>
        </View>
        <TouchableOpacity onPress={markAllRead}>
          <Text variant="small" color={theme.colors.primary} weight="600">
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View
            style={{ alignItems: "center", marginTop: theme.spacing.xl * 2 }}
          >
            <Bell color={theme.colors.border} size={48} />
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md, textAlign: "center" }}
            >
              No notifications yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notificationCard, !item.read && styles.unreadCard]}
            onPress={() => toggleRead(item.id)}
          >
            <View style={styles.iconContainer}>
              {item.read ? (
                <Bell color={theme.colors.textSecondary} size={24} />
              ) : (
                <BellDot color={theme.colors.primary} size={24} />
              )}
            </View>
            <View style={styles.infoContainer}>
              <Text variant="body" weight={item.read ? "500" : "700"}>
                {item.title}
              </Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 4 }}
              >
                {item.body || item.message || ""}
              </Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 8, fontSize: 10 }}
              >
                {formatTime(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unreadCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
  },
  iconContainer: {
    marginRight: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
  },
});
