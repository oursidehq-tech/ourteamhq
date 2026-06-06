import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Users,
  DollarSign,
  ShieldAlert,
  Ban,
  ReceiptText,
  Check,
  RefreshCcw,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  collectionGroup,
  getDocs,
  getCountFromServer,
  where,
  limit,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { logOut } from "../../services/authService";

const PLAN_SEQUENCE = ["Free", "Pro", "Elite"];
const PUBLIC_NETWORK_VISIBILITY_VALUES = [
  "Public",
  "Network",
  "public",
  "network",
  "PUBLIC",
  "NETWORK",
];

const isPublicOrNetworkPost = (visibility) => {
  const normalized = (visibility || "").toString().trim().toLowerCase();
  return normalized === "public" || normalized === "network";
};

const isModerationCandidatePost = (post = {}) => {
  const visibility = (post.visibility || "").toString().trim().toLowerCase();
  const type = (post.type || "").toString().trim().toLowerCase();
  const category = (post.category || "").toString().trim().toLowerCase();

  return (
    visibility === "public" ||
    visibility === "network" ||
    type === "network" ||
    category === "network" ||
    post.isPublic === true
  );
};

const inferClubIdFromRefPath = (path = "") => {
  const parts = path.split("/");
  const idx = parts.indexOf("clubs");
  return idx >= 0 ? parts[idx + 1] || "" : "";
};

const getNextPlan = (currentPlan) => {
  const normalized = (currentPlan || "Free").toString().trim();
  const idx = PLAN_SEQUENCE.findIndex(
    (plan) => plan.toLowerCase() === normalized.toLowerCase(),
  );
  if (idx === -1) return PLAN_SEQUENCE[0];
  return PLAN_SEQUENCE[(idx + 1) % PLAN_SEQUENCE.length];
};

