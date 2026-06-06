import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ReceiptText,
  DollarSign,
  Truck,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import {
  subscribeToOrders,
  updateOrderStatus,
} from "../../services/shopService";

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

const nextStatus = (status) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "pending") return "confirmed";
  if (normalized === "confirmed") return "shipped";
  if (normalized === "shipped") return "delivered";
  return null;
};

const isOrderLocked = (paymentStatus) => {
  const normalized = (paymentStatus || "").toLowerCase();
  return normalized === "paid" || normalized === "succeeded";
};

const toDisplayText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

export default function OrdersDashboardScreen({ navigation }) {
  const { activeClubId, isClubLeader } = useClub();
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    if (!activeClubId || !isClubLeader) {
      setOrders([]);
      return;
    }
    const unsubscribe = subscribeToOrders(activeClubId, setOrders);
    return unsubscribe;
  }, [activeClubId, isClubLeader]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.sales += Number(order.total) || 0;
        if ((order.paymentStatus || "").toLowerCase() === "paid") {
          acc.paid += Number(order.total) || 0;
        }
        if ((order.status || "").toLowerCase() === "pending") {
          acc.pending += 1;
        }
        return acc;
      },
      { sales: 0, paid: 0, pending: 0 },
    );
  }, [orders]);

  const handleAdvance = async (order) => {
    const toStatus = nextStatus(order.status);
    if (!toStatus || !activeClubId || isOrderLocked(order.paymentStatus)) {
      if (isOrderLocked(order.paymentStatus)) {
        Alert.alert(
          "Order Locked",
          "Paid orders are locked and cannot be modified.",
        );
      }
      return;
    }

    setUpdatingId(order.id);
    try {
      await updateOrderStatus(activeClubId, order.id, toStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: toStatus } : o)),
      );
    } catch {
      Alert.alert("Error", "Failed to update order status.");
    } finally {
      setUpdatingId("");
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
        <Text variant="h3">Orders Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isClubLeader ? (
        <View style={styles.restrictedWrap}>
          <Text variant="h4">Club leader access only</Text>
          <Text
            variant="body"
            color={theme.colors.textSecondary}
            style={{ marginTop: 8, textAlign: "center" }}
          >
            Owners and admins can manage all club store orders.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, { marginRight: 8 }]}>
              <DollarSign color={theme.colors.primary} size={18} />
              <Text variant="small" color={theme.colors.textSecondary}>
                Gross Sales
              </Text>
              <Text variant="h4">${totals.sales.toFixed(2)}</Text>
            </Card>
            <Card style={[styles.metricCard, { marginLeft: 8 }]}>
              <ReceiptText color={theme.colors.primary} size={18} />
              <Text variant="small" color={theme.colors.textSecondary}>
                Pending
              </Text>
              <Text variant="h4">{totals.pending}</Text>
            </Card>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Truck color={theme.colors.border} size={44} />
              <Text
                variant="h4"
                color={theme.colors.textSecondary}
                style={{ marginTop: theme.spacing.md }}
              >
                No orders yet
              </Text>
            </View>
          ) : (
            orders.map((order) => {
              const canAdvance =
                !!nextStatus(order.status) &&
                !isOrderLocked(order.paymentStatus);
              return (
                <Card key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text variant="h4">
                        {toDisplayText(order.orderRef) ||
                          toDisplayText(order.id)}
                      </Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {toDisplayText(order.userName) ||
                          toDisplayText(order.userEmail) ||
                          "Member"}
                      </Text>
                    </View>
                    <Text variant="h4" color={theme.colors.primary}>
                      ${(Number(order.total) || 0).toFixed(2)}
                    </Text>
                  </View>

                  <Text variant="small" color={theme.colors.textSecondary}>
                    {formatDate(order.createdAt)}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4 }}
                  >
                    {`Payment: ${toDisplayText(order.paymentStatus, "pending")} | Status: ${toDisplayText(order.status, "pending")}`}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4, marginBottom: 10 }}
                  >
                    Items: {(order.items || []).length}
                  </Text>

                  <Button
                    title={
                      canAdvance
                        ? updatingId === order.id
                          ? "Updating..."
                          : `Mark as ${nextStatus(order.status)}`
                        : isOrderLocked(order.paymentStatus)
                          ? "Locked After Payment"
                          : "Completed"
                    }
                    onPress={() => handleAdvance(order)}
                    disabled={!canAdvance || updatingId === order.id}
                    variant={canAdvance ? "primary" : "outline"}
                    style={{ width: "100%" }}
                  />
                </Card>
              );
            })
          )}
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
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 40,
    padding: theme.spacing.xs,
  },
  restrictedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 140,
  },
  metricsRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
  },
  orderCard: {
    marginBottom: theme.spacing.sm,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
