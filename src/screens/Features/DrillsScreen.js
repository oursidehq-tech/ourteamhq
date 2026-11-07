import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Plus,
  Search,
  PlayCircle,
  Settings,
  Video,
  FileText,
  Clock,
  PlusCircle,
  Check,
  CheckCircle2,
  X,
  Play,
  ClipboardList,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToDrills } from "../../services/clubOperationsService";

// ─── Design Tokens (Section 10) ───────────────────────────────────────────────
const DESIGN_TOKENS = {
  primaryTeal: "#0D9488",
  successGreen: "#10B981",
  warningOrange: "#F59E0B",
  sessionBlue: "#3B82F6",
};

const CATEGORIES = [
  "All",
  "Warm-Up",
  "Tactics",
  "Technique",
  "Physical",
  "Psychological",
  "Goal Keeping",
  "Set Pieces",
  "General",
];

const TABS = [
  { key: "all", label: "All Content" },
  { key: "videos", label: "Videos & Drills" },
  { key: "docs", label: "Documents" },
];

const getYoutubeId = (url) => {
  if (!url) return null;
  const m = String(url).match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? m[2] : null;
};

const getThumbnailUri = (drill) => {
  if (!drill) return null;
  const ytId = getYoutubeId(drill.youtubeUrl || drill.videoUrl);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  if (Array.isArray(drill.imageUrls) && drill.imageUrls[0]) return drill.imageUrls[0];
  if (drill.imageUrl) return drill.imageUrl;
  return null;
};

const parseDurationToMins = (str) => {
  if (!str) return 0;
  if (typeof str === "number") return str;
  const clean = String(str).trim();
  if (clean.includes(":")) {
    const [m, s] = clean.split(":").map(Number);
    return (m || 0) + Math.round((s || 0) / 60);
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const openVideo = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    Alert.alert("Error", "Could not open video URL.");
  });
};

