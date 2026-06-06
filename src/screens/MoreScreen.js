import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  User,
  ShoppingBag,
  Calendar as CalendarIcon,
  RefreshCcw,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Users,
  CheckSquare,
  Wrench,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Building2,
  UserCog,
  ClipboardList,
  BookOpen,
  ExternalLink,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { theme } from "../theme/theme";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import { logOut, updateUserProfile } from "../services/authService";
import { uploadAvatar } from "../services/storageService";
import {
  ensureClubInviteCode,
  regenerateClubInviteCode,
} from "../services/clubService";

const MenuItem = ({
  icon,
  title,
  subtitle,
  badge,
  color = theme.colors.text,
  isLast = false,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.menuItem, !isLast && styles.menuItemBorder]}
    onPress={onPress}
  >
    <View style={styles.menuItemLeft}>
      {icon}
      <View style={{ marginLeft: theme.spacing.md }}>
        <Text variant="h4" color={color}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="small" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
    <View style={styles.menuItemRight}>
      {badge && (
        <Badge
          text={badge}
          variant="outline"
          style={{ borderColor: theme.colors.error, marginRight: 8 }}
        />
      )}
      <ChevronRight color={theme.colors.border} size={20} />
    </View>
  </TouchableOpacity>
);

export default function MoreScreen({ navigation, route }) {
  const { profile, user, refreshProfile } = useAuth();
  const {
    userRole,
    isClubLeader,
    activeClubId,
    activeClub,
    allClubs,
    switchClub,
  } = useClub();
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const isOwner = normalizedRole === "owner";
  const isClubStaff =
    isClubLeader || normalizedRole === "coach" || normalizedRole === "manager";
  const canAccessClubManagement =
    isClubStaff ||
    normalizedRole === "executive" ||
    normalizedRole === "committee";
  const hideOperations = normalizedRole === "player" || normalizedRole === "parent";
  const { setCollapsed } = useTabBarAnimation();
  const [switchModalOpen, setSwitchModalOpen] = useState(false);

  const sortedClubs = useMemo(() => {
    return [...allClubs].sort((a, b) =>
      String(a.clubName || a.clubId || "").localeCompare(
        String(b.clubName || b.clubId || ""),
      ),
    );
  }, [allClubs]);

  useFocusEffect(
    useCallback(() => {
      setCollapsed(false);
      return () => setCollapsed(false);
    }, [setCollapsed]),
  );

  const handleTabBarScroll = useCallback(
    (event) => {
      const offsetY = event?.nativeEvent?.contentOffset?.y || 0;
      setCollapsed(offsetY > 24);
    },
    [setCollapsed],
  );

  const handleAlert = (title, message) => {
    Alert.alert(title, message || "This feature is coming soon.");
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logOut();
          } catch (e) {
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  };

  const handleSwitchClub = () => {
    if (allClubs.length <= 1) {
      Alert.alert("Switch Club", "You are only a member of one club.");
      return;
    }
    setSwitchModalOpen(true);
  };

  const closeSwitchModal = () => setSwitchModalOpen(false);
  const handleSelectClub = (clubId) => {
    switchClub(clubId);
    setSwitchModalOpen(false);
  };

  const handleClubJoinCode = async () => {
    if (!activeClubId || !isClubLeader) return;

    try {
      const code = await ensureClubInviteCode(activeClubId);
      Alert.alert(
        "Club Join Code",
        `Share this 6-digit code with players, coaches, and parents:\n\n${code}`,
        [
          { text: "Close", style: "cancel" },
          isOwner
            ? {
                text: "Regenerate",
                style: "destructive",
                onPress: async () => {
                  try {
                    const newCode =
                      await regenerateClubInviteCode(activeClubId);
                    Alert.alert(
                      "New Join Code",
                      `Your new 6-digit code is:\n\n${newCode}`,
                    );
                  } catch {
                    Alert.alert(
                      "Error",
                      "Could not regenerate code right now.",
                    );
                  }
                },
              }
            : undefined,
        ].filter(Boolean),
      );
    } catch {
      Alert.alert("Error", "Could not load club join code right now.");
    }
  };

  const handleEditProfile = async () => {
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
      Alert.alert(
        "Upload Failed",
        error?.message || "Could not update profile image.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2">More</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        {/* Profile Card */}
        <View style={styles.section}>
          <Card style={styles.profileCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Avatar
                source={
                  profile?.avatarUrl
                    ? { uri: profile.avatarUrl }
                    : {
                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "User")}&background=108B51&color=fff&size=150`,
                      }
                }
                size={60}
              />
              <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
                <Text variant="h3">{profile?.displayName || "User"}</Text>
                <Text variant="small" style={{ marginTop: 4 }}>
                  {userRole} • {activeClub?.name || "No Club"}
                </Text>
              </View>
              <TouchableOpacity onPress={handleEditProfile}>
                <Text variant="body" color={theme.colors.primary} weight="600">
                  Edit
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* MY ACCOUNT */}
        <View style={styles.section}>
          <Text variant="small" weight="600" style={styles.sectionTitle}>
            MY ACCOUNT
          </Text>
          <Card noPadding style={styles.menuCard}>
            <MenuItem
              icon={<User color={theme.colors.primary} size={24} />}
              title="My Profile"
              onPress={() => navigation.navigate("Profile")}
            />
            <MenuItem
              icon={<ShoppingBag color={theme.colors.primary} size={24} />}
              title="My Orders"
              onPress={() => navigation.navigate("MyOrders")}
            />
            <MenuItem
              icon={<CalendarIcon color={theme.colors.primary} size={24} />}
              title="My Availability"
              onPress={() => handleAlert("My Availability")}
            />
            <MenuItem
              icon={<UserCog color={theme.colors.primary} size={24} />}
              title="Request Role Change"
              subtitle="Ask admin to update your role"
              isLast
              onPress={() => navigation.navigate("RoleChangeRequest")}
            />
          </Card>
        </View>

        {/* CLUB STORE */}
        <View style={styles.section}>
          <Text variant="small" weight="600" style={styles.sectionTitle}>
            CLUB STORE
          </Text>
          <Card noPadding style={styles.menuCard}>
            <MenuItem
              icon={<ShoppingBag color={theme.colors.primary} size={24} />}
              title="Storefront"
              subtitle="Browse club merchandise"
              onPress={() => navigation.navigate("Shop")}
            />
            <MenuItem
              icon={<CreditCard color={theme.colors.primary} size={24} />}
              title="Cart & Checkout"
              subtitle="Review your cart and place orders"
              onPress={() => navigation.navigate("Cart")}
            />
            <MenuItem
              icon={<CheckSquare color={theme.colors.primary} size={24} />}
              title="Orders"
              subtitle={
                isClubLeader
                  ? "Track all club sales"
                  : "View your order history"
              }
              onPress={() =>
                navigation.navigate(
                  isClubLeader ? "OrdersDashboard" : "MyOrders",
                )
              }
            />
            {isClubLeader && (
              <MenuItem
                icon={<Wrench color={theme.colors.primary} size={24} />}
                title="Edit Shop"
                subtitle="Edit catalog, stock and visibility"
                isLast
                onPress={() => navigation.navigate("ProductManager")}
              />
            )}
          </Card>
        </View>

        {/* OPERATIONS — all members except players/parents */}
        {!hideOperations && (
          <View style={styles.section}>
            <Text variant="small" weight="600" style={styles.sectionTitle}>
              OPERATIONS
            </Text>
          <Card noPadding style={styles.menuCard}>
            <MenuItem
              icon={<CheckSquare color={theme.colors.primary} size={24} />}
              title="Tasks"
              subtitle="View and manage your assigned tasks"
              onPress={() => navigation.navigate("Tasks", { role: userRole })}
            />
            <MenuItem
              icon={<Users color={theme.colors.primary} size={24} />}
              title="Rostering & Shifts"
              subtitle="Sign up for shifts and view rosters"
              onPress={() =>
                navigation.navigate("Rostering", { role: userRole })
              }
            />
            <MenuItem
              icon={<ClipboardList color={theme.colors.primary} size={24} />}
              title="Checklists"
              subtitle="Game-day, pre-season and event checklists"
              onPress={() =>
                navigation.navigate("ClubOperations", { initialTab: 1 })
              }
            />
            <MenuItem
              icon={<ShieldCheck color={theme.colors.primary} size={24} />}
              title="Compliance"
              subtitle="Team compliance roles and requirements"
              isLast
              onPress={() =>
                navigation.navigate("ClubOperations", { initialTab: 2 })
              }
            />
          </Card>
        </View>
        )}

        {/* TRAINING HUB — staff and coaches */}
        {isClubStaff && (
          <View style={styles.section}>
            <Text variant="small" weight="600" style={styles.sectionTitle}>
              TRAINING HUB
            </Text>
            <Card noPadding style={styles.menuCard}>
              <MenuItem
                icon={<BookOpen color={theme.colors.primary} size={24} />}
                title="Drill Library"
                subtitle="Browse and manage training drills"
                onPress={() =>
                  navigation.navigate("DrillLibrary")
                }
              />
              <MenuItem
                icon={<Wrench color={theme.colors.primary} size={24} />}
                title="Create Plan"
                subtitle="Build a structured training session"
                onPress={() =>
                  navigation.navigate("ClubOperations", { initialTab: 3 })
                }
              />
              <MenuItem
                icon={<ClipboardList color={theme.colors.primary} size={24} />}
                title="Training Plans"
                subtitle="Accessible by coach profile"
                isLast
                onPress={() =>
                  navigation.navigate("ClubOperations", { initialTab: 4 })
                }
              />
            </Card>
          </View>
        )}

        {/* CLUB MANAGEMENT */}
        {canAccessClubManagement && (
          <View style={styles.section}>
            <Text variant="small" weight="600" style={styles.sectionTitle}>
              CLUB MANAGEMENT
            </Text>
            <Card noPadding style={styles.menuCard}>
              {isClubLeader && (
                <MenuItem
                  icon={<Wrench color={theme.colors.primary} size={24} />}
                  title="Trades & Suppliers"
                  onPress={() =>
                    navigation.navigate("Trades", { role: userRole })
                  }
                />
              )}
              {isClubLeader && (
                <MenuItem
                  icon={<UserCog color={theme.colors.primary} size={24} />}
                  title="Role Requests"
                  subtitle="Approve or reject member role changes"
                  onPress={() => navigation.navigate("RoleRequests")}
                />
              )}
              <MenuItem
                icon={<ExternalLink color={theme.colors.primary} size={24} />}
                title="Public Club Page"
                onPress={() =>
                  navigation.navigate("PublicClubPage", { role: userRole })
                }
              />
              <MenuItem
                icon={<Settings color={theme.colors.primary} size={24} />}
                title="Club Information"
                onPress={() =>
                  navigation.navigate("ClubInfo", { role: userRole })
                }
              />
              {isClubLeader && (
                <MenuItem
                  icon={<CreditCard color={theme.colors.primary} size={24} />}
                  title="Subscription & Billing"
                  isLast
                  onPress={() =>
                    navigation.navigate("Billing", { role: userRole })
                  }
                />
              )}
            </Card>
          </View>
        )}

        {/* CLUB & SETTINGS */}
        <View style={styles.section}>
          <Text variant="small" weight="600" style={styles.sectionTitle}>
            CLUB & SETTINGS
          </Text>
          <Card noPadding style={styles.menuCard}>
            {isClubLeader && (
              <MenuItem
                icon={<KeyRound color={theme.colors.textSecondary} size={24} />}
                title="Club Join Code"
                subtitle={
                  activeClub?.inviteCode
                    ? `Code: ${activeClub.inviteCode}`
                    : "Tap to generate 6-digit code"
                }
                onPress={handleClubJoinCode}
              />
            )}
            <MenuItem
              icon={<RefreshCcw color={theme.colors.textSecondary} size={24} />}
              title="Switch Club"
              subtitle={`Current: ${activeClub?.name || "None"}`}
              onPress={handleSwitchClub}
            />
            {isClubStaff && (
              <MenuItem
                icon={<Building2 color={theme.colors.textSecondary} size={24} />}
                title="Admin Page"
                subtitle="Updates, notifications, rosters, tasks"
                onPress={() => navigation.navigate("AdminPage")}
              />
            )}
            <MenuItem
              icon={<Settings color={theme.colors.textSecondary} size={24} />}
              title="Settings"
              onPress={() => navigation.navigate("Settings")}
            />
            <MenuItem
              icon={<HelpCircle color={theme.colors.textSecondary} size={24} />}
              title="Help & Support"
              isLast
              onPress={() => navigation.navigate("HelpSupport")}
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={[styles.section, { paddingBottom: theme.spacing.xl }]}>
          <Card
            noPadding
            style={[styles.menuCard, { borderColor: theme.colors.error }]}
          >
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut color={theme.colors.error} size={20} />
              <Text
                variant="h4"
                color={theme.colors.error}
                style={{ marginLeft: 8 }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </Card>
          <Text
            variant="small"
            style={{ textAlign: "center", marginTop: theme.spacing.md }}
          >
            App Version 1.0.0 (Build 42)
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={switchModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeSwitchModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSwitchModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text variant="h3">Switch Club</Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                Select the club you want to use right now.
              </Text>
            </View>
            <View style={styles.modalList}>
              {sortedClubs.map((club, index) => {
                const isActive = club.clubId === activeClubId;
                return (
                  <TouchableOpacity
                    key={club.clubId || `${club.clubName}-${index}`}
                    style={[
                      styles.modalRow,
                      index !== sortedClubs.length - 1 && styles.modalRowBorder,
                    ]}
                    onPress={() => handleSelectClub(club.clubId)}
                  >
                    <View style={styles.modalRowLeft}>
                      <Text variant="h4">{club.clubName || club.clubId}</Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {club.role || "Member"}
                      </Text>
                    </View>
                    {isActive && (
                      <Badge
                        text="Current"
                        variant="solid"
                        style={styles.currentBadge}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={closeSwitchModal}
            >
              <Text variant="h4" color={theme.colors.textSecondary}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  section: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    backgroundColor: "#FFF5F5",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    marginBottom: theme.spacing.md,
  },
  modalList: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  modalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalRowLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  currentBadge: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalClose: {
    marginTop: theme.spacing.md,
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
});
