import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckSquare,
  Plus,
  RefreshCw,
  Calendar,
  ChevronRight,
  Square,
  MoreVertical,
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
  subscribeToVisibleTasks,
  updateTask,
  getTaskTemplates,
  deleteTaskTemplate,
} from "../../services/managementService";

export default function TasksScreen({ route, navigation }) {
  const { userRole, activeClubId, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
  const isStaffTaskRole = [
    "owner",
    "admin",
    "president",
    "vice president",
    "executive",
    "committee",
    "treasurer",
    "secretary",
    "registrar",
    "coordinator",
    "coach",
    "manager",
  ].includes(normalizedRole);
  const canManageTasks = isStaffTaskRole;

  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState(0); // 0 Tasks, 1 Templates
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [dutyScope, setDutyScope] = useState(0);
  const [taskStatusScope, setTaskStatusScope] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const refreshTemplates = useCallback(async () => {
    if (!activeClubId) return;
    setLoadingTemplates(true);
    try {
      const rows = await getTaskTemplates(activeClubId);
      setTemplates(rows || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [activeClubId]);

  const dutyScopeOptions = ["All", "Team", "Groups", "User"];
  const dutyScopeKey = dutyScopeOptions[dutyScope]?.toLowerCase() || "all";
  const taskStatusOptions = ["Upcoming", "Completed", "All"];
  const taskStatusKey =
    taskStatusOptions[taskStatusScope]?.toLowerCase() || "upcoming";

  useEffect(() => {
    if (!activeClubId) return;
    const unsub = subscribeToVisibleTasks(activeClubId, setTasks, {
      userGroupIds,
      userId: user?.uid || "",
      scope: dutyScopeKey,
      isAdmin: isStaffTaskRole,
    });
    return () => unsub();
  }, [activeClubId, userGroupIds, user?.uid, dutyScopeKey, isStaffTaskRole]);

  useEffect(() => {
    if (activeTab !== 1) {
      setTemplates([]);
      setLoadingTemplates(false);
      return;
    }
    refreshTemplates();
  }, [activeTab, refreshTemplates]);

  useEffect(() => {
    if (route.params?.openTask) {
      setSelectedTask(route.params.openTask);
      navigation.setParams({ openTask: undefined });
    }
  }, [route.params?.openTask, navigation]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (activeTab === 1) refreshTemplates();
    });
    return unsub;
  }, [navigation, activeTab, refreshTemplates]);

  const handleAddTask = () => {
    navigation.navigate("CreateItem", {
      title: "Create New Task",
      type: "Task",
    });
  };

  const handleCreateTemplate = () => {
    navigation.navigate("CreateItem", {
      title: "Create Task Template",
      type: "Task",
      initialCreateAsTemplate: true,
    });
  };

  const formatTaskDateLabel = (task) => {
    const date = task?.startDate || task?.dueDate || "";
    if (!date) return "No date";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatTaskTimeLabel = (task) => {
    if (task?.isAllDay) return "All day";
    const start = String(task?.startTime || "").trim();
    const end = String(task?.endTime || "").trim();
    if (!start && !end) return "";
    if (start && end) return `${start} - ${end}`;
    return start || end;
  };

  const formatTaskDateTimeLabel = (task) => {
    const dateLabel = formatTaskDateLabel(task);
    const timeLabel = formatTaskTimeLabel(task);
    return timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
  };

  const groupVisibleTasks = tasks;

  const statusVisibleTasks = groupVisibleTasks.filter((task) => {
    const normalizedStatus = String(task?.status || "pending")
      .trim()
      .toLowerCase();

    if (taskStatusKey === "completed") {
      return normalizedStatus === "completed";
    }
    if (taskStatusKey === "upcoming") {
      return normalizedStatus !== "completed";
    }
    return true;
  });

  const visibleTasks =
    showMyTasksOnly && user?.uid
      ? statusVisibleTasks.filter(
        (t) =>
          (t.assignedUserId && t.assignedUserId === user.uid) ||
          (t.assigneeId && t.assigneeId === user.uid),
      )
      : statusVisibleTasks;

  const sectionTitle =
    taskStatusKey === "completed"
      ? "Completed Tasks"
      : taskStatusKey === "all"
        ? "All Tasks"
        : "Upcoming Tasks";

  const emptyLabel =
    taskStatusKey === "completed"
      ? "No completed tasks yet."
      : taskStatusKey === "all"
        ? "No tasks found."
        : "No upcoming tasks right now.";

  const canUpdateTask = (task) =>
    !!task &&
    (isAdmin ||
      (task.assigneeId && task.assigneeId === user?.uid) ||
      (task.assignedUserId && task.assignedUserId === user?.uid));

  const toggleTaskStatus = async (task) => {
    if (!task) return;

    if (!canUpdateTask(task)) {
      Alert.alert(
        "Not allowed",
        "Only the assignee or an admin can update this task.",
      );
      return;
    }

    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await updateTask(activeClubId, task.id, {
        status: newStatus,
      });
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) =>
          prev
            ? {
              ...prev,
              status: newStatus,
            }
            : prev,
        );
      }
    } catch {
      Alert.alert("Error", "Unable to update task status.");
    }
  };

  const handleTemplateEdit = () => {
    if (!selectedTemplate) return;
    setShowTemplateMenu(false);
    navigation.navigate("CreateItem", {
      title: "Edit Task Template",
      type: "Task",
      initialCreateAsTemplate: true,
      initialData: selectedTemplate,
    });
    setSelectedTemplate(null);
  };

  const handleTemplateUse = () => {
    if (!selectedTemplate) return;
    setShowTemplateMenu(false);
    navigation.navigate("CreateItem", {
      title: "Create Task from Template",
      type: "Task",
      initialData: selectedTemplate,
    });
    setSelectedTemplate(null);
  };

  const handleTemplateDelete = () => {
    if (!selectedTemplate) return;
    Alert.alert(
      "Delete Template",
      "Are you sure you want to delete this template? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setShowTemplateMenu(false);
            try {
              await deleteTaskTemplate(activeClubId, selectedTemplate.id);
              setSelectedTemplate(null);
              await refreshTemplates();
              Alert.alert("Success", "Template deleted successfully.");
            } catch (error) {
              Alert.alert("Error", "Failed to delete template.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View>
              <Text variant="h2">Tasks</Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                Manage club duties • {tasks.length} task{tasks.length === 1 ? "" : "s"}
              </Text>
            </View>

          </View>
        </View>
        <View style={styles.headerRight}>
          {canManageTasks ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowTemplateMenu(true)}
            >
              <MoreVertical color={theme.colors.text} size={18} />
            </TouchableOpacity>
          ) : null}
          {canManageTasks ? (
            <TouchableOpacity
              style={[styles.iconButton, styles.addBtn]}
              onPress={activeTab === 1 ? handleCreateTemplate : handleAddTask}
            >
              <Plus color={theme.colors.white} size={20} />
            </TouchableOpacity>
          ) : null}
          {!isStaffTaskRole && (
            <TouchableOpacity
              style={styles.myTasksToggle}
              onPress={() => setShowMyTasksOnly(!showMyTasksOnly)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                {showMyTasksOnly ? "All Tasks" : "My Tasks"}
              </Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 1 && canManageTasks ? (
          <>
            <View style={{ marginBottom: theme.spacing.md }}>
              <Text variant="h4" style={{ marginBottom: 6 }}>
                Recurring Templates
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                Create templates for recurring club duties.
              </Text>
              <Button
                title="Create Template"
                size="small"
                onPress={handleCreateTemplate}
                style={{ marginTop: theme.spacing.md, alignSelf: "flex-start" }}
              />
            </View>

            {loadingTemplates ? (
              <View style={{ paddingVertical: theme.spacing.md }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : templates.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  No templates yet.
                </Text>
              </Card>
            ) : (
              templates.map((tpl) => (
                <Card key={tpl.id} style={[styles.taskCard, { marginBottom: 10 }]}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      setSelectedTemplate((prev) =>
                        prev?.id === tpl.id ? null : tpl
                      )
                    }
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="700">
                          {tpl.name || tpl.title || "Untitled template"}
                        </Text>
                        {tpl.description ? (
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                            style={{ marginTop: 4 }}
                          >
                            {tpl.description}
                          </Text>
                        ) : null}
                        {tpl.startTime ? (
                          <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                            {tpl.startTime}{tpl.endTime ? ` - ${tpl.endTime}` : ""}
                          </Text>
                        ) : null}
                      </View>
                      <MoreVertical color={theme.colors.textSecondary} size={20} style={{ marginTop: 2 }} />
                    </View>
                  </TouchableOpacity>

                  {selectedTemplate?.id === tpl.id && (
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        style={styles.templateActionBtn}
                        onPress={handleTemplateUse}
                      >
                        <Text variant="small" weight="700" color={theme.colors.primary}>
                          Use
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.templateActionDivider} />
                      <TouchableOpacity
                        style={styles.templateActionBtn}
                        onPress={handleTemplateEdit}
                      >
                        <Text variant="small" weight="700" color={theme.colors.text}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.templateActionDivider} />
                      <TouchableOpacity
                        style={styles.templateActionBtn}
                        onPress={handleTemplateDelete}
                      >
                        <Text variant="small" weight="700" color={theme.colors.error}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              ))
            )}

          </>
        ) : (
          <>

            <View style={styles.segmentContainer}>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={styles.segmentLabel}
              >
                View tasks by
              </Text>
              <SegmentedControl
                options={dutyScopeOptions}
                selectedIndex={dutyScope}
                onChange={setDutyScope}
              />
            </View>

            <View style={styles.segmentContainer}>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={styles.segmentLabel}
              >
                Task status
              </Text>
              <SegmentedControl
                options={taskStatusOptions}
                selectedIndex={taskStatusScope}
                onChange={setTaskStatusScope}
              />
            </View>

            <Text
              variant="h4"
              style={{
                marginBottom: theme.spacing.md,
                marginTop: theme.spacing.md,
              }}
            >
              {sectionTitle}
            </Text>

            {visibleTasks.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {emptyLabel}
                </Text>
              </Card>
            ) : (
              visibleTasks.map((task) => (
                <Card key={task.id} style={styles.taskCard}>
                  <View style={styles.taskRow}>
                    <TouchableOpacity
                      onPress={() => toggleTaskStatus(task)}
                      style={styles.checkbox}
                    >
                      {task.status === "completed" ? (
                        <CheckSquare color={theme.colors.primary} size={24} />
                      ) : (
                        <Square color={theme.colors.border} size={24} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.taskInfo}
                      activeOpacity={0.85}
                      onPress={() => setSelectedTask(task)}
                    >
                      <Text
                        variant="body"
                        weight="600"
                        style={[
                          { marginBottom: 4 },
                          task.status === "completed" && {
                            textDecorationLine: "line-through",
                            opacity: 0.5,
                          },
                        ]}
                      >
                        {task.title}
                      </Text>
                      <View style={styles.taskMeta}>
                        <Text variant="small">
                          {task.assigneeName || task.assignedUserName || "Unassigned"}
                        </Text>
                        <Text
                          variant="small"
                          color={theme.colors.border}
                          style={{ marginHorizontal: 6 }}
                        >
                          •
                        </Text>
                        <Calendar
                          color={theme.colors.textSecondary}
                          size={12}
                          style={{ marginRight: 4 }}
                        />
                        <Text variant="small" color={theme.colors.textSecondary}>
                          {formatTaskDateTimeLabel(task)}
                        </Text>
                        {task.openToAll ? (
                          <>
                            <Text
                              variant="small"
                              color={theme.colors.border}
                              style={{ marginHorizontal: 6 }}
                            >
                              •
                            </Text>
                            <Text variant="small" color={theme.colors.textSecondary}>
                              Open to all
                            </Text>
                          </>
                        ) : task.assignedGroupName || task.assignedGroupId ? (
                          <>
                            <Text
                              variant="small"
                              color={theme.colors.border}
                              style={{ marginHorizontal: 6 }}
                            >
                              •
                            </Text>
                            <Text variant="small" color={theme.colors.textSecondary}>
                              {task.assignedGroupName || task.assignedGroupId}
                            </Text>
                          </>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={styles.viewTaskBtn}
                        onPress={() => setSelectedTask(task)}
                      >
                        <Text variant="small" color={theme.colors.primary} weight="700">
                          View details
                        </Text>
                        <ChevronRight color={theme.colors.primary} size={14} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {task.isRecurring && (
                      <RefreshCw color={theme.colors.primary} size={16} />
                    )}
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showTemplateMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTemplateMenu(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setShowTemplateMenu(false)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => {
                setShowTemplateMenu(false);
                setActiveTab(0);
              }}
            >
              <Text variant="body" weight="600">
                Tasks
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => {
                setShowTemplateMenu(false);
                setActiveTab(1);
              }}
            >
              <Text variant="body" weight="600">
                Recurring Templates
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!selectedTask}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedTask(null)}
          />
          {selectedTask && (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text variant="h3" style={{ flex: 1 }}>
                  Task Details
                </Text>
                {canManageTasks && (
                  <TouchableOpacity
                    style={styles.modalEditButton}
                    onPress={() => {
                      setSelectedTask(null);
                      navigation.navigate("CreateItem", {
                        title: "Edit Task",
                        type: "Task",
                        initialData: selectedTask,
                      });
                    }}
                  >
                    <Text variant="small" weight="600" color={theme.colors.primary}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 350 }}
                contentContainerStyle={{ paddingBottom: theme.spacing.md }}
              >
                <Text variant="small" color={theme.colors.textSecondary}>
                  Title
                </Text>
                <Text variant="body" weight="700" style={styles.modalValue}>
                  {selectedTask?.title || "Untitled task"}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Description
                </Text>
                <Text variant="body" style={styles.modalValue}>
                  {selectedTask?.description || "No description provided."}
                </Text>

                {Array.isArray(selectedTask?.checklistItems) &&
                selectedTask.checklistItems.length > 0 ? (
                  <>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      Checklist
                    </Text>
                    <View style={{ marginTop: 6, marginBottom: 10 }}>
                      {selectedTask.checklistItems.map((item, idx) => (
                        <Text key={`task-check-${idx}`} variant="body">
                          {`${idx + 1}. ${item}`}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : null}

                {!!(selectedTask?.assigneeName || selectedTask?.assignedUserName) && (
                  <>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      Assignee
                    </Text>
                    <Text variant="body" style={styles.modalValue}>
                      {selectedTask?.assigneeName ||
                        selectedTask?.assignedUserName ||
                        "Unassigned"}
                    </Text>
                  </>
                )}

                <Text variant="small" color={theme.colors.textSecondary}>
                  Date & Time
                </Text>
                <Text variant="body" style={styles.modalValue}>
                  {formatTaskDateTimeLabel(selectedTask)}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Status
                </Text>
                <Text variant="body" style={styles.modalValue}>
                  {String(selectedTask?.status || "pending")
                    .trim()
                    .toLowerCase() === "completed"
                    ? "Completed"
                    : "Upcoming"}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Assignment
                </Text>
                <Text variant="body" style={styles.modalValue}>
                  {selectedTask?.openToAll
                    ? "Open to all"
                    : selectedTask?.assignedGroupName ||
                    selectedTask?.assignedGroupId ||
                    "No group assigned"}
                </Text>

                {Array.isArray(selectedTask?.checklistItems) && selectedTask.checklistItems.length > 0 && (
                  <>
                    <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 4 }}>
                      Checklist
                    </Text>
                    {selectedTask.checklistItems.map((item, idx) => (
                      <View key={`detail-check-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <CheckSquare size={16} color={theme.colors.primary} />
                        <Text variant="body" style={{ marginLeft: 8 }}>{item}</Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="Close"
                  variant="outline"
                  size="small"
                  onPress={() => setSelectedTask(null)}
                  style={styles.modalBtn}
                />
                <Button
                  title={
                    String(selectedTask?.status || "pending")
                      .trim()
                      .toLowerCase() === "completed"
                      ? "Mark Upcoming"
                      : "Mark Completed"
                  }
                  size="small"
                  onPress={() => selectedTask && toggleTaskStatus(selectedTask)}
                  style={styles.modalBtn}
                  disabled={!canUpdateTask(selectedTask)}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>

      <FloatingTabBar navigation={navigation} activeScreen="More" />
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  menuButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  avatarContainer: {
    marginLeft: 8,
  },
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
  myTasksToggle: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  segmentContainer: {
    marginBottom: theme.spacing.md,
  },
  segmentLabel: {
    marginBottom: theme.spacing.xs,
  },
  taskCard: {
    marginBottom: theme.spacing.sm,
  },
  emptyCard: {
    marginBottom: theme.spacing.sm,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    marginRight: theme.spacing.md,
  },
  taskInfo: {
    flex: 1,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewTaskBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalEditButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: "rgba(16, 139, 81, 0.08)",
    borderRadius: theme.radius.md,
  },
  modalValue: {
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  modalActions: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  modalBtn: {
    flex: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  menuSheet: {
    position: "absolute",
    left: theme.spacing.md,
    top: 100,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  templateMenuContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  templateMenuButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: "rgba(16, 139, 81, 0.08)",
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  templateActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  templateActionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  templateActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },
});
