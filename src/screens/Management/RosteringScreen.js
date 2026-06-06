import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar as CalendarComponent } from "react-native-calendars";
import {
  Users,
  Clock,
  Plus,
  Download,
  Edit2,
  Trash2,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import FloatingTabBar from "../../components/ui/FloatingTabBar";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToVisibleRosters,
  signUpForShift,
  cancelShiftSignup,
  exportAllRostersToCsv,
  createRosterReminder,
  getRosterTemplates,
  createRosterFromTemplate,
  deleteRosterTemplate,
  updateRosterTemplate,
} from "../../services/managementService";
import { createNotification } from "../../services/notificationService";
import * as Clipboard from "expo-clipboard";
import { useWindowDimensions } from "react-native";

export default function RosteringScreen({ navigation }) {
  const { userRole, activeClubId, userGroupIds, userGroupIdsKey } = useClub();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
  const canManageRosters =
    isAdmin || normalizedRole === "coach" || normalizedRole === "manager";

  const [activeTab, setActiveTab] = useState(0);
  const [rosters, setRosters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [dutyScope, setDutyScope] = useState(0);

  // Template creation modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Use template state
  const [useTemplateTarget, setUseTemplateTarget] = useState(null);
  const [showUseDateModal, setShowUseDateModal] = useState(false);
  const [useTemplateDate, setUseTemplateDate] = useState("");
  const [usingTemplate, setUsingTemplate] = useState(false);
  const [showUseDatePicker, setShowUseDatePicker] = useState(false);

  const dutyScopeOptions = ["All", "Upcoming", "Completed"];
  // We no longer use dutyScopeKey to filter at the subscription level
  // so we fetch 'all' and apply local filtering.
  const dutyScopeKey = "all";

  useEffect(() => {
    if (!activeClubId) {
      setRosters([]);
      return;
    }
    const unsub = subscribeToVisibleRosters(activeClubId, setRosters, {
      userGroupIds,
      userId: user?.uid || "",
      scope: dutyScopeKey,
      isAdmin,
    });
    return () => unsub();
  }, [activeClubId, userGroupIdsKey, user?.uid, dutyScopeKey, isAdmin]);

  const refreshTemplates = () => {
    if (!activeClubId) return;
    setLoadingTemplates(true);
    getRosterTemplates(activeClubId)
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  };

  useEffect(() => {
    refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, activeTab]);

  const visibleRosters = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (dutyScope === 1) { // Upcoming
      return rosters.filter((r) => r.date >= today);
    } else if (dutyScope === 2) { // Completed
      return rosters.filter((r) => r.date < today);
    }
    return rosters;
  }, [rosters, dutyScope]);

  const shifts = visibleRosters.flatMap((roster) =>
    (roster.shifts || []).map((shift, idx) => ({
      rosterId: roster.id,
      shiftIndex: idx,
      title: roster.title,
      date: roster.date || "TBD",
      time: `${shift.startTime || ""}${shift.endTime ? ` - ${shift.endTime}` : ""}`,
      role: shift.role || "",
      filledBy: shift.filledBy || shift.assignedUserId || null,
      filledByName: shift.filledByName || shift.assignedUserName || "",
      assignedGroupName:
        shift.assignedGroupName || roster.assignedGroupName || "",
      assignedGroupId: shift.assignedGroupId || roster.assignedGroupId || "",
      assignedUserId: shift.assignedUserId || roster.assignedUserId || "",
      assignedUserName: shift.assignedUserName || roster.assignedUserName || "",
      openToAll:
        shift.openToAll === true ||
        (shift.openToAll !== false && roster.openToAll === true),
      filled: (shift.filledBy || shift.assignedUserId) ? 1 : 0,
      required: 1,
    })),
  );

  const handleAddShift = () => {
    navigation.navigate("CreateItem", {
      title: "Create New Shift",
      type: "Shift",
      isTemplate: false,
    });
  };

  const handleEditTemplate = (template) => {
    navigation.navigate("CreateItem", {
      title: "Edit Roster Template",
      type: "Shift",
      isTemplate: true,
      initialData: template,
    });
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRosterTemplate(activeClubId, template.id);
              refreshTemplates();
            } catch (err) {
              Alert.alert("Error", "Could not delete template.");
            }
          },
        },
      ],
    );
  };

  const handleCreateTemplate = () => {
    navigation.navigate("CreateItem", {
      title: "Create Roster Template",
      type: "Shift",
      isTemplate: true,
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert("Required", "Please enter a template name.");
      return;
    }
    if (!activeClubId) return;
    setSavingTemplate(true);
    try {
      const { createRosterTemplate } =
        await import("../../services/managementService");
      await createRosterTemplate(activeClubId, {
        name: templateName.trim(),
        shifts: [
          {
            role: templateDescription.trim() || templateName.trim(),
            startTime: "",
            endTime: "",
            filledBy: null,
            filledByName: "",
            assignedUserId: "",
            assignedUserName: "",
          },
        ],
        assignedGroupId: null,
        assignedGroupIds: [],
        assignedGroupName: "",
        groupType: "Team",
        openToAll: true,
        assignedUserId: "",
        assignedUserName: "",
        recurringRule: null,
        createdBy: user?.uid || "",
      });
      setShowTemplateModal(false);
      refreshTemplates();
      setActiveTab(1);
      Alert.alert(
        "Template Created",
        templateName.trim() + " added to Templates.",
      );
    } catch (err) {
      Alert.alert("Error", err.message || "Could not save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = exportAllRostersToCsv(rosters);
      await Clipboard.setStringAsync(csv);
      Alert.alert("CSV Exported", "Roster CSV has been copied to clipboard.");
    } catch {
      Alert.alert("Export Failed", "Could not generate roster CSV.");
    }
  };

  const handleSetReminder = async (shift) => {
    if (!activeClubId || !shift.filledBy) {
      Alert.alert("Reminder", "Assign a volunteer before setting reminders.");
      return;
    }

    try {
      await createRosterReminder(activeClubId, {
        rosterId: shift.rosterId,
        shiftIndex: shift.shiftIndex,
        recipientId: shift.filledBy,
        recipientName: shift.filledByName || "",
        delivery: "in-app",
        when: shift.date || "",
      });

      await createNotification(activeClubId, {
        recipientId: shift.filledBy,
        title: "Roster Reminder",
        body: `Reminder: ${shift.title}${shift.role ? ` (${shift.role})` : ""} on ${shift.date}.`,
        type: "roster-reminder",
        meta: {
          rosterId: shift.rosterId,
          shiftIndex: shift.shiftIndex,
          date: shift.date,
        },
        createdBy: user?.uid || "",
      });

      Alert.alert(
        "Reminder Scheduled",
        `Reminder set for ${shift.filledByName || "volunteer"}.`,
      );
    } catch {
      Alert.alert("Error", "Unable to set reminder right now.");
    }
  };

  const handleUseTemplate = (template) => {
    if (!activeClubId) return;
    const today = new Date().toISOString().split("T")[0];
    setUseTemplateTarget(template);
    setUseTemplateDate(today);
    setShowUseDateModal(true);
  };

  const confirmUseTemplate = async () => {
    if (!useTemplateTarget || !useTemplateDate) return;
    setUsingTemplate(true);
    try {
      await createRosterFromTemplate(activeClubId, useTemplateTarget.id, {
        title: useTemplateTarget.name,
        date: useTemplateDate,
        createdBy: user?.uid || "",
      });
      setShowUseDateModal(false);
      setUseTemplateTarget(null);
      setUseTemplateDate("");
      setActiveTab(0);
      Alert.alert(
        "Created",
        `Roster created from "${useTemplateTarget.name}".`,
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err.message || "Could not create roster from template.",
      );
    } finally {
      setUsingTemplate(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text variant="h2">Rostering</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Volunteer and Shift Management
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {canManageRosters ? (
            <TouchableOpacity
              style={[styles.iconButton, styles.addBtn]}
              onPress={activeTab === 0 ? handleAddShift : handleCreateTemplate}
            >
              <Plus color={theme.colors.white} size={20} />
            </TouchableOpacity>
          ) : null}
          {canManageRosters && (
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExportCsv}
            >
              <Download color={theme.colors.primary} size={20} />
            </TouchableOpacity>
          )}
          <View style={styles.avatarContainer}>
            {profile?.photoURL ? (
              <Image
                source={{ uri: profile.photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text variant="small" weight="700" color={theme.colors.primary}>
                  {(profile?.displayName ||
                    profile?.email ||
                    "U")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.segmentContainer}>
        <SegmentedControl
          options={["Upcoming Shifts", "Templates"]}
          selectedIndex={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {activeTab === 0 && (
        <View style={styles.scopeContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scopeScrollContent}
          >
            {["All", "Upcoming", "Completed"].map((option, idx) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.scopeChip,
                  dutyScope === idx && styles.scopeChipActive,
                ]}
                onPress={() => setDutyScope(idx)}
              >
                <Text
                  variant="small"
                  weight="600"
                  color={
                    dutyScope === idx ? theme.colors.white : theme.colors.text
                  }
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 0 ? (
          <View key="upcoming-shifts-tab">
            {shifts.length > 0 ? (
              shifts.map((shift) => (
              <Card
                key={`${shift.rosterId}-${shift.shiftIndex}`}
                style={styles.shiftCard}
              >
                <View style={styles.shiftHeader}>
                  <Text variant="h4">
                    {shift.title}
                    {shift.role ? ` - ${shift.role}` : ""}
                  </Text>
                  <View style={styles.badge}>
                    <Text
                      variant="small"
                      color={theme.colors.white}
                      weight="600"
                    >
                      {shift.filled}/{shift.required} Filled
                    </Text>
                  </View>
                </View>

                <View style={styles.shiftMeta}>
                  <View style={styles.metaItem}>
                    <Clock color={theme.colors.textSecondary} size={16} />
                    <Text variant="small" style={{ marginLeft: 6 }}>
                      {shift.date} • {shift.time || "Time TBD"}
                    </Text>
                  </View>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 6 }}
                  >
                    {shift.assignedUserId
                      ? `Assigned: ${shift.assignedUserName || shift.assignedUserId}`
                      : shift.openToAll
                        ? "Open to all"
                        : shift.assignedGroupName || shift.assignedGroupId
                          ? `Group: ${shift.assignedGroupName || shift.assignedGroupId}`
                          : "Group: General"}
                  </Text>
                </View>

                <View style={styles.shiftActions}>
                  {!shift.filledBy ? (
                    <Button
                      title="Sign Up"
                      size="small"
                      onPress={async () => {
                        try {
                          await signUpForShift(
                            activeClubId,
                            shift.rosterId,
                            shift.shiftIndex,
                            user?.uid,
                            profile?.displayName || "Member",
                            { userGroupIds },
                          );
                        } catch {
                          Alert.alert(
                            "Error",
                            "Unable to sign up for this shift.",
                          );
                        }
                      }}
                    />
                  ) : shift.filledBy === user?.uid ? (
                    <Button
                      title="Cancel Signup"
                      variant="outline"
                      size="small"
                      onPress={async () => {
                        try {
                          await cancelShiftSignup(
                            activeClubId,
                            shift.rosterId,
                            shift.shiftIndex,
                            user?.uid,
                          );
                        } catch {
                          Alert.alert("Error", "Unable to cancel signup.");
                        }
                      }}
                    />
                  ) : (
                    <Button
                      title={shift.filledByName || "Filled"}
                      variant="outline"
                      size="small"
                      disabled
                    />
                  )}

                  {canManageRosters && (
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <TouchableOpacity
                        onPress={() => handleSetReminder(shift)}
                        style={{ padding: theme.spacing.sm }}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="600"
                        >
                          Reminder
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Users color={theme.colors.border} size={48} />
              <Text
                variant="body"
                color={theme.colors.textSecondary}
                style={{ textAlign: "center", marginTop: theme.spacing.md }}
              >
                No upcoming shifts. Admins can create new rosters.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View key="templates-tab" style={{ paddingBottom: 100 }}>
          <Card style={styles.shiftCard}>
            <View style={styles.shiftHeader}>
              <Text variant="h4">Roster Templates</Text>
            </View>
            <Text variant="small" color={theme.colors.textSecondary}>
              Create templates for recurring rosters like Game Day Canteen or
              Field Setup.
            </Text>
            {canManageRosters && (
              <View style={{ marginTop: theme.spacing.md }}>
                <Button
                  title="Create Template"
                  size="small"
                  onPress={handleCreateTemplate}
                />
              </View>
            )}
          </Card>

          {loadingTemplates ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginTop: theme.spacing.md }}
            />
          ) : templates.length > 0 ? (
            templates.map((template) => (
              <Card key={template.id} style={styles.shiftCard}>
                <View style={styles.shiftHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h4">{template.name}</Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {(template.shifts || []).length} shifts
                    </Text>
                  </View>
                  {canManageRosters ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleUseTemplate(template)}
                        style={styles.useTemplateBtn}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.white}
                          weight="700"
                        >
                          Use
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleEditTemplate(template)}
                      >
                        <Edit2 color={theme.colors.textSecondary} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteTemplate(template)}
                      >
                        <Trash2 color={theme.colors.error} size={18} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))
          ) : (
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ textAlign: "center", marginTop: theme.spacing.md }}
            >
              No templates yet.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
    <FloatingTabBar navigation={navigation} activeScreen="More" />

    {/* Create Template Modal */}
    <Modal
      visible={showTemplateModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTemplateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text variant="h4">Create Roster Template</Text>
            <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
              <Text variant="small" color={theme.colors.textSecondary}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.modalBody, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <Text variant="small" weight="600" style={styles.modalLabel}>
              Template Name
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Game Day Canteen, Field Setup..."
              placeholderTextColor={theme.colors.textSecondary}
              value={templateName}
              onChangeText={setTemplateName}
              autoFocus
              returnKeyType="next"
            />
            <Text variant="small" weight="600" style={styles.modalLabel}>
              Default Role / Description
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Describe the shift or duty role..."
              placeholderTextColor={theme.colors.textSecondary}
              value={templateDescription}
              onChangeText={setTemplateDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginBottom: theme.spacing.md }}
            >
              You can add more shifts and refine this template after creation.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, savingTemplate && { opacity: 0.7 }]}
              onPress={handleSaveTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <Text variant="body" weight="700" color={theme.colors.white}>
                  Create Template
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

      {/* Use Template Date Modal */}
      <Modal
        visible={showUseDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUseDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text variant="h4">Select Roster Date</Text>
              <TouchableOpacity onPress={() => setShowUseDateModal(false)}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.modalBody, { paddingBottom: Math.max(insets.bottom + 20, theme.spacing.lg) }]}>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                Creating roster from:{" "}
                <Text weight="700">{useTemplateTarget?.name}</Text>
              </Text>
              <Text variant="small" weight="600" style={styles.modalLabel}>
                Roster Date
              </Text>
              <TouchableOpacity
                style={styles.modalInput}
                onPress={() => setShowUseDatePicker(true)}
              >
                <Text
                  color={
                    useTemplateDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {useTemplateDate || "Select date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, usingTemplate && { opacity: 0.7 }]}
                onPress={confirmUseTemplate}
                disabled={usingTemplate || !useTemplateDate}
              >
                {usingTemplate ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text variant="body" weight="700" color={theme.colors.white}>
                    Create Roster
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Use Template Calendar Picker */}
      <Modal
        visible={showUseDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUseDatePicker(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { justifyContent: "center", paddingHorizontal: 16 },
          ]}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Text variant="h4">Pick Date</Text>
              <TouchableOpacity onPress={() => setShowUseDatePicker(false)}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <CalendarComponent
              current={useTemplateDate || undefined}
              onDayPress={(day) => {
                setUseTemplateDate(day.dateString);
                setShowUseDatePicker(false);
              }}
              markedDates={
                useTemplateDate
                  ? {
                    [useTemplateDate]: {
                      selected: true,
                      selectedColor: theme.colors.primary,
                    },
                  }
                  : undefined
              }
              theme={{
                todayTextColor: theme.colors.primary,
                selectedDayBackgroundColor: theme.colors.primary,
                arrowColor: theme.colors.primary,
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
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
  },
  avatarContainer: {},
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 139, 81, 0.15)",
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16, 139, 81, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    padding: 8,
  },
  segmentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scopeContainer: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scopeScrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginRight: 6,
  },
  scopeChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  shiftCard: {
    marginBottom: theme.spacing.md,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  shiftMeta: {
    marginBottom: theme.spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  shiftActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalBody: {
    padding: theme.spacing.lg,
  },
  modalLabel: {
    marginBottom: 6,
    marginTop: theme.spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 11,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontSize: 15,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  useTemplateBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
});
