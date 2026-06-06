import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Moon,
  Bell,
  Shield,
  Smartphone,
  Sparkles,
  KeyRound,
  Users,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { theme } from "../theme/theme";
import { useUISettings } from "../contexts/UISettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { getClubByInviteCode, joinClub } from "../services/clubService";

const Row = ({ icon, title, subtitle, right, onPress, isLast = false }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.row, !isLast && styles.rowBorder]}
    activeOpacity={onPress ? 0.85 : 1}
    disabled={!onPress}
  >
    <View style={styles.rowLeft}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.rowTextWrap}>
        <Text variant="h4">{title}</Text>
        {subtitle ? (
          <Text variant="small" color={theme.colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
    {right}
  </TouchableOpacity>
);

export default function SettingsScreen({ navigation }) {
  const { settings, loaded, updateSetting } = useUISettings();
  const { user, profile, refreshProfile } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  const setFlag = (key, value) => {
    updateSetting(key, value);
  };

  const modeLabel = useMemo(
    () => (settings.darkMode ? "Dark" : "Light"),
    [settings.darkMode],
  );

  const openDeviceNotificationSettings = async () => {
    try {
      const supported = await Linking.canOpenURL("app-settings:");
      if (supported) {
        await Linking.openURL("app-settings:");
        return;
      }
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Notifications",
        "Could not open settings. Please open your device settings manually.",
      );
    }
  };

  const showThemeInfo = () => {
    Alert.alert(
      "Dark Mode",
      "Dark mode preference is saved. Full app-wide dark theme rollout can be connected to this setting next.",
    );
  };

  const handleJoinClub = async () => {
    const code = (inviteCode || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a valid 6-digit invite code.");
      return;
    }
    if (!user?.uid) return;

    const existing = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];

    setJoining(true);
    try {
      const club = await getClubByInviteCode(code);
      if (!club) {
        Alert.alert("Invalid Code", "No club found for this invite code.");
        return;
      }

      if (existing.some((m) => m.clubId === club.id)) {
        Alert.alert("Already Joined", "You are already a member of this club.");
        return;
      }

      await joinClub(club.id, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || "Member",
        email: profile?.email || user.email || "",
        role: "Player",
        teamIds: [],
        clubName: club.name || "",
      });

      await refreshProfile();
      setInviteCode("");
      Alert.alert(
        "Joined",
        `You joined ${club.name || "the club"} successfully.`,
      );
    } catch (error) {
      Alert.alert(
        "Join Failed",
        error?.message || "Unable to join club right now. Please try again.",
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card noPadding style={styles.card}>
          <Row
            icon={<Moon color={theme.colors.primary} size={20} />}
            title="Dark Mode"
            subtitle={`Current mode: ${modeLabel}`}
            right={
              <Switch
                value={settings.darkMode}
                onValueChange={(v) => setFlag("darkMode", v)}
                trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                thumbColor={settings.darkMode ? "#166534" : "#F8FAFC"}
              />
            }
          />
          <Row
            icon={<Sparkles color={theme.colors.primary} size={20} />}
            title="Reduce Motion"
            subtitle="Use less animation in app interactions"
            right={
              <Switch
                value={settings.reduceMotion}
                onValueChange={(v) => setFlag("reduceMotion", v)}
                trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                thumbColor={settings.reduceMotion ? "#166534" : "#F8FAFC"}
              />
            }
          />
          <Row
            icon={<Smartphone color={theme.colors.primary} size={20} />}
            title="Compact Layout"
            subtitle="Use tighter spacing on smaller screens"
            right={
              <Switch
                value={settings.compactMode}
                onValueChange={(v) => setFlag("compactMode", v)}
                trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                thumbColor={settings.compactMode ? "#166534" : "#F8FAFC"}
              />
            }
            isLast
          />
        </Card>

        <Card noPadding style={styles.card}>
          <Row
            icon={<Bell color={theme.colors.primary} size={20} />}
            title="Notification Permissions"
            subtitle={
              Platform.OS === "android"
                ? "Open system settings to allow notifications"
                : "Open iOS settings to manage notifications"
            }
            right={
              <Text variant="small" color={theme.colors.primary} weight="700">
                Open
              </Text>
            }
            onPress={openDeviceNotificationSettings}
            isLast
          />
        </Card>

        <Card noPadding style={styles.card}>
          <Row
            icon={<Shield color={theme.colors.primary} size={20} />}
            title="Theme & Privacy Note"
            subtitle="See details about saved local preferences"
            right={
              <Text variant="small" color={theme.colors.primary} weight="700">
                View
              </Text>
            }
            onPress={showThemeInfo}
            isLast
          />
        </Card>

        <Text variant="small" weight="600" style={styles.sectionTitle}>
          CLUB MEMBERSHIP
        </Text>
        <Card style={styles.joinCard}>
          <View style={styles.joinHeader}>
            <View style={styles.joinIcon}>
              <Users color={theme.colors.primary} size={22} />
            </View>
            <View style={styles.joinText}>
              <Text variant="h4">Join Another Club</Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                Enter a 6-digit club invite code.
              </Text>
            </View>
          </View>
          <View style={styles.inputWrap}>
            <KeyRound color={theme.colors.textSecondary} size={20} />
            <TextInput
              style={styles.input}
              placeholder="000000"
              value={inviteCode}
              onChangeText={(text) =>
                setInviteCode((text || "").replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              keyboardType="number-pad"
              autoCorrect={false}
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          <Button
            title={joining ? "Joining..." : "Join Club"}
            onPress={handleJoinClub}
            disabled={joining}
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        <Text
          variant="small"
          color={theme.colors.textSecondary}
          style={styles.footnote}
        >
          {!loaded
            ? "Loading preferences..."
            : "Settings are saved on this device."}
        </Text>
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
    width: 40,
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  joinCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  joinHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  joinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  joinText: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  inputWrap: {
    height: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 24,
    letterSpacing: 4,
    textAlign: "center",
    color: theme.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: theme.spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    marginRight: 10,
  },
  rowTextWrap: {
    flex: 1,
  },
  footnote: {
    textAlign: "center",
    marginTop: 4,
  },
});
