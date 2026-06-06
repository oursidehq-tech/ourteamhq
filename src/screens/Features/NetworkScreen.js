import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Globe2, Users, ArrowRight, Check } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import {
  getPublicClubs,
  followClub,
  unfollowClub,
} from "../../services/clubService";

export default function NetworkScreen({ navigation }) {
  const { user, profile, refreshProfile } = useAuth();
  const { activeClubId } = useClub();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyClubId, setBusyClubId] = useState(null);

  const followedIds = profile?.followedClubIds || [];

  useEffect(() => {
    let mounted = true;

    const loadClubs = async () => {
      setLoading(true);
      try {
        const rows = await getPublicClubs(activeClubId, 60);
        if (mounted) {
          setClubs(rows);
        }
      } catch {
        if (mounted) {
          setClubs([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadClubs();

    return () => {
      mounted = false;
    };
  }, [activeClubId]);

  const sortedClubs = useMemo(() => {
    return [...clubs].sort((a, b) => {
      const aFollowed = followedIds.includes(a.id) ? 1 : 0;
      const bFollowed = followedIds.includes(b.id) ? 1 : 0;
      if (aFollowed !== bFollowed) return bFollowed - aFollowed;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [clubs, followedIds]);

  const toggleFollow = async (clubId) => {
    if (!user?.uid || !clubId) return;

    setBusyClubId(clubId);
    try {
      const isFollowing = followedIds.includes(clubId);
      if (isFollowing) {
        await unfollowClub(user.uid, clubId);
      } else {
        await followClub(user.uid, clubId);
      }
      await refreshProfile();
    } catch {
      Alert.alert("Error", "Could not update follow status right now.");
    } finally {
      setBusyClubId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text variant="h2">Network</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Discover and follow other clubs
          </Text>
        </View>
        <View style={styles.headerIconWrap}>
          <Globe2 color={theme.colors.primary} size={20} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl * 2 }}
          />
        ) : sortedClubs.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={theme.colors.border} size={48} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md }}
            >
              No clubs available right now.
            </Text>
          </View>
        ) : (
          sortedClubs.map((club) => {
            const isFollowing = followedIds.includes(club.id);
            const isBusy = busyClubId === club.id;
            return (
              <Card key={club.id} style={styles.clubCard}>
                <View style={styles.clubHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <Avatar
                      source={
                        club.logoUrl
                          ? { uri: club.logoUrl }
                          : {
                              uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name || "Club")}&background=108B51&color=fff&size=150`,
                            }
                      }
                      size={44}
                      isClub
                    />
                    <View style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
                      <Text variant="h4">{club.name || "Club"}</Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {club.location || "Location not set"}
                      </Text>
                    </View>
                  </View>

                  <Button
                    title={isFollowing ? "Following" : "Follow"}
                    variant={isFollowing ? "outline" : "primary"}
                    size="small"
                    onPress={() => toggleFollow(club.id)}
                    disabled={isBusy}
                    style={{ width: 110 }}
                  />
                </View>

                <Text
                  variant="body"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: theme.spacing.sm, lineHeight: 20 }}
                  numberOfLines={3}
                >
                  {club.description || "Community club profile"}
                </Text>

                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() =>
                    navigation.navigate("PublicClubPage", {
                      clubId: club.id,
                    })
                  }
                >
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                  >
                    View Public Page
                  </Text>
                  {isFollowing ? (
                    <Check color={theme.colors.primary} size={16} />
                  ) : (
                    <ArrowRight color={theme.colors.primary} size={16} />
                  )}
                </TouchableOpacity>
              </Card>
            );
          })
        )}
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
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.md,
  },
  clubCard: {
    marginBottom: theme.spacing.sm,
  },
  clubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewBtn: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