export default function SuperAdminScreen({ navigation }) {
  const [clubs, setClubs] = useState([]);
  const [publicPosts, setPublicPosts] = useState([]);
  const [marketplace, setMarketplace] = useState({
    gross: 0,
    paid: 0,
    orders: 0,
  });
  const [memberCountsByClub, setMemberCountsByClub] = useState({});
  const [busyId, setBusyId] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const clubsById = useMemo(() => {
    const map = {};
    clubs.forEach((club) => {
      map[club.id] = club;
    });
    return map;
  }, [clubs]);

  useEffect(() => {
    const clubsQuery = query(
      collection(db, "clubs"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      clubsQuery,
      (snap) => {
        setClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
        setClubs([]);
      },
    );

    return unsubscribe;
  }, []);

  const loadRevenueOverview = async () => {
    setLoadingOverview(true);
    try {
      const ordersSnap = await getDocs(collectionGroup(db, "orders"));
      const totals = ordersSnap.docs.reduce(
        (acc, orderDoc) => {
          const order = orderDoc.data();
          const amount = Number(order.total) || 0;
          acc.gross += amount;
          acc.orders += 1;
          if ((order.paymentStatus || "").toLowerCase() === "paid") {
            acc.paid += amount;
          }
          return acc;
        },
        { gross: 0, paid: 0, orders: 0 },
      );
      setMarketplace(totals);
    } catch {
      setMarketplace({ gross: 0, paid: 0, orders: 0 });
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadPublicPosts = async () => {
    setLoadingPosts(true);
    try {
      if (clubs.length === 0) {
        setPublicPosts([]);
        return;
      }

      const perClubPosts = await Promise.all(
        clubs.map(async (club) => {
          try {
            const publicSnap = await getDocs(
              query(
                collection(db, "clubs", club.id, "posts"),
                where("visibility", "in", PUBLIC_NETWORK_VISIBILITY_VALUES),
                limit(60),
              ),
            );
            return publicSnap.docs.map((d) => ({
              id: d.id,
              refPath: d.ref.path,
              ...d.data(),
              clubId:
                d.data().clubId ||
                inferClubIdFromRefPath(d.ref.path) ||
                club.id,
              clubName: d.data().clubName || club.name || "Club",
            }));
          } catch {
            try {
              const fallbackSnap = await getDocs(
                query(
                  collection(db, "clubs", club.id, "posts"),
                  where("visibility", "in", PUBLIC_NETWORK_VISIBILITY_VALUES),
                  orderBy("createdAt", "desc"),
                  limit(60),
                ),
              );
              return fallbackSnap.docs.map((d) => ({
                id: d.id,
                refPath: d.ref.path,
                ...d.data(),
                clubId:
                  d.data().clubId ||
                  inferClubIdFromRefPath(d.ref.path) ||
                  club.id,
                clubName: d.data().clubName || club.name || "Club",
              }));
            } catch {
              return [];
            }
          }
        }),
      );

      const normalizedPosts = perClubPosts
        .flat()
        .filter((post) => isModerationCandidatePost(post))
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bMs - aMs;
        })
        .slice(0, 25);

      setPublicPosts(normalizedPosts);
    } catch {
      setPublicPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadRevenueOverview();
  }, []);

  useEffect(() => {
    if (clubs.length > 0) {
      loadPublicPosts();
    } else {
      setPublicPosts([]);
    }
  }, []);

  useEffect(() => {
    if (clubs.length > 0 && !loadingPosts) {
      loadPublicPosts();
    }
  }, [clubs]);

  useEffect(() => {
    let cancelled = false;

    const missingClubIds = clubs
      .map((club) => club.id)
      .filter((clubId) => !(clubId in memberCountsByClub));

    if (missingClubIds.length === 0) return;

    const loadMemberCounts = async () => {
      const countEntries = await Promise.all(
        missingClubIds.map(async (clubId) => {
          try {
            const countSnap = await getCountFromServer(
              collection(db, "clubs", clubId, "members"),
            );
            return [clubId, countSnap.data().count];
          } catch {
            return [clubId, null];
          }
        }),
      );

      if (cancelled) return;

      setMemberCountsByClub((prev) => {
        const next = { ...prev };
        countEntries.forEach(([clubId, count]) => {
          if (typeof count === "number") {
            next[clubId] = count;
          }
        });
        return next;
      });
    };

    loadMemberCounts();

    return () => {
      cancelled = true;
    };
  }, [clubs, memberCountsByClub]);

  const totalMembers = useMemo(
    () =>
      clubs.reduce(
        (sum, club) =>
          sum +
          (memberCountsByClub[club.id] ??
            (typeof club.memberCount === "number" ? club.memberCount : 0)),
        0,
      ),
    [clubs, memberCountsByClub],
  );

  const suspendedCount = useMemo(
    () =>
      clubs.filter((club) => (club.status || "").toLowerCase() === "suspended")
        .length,
    [clubs],
  );

  const handleToggleSuspension = async (club) => {
    const nextStatus =
      (club.status || "").toLowerCase() === "suspended"
        ? "Active"
        : "Suspended";
    setBusyId(`status:${club.id}`);
    try {
      await updateDoc(doc(db, "clubs", club.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Update Failed", "Could not update club status.");
    } finally {
      setBusyId("");
    }
  };

  const handleCyclePlan = async (club) => {
    const nextPlan = getNextPlan(club.plan);
    setBusyId(`plan:${club.id}`);
    try {
      await updateDoc(doc(db, "clubs", club.id), {
        plan: nextPlan,
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Update Failed", "Could not update subscription plan.");
    } finally {
      setBusyId("");
    }
  };

  const handleDeletePost = async (post) => {
    Alert.alert("Moderate Post", "Remove this public post from the platform?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusyId(`post:${post.id}`);
          try {
            await deleteDoc(doc(db, post.refPath));
            setPublicPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch {
            Alert.alert("Moderation Failed", "Could not remove this post.");
          } finally {
            setBusyId("");
          }
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text variant="h2">Super Admin</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Platform owner console
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut}>
          <Text variant="small" color={theme.colors.error} weight="700">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metricsRow}>
          <Card style={[styles.metricCard, { marginRight: theme.spacing.sm }]}>
            <Users color={theme.colors.primary} size={18} />
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginTop: 6 }}
            >
              Clubs / Members
            </Text>
            <Text variant="h4" style={{ marginTop: 6 }}>
              {clubs.length} / {totalMembers}
            </Text>
          </Card>

          <Card style={[styles.metricCard, { marginLeft: theme.spacing.sm }]}>
            <Ban color={theme.colors.error} size={18} />
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginTop: 6 }}
            >
              Suspended Clubs
            </Text>
            <Text variant="h4" style={{ marginTop: 6 }}>
              {suspendedCount}
            </Text>
          </Card>
        </View>

        <Card style={styles.revenueCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="h4">Marketplace Revenue</Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 2 }}
              >
                Gross, paid and order volume
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                loadRevenueOverview();
                loadPublicPosts();
              }}
              disabled={loadingOverview}
            >
              <RefreshCcw color={theme.colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          <View style={[styles.rowBetween, { marginTop: theme.spacing.md }]}>
            <View>
              <Text variant="small" color={theme.colors.textSecondary}>
                Gross
              </Text>
              <Text variant="h4">${marketplace.gross.toFixed(2)}</Text>
            </View>
            <View>
              <Text variant="small" color={theme.colors.textSecondary}>
                Paid
              </Text>
              <Text variant="h4">${marketplace.paid.toFixed(2)}</Text>
            </View>
            <View>
              <Text variant="small" color={theme.colors.textSecondary}>
                Orders
              </Text>
              <Text variant="h4">{marketplace.orders}</Text>
            </View>
          </View>
        </Card>

        <Text variant="h4" style={styles.sectionTitle}>
          Manage Clubs & Plans
        </Text>
        {clubs.map((club) => {
          const suspended = (club.status || "").toLowerCase() === "suspended";
          const memberCount =
            memberCountsByClub[club.id] ??
            (typeof club.memberCount === "number" ? club.memberCount : 0);
          return (
            <Card key={club.id} style={styles.clubCard}>
              <TouchableOpacity
                style={styles.rowBetween}
                onPress={() =>
                  navigation.navigate("SuperAdminClubDetails", {
                    clubId: club.id,
                    clubName: club.name || "Club Details",
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text variant="h4">{club.name || "Unnamed Club"}</Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4 }}
                  >
                    {club.sport || "Sport TBD"} • {memberCount.toString()}{" "}
                    members
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4 }}
                  >
                    Tap to open full club information
                  </Text>
                  {suspended && (
                    <View style={styles.badgesRow}>
                      <View style={[styles.planBadge, styles.suspendedBadge]}>
                        <Text
                          variant="small"
                          color={theme.colors.white}
                          style={styles.badgeText}
                        >
                          SUSPENDED
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <Text variant="small" color={theme.colors.primary} weight="700">
                  Open
                </Text>
              </TouchableOpacity>

              <View
                style={[styles.rowBetween, { marginTop: theme.spacing.md }]}
              >
                <TouchableOpacity
                  style={[styles.actionBtn, { marginRight: 8 }]}
                  onPress={() => handleCyclePlan(club)}
                  disabled={busyId === `plan:${club.id}`}
                >
                  <DollarSign color={theme.colors.white} size={16} />
                  <Text
                    variant="small"
                    color={theme.colors.white}
                    style={styles.actionText}
                  >
                    {busyId === `plan:${club.id}`
                      ? "Updating..."
                      : "Cycle Plan"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    suspended ? styles.reactivateBtn : styles.suspendBtn,
                  ]}
                  onPress={() => handleToggleSuspension(club)}
                  disabled={busyId === `status:${club.id}`}
                >
                  {suspended ? (
                    <Check color={theme.colors.white} size={16} />
                  ) : (
                    <Ban color={theme.colors.white} size={16} />
                  )}
                  <Text
                    variant="small"
                    color={theme.colors.white}
                    style={styles.actionText}
                  >
                    {busyId === `status:${club.id}`
                      ? "Updating..."
                      : suspended
                        ? "Reactivate"
                        : "Suspend Club"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}

        <Text variant="h4" style={styles.sectionTitle}>
          Moderate Public Posts
        </Text>
        {publicPosts.length === 0 ? (
          <Card>
            <Text variant="body" color={theme.colors.textSecondary}>
              No public/network posts to moderate right now.
            </Text>
          </Card>
        ) : (
          publicPosts.slice(0, 12).map((post) => (
            <Card key={`${post.refPath}:${post.id}`} style={styles.postCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {post.clubName ||
                      clubsById[post.clubId]?.name ||
                      post.clubId ||
                      "Unknown Club"}
                  </Text>
                  <Text variant="body" style={{ marginTop: 4 }}>
                    {post.content || "(No text content)"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removePostBtn}
                  onPress={() => handleDeletePost(post)}
                  disabled={busyId === `post:${post.id}`}
                >
                  <ShieldAlert color={theme.colors.white} size={14} />
                  <Text
                    variant="small"
                    color={theme.colors.white}
                    style={styles.actionText}
                  >
                    {busyId === `post:${post.id}` ? "..." : "Remove"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        <Card style={{ marginTop: theme.spacing.md }}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="h4">Platform Controls</Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 2 }}
              >
                Clubs, plans, suspensions, revenue, and moderation are active.
              </Text>
            </View>
            <ReceiptText color={theme.colors.primary} size={18} />
          </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  metricsRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
  },
  revenueCard: {
    marginBottom: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  clubCard: {
    marginBottom: theme.spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  planBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  suspendedBadge: {
    backgroundColor: theme.colors.error,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  actionBtn: {
    flex: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    marginLeft: 6,
    fontWeight: "700",
  },
  suspendBtn: {
    backgroundColor: theme.colors.error,
  },
  reactivateBtn: {
    backgroundColor: "#1F9D61",
  },
  postCard: {
    marginBottom: theme.spacing.sm,
  },
  removePostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
