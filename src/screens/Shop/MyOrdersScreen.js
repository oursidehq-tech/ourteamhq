import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Receipt, ShoppingBag } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  approveOrderPaymentByParent,
  subscribeToOrders,
  subscribeToOrdersAwaitingParentApproval,
} from "../../services/shopService";
import { createNotification } from "../../services/notificationService";

const formatDate = (value) => {
  if (!value) return "Date pending";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const renderPaymentLabel = (status) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "paid" || normalized === "succeeded") return "Paid";
  if (normalized === "approval-required") return "Parent Approval Required";
  if (normalized === "awaiting-payment") return "Awaiting Payment";
  if (normalized === "pending") return "Pending";
  return status || "Unknown";
};

const toDisplayText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

export default function MyOrdersScreen({ navigation }) {
  const { activeClubId, userRole } = useClub();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!activeClubId || !user?.uid) {
      setOrders([]);
      return;
    }

    const unsubscribe = subscribeToOrders(activeClubId, setOrders, {
      userId: user.uid,
    });
    return unsubscribe;
  }, [activeClubId, user?.uid]);

  useEffect(() => {
    if (!activeClubId || !user?.uid || userRole !== "Parent") {
      setPendingApprovals([]);
      return;
    }

    const unsubscribe = subscribeToOrdersAwaitingParentApproval(
      activeClubId,
      user.uid,
      setPendingApprovals,
    );
    return unsubscribe;
  }, [activeClubId, user?.uid, userRole]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    [orders],
  );

  const approvePayment = async (order) => {
    try {
      await approveOrderPaymentByParent(activeClubId, order.id, {
        approverUid: user.uid,
      });

      await createNotification(activeClubId, {
        recipientId: order.userId,
        title: "Payment Approved",
        body: `Your order ${order.orderRef || order.id} has been approved by parent and is ready for payment processing.`,
        type: "payment-approved",
        meta: {
          orderId: order.id,
          orderRef: order.orderRef || "",
        },
        createdBy: user.uid,
      });
    } catch {
      // Keep UX simple; order list will auto-refresh on failure/success.
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <Text variant="h3">My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={styles.summaryCard}>
          <Text variant="small" color={theme.colors.textSecondary}>
            Total Orders
          </Text>
          <Text variant="h2" style={{ marginTop: 4 }}>
            {orders.length}
          </Text>
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginTop: 8 }}
          >
            Total Spent: ${totalSpent.toFixed(2)}
          </Text>
        </Card>

        {userRole === "Parent" && pendingApprovals.length > 0 ? (
          <Card style={styles.summaryCard}>
            <Text variant="h4">Pending Payment Approvals</Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4, marginBottom: 10 }}
            >
              Approve child purchases before payment is processed.
            </Text>

            {pendingApprovals.map((order) => (
              <View key={`approval-${order.id}`} style={styles.approvalRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="700">
                    {toDisplayText(order.orderRef) || toDisplayText(order.id)}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Player: {toDisplayText(order.userName, "Player")}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Total: ${(Number(order.total) || 0).toFixed(2)}
                  </Text>
                </View>
                <Button
                  title="Approve"
                  size="small"
                  onPress={() => approvePayment(order)}
                />
              </View>
            ))}
          </Card>
        ) : null}

        {orders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ShoppingBag color={theme.colors.border} size={44} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md }}
            >
              No orders yet
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4, textAlign: "center" }}
            >
              Your order history will appear here after checkout.
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <Card key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text variant="h4">
                    {toDisplayText(order.orderRef) || toDisplayText(order.id)}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {formatDate(order.createdAt)}
                  </Text>
                </View>
                <Text variant="h4" color={theme.colors.primary}>
                  ${(Number(order.total) || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Receipt color={theme.colors.textSecondary} size={14} />
                <Text variant="small" color={theme.colors.textSecondary}>
                  {renderPaymentLabel(toDisplayText(order.paymentStatus))}
                </Text>
              </View>

              <Text variant="small" color={theme.colors.textSecondary}>
                Items: {(order.items || []).length}
              </Text>
            </Card>
          ))
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
    width: 40,
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 140,
  },
  summaryCard: {
    marginBottom: theme.spacing.md,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.lg,
  },
  orderCard: {
    marginBottom: theme.spacing.sm,
  },
  approvalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    marginTop: 10,
    gap: 10,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
});
