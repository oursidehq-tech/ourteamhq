import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyRound, LogOut, Users } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { getClubByInviteCode, joinClub } from "../../services/clubService";
import { logOut } from "../../services/authService";

export default function JoinClubScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoinClub = async () => {
    const code = (inviteCode || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a valid 6-digit invite code.");
      return;
    }
    if (!user?.uid) return;

    setJoining(true);
    try {
      const club = await getClubByInviteCode(code);
      if (!club) {
        Alert.alert("Invalid Code", "No club found for this invite code.");
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Users color={theme.colors.primary} size={36} />
          </View>
          <Text variant="h1" style={styles.title}>
            Join a Club
          </Text>
          <Text
            variant="body"
            color={theme.colors.textSecondary}
            style={styles.subtitle}
          >
            Enter your club invite code to continue.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text variant="h4" style={styles.label}>
            Club Invite Code
          </Text>
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

        <TouchableOpacity
          onPress={logOut}
          style={styles.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <LogOut color={theme.colors.textSecondary} size={16} />
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginLeft: 6 }}
          >
            Log out and create a different account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  card: {
    padding: theme.spacing.lg,
  },
  label: {
    marginBottom: theme.spacing.sm,
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
  logoutBtn: {
    marginTop: theme.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
