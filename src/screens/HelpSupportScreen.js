import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  LifeBuoy,
  Mail,
  MessageCircle,
  ExternalLink,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { theme } from "../theme/theme";

const SUPPORT_EMAIL = "support@greensports.app";

const SupportRow = ({ icon, title, subtitle, onPress, isLast = false }) => (
  <TouchableOpacity
    style={[styles.row, !isLast && styles.rowBorder]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={styles.rowLeft}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.rowTextWrap}>
        <Text variant="h4">{title}</Text>
        <Text variant="small" color={theme.colors.textSecondary}>
          {subtitle}
        </Text>
      </View>
    </View>
    <ExternalLink color={theme.colors.textSecondary} size={18} />
  </TouchableOpacity>
);

export default function HelpSupportScreen({ navigation }) {
  const openUrl = async (url, fallbackMessage) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert("Unavailable", fallbackMessage);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", fallbackMessage);
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent("GreenSports Support Request");
    const body = encodeURIComponent(
      "Hi Support Team,\n\nPlease help me with:\n\n",
    );
    openUrl(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
      "Could not open your email app.",
    );
  };

  const openWhatsApp = () => {
    openUrl(
      "https://wa.me/61400000000",
      "Could not open WhatsApp. You can contact support by email.",
    );
  };

  const openDocs = () => {
    openUrl(
      "https://greensports.app/help",
      "Could not open help center in browser.",
    );
  };

  const reportBug = () => {
    const subject = encodeURIComponent("Bug Report - GreenSports");
    const body = encodeURIComponent(
      "Please describe the issue:\n\nSteps to reproduce:\n1)\n2)\n3)\n\nExpected:\nActual:\n",
    );
    openUrl(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
      "Could not open email app to report bug.",
    );
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
        <Text variant="h3">Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIconWrap}>
              <LifeBuoy color={theme.colors.primary} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">Need help?</Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: 4 }}
              >
                Contact support or browse quick help resources.
              </Text>
            </View>
          </View>
          <Button
            title="Report A Bug"
            onPress={reportBug}
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        <Card noPadding style={styles.card}>
          <SupportRow
            icon={<Mail color={theme.colors.primary} size={18} />}
            title="Email Support"
            subtitle={SUPPORT_EMAIL}
            onPress={openEmail}
          />
          <SupportRow
            icon={<MessageCircle color={theme.colors.primary} size={18} />}
            title="WhatsApp Support"
            subtitle="Chat with support team"
            onPress={openWhatsApp}
          />
          <SupportRow
            icon={<ExternalLink color={theme.colors.primary} size={18} />}
            title="Help Center"
            subtitle="Open guides and FAQs"
            onPress={openDocs}
            isLast
          />
        </Card>

        <Text
          variant="small"
          color={theme.colors.textSecondary}
          style={styles.footnote}
        >
          Support availability may vary by timezone.
        </Text>
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
    paddingBottom: 120,
  },
  heroCard: {
    marginBottom: theme.spacing.md,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    marginRight: 10,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  rowTextWrap: {
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    marginRight: 10,
  },
  footnote: {
    textAlign: "center",
    marginTop: 2,
  },
});