const DrillsScreen = ({ navigation }) => {
  const { activeClubId, userRole, isClubLeader, isClubStaff, userGroupIds } = useClub();
  const { user } = useAuth();

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const canManageDrills =
    isClubLeader ||
    isClubStaff ||
    ["owner", "admin", "coach", "manager"].includes(normalizedRole);

  const [drills, setDrills] = useState([]);
  const [drillSearchQuery, setDrillSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedDrills, setSelectedDrills] = useState([]); // Array of drill IDs
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
      }
    );
    return () => unsubDrills?.();
  }, [activeClubId, normalizedRole, user?.uid, userGroupIds]);

  const filteredDrills = useMemo(() => {
    return (drills || []).filter((d) => {
      // Search match
      const q = drillSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        d.title?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q);
      if (!matchQ) return false;

      // Category match
      if (activeCategory !== "All" && (d.category || "").toLowerCase() !== activeCategory.toLowerCase()) {
        return false;
      }

      // Tab match
      if (activeTab === "videos") {
        return d.type === "Video" || d.type === "Youtube" || Boolean(d.youtubeUrl) || Boolean(d.videoUrl);
      }
      if (activeTab === "docs") {
        return d.type === "Document";
      }

      return true;
    });
  }, [drills, drillSearchQuery, activeCategory, activeTab]);

  const toggleSelectDrill = (id) => {
    setSelectedDrills((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleAddSingleToPlan = (drillId) => {
    navigation.navigate("TrainingPlans", {
      initialTab: 2,
      selectedDrillIds: [drillId],
    });
  };

  const handleAddBulkToPlan = () => {
    if (selectedDrills.length === 0) return;
    navigation.navigate("TrainingPlans", {
      initialTab: 2,
      selectedDrillIds: selectedDrills,
    });
    setSelectedDrills([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft color={theme.colors.text} size={28} />
          </TouchableOpacity>
          <View>
            <Text variant="h2">Drill Library</Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              {filteredDrills.length} drill{filteredDrills.length !== 1 ? "s" : ""} available
            </Text>
          </View>
        </View>

        {canManageDrills && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: DESIGN_TOKENS.primaryTeal }]}
            onPress={() => {
              navigation.navigate("CreateItem", {
                type: "Drill",
                title: "Create Drill",
              });
            }}
          >
            <Plus color="#FFF" size={22} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Row: All Content / Videos & Drills / Documents */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                active && { borderBottomColor: DESIGN_TOKENS.primaryTeal, borderBottomWidth: 3 },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                variant="body"
                weight={active ? "700" : "500"}
                color={active ? DESIGN_TOKENS.primaryTeal : theme.colors.textSecondary}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Search color={theme.colors.textSecondary} size={16} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.drillSearchInput}
            placeholder="Search drills by keyword, title, category..."
            placeholderTextColor={theme.colors.textSecondary}
            value={drillSearchQuery}
            onChangeText={setDrillSearchQuery}
          />
          {drillSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setDrillSearchQuery("")}>
              <X size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips Horizontal Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  active && {
                    backgroundColor: DESIGN_TOKENS.primaryTeal,
                    borderColor: DESIGN_TOKENS.primaryTeal,
                  },
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text variant="small" weight="600" color={active ? "#FFF" : theme.colors.textSecondary}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Loading Spinner */}
        {loading ? (
          <ActivityIndicator size="large" color={DESIGN_TOKENS.primaryTeal} style={{ marginTop: 40 }} />
        ) : filteredDrills.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Video color={theme.colors.textSecondary} size={38} />
            <Text variant="h4" style={{ marginTop: 12, textAlign: "center" }}>
              No drills found
            </Text>
            <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 6, textAlign: "center" }}>
              {drillSearchQuery
                ? `No drills matching "${drillSearchQuery}"`
                : canManageDrills
                ? "Tap the + button above to add your first drill."
                : "No drills have been uploaded to this category yet."}
            </Text>
          </Card>
        ) : (
          <View style={styles.drillsListContainer}>
            {filteredDrills.map((drill) => {
              const thumbUri = getThumbnailUri(drill);
              const isSelected = selectedDrills.includes(drill.id);
              const dur = drill.durationMins || parseDurationToMins(drill.duration) || 10;
              const videoUrl = drill.youtubeUrl || drill.videoUrl || (Array.isArray(drill.videoUrls) && drill.videoUrls[0]);

              return (
                <Card
                  key={drill.id}
                  style={[
                    styles.drillCard,
                    isSelected && { borderColor: DESIGN_TOKENS.primaryTeal, borderWidth: 2 },
                  ]}
                >
                  <View style={styles.drillCardTop}>
                    {/* Checkbox for bulk select */}
                    <TouchableOpacity
                      style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}
                      onPress={() => toggleSelectDrill(drill.id)}
                    >
                      {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                    </TouchableOpacity>

                    {/* Thumbnail */}
                    <View style={styles.drillThumbnailWrap}>
                      {thumbUri ? (
                        <Image source={{ uri: thumbUri }} style={styles.drillThumbnail} />
                      ) : (
                        <View style={styles.drillThumbnailPlaceholder}>
                          {drill.type === "Document" ? (
                            <FileText size={20} color="#94A3B8" />
                          ) : (
                            <Video size={20} color="#94A3B8" />
                          )}
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={styles.drillItemInfo}>
                      <View style={styles.categoryRow}>
                        <View style={styles.categoryBadge}>
                          <Text variant="small" weight="700" color={DESIGN_TOKENS.primaryTeal}>
                            {drill.category || "General"}
                          </Text>
                        </View>
                        <View style={styles.durationBadge}>
                          <Clock size={10} color={theme.colors.textSecondary} />
                          <Text variant="small" color={theme.colors.textSecondary} style={{ marginLeft: 3 }}>
                            {dur} min
                          </Text>
                        </View>
                      </View>

                      <Text variant="h4" numberOfLines={1} style={styles.drillItemTitle}>
                        {drill.title}
                      </Text>

                      {drill.description ? (
                        <Text variant="small" numberOfLines={2} style={styles.drillDesc}>
                          {drill.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.cardActionsRow}>
                    {videoUrl ? (
                      <TouchableOpacity
                        style={styles.actionBtnWatch}
                        onPress={() => openVideo(videoUrl)}
                      >
                        <Play size={12} color="#DC2626" />
                        <Text variant="small" weight="700" color="#DC2626" style={{ marginLeft: 4 }}>
                          Watch Video
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {canManageDrills && (
                      <TouchableOpacity
                        style={styles.actionBtnAddPlan}
                        onPress={() => handleAddSingleToPlan(drill.id)}
                      >
                        <PlusCircle size={13} color={DESIGN_TOKENS.primaryTeal} />
                        <Text variant="small" weight="700" color={DESIGN_TOKENS.primaryTeal} style={{ marginLeft: 4 }}>
                          Add to Plan
                        </Text>
                      </TouchableOpacity>
                    )}

                    {canManageDrills && (
                      <TouchableOpacity
                        style={styles.actionBtnEdit}
                        onPress={() => {
                          navigation.navigate("CreateItem", {
                            type: "Drill",
                            title: "Edit Drill",
                            initialData: drill,
                          });
                        }}
                      >
                        <Settings size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Bulk Selection Bar (Section 8: Bulk Selection Bar) */}
      {selectedDrills.length > 0 && (
        <View style={styles.bulkBar}>
          <Text variant="body" weight="700" color="#FFF">
            {selectedDrills.length} drill{selectedDrills.length !== 1 ? "s" : ""} selected
          </Text>

          <TouchableOpacity
            style={[styles.bulkAddBtn, { backgroundColor: DESIGN_TOKENS.primaryTeal }]}
            onPress={handleAddBulkToPlan}
          >
            <ClipboardList size={15} color="#FFF" />
            <Text variant="small" weight="700" color="#FFF" style={{ marginLeft: 6 }}>
              Add to Plan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSelectedDrills([])} style={styles.bulkClearBtn}>
            <Text variant="small" color="#94A3B8">
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
    padding: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 110,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: 10,
  },
  drillSearchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    paddingVertical: 8,
  },
  categoryScroll: {
    marginBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: 6,
  },
  emptyCard: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  drillsListContainer: {
    gap: 12,
  },
  drillCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  drillCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  selectCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  selectCheckboxActive: {
    backgroundColor: DESIGN_TOKENS.primaryTeal,
    borderColor: DESIGN_TOKENS.primaryTeal,
  },
  drillThumbnailWrap: {
    width: 58,
    height: 58,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    marginRight: 10,
  },
  drillThumbnail: {
    width: "100%",
    height: "100%",
  },
  drillThumbnailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  drillItemInfo: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#F0FDFA",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  drillItemTitle: {
    marginBottom: 2,
  },
  drillDesc: {
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + "60",
  },
  actionBtnWatch: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
  },
  actionBtnAddPlan: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F0FDFA",
    borderRadius: 6,
  },
  actionBtnEdit: {
    marginLeft: "auto",
    padding: 6,
  },
  // Floating Bulk Selection Bar
  bulkBar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#0F172A",
    borderRadius: theme.radius.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bulkAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
  },
  bulkClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default DrillsScreen;
