import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Trash2, CreditCard, Shirt } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import {
  createOrder,
  createStripeCheckoutSession,
} from "../../services/shopService";
import { createNotification } from "../../services/notificationService";
import { getLinkedPlayerProfileByUser } from "../../services/clubOperationsService";

export default function CartScreen({ navigation }) {
  const {
    items,
    subtotal,
    tax,
    total,
    taxEnabled,
    taxRate,
    setTaxConfig,
    removeItem,
    clearCart,
  } = useCart();
  const { user, profile } = useAuth();
  const { activeClubId, activeClub } = useClub();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const enabled = activeClub?.shopTaxEnabled !== false;
    const rate = Number(activeClub?.shopTaxRate);
    const normalizedRate = Number.isFinite(rate) && rate >= 0 ? rate : 0.1;
    setTaxConfig({ enabled, rate: normalizedRate });
  }, [activeClub?.shopTaxEnabled, activeClub?.shopTaxRate]);

  const toDisplayText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "object" && value?.label) {
      return String(value.label);
    }
    return fallback;
  };

  const placeManualOrder = async () => {
    const membership = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships.find((m) => m.clubId === activeClubId)
      : null;
    const role = String(membership?.role || "").trim().toLowerCase();

    const linkedPlayerProfile = await getLinkedPlayerProfileByUser(
      activeClubId,
      user.uid,
    );

    const requireParentApproval =
      role === "player" &&
      linkedPlayerProfile?.paymentPolicy?.requireParentApprovalForPayments ===
        true;

    const parentApproverUids = Array.isArray(linkedPlayerProfile?.parentUids)
      ? linkedPlayerProfile.parentUids.filter((uid) => uid !== user.uid)
      : [];

    const order = await createOrder(activeClubId, {
      userId: user.uid,
      userName: profile?.displayName || "",
      userEmail: user.email || "",
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        variant: i.variant,
        postageOption: i.postageOption || "post",
        price: i.price,
        quantity: i.quantity,
      })),
      subtotal,
      tax,
      total,
      paymentMethod: "manual",
      paymentPolicy: {
        requireParentApprovalForPayments: requireParentApproval,
        parentApproverUids,
      },
    });

    await createNotification(activeClubId, {
      recipientId: user.uid,
      title: "Order Confirmation",
      body: `Your order ${order.orderRef || order.id} has been placed and is awaiting club confirmation.`,
      type: "order-confirmation",
      meta: {
        orderId: order.id,
        orderRef: order.orderRef || "",
        total,
      },
      createdBy: user.uid,
    });

    if (requireParentApproval && parentApproverUids.length > 0) {
      await Promise.all(
        parentApproverUids.map((parentUid) =>
          createNotification(activeClubId, {
            recipientId: parentUid,
            title: "Payment Approval Needed",
            body: `${profile?.displayName || "Player"} placed order ${order.orderRef || order.id}. Please review payment approval.`,
            type: "payment-approval-required",
            meta: {
              orderId: order.id,
              orderRef: order.orderRef || "",
              playerUid: user.uid,
              total,
            },
            createdBy: user.uid,
          }),
        ),
      );
    }

    clearCart();
    if (requireParentApproval) {
      Alert.alert(
        "Approval Required",
        `Order ${order.orderRef || order.id} submitted and waiting for parent approval.`,
      );
    } else {
      Alert.alert(
        "Order Placed!",
        `Order ${order.orderRef || order.id} submitted successfully.`,
      );
    }
    navigation.goBack();
  };

  const handleCheckout = async () => {
    if (!activeClubId || items.length === 0 || !user?.uid) return;

    try {
      const checkout = await createStripeCheckoutSession(activeClubId, {
        userId: user.uid,
        userEmail: user.email || "",
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          variant: i.variant,
          unitAmount: i.price,
          quantity: i.quantity,
        })),
        successUrl: "https://greensports.app/checkout/success",
        cancelUrl: "https://greensports.app/checkout/cancel",
      });

      if (!checkout?.url) {
        throw new Error("Checkout URL not returned.");
      }

      clearCart();
      Alert.alert(
        "Continue To Payment",
        "Complete your payment in Stripe checkout.",
      );
      await Linking.openURL(checkout.url);
    } catch (error) {
      Alert.alert(
        "Stripe Checkout Unavailable",
        "Stripe checkout function is not available yet. Would you like to place a manual order instead?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Place Manual Order",
            onPress: () => {
              placeManualOrder().catch(() => {
                Alert.alert("Error", "Failed to place manual order.");
              });
            },
          },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Your Cart</Text>
        <View style={{ width: 40 }} /> {/* Spacer */}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingBottom: 120,
        }}
      >
        {items.length === 0 ? (
          <View
            style={{ alignItems: "center", marginTop: theme.spacing.xl * 2 }}
          >
            <Text variant="h4" color={theme.colors.textSecondary}>
              Cart is empty
            </Text>
          </View>
        ) : (
          items.map((item, index) => (
            <Card
              key={`${item.productId}-${item.variant}-${index}`}
              style={styles.cartItemCard}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.itemImage}
                />
              ) : (
                <View
                  style={[
                    styles.itemImage,
                    {
                      backgroundColor: theme.colors.border,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Shirt color={theme.colors.textSecondary} size={24} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text variant="body" weight="600" numberOfLines={1}>
                  {toDisplayText(item.name, "Product")}
                </Text>
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginVertical: 4 }}
                >
                  {`${toDisplayText(item.variant, "One Size")} x${Number(item.quantity) || 1}`}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {`Delivery: ${String(item.postageOption || "post").toLowerCase() === "pickup" ? "Pick Up from Club" : "Can Post"}`}
                </Text>
                <Text variant="h4" color={theme.colors.primary}>
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => removeItem(item.productId, item.variant)}
              >
                <Trash2 color={theme.colors.error} size={20} />
              </TouchableOpacity>
            </Card>
          ))
        )}

        {items.length > 0 && (
          <Card style={styles.summaryCard}>
            <Text variant="h3" style={{ marginBottom: theme.spacing.md }}>
              Order Summary
            </Text>

            <View style={styles.summaryRow}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Subtotal
              </Text>
              <Text variant="body" weight="600">
                ${subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="body" color={theme.colors.textSecondary}>
                {taxEnabled
                  ? `Tax (${Math.round((taxRate || 0) * 100)}%)`
                  : "Tax (Disabled)"}
              </Text>
              <Text variant="body" weight="600">
                ${tax.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text variant="h3">Total</Text>
              <Text variant="h2" color={theme.colors.primary}>
                ${total.toFixed(2)}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Checkout Footer */}
      {items.length > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Button
            title="Checkout"
            onPress={handleCheckout}
            style={styles.checkoutBtn}
          />
        </View>
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
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: theme.spacing.xs,
    width: 40,
  },
  cartItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.sm,
    backgroundColor: "#F0F0F0",
  },
  itemInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  deleteBtn: {
    padding: theme.spacing.sm,
  },
  summaryCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.medium,
  },
  checkoutBtn: {
    width: "100%",
  },
});
