import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Wrench,
  Phone,
  Mail,
  Search,
  FileText,
  Plus,
  ChevronRight,
  ClipboardList,
  MessageSquareText,
  Trash2,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { FAB } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import {
  subscribeToTrades,
  deleteTrade,
  addTradeEmailTemplate,
  addTradeServiceLogEntry,
} from "../../services/managementService";

export default function TradesScreen({ navigation }) {
  const { activeClubId, userRole } = useClub();
  const { user } = useAuth();
  const isAdmin = userRole === "Owner" || userRole === "Admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    if (!activeClubId) return;
    const unsub = subscribeToTrades(activeClubId, setTrades);
    return () => unsub();
  }, [activeClubId]);

  const filteredTrades = trades.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert(
        "No Phone",
        "This supplier does not have a phone number yet.",
      );
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email) => {
    if (!email) {
      Alert.alert(
        "No Email",
        "This supplier does not have an email address yet.",
      );
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  const handleSendTemplate = (trade) => {
    const templates = trade.emailTemplates || [];
    if (!templates.length) {
      Alert.alert("No Templates", "Create an email template first.");
      return;
    }
    if (!trade.email) {
      Alert.alert(
        "No Email",
        "This supplier does not have an email address yet.",
      );
      return;
    }

    const buttons = templates.slice(0, 8).map((template) => ({
      text: template.title || "Untitled",
      onPress: async () => {
        const subject = encodeURIComponent(
          template.subject || "Supplier Update",
        );
        const body = encodeURIComponent(template.body || "");
        const url = `mailto:${trade.email}?subject=${subject}&body=${body}`;
        try {
          await Linking.openURL(url);
        } catch {
          Alert.alert("Error", "Unable to open mail app right now.");
        }
      },
    }));
    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Send Email Template", "Choose a template:", buttons);
  };

  const handleAddTrade = () => {
    navigation.navigate("CreateItem", {
      title: "Add Trade/Supplier",
      type: "Trade",
    });
  };

  const handleDeleteTrade = (trade) => {
    if (!isAdmin || !activeClubId) return;
    Alert.alert(
      "Delete Supplier",
      `Delete ${trade.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrade(activeClubId, trade.id);
            } catch {
              Alert.alert("Error", "Could not delete supplier.");
            }
          },
        },
      ],
    );
  };

  const openTemplates = (trade) => {
    const templates = trade.emailTemplates || [];
    const summary = templates.length
      ? templates
          .map(
            (t, i) => `${i + 1}. ${t.title || "Untitled"} - ${t.subject || ""}`,
          )
          .join("\n")
      : "No templates yet.";

    Alert.alert(
      `${trade.name} Templates`,
      summary,
      [
        { text: "Close", style: "cancel" },
        isAdmin
          ? {
              text: "Add Template",
              onPress: () => {
                Alert.prompt(
                  "Template Title",
                  "Enter a template title:",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Next",
                      onPress: (title) => {
                        const templateTitle = (title || "").trim();
                        if (!templateTitle) return;
                        Alert.prompt(
                          "Email Subject",
                          "Enter subject line:",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Save",
                              onPress: async (subject) => {
                                const emailSubject = (subject || "").trim();
                                try {
                                  await addTradeEmailTemplate(
                                    activeClubId,
                                    trade.id,
                                    {
                                      title: templateTitle,
                                      subject: emailSubject,
                                      body: `${templateTitle}\n\n`,
                                      createdBy: user?.uid || "",
                                    },
                                  );
                                  Alert.alert(
                                    "Saved",
                                    "Email template created.",
                                  );
                                } catch {
                                  Alert.alert(
                                    "Error",
                                    "Could not save email template.",
                                  );
                                }
                              },
                            },
                          ],
                          "plain-text",
                        );
                      },
                    },
                  ],
                  "plain-text",
                );
              },
            }
          : undefined,
      ].filter(Boolean),
    );
  };

  const openServiceLog = (trade) => {
    const entries = trade.serviceLog || [];
    const summary = entries.length
      ? entries
          .slice(-5)
          .reverse()
          .map(
            (e) =>
              `${e.date || "Date?"} - ${e.note || ""}${e.cost ? ` ($${e.cost})` : ""}`,
          )
          .join("\n")
      : "No service entries yet.";

    Alert.alert(
      `${trade.name} Service Log`,
      summary,
      [
        { text: "Close", style: "cancel" },
        isAdmin
          ? {
              text: "Add Entry",
              onPress: () => {
                Alert.prompt(
                  "Service Date",
                  "Enter date (e.g. 2026-03-14):",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Next",
                      onPress: (date) => {
                        const serviceDate = (date || "").trim();
                        if (!serviceDate) return;
                        Alert.prompt(
                          "Service Note",
                          "What was done?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Next",
                              onPress: async (note) => {
                                const serviceNote = (note || "").trim();
                                if (!serviceNote) return;
                                Alert.prompt(
                                  "Cost (Optional)",
                                  "Enter cost amount (e.g. 250):",
                                  [
                                    {
                                      text: "Skip",
                                      style: "cancel",
                                      onPress: async () => {
                                        try {
                                          await addTradeServiceLogEntry(
                                            activeClubId,
                                            trade.id,
                                            {
                                              date: serviceDate,
                                              note: serviceNote,
                                              cost: "",
                                              createdBy: user?.uid || "",
                                            },
                                          );
                                          Alert.alert(
                                            "Saved",
                                            "Service log entry added.",
                                          );
                                        } catch {
                                          Alert.alert(
                                            "Error",
                                            "Could not add service log entry.",
                                          );
                                        }
                                      },
                                    },
                                    {
                                      text: "Save",
                                      onPress: async (cost) => {
                                        try {
                                          await addTradeServiceLogEntry(
                                            activeClubId,
                                            trade.id,
                                            {
                                              date: serviceDate,
                                              note: serviceNote,
                                              cost: (cost || "").trim(),
                                              createdBy: user?.uid || "",
                                            },
                                          );
                                          Alert.alert(
                                            "Saved",
                                            "Service log entry added.",
                                          );
                                        } catch {
                                          Alert.alert(
                                            "Error",
                                            "Could not add service log entry.",
                                          );
                                        }
                                      },
                                    },
                                  ],
                                  "plain-text",
                                );
                              },
                            },
                          ],
                          "plain-text",
                        );
                      },
                    },
                  ],
                  "plain-text",
                );
              },
            }
          : undefined,
      ].filter(Boolean),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h2">Trades & Suppliers</Text>
        <Text variant="small" style={{ marginTop: 2 }}>
          Club maintenance directory
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color={theme.colors.textSecondary} size={20} />
          <TextInput
            placeholder="Search plumbers, electricians..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredTrades.map((trade) => (
          <Card key={trade.id} style={styles.tradeCard}>
            <View style={styles.tradeHeader}>
              <View style={styles.iconBox}>
                <Wrench color={theme.colors.primary} size={20} />
              </View>
              <View style={styles.tradeInfo}>
                <Text variant="h4">{trade.name}</Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {trade.category}
                </Text>
              </View>
            </View>

            <View style={styles.tradeDivider} />

            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleCall(trade.phone)}
              >
                <Phone color={theme.colors.primary} size={18} />
                <Text
                  variant="body"
                  weight="600"
                  color={theme.colors.primary}
                  style={{ marginLeft: 6 }}
                >
                  Call
                </Text>
              </TouchableOpacity>
              <View style={styles.dividerVertical} />
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => handleEmail(trade.email)}
              >
                <Mail color={theme.colors.primary} size={18} />
                <Text
                  variant="body"
                  weight="600"
                  color={theme.colors.primary}
                  style={{ marginLeft: 6 }}
                >
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.serviceLog}>
              <FileText color={theme.colors.textSecondary} size={14} />
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginLeft: 6 }}
              >
                Last service: {trade.lastService || "Not recorded"}
              </Text>
            </View>

            <View style={styles.tradeDivider} />

            <View style={styles.manageRow}>
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => openServiceLog(trade)}
              >
                <ClipboardList color={theme.colors.primary} size={16} />
                <Text
                  variant="small"
                  weight="600"
                  color={theme.colors.primary}
                  style={{ marginLeft: 6 }}
                >
                  Service Log ({(trade.serviceLog || []).length})
                </Text>
                <ChevronRight
                  color={theme.colors.border}
                  size={16}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => openTemplates(trade)}
              >
                <MessageSquareText color={theme.colors.primary} size={16} />
                <Text
                  variant="small"
                  weight="600"
                  color={theme.colors.primary}
                  style={{ marginLeft: 6 }}
                >
                  Email Templates ({(trade.emailTemplates || []).length})
                </Text>
                <ChevronRight
                  color={theme.colors.border}
                  size={16}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => handleSendTemplate(trade)}
              >
                <Mail color={theme.colors.primary} size={16} />
                <Text
                  variant="small"
                  weight="600"
                  color={theme.colors.primary}
                  style={{ marginLeft: 6 }}
                >
                  Send Template Email
                </Text>
                <ChevronRight
                  color={theme.colors.border}
                  size={16}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => handleDeleteTrade(trade)}
                >
                  <Trash2 color={theme.colors.error} size={16} />
                  <Text
                    variant="small"
                    weight="600"
                    color={theme.colors.error}
                    style={{ marginLeft: 6 }}
                  >
                    Delete Supplier
                  </Text>
                  <ChevronRight
                    color={theme.colors.border}
                    size={16}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ))}
        {filteredTrades.length === 0 && (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Wrench color={theme.colors.border} size={48} />
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ textAlign: "center", marginTop: theme.spacing.md }}
            >
              {searchQuery
                ? "No trades match your search"
                : "No trades or suppliers added yet"}
            </Text>
          </View>
        )}
      </ScrollView>

      {isAdmin && (
        <FAB
          icon={<Plus color={theme.colors.white} size={24} />}
          onPress={handleAddTrade}
        />
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  searchContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  tradeCard: {
    marginBottom: theme.spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  tradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(16, 139, 81, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  tradeInfo: {
    marginLeft: theme.spacing.md,
  },
  tradeDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  dividerVertical: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
  serviceLog: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  manageRow: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.xs,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
