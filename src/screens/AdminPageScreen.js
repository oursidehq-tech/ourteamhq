import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { theme } from "../theme/theme";

const ADMIN_ACTIONS = [
  {
    title: "Viewing updates",
    subtitle: "Club-wide posts and updates",
    route: "Updates",
  },
  {
    title: "Receiving notifications",
    subtitle: "Alerts and announcements",
    route: "Notifications",
  },
  {
    title: "Accepting roster shifts",
    subtitle: "Rosters and shift sign-ups",
    route: "Rostering",
  },
  {
    title: "Checking tasks",
    subtitle: "Assigned tasks and duties",
    route: "Tasks",
  },
  {
    title: "Viewing team info",
    subtitle: "Teams, members, and details",
    route: "Teams",
  },
  {
    title: "Family/team use",
    subtitle: "Roster and team access for families",
    route: "Teams",
  },
  {
    title: "Sponsor offers",
    subtitle: "Sponsorships and club offers",
    route: "LeaguePlatform",
  },
  {
    title: "Shop browsing",
    subtitle: "Browse club merchandise",
    route: "Shop",
  },
];

const TAB_ROUTES = new Set(["Home", "Teams", "Groups", "Calendar", "Shop", "More"]);

export default function AdminPageScreen({ navigation }) {
  const handleNavigate = (route) => {
    if (TAB_ROUTES.has(route)) {
      navigation.navigate("Main", { screen: route });
      return;
    }
    navigation.navigate(route);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h2">Admin Page</Text>
        <Text variant="small" color={theme.colors.textSecondary}>
          Quick access for club operations and member needs.
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card style={styles.card}>
          {ADMIN_ACTIONS.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.actionRow,
                index !== ADMIN_ACTIONS.length - 1 && styles.actionRowBorder,
              ]}
              onPress={() => handleNavigate(item.route)}
            >
              <View style={styles.actionText}>
                <Text variant="h4">{item.title}</Text>
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: 2 }}
                >
                  {item.subtitle}
                </Text>
              </View>
              <Text variant="small" color={theme.colors.primary}>
                Open
              </Text>
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 140,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionText: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  itemText: {
    flex: 1,
  },
});
