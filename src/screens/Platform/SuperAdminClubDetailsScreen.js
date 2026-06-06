import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  MapPin,
  Link2,
  Mail,
  Phone,
  KeyRound,
  Users,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { theme } from "../../theme/theme";
import { getClub, getClubMembers } from "../../services/clubService";

const ROLE_ORDER = {
  Owner: 0,
  Admin: 1,
  Coach: 2,
  Manager: 3,
  Volunteer: 4,
  Parent: 5,
  Player: 6,
};

const roleSortValue = (role) => {
  const value = ROLE_ORDER[(role || "").toString()];
  return typeof value === "number" ? value : 99;
};

const getRoleBadgeColor = (role) => {
  if (role === "Owner") return theme.colors.warning || "#F5A623";
  if (role === "Admin") return "#E74C3C";
  if (role === "Coach") return theme.colors.info || "#007AFF";
  if (role === "Manager") return "#8E44AD";
  if (role === "Parent") return theme.colors.secondary || "#5856D6";
  if (role === "Volunteer") return "#27AE60";
  return theme.colors.primary;
};

export default function SuperAdminClubDetailsScreen({ route, navigation }) {
  const clubId = route?.params?.clubId || "";
  const fallbackName = route?.params?.clubName || "Club Details";

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!clubId) {
        if (alive) setLoading(false);
        return;
      }

      try {
        const [clubData, memberRows] = await Promise.all([
          getClub(clubId),
          getClubMembers(clubId),
        ]);

        if (!alive) return;

        setClub(clubData);
        setMembers(memberRows || []);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [clubId]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const roleDiff = roleSortValue(a.role) - roleSortValue(b.role);
      if (roleDiff !== 0) return roleDiff;
      const aName = (a.displayName || a.email || "").toLowerCase();
      const bName = (b.displayName || b.email || "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [members]);

  const contact = club?.contact || {};
  const keyPeople = club?.keyPeople || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={22} />
        </TouchableOpacity>
        <Text variant="h3">{club?.name || fallbackName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.bannerContainer}>
            <Image
              source={
                club?.bannerUrl
                  ? { uri: club.bannerUrl }
                  : {
                      uri: "https://images.unsplash.com/photo-1518605368461-1ee11b6ecbe4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                    }
              }
              style={styles.banner}
            />
          </View>

          <Card style={styles.heroCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Avatar
                source={
                  club?.logoUrl
                    ? { uri: club.logoUrl }
                    : {
                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(club?.name || "Club")}&background=108B51&color=fff&size=150`,
                      }
                }
                size={54}
                isClub
              />
              <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
                <Text variant="h4">{club?.name || "Unnamed Club"}</Text>
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: 4 }}
                >
                  {club?.sport || "Sport TBD"} •{" "}
                  {(club?.memberCount || members.length || 0).toString()}{" "}
                  members
                </Text>
              </View>
            </View>
            {!!club?.description && (
              <Text variant="body" style={{ marginTop: theme.spacing.md }}>
                {club.description}
              </Text>
            )}
          </Card>

          <Card style={styles.sectionCard}>
            <Text variant="h4" style={styles.sectionTitle}>
              About Us
            </Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              {club?.description || "No description available yet."}
            </Text>
          </Card>

          <Card style={styles.sectionCard}>
            <Text variant="h4" style={styles.sectionTitle}>
              Contact Details
            </Text>

            {club?.location ? (
              <View style={styles.detailRow}>
                <MapPin color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={styles.detailText}>
                  {club.location}
                </Text>
              </View>
            ) : null}
            {contact.phone ? (
              <View style={styles.detailRow}>
                <Phone color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={styles.detailText}>
                  {contact.phone}
                </Text>
              </View>
            ) : null}
            {contact.email ? (
              <View style={styles.detailRow}>
                <Mail color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={styles.detailText}>
                  {contact.email}
                </Text>
              </View>
            ) : null}
            {club?.website ? (
              <View style={styles.detailRow}>
                <Link2 color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={styles.detailText}>
                  {club.website}
                </Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <KeyRound color={theme.colors.primary} size={15} />
              <Text variant="small" style={styles.detailText}>
                Invite Code: {club?.inviteCode || "Not generated"}
              </Text>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text variant="h4" style={styles.sectionTitle}>
              Key People
            </Text>
            {keyPeople.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No key people listed.
              </Text>
            ) : (
              keyPeople.map((person, idx) => (
                <View key={`${clubId}-kp-${idx}`} style={styles.keyPersonRow}>
                  <Avatar
                    source={{
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name || "Member")}&background=108B51&color=fff&size=150`,
                    }}
                    size={40}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text variant="h4">
                      {(person.name || "Member").toString()}
                    </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {(person.role || "Role").toString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card style={styles.sectionCard}>
            <View style={styles.membersHeader}>
              <Text variant="h4">Club Members</Text>
              <View style={styles.memberCountBadge}>
                <Users color={theme.colors.white} size={12} />
                <Text
                  variant="small"
                  color={theme.colors.white}
                  style={{ marginLeft: 4, fontSize: 10 }}
                >
                  {sortedMembers.length}
                </Text>
              </View>
            </View>

            {sortedMembers.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No members found for this club.
              </Text>
            ) : (
              sortedMembers.map((member) => (
                <View
                  key={`${clubId}-member-${member.id}`}
                  style={styles.memberRow}
                >
                  <Avatar
                    source={{
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName || "User")}&background=108B51&color=fff&size=150`,
                    }}
                    size={40}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="body" weight="600">
                      {(
                        member.displayName ||
                        member.email ||
                        "Member"
                      ).toString()}
                    </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {(member.email || member.uid || "No email").toString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: getRoleBadgeColor(member.role) + "20",
                      },
                    ]}
                  >
                    <Text
                      variant="small"
                      color={getRoleBadgeColor(member.role)}
                      weight="700"
                    >
                      {(member.role || "Member").toString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backBtn: {
    width: 40,
    paddingVertical: 4,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  bannerContainer: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: 160,
    backgroundColor: theme.colors.border,
  },
  heroCard: {
    marginBottom: theme.spacing.md,
  },
  sectionCard: {
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    color: theme.colors.textSecondary,
  },
  listText: {
    marginBottom: 6,
    color: theme.colors.textSecondary,
  },
  keyPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  memberCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  roleBadge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
