import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { subscribeToRoleChangeRequests, approveRoleChangeRequest, rejectRoleChangeRequest } from "../../services/clubService";
import { ChevronLeft, UserCheck } from "lucide-react-native";

export default function RoleRequestsScreen({ navigation }) {
  const { activeClubId, isClubLeader } = useClub();
  const [requests, setRequests] = useState([]);
  const [loadingIds, setLoadingIds] = useState(new Set());

  useEffect(() => {
    if (!activeClubId || !isClubLeader) return;
    const unsub = subscribeToRoleChangeRequests(activeClubId, setRequests);
    return () => unsub();
  }, [activeClubId, isClubLeader]);

  const handleApprove = async (req) => {
    setLoadingIds(prev => new Set([...prev, req.id]));
    try {
      await approveRoleChangeRequest(activeClubId, req);
      Alert.alert("Approved", `Role updated for ${req.userName || "User"}.`);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not approve request.");
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
    }
  };

  const handleReject = async (req) => {
    setLoadingIds(prev => new Set([...prev, req.id]));
    try {
      await rejectRoleChangeRequest(activeClubId, req.userId, "Rejected by admin");
      Alert.alert("Rejected", "Role request rejected.");
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not reject request.");
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text variant="h2">Role Requests</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <UserCheck color={theme.colors.border} size={48} />
            <Text variant="body" color={theme.colors.textSecondary} style={{ marginTop: 16 }}>
              No pending role requests.
            </Text>
          </View>
        ) : (
          requests.map(req => (
            <Card key={req.id} style={styles.reqCard}>
              <View style={styles.reqHeader}>
                <Text variant="h3">{req.userName || "Member"}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="small" color={theme.colors.textSecondary}>Current Role:</Text>
                <Text variant="small" weight="600" style={{ marginLeft: 6 }}>{req.currentRole || "None"}</Text>
              </View>
              <View style={styles.row}>
                <Text variant="small" color={theme.colors.textSecondary}>Requested Roles:</Text>
                <Text variant="small" weight="700" color={theme.colors.primary} style={{ marginLeft: 6 }}>
                  {(req.requestedRoles || [req.requestedRole]).join(", ")}
                </Text>
              </View>
              {!!req.reason && (
                <View style={[styles.row, { marginTop: 8, flexDirection: "column", alignItems: "flex-start" }]}>
                  <Text variant="small" color={theme.colors.textSecondary}>Reason:</Text>
                  <Text variant="body" style={{ marginTop: 4 }}>{req.reason}</Text>
                </View>
              )}
              <View style={styles.actions}>
                <Button 
                  title="Reject" 
                  variant="outline" 
                  style={{ flex: 1, marginRight: 8 }} 
                  onPress={() => handleReject(req)} 
                  disabled={loadingIds.has(req.id)}
                />
                <Button 
                  title="Approve" 
                  style={{ flex: 1, marginLeft: 8 }} 
                  onPress={() => handleApprove(req)} 
                  loading={loadingIds.has(req.id)}
                  disabled={loadingIds.has(req.id)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { marginRight: theme.spacing.sm },
  content: { padding: theme.spacing.md },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 40 },
  reqCard: { marginBottom: theme.spacing.md },
  reqHeader: { marginBottom: theme.spacing.sm },
  row: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  actions: { flexDirection: "row", marginTop: theme.spacing.lg },
});
