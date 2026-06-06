import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Share2,
  MapPin,
  Link2,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToPosts } from "../../services/postService";
import {
  followClub,
  unfollowClub,
  subscribeToClub,
} from "../../services/clubService";
import { subscribeToEvents } from "../../services/eventService";
import { subscribeToProducts } from "../../services/shopService";

const normalizeVisibility = (visibility) =>
  (visibility || "").toString().toLowerCase();

const isPublicVisibility = (visibility) => {
  const v = normalizeVisibility(visibility);
  return v === "public" || v === "network";
};

export default function PublicClubPageScreen({ route, navigation }) {
  const { activeClub, activeClubId } = useClub();
  const { user, profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const targetClubId = route?.params?.clubId || activeClubId;
  const isOwnClub = targetClubId === activeClubId;
  const [club, setClub] = useState(activeClub);
  const isFollowing = !!(profile?.followedClubIds || []).includes(targetClubId);
  const [publicPosts, setPublicPosts] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [shopPreview, setShopPreview] = useState([]);
  const contact = club?.contact || {};
  const contactVisibility = {
    location: club?.contactVisibility?.location || "public",
    website: club?.contactVisibility?.website || "public",
    phone: club?.contactVisibility?.phone || "members",
    email: club?.contactVisibility?.email || "members",
  };
  const keyPeopleVisibility = club?.keyPeopleVisibility || "public";

  const showPublicField = (field) => contactVisibility[field] === "public";

  useEffect(() => {
    if (!targetClubId) {
      setClub(null);
      return;
    }
    if (targetClubId === activeClubId) {
      setClub(activeClub || null);
      return;
    }
    const unsub = subscribeToClub(targetClubId, (clubData) => {
      setClub(clubData);
    });
    return () => unsub();
  }, [targetClubId, activeClubId, activeClub]);

  useEffect(() => {
    if (!targetClubId) {
      setPublicPosts([]);
      return;
    }
    const unsub = subscribeToPosts(
      targetClubId,
      (posts) => {
        setPublicPosts(
          posts.filter((p) => {
            return isPublicVisibility(p.visibility);
          }),
        );
      },
      50,
      isOwnClub
        ? null
        : {
            includePublicOnly: true,
          },
    );
    return () => unsub();
  }, [targetClubId, isOwnClub]);

  useEffect(() => {
    if (!targetClubId) {
      setPublicEvents([]);
      return;
    }

    const unsub = subscribeToEvents(
      targetClubId,
      (events) => {
        const now = new Date();
        const visibleEvents = (events || [])
          .filter((event) => {
            if (event.isPublic === true) return true;
            return isPublicVisibility(event.visibility);
          })
          .filter((event) => {
            if (!event.date) return true;
            const start = new Date(`${event.date}T00:00:00`);
            return start >= new Date(now.toDateString());
          })
          .sort((a, b) => {
            const aDate = new Date(
              `${a.date || "9999-12-31"}T${a.startTime || "23:59"}`,
            );
            const bDate = new Date(
              `${b.date || "9999-12-31"}T${b.startTime || "23:59"}`,
            );
            return aDate - bDate;
          })
          .slice(0, 5);

        setPublicEvents(visibleEvents);
      },
      {
        publicOnly: !isOwnClub,
      },
    );

    return () => unsub();
  }, [targetClubId, isOwnClub]);

  useEffect(() => {
    if (!targetClubId) {
      setShopPreview([]);
      return;
    }

    const viewerType = isOwnClub ? "club" : user?.uid ? "network" : "public";

    const unsub = subscribeToProducts(
      targetClubId,
      (products) => {
        const visibleProducts = (products || []).slice(0, 4);
        setShopPreview(visibleProducts);
      },
      {
        viewerType,
      },
    );

    return () => unsub();
  }, [targetClubId, isOwnClub, user?.uid]);

  const handleShare = () => {
    Alert.alert("Share", "Share club link to your network");
  };

  const handleFollow = async () => {
    if (!user?.uid || !targetClubId) return;
    try {
      if (isFollowing) {
        await unfollowClub(user.uid, targetClubId);
        Alert.alert(
          "Unfollowed",
          `You will no longer receive updates from ${club?.name || "this club"}.`,
        );
      } else {
        await followClub(user.uid, targetClubId);
        Alert.alert(
          "Following",
          `You are now following ${club?.name || "this club"} updates.`,
        );
      }
      await refreshProfile();
    } catch {
      Alert.alert("Error", "Unable to update follow status right now.");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const diff = Date.now() - timestamp.toDate().getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatEventDate = (event) => {
    if (!event?.date) return "Date TBC";
    const d = new Date(`${event.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return event.date;
    const dateLabel = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return event.startTime ? `${dateLabel} • ${event.startTime}` : dateLabel;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h3">Club Profile</Text>
        <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
          <Share2 color={theme.colors.text} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.bannerContainer}>
          {club?.bannerUrl ? (
            <Image source={{ uri: club.bannerUrl }} style={styles.banner} />
          ) : (
            <View
              style={[
                styles.banner,
                { backgroundColor: theme.colors.primary + "30" },
              ]}
            />
          )}
        </View>

        <View style={styles.profileSection}>
          <View style={styles.logoWrapper}>
            <Avatar
              source={club?.logoUrl ? { uri: club.logoUrl } : undefined}
              size={80}
              isClub
            />
          </View>

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text variant="h2">{club?.name || "Club"}</Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 2 }}
              >
                {club?.sport || "Community Sports Club"}
              </Text>
            </View>
            <Button
              title={isFollowing ? "Following" : "Follow"}
              variant={isFollowing ? "outline" : "primary"}
              size="small"
              onPress={handleFollow}
              style={{ width: 100 }}
            />
          </View>

          <Card style={styles.aboutCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              About Us
            </Text>
            <Text variant="body" color={theme.colors.textSecondary} style={{ lineHeight: 22 }}>
              {club?.description || "No club bio has been added yet."}
            </Text>

            {keyPeopleVisibility === "public" &&
            Array.isArray(club?.keyPeople) &&
            club.keyPeople.length > 0 ? (
              <View style={{ marginTop: theme.spacing.md }}>
                <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
                  Key People
                </Text>
                {club.keyPeople.slice(0, 4).map((person, idx) => (
                  <Text
                    key={`${person.uid || person.name || "person"}-${idx}`}
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginBottom: 3 }}
                  >
                    {person.name || "Club Staff"}
                    {person.role ? ` • ${person.role}` : ""}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>

          <View style={styles.metaRow}>
            {club?.location && showPublicField("location") && (
              <View style={styles.metaItem}>
                <MapPin color={theme.colors.textSecondary} size={16} />
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginLeft: 6 }}
                >
                  {club.location}
                </Text>
              </View>
            )}
            {club?.website && showPublicField("website") && (
              <View style={styles.metaItem}>
                <Link2 color={theme.colors.textSecondary} size={16} />
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginLeft: 6 }}
                >
                  {club.website}
                </Text>
              </View>
            )}
          </View>

          {(showPublicField("email") && contact?.email) ||
          (showPublicField("phone") && contact?.phone) ? (
            <Card style={styles.contactCard}>
              <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
                Public Contact
              </Text>
              {showPublicField("email") && contact?.email ? (
                <View style={styles.contactItem}>
                  <Mail color={theme.colors.textSecondary} size={14} />
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 6 }}
                  >
                    {contact.email}
                  </Text>
                </View>
              ) : null}
              {showPublicField("phone") && contact?.phone ? (
                <View style={styles.contactItem}>
                  <Phone color={theme.colors.textSecondary} size={14} />
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 6 }}
                  >
                    {contact.phone}
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
            Public Events
          </Text>

          {publicEvents.length > 0 ? (
            publicEvents.map((event) => (
              <Card key={event.id} style={styles.eventCard}>
                <View style={styles.eventRow}>
                  <Calendar color={theme.colors.primary} size={18} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text variant="body" weight="600">
                      {event.title || "Club Event"}
                    </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {formatEventDate(event)}
                    </Text>
                    {!!event.location && (
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {event.location}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Text variant="body" color={theme.colors.textSecondary}>
              No public events yet.
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
            Shop Preview
          </Text>

          {shopPreview.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {shopPreview.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("ProductDetail", { product })}
                >
                  <Card style={styles.productCard}>
                    {product.imageUrl ? (
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={styles.productImage}
                    />
                  ) : (
                    <View style={styles.productPlaceholder}>
                      <ShoppingBag
                        color={theme.colors.textSecondary}
                        size={20}
                      />
                    </View>
                  )}
                  <Text
                    variant="body"
                    weight="600"
                    numberOfLines={1}
                    style={{ marginTop: theme.spacing.sm }}
                  >
                    {product.name || "Club Item"}
                  </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      ${Number(product.price || 0).toFixed(2)}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text variant="body" color={theme.colors.textSecondary}>
              No public products yet.
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
            Public Updates
          </Text>

          {publicPosts.length > 0 ? (
            publicPosts.map((post) => (
              <Card key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Avatar
                    source={club?.logoUrl ? { uri: club.logoUrl } : undefined}
                    size={32}
                    isClub
                  />
                  <View style={{ marginLeft: 10 }}>
                    <Text variant="body" weight="600">
                      {post.authorName || club?.name || "Admin"}
                    </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {formatTime(post.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text
                  variant="body"
                  style={{ marginTop: theme.spacing.sm, lineHeight: 22 }}
                >
                  {post.content}
                </Text>
                {post.imageUrl && (
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.postImage}
                  />
                )}
              </Card>
            ))
          ) : (
            <Text variant="body" color={theme.colors.textSecondary}>
              No public updates yet.
            </Text>
          )}
        </View>
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
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  iconBtn: {
    padding: theme.spacing.xs,
  },
  bannerContainer: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.border,
  },
  banner: {
    width: "100%",
    height: "100%",
  },
  profileSection: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  logoWrapper: {
    marginTop: -40,
    marginBottom: theme.spacing.sm,
    padding: 4,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    alignSelf: "flex-start",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bio: {
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  aboutCard: {
    marginTop: theme.spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: theme.spacing.lg,
  },
  contactCard: {
    marginTop: theme.spacing.md,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  divider: {
    height: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  contentSection: {
    padding: theme.spacing.md,
  },
  eventCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  productCard: {
    width: 170,
    marginRight: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  productImage: {
    width: "100%",
    height: 110,
    borderRadius: theme.radius.md,
  },
  productPlaceholder: {
    width: "100%",
    height: 110,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  postCard: {
    padding: theme.spacing.md,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
  },
});
