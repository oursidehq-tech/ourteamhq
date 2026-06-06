import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  CheckCircle2,
  Building,
  CreditCard,
  Settings,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { createClub, updateClub } from "../../services/clubService";
import * as ImagePicker from "expo-image-picker";
import { uploadClubLogo } from "../../services/storageService";

const { width } = Dimensions.get("window");

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$49/mo",
    features: ["Up to 5 Teams", "Basic Reporting", "Email Support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$99/mo",
    features: [
      "Unlimited Teams",
      "Advanced Analytics",
      "Priority Support",
      "Merch Store",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$199/mo",
    features: [
      "Custom Domain",
      "API Access",
      "Dedicated Account Manager",
      "Custom App Branding",
    ],
  },
];

export default function ClubOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logoUri, setLogoUri] = useState(null);

  // Step 1: Club Info
  const [clubName, setClubName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Step 2: Plan
  const [selectedPlan, setSelectedPlan] = useState("growth");

  // Step 3: Admin & Setup
  const [adminName, setAdminName] = useState(profile?.displayName || "");
  const [adminEmail, setAdminEmail] = useState(user?.email || "");
  const [numTeams, setNumTeams] = useState("");
  const [sellsMerchandise, setSellsMerchandise] = useState(null);
  const [needsVolunteerRoster, setNeedsVolunteerRoster] = useState(null);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handleNext = async () => {
    if (step < 3) {
      if (step === 1 && !clubName.trim()) {
        Alert.alert("Required", "Please enter your club name.");
        return;
      }
      setStep(step + 1);
    } else {
      // Finish Onboarding - Create the club in Firebase
      setLoading(true);
      try {
        const createdClub = await createClub({
          name: clubName.trim(),
          description: description.trim(),
          location: location.trim(),
          logoUrl: "",
          bannerUrl: "",
          website: "",
          planType: selectedPlan,
          adminUid: user.uid,
          adminName: adminName.trim() || profile?.displayName || "",
          adminEmail: adminEmail.trim() || user?.email || "",
        });

        if (createdClub?.id) {
          const parsedTeamCount = parseInt((numTeams || "").trim(), 10);
          await updateClub(createdClub.id, {
            onboardingSetup: {
              estimatedTeamCount: Number.isFinite(parsedTeamCount)
                ? parsedTeamCount
                : null,
              sellsMerchandise,
              needsVolunteerRoster,
            },
          });
        }

        if (logoUri && createdClub?.id) {
          try {
            const logoUrl = await uploadClubLogo(createdClub.id, logoUri);
            await updateClub(createdClub.id, { logoUrl });
          } catch (e) {
            // Keep onboarding successful even if Storage is not configured yet.
            console.warn("Logo upload skipped:", e?.code || e?.message || e);
          }
        }

        await refreshProfile();
        // Navigation handled by auth state (user now has club membership)
      } catch (error) {
        Alert.alert(
          "Error",
          error?.message
            ? `Failed to create club: ${error.message}`
            : "Failed to create club. Please try again.",
        );
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const renderStepIndicator = () => {
    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepNodes}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.stepNode, step >= i && styles.stepNodeActive]}
            >
              {i === 1 && (
                <Building
                  size={16}
                  color={
                    step >= i ? theme.colors.white : theme.colors.textSecondary
                  }
                />
              )}
              {i === 2 && (
                <CreditCard
                  size={16}
                  color={
                    step >= i ? theme.colors.white : theme.colors.textSecondary
                  }
                />
              )}
              {i === 3 && (
                <Settings
                  size={16}
                  color={
                    step >= i ? theme.colors.white : theme.colors.textSecondary
                  }
                />
              )}
            </View>
          ))}
        </View>
        <View style={styles.stepLines}>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
        </View>
        <Text
          variant="small"
          weight="600"
          color={theme.colors.primary}
          style={{ marginTop: theme.spacing.md, textAlign: "center" }}
        >
          Step {step} of 3
        </Text>
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.formContainer}>
      <Text variant="h2" style={styles.stepTitle}>
        Basic Club Information
      </Text>
      <Text
        variant="body"
        color={theme.colors.textSecondary}
        style={{ marginBottom: theme.spacing.xl }}
      >
        Let's set up your club's public profile.
      </Text>

      <TouchableOpacity
        style={[
          styles.logoUpload,
          logoUri && { borderColor: theme.colors.success },
        ]}
        onPress={pickLogo}
      >
        <Upload
          color={logoUri ? theme.colors.success : theme.colors.primary}
          size={32}
        />
        <Text
          variant="body"
          weight="600"
          color={logoUri ? theme.colors.success : theme.colors.primary}
          style={{ marginTop: theme.spacing.sm }}
        >
          {logoUri ? "Logo Selected ✓" : "Upload Club Logo"}
        </Text>
      </TouchableOpacity>

      <Text variant="h4" style={styles.label}>
        Club Name
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Easts Tigers FC"
        value={clubName}
        onChangeText={setClubName}
      />

      <Text variant="h4" style={styles.label}>
        Location
      </Text>
      <TextInput
        style={styles.input}
        placeholder="City, Region"
        value={location}
        onChangeText={setLocation}
      />

      <Text variant="h4" style={styles.label}>
        Short Description (About)
      </Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Tell us about your club..."
        multiline
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.formContainer}>
      <Text variant="h2" style={styles.stepTitle}>
        Choose a Subscription Plan
      </Text>
      <Text
        variant="body"
        color={theme.colors.textSecondary}
        style={{ marginBottom: theme.spacing.xl }}
      >
        Unlock the full potential of OurTeamHQ for your club.
      </Text>

      {PLANS.map((plan) => (
        <TouchableOpacity
          key={plan.id}
          onPress={() => setSelectedPlan(plan.id)}
          activeOpacity={0.8}
        >
          <Card
            style={[
              styles.planCard,
              selectedPlan === plan.id && styles.planCardActive,
            ]}
          >
            <View style={styles.planHeader}>
              <View>
                <Text
                  variant="h3"
                  weight="700"
                  color={
                    selectedPlan === plan.id
                      ? theme.colors.primary
                      : theme.colors.text
                  }
                >
                  {plan.name}
                </Text>
                <Text variant="h2" weight="700" style={{ marginTop: 4 }}>
                  {plan.price}
                </Text>
              </View>
              {selectedPlan === plan.id ? (
                <CheckCircle2 color={theme.colors.primary} size={28} />
              ) : (
                <View style={styles.unselectedCircle} />
              )}
            </View>
            <View style={styles.planFeatures}>
              {plan.features.map((feature, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <CheckCircle2 color={theme.colors.textSecondary} size={16} />
                  <Text variant="small" style={{ marginLeft: 8 }}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      <View style={styles.billingNotice}>
        <Text
          variant="small"
          color={theme.colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          Your subscription starts after payment via Stripe. You can cancel at
          any time.
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.formContainer}>
      <Text variant="h2" style={styles.stepTitle}>
        Admin & Setup Questions
      </Text>
      <Text
        variant="body"
        color={theme.colors.textSecondary}
        style={{ marginBottom: theme.spacing.xl }}
      >
        We'll use this to set up your initial templates.
      </Text>

      <Text variant="h4" style={styles.label}>
        Admin Full Name
      </Text>
      <TextInput
        style={styles.input}
        placeholder="John Doe"
        value={adminName}
        onChangeText={setAdminName}
      />

      <Text variant="h4" style={styles.label}>
        Admin Email
      </Text>
      <TextInput
        style={styles.input}
        placeholder="john@example.com"
        keyboardType="email-address"
        value={adminEmail}
        onChangeText={setAdminEmail}
        autoCapitalize="none"
      />

      <Text variant="h4" style={styles.label}>
        Approx. Number of Teams
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 15"
        keyboardType="numeric"
        value={numTeams}
        onChangeText={setNumTeams}
      />

      <View style={styles.togglesContainer}>
        <View style={styles.toggleRow}>
          <Text variant="body">Does club sell merchandise?</Text>
          <View style={styles.toggleButtonsRow}>
            <Button
              title="Yes"
              onPress={() => setSellsMerchandise(true)}
              variant={sellsMerchandise === true ? "primary" : "outline"}
              size="small"
              style={styles.toggleButton}
            />
            <Button
              title="No"
              onPress={() => setSellsMerchandise(false)}
              variant={sellsMerchandise === false ? "primary" : "outline"}
              size="small"
              style={styles.toggleButton}
            />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text variant="body">Need volunteer roster?</Text>
          <View style={styles.toggleButtonsRow}>
            <Button
              title="Yes"
              onPress={() => setNeedsVolunteerRoster(true)}
              variant={needsVolunteerRoster === true ? "primary" : "outline"}
              size="small"
              style={styles.toggleButton}
            />
            <Button
              title="No"
              onPress={() => setNeedsVolunteerRoster(false)}
              variant={needsVolunteerRoster === false ? "primary" : "outline"}
              size="small"
              style={styles.toggleButton}
            />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text variant="h3">Club Onboarding</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(
              insets.bottom + theme.spacing.md,
              theme.spacing.xl,
            ),
          },
        ]}
      >
        <Button
          title={
            loading
              ? "Creating Club..."
              : step === 3
                ? "Complete Setup"
                : "Continue"
          }
          onPress={handleNext}
          style={styles.nextButton}
          disabled={loading}
        />
      </View>
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
  backButton: {
    padding: theme.spacing.xs,
  },
  stepIndicatorContainer: {
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stepNodes: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.2,
    position: "relative",
    zIndex: 2,
  },
  stepNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNodeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepLines: {
    position: "absolute",
    top: 50,
    left: width * 0.2 + 18,
    right: width * 0.2 + 18,
    height: 2,
    flexDirection: "row",
    zIndex: 1,
  },
  stepLine: {
    flex: 1,
    backgroundColor: theme.colors.border,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  formContainer: {
    flex: 1,
  },
  stepTitle: {
    marginBottom: theme.spacing.xs,
  },
  logoUpload: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(16, 139, 81, 0.05)",
    marginBottom: theme.spacing.xl,
  },
  label: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  planCard: {
    borderWidth: 2,
    borderColor: theme.colors.transparent,
    marginBottom: theme.spacing.md,
  },
  planCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(16, 139, 81, 0.03)",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  unselectedCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  planFeatures: {
    gap: theme.spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  billingNotice: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  togglesContainer: {
    marginTop: theme.spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  toggleButtonsRow: {
    flexDirection: "row",
  },
  toggleButton: {
    minWidth: 64,
    marginLeft: 8,
  },
  footer: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  nextButton: {
    width: "100%",
  },
});
