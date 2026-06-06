import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, Camera } from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { updateUserProfile } from "../services/authService";
import { uploadAvatar } from "../services/storageService";
import {
  getLinkedPlayerProfileByUser,
  subscribeToParentPlayerProfiles,
} from "../services/clubOperationsService";

export default function ProfileScreen({ navigation }) {
  const { user, profile, refreshProfile } = useAuth();
  const { activeClubId } = useClub();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [linkedPlayerProfile, setLinkedPlayerProfile] = useState(null);
  const [parentLinkedPlayers, setParentLinkedPlayers] = useState([]);

  const activeMembership = useMemo(() => {
    const memberships = profile?.clubMemberships || [];
    return memberships.find((m) => m.clubId === activeClubId) || null;
  }, [profile?.clubMemberships, activeClubId]);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    const load = async () => {
      if (!activeClubId || !user?.uid) {
        if (!cancelled) {
          setLinkedPlayerProfile(null);
          setParentLinkedPlayers([]);
        }
        return;
      }

      const role = String(activeMembership?.role || "").toLowerCase();
      if (role === "parent") {
        unsubscribe = subscribeToParentPlayerProfiles(
          activeClubId,
          user.uid,
          (rows) => {
            if (!cancelled) setParentLinkedPlayers(rows || []);
          },
        );
        if (!cancelled) setLinkedPlayerProfile(null);
        return;
      }

      if (role === "player") {
        const row = await getLinkedPlayerProfileByUser(activeClubId, user.uid);
        if (!cancelled) {
          setLinkedPlayerProfile(row || null);
          setParentLinkedPlayers([]);
        }
        return;
      }

      if (!cancelled) {
        setLinkedPlayerProfile(null);
        setParentLinkedPlayers([]);
      }
    };

    load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeClubId, user?.uid, activeMembership?.role]);

  const handlePickAvatar = async () => {
    if (!user?.uid) {
      Alert.alert("Error", "You need to be signed in to update profile image.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploadingAvatar(true);
    try {
      const imageUrl = await uploadAvatar(user.uid, picked.assets[0].uri);
      if (!imageUrl) {
        Alert.alert(
          "Upload Unavailable",
          "Please configure Cloudinary credentials in .env to upload profile images.",
        );
        return;
      }

      await updateUserProfile(user.uid, {
        avatarUrl: imageUrl,
        avatarOwnerUid: user.uid,
        avatarOwnerName: profile?.displayName || profile?.email || "User",
      });
      await refreshProfile();
      Alert.alert("Updated", "Profile image updated successfully.");
    } catch (error) {
      Alert.alert("Upload Failed", error?.message || "Could not update image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = (displayName || "").trim();
    const trimmedPhone = (phone || "").trim();

    if (!trimmedName) {
      Alert.alert("Required", "Display name is required.");
      return;
    }
    if (!user?.uid) {
      Alert.alert("Error", "You need to be signed in.");
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: trimmedName,
        phone: trimmedPhone,
      });
      await refreshProfile();
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <Text variant="h2">My Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.avatarCard}>
          <View style={styles.avatarRow}>
            <Avatar
              source={
                profile?.avatarUrl
                  ? { uri: profile.avatarUrl }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "User")}&background=108B51&color=fff&size=150`,
                    }
              }
              size={80}
            />
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={handlePickAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Camera color={theme.colors.primary} size={16} />
                  <Text
                    variant="small"
                    weight="600"
                    color={theme.colors.primary}
                    style={{ marginLeft: 6 }}
                  >
                    Change Photo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text variant="h4" style={styles.fieldLabel}>
            Display Name
          </Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
          />

          <Text variant="h4" style={styles.fieldLabel}>
            Phone
          </Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Your phone"
            keyboardType="phone-pad"
          />

          <Text variant="h4" style={styles.fieldLabel}>
            Email
          </Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={profile?.email || ""}
            editable={false}
            selectTextOnFocus={false}
          />

          <Text variant="h4" style={styles.fieldLabel}>
            Active Club Role
          </Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={activeMembership?.role || "Player"}
            editable={false}
            selectTextOnFocus={false}
          />

          <Button
            title={saving ? "Saving..." : "Save Profile"}
            onPress={handleSave}
            disabled={saving}
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        <Card style={styles.sectionCard}>
          <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
            Club Memberships
          </Text>
          {(profile?.clubMemberships || []).length === 0 ? (
            <Text variant="small" color={theme.colors.textSecondary}>
              No club memberships yet.
            </Text>
          ) : (
            (profile?.clubMemberships || []).map((membership) => (
              <View
                key={`${membership.clubId}-${membership.role}`}
                style={styles.membershipRow}
              >
                <Text variant="body" weight="600">
                  {membership.clubName || membership.clubId}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Role: {membership.role || "Player"}
                </Text>
              </View>
            ))
          )}
        </Card>

        {String(activeMembership?.role || "").toLowerCase() === "parent" ? (
          <Card style={styles.sectionCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              Linked Player Profiles
            </Text>
            {parentLinkedPlayers.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No linked players yet. Add players from My Family Dashboard.
              </Text>
            ) : (
              parentLinkedPlayers.map((player) => (
                <View
                  key={player.id}
                  style={styles.membershipRow}
                >
                  <Text variant="body" weight="600">
                    {player.playerName || "Player"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Team: {player.teamName || player.teamId || "Unassigned"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Login linked: {player.linkedPlayerUserUid ? "Yes" : "No"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Parent payment approval: {player?.paymentPolicy?.requireParentApprovalForPayments === false ? "Off" : "On"}
                  </Text>
                </View>
              ))
            )}
          </Card>
        ) : null}

        {String(activeMembership?.role || "").toLowerCase() === "player" ? (
          <Card style={styles.sectionCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              My Player Profile Link
            </Text>
            {!linkedPlayerProfile ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No linked player profile found yet. Ask a parent or admin to link your account.
              </Text>
            ) : (
              <>
                <Text variant="body" weight="600">
                  {linkedPlayerProfile.playerName || "Player"}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Team: {linkedPlayerProfile.teamName || linkedPlayerProfile.teamId || "Unassigned"}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Parent payment approval: {linkedPlayerProfile?.paymentPolicy?.requireParentApprovalForPayments === false ? "Off" : "On"}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Linked parents: {(linkedPlayerProfile.parentLinks || []).length}
                </Text>
              </>
            )}
          </Card>
        ) : null}
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
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 2,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  avatarCard: {
    marginBottom: theme.spacing.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    fontSize: 15,
  },
  inputDisabled: {
    backgroundColor: theme.colors.background,
    color: theme.colors.textSecondary,
  },
  membershipRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
});
