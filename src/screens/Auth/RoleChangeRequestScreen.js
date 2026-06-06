import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, UserCog } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import { createRoleChangeRequest } from "../../services/clubService";

const AVAILABLE_ROLES = [
  "Player",
  "Parent",
  "Coach",
  "Manager",
  "Volunteer",
  "Committee",
  "Executive",
  "Admin",
];

export default function RoleChangeRequestScreen({ navigation }) {
  const { profile, user } = useAuth();
  const { activeClubId, userRole, activeMembership } = useClub();
  const currentRoles = Array.isArray(activeMembership?.roles) 
    ? activeMembership.roles 
    : [userRole || "Player"];
  const [selectedRoles, setSelectedRoles] = useState(
    currentRoles.filter(r => AVAILABLE_ROLES.includes(r))
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!activeClubId) {
      Alert.alert("Unavailable", "Join or switch to a club before requesting a role change.");
      return;
    }
    if (selectedRoles.length === 0) {
      Alert.alert("Required", "Please select at least one role.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Required", "Please provide a reason for the role change.");
      return;
    }
    const normalizedCurrentRoles = currentRoles
      .map(r => String(r || "").trim().toLowerCase())
      .sort()
      .join(",");
    const normalizedSelectedRoles = selectedRoles
      .map((role) => String(role || "").trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(",");

    if (normalizedCurrentRoles === normalizedSelectedRoles) {
      Alert.alert("Same Roles", "Your selected roles match your current roles. Please make a change to submit a request.");
      return;
    }

    setLoading(true);
    try {
      await createRoleChangeRequest(activeClubId, {
        userId: user?.uid || "",
        userName: profile?.displayName || profile?.email || "",
        currentRole: userRole || "",
        requestedRole: selectedRoles[0] || "",
        requestedRoles: selectedRoles,
        reason: reason.trim(),
      });
      Alert.alert(
        "Request Submitted",
        "Your role change request has been sent to the club admin for approval.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text variant="h2">Request Role Change</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <UserCog color={theme.colors.primary} size={20} />
              <Text variant="body" style={{ marginLeft: 10, flex: 1 }}>
                Your request will be reviewed by a club admin. Once approved,
                your role will be updated automatically.
              </Text>
            </View>
            <View style={styles.currentRoleRow}>
              <Text variant="small" color={theme.colors.textSecondary}>
                Current role:
              </Text>
              <Text
                variant="small"
                weight="700"
                color={theme.colors.primary}
                style={{ marginLeft: 6 }}
              >
                {userRole || "Not assigned"}
              </Text>
            </View>
          </Card>

          <Text variant="h4" style={styles.label}>
            Select Requested Roles
          </Text>
          <View style={styles.rolesWrap}>
            {AVAILABLE_ROLES.map((role) => {
              const active = selectedRoles.includes(role);
              const isCurrent = currentRoles.includes(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    active && styles.roleChipActive,
                  ]}
                  onPress={() => {
                    setSelectedRoles((prev) =>
                      prev.includes(role)
                        ? prev.filter((item) => item !== role)
                        : [...prev, role],
                    );
                  }}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={
                      active
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {role}
                    {isCurrent ? " (current)" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text variant="h4" style={styles.label}>
            Reason
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Explain why you are requesting this role..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Button
            title={loading ? "Submitting..." : "Submit Request"}
            onPress={handleSubmit}
            disabled={loading}
            style={{ marginTop: theme.spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  infoCard: {
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  currentRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  label: {
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  rolesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleChipCurrent: {
    opacity: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    fontSize: 14,
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 100,
  },
});
