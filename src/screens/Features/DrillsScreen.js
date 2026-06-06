import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Search, PlayCircle, Settings, Video } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToDrills } from "../../services/clubOperationsService";

const DrillsScreen = ({ navigation }) => {
  const { activeClubId, userRole, isClubLeader, isClubStaff, userGroupIds } =
    useClub();
  const { user } = useAuth();

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const canManageDrills =
    isClubLeader ||
    isClubStaff ||
    ["owner", "admin", "coach", "manager"].includes(normalizedRole);

  const [drills, setDrills] = useState([]);
  const [drillSearchQuery, setDrillSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
    const unsubDrills = subscribeToDrills(
      activeClubId,
      (data) => {
        setDrills(data || []);
        setLoading(false);
      },
      {
        userGroupIds,
        userId: user?.uid || "",
        isAdmin,
      },
    );
    return () => unsubDrills?.();
  }, [activeClubId, normalizedRole, user?.uid, userGroupIds]);

  const filteredDrills = (drills || []).filter((d) => {
    if (!drillSearchQuery.trim()) return true;
    const q = drillSearchQuery.toLowerCase();
    return (
      d.title?.toLowerCase().includes(q) ||
      d.category?.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={28} />
          </TouchableOpacity>
          <Text variant="h2">Drill Library</Text>
        </View>
        {canManageDrills && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              navigation.navigate("CreateItem", {
                type: "Drill",
                title: "Create Drill",
              });
            }}
          >
            <Plus color={theme.colors.white} size={22} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search bar */}
        <View style={styles.searchBarWrap}>
          <Search
            color={theme.colors.textSecondary}
            size={18}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.drillSearchInput}
            placeholder="Search drills by title or category..."
            placeholderTextColor={theme.colors.textSecondary}
            value={drillSearchQuery}
            onChangeText={setDrillSearchQuery}
          />
        </View>

        {/* Loading */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : filteredDrills.length === 0 ? (
          /* Empty state */
          <Card style={styles.emptyCard}>
            <Video color={theme.colors.textSecondary} size={36} />
            <Text variant="h4" style={{ marginTop: 12, textAlign: "center" }}>
              No drills yet
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginTop: 6, textAlign: "center" }}
            >
              {canManageDrills
                ? "Tap the + button to add your first drill."
                : "No drills have been added yet."}
            </Text>
          </Card>
        ) : (
          /* Drill list */
          <Card style={styles.panelCard}>
            <View style={styles.sectionHeaderRow}>
              <Video color={theme.colors.primary} size={20} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text variant="h4">
                  {filteredDrills.length} Drill{filteredDrills.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {filteredDrills.map((drill) => (
              <TouchableOpacity
                key={drill.id}
                style={styles.drillListItem}
                onPress={() => {
                  if (canManageDrills) {
                    navigation.navigate("CreateItem", {
                      type: "Drill",
                      title: "Edit Drill",
                      initialData: drill,
                    });
                  }
                }}
              >
                {(() => {
                  const thumbnailUrl =
                    (Array.isArray(drill.imageUrls) && drill.imageUrls[0]) ||
                    drill.imageUrl ||
                    "";
                  return thumbnailUrl ? (
                    <Image
                      source={{ uri: thumbnailUrl }}
                      style={styles.drillThumbnail}
                    />
                  ) : (
                    <View style={styles.drillThumbnailPlaceholder}>
                      <Video color={theme.colors.textSecondary} size={16} />
                    </View>
                  );
                })()}
                <View style={styles.drillItemInfo}>
                  <Text variant="body" weight="700" style={styles.drillItemTitle}>
                    {drill.title}
                  </Text>
                  {!!drill.category && (
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {drill.category}
                    </Text>
                  )}
                  {!!drill.difficulty && (
                    <Text variant="small" color={theme.colors.textSecondary}>
                      Difficulty: {drill.difficulty}
                    </Text>
                  )}
                  {!!(drill.durationMins || drill.duration) && (
                    <Text variant="small" color={theme.colors.textSecondary}>
                      Duration: {drill.durationMins || drill.duration} min
                    </Text>
                  )}
                </View>
                <View style={styles.drillItemActions}>
                  {(drill.videoUrl || (drill.videoUrls && drill.videoUrls[0])) ? (
                    <TouchableOpacity
                      style={styles.drillActionBtn}
                      onPress={() => {
                        const url = Array.isArray(drill.videoUrls)
                          ? drill.videoUrls[0]
                          : drill.videoUrl;
                        if (url) Linking.openURL(url);
                      }}
                    >
                      <PlayCircle size={18} color={theme.colors.primary} />
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        weight="700"
                        style={{ marginLeft: 4 }}
                      >
                        Watch
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {canManageDrills && (
                    <TouchableOpacity
                      style={styles.drillActionBtn}
                      onPress={() => {
                        navigation.navigate("CreateItem", {
                          type: "Drill",
                          title: "Edit Drill",
                          initialData: drill,
                        });
                      }}
                    >
                      <Settings size={16} color={theme.colors.primary} />
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        weight="700"
                        style={{ marginLeft: 4 }}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  panelCard: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: 10,
  },
  drillSearchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  drillListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  drillThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: theme.colors.surface,
  },
  drillThumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  drillItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  drillItemTitle: {
    marginBottom: 4,
  },
  drillItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drillActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.sm,
    backgroundColor: "rgba(16, 139, 81, 0.05)",
    borderRadius: theme.radius.sm,
  },
});

export default DrillsScreen;
