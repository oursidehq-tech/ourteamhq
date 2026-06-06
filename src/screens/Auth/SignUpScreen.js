import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mail,
  Lock,
  User,
  Phone,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { theme } from "../../theme/theme";
import { signUp } from "../../services/authService";
import { showToast } from "../../utils/toast";

export default function SignUpScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(0);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roles = ["Player", "Coach", "Parent", "Club Owner"];
  const handleNext = () => {
    if (!fullName || !email || !password) {
      showToast("Please fill in basic details", "Error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "Error");
      return;
    }
    setStep(2);
  };

  const handleSignUp = async () => {
    const isClubOwner = roles[selectedRole] === "Club Owner";
    setLoading(true);

    try {
      if (isClubOwner) {
        // Create user without club — AppNavigator will detect no clubs and route to ClubOnboarding
        await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
          role: "Owner",
          clubId: null,
          teamIds: [],
        });
        showToast("Account created. Continue club setup.");
        // Auth state listener + AppNavigator handles navigation to ClubOnboarding
      } else {
        // Create member account without club membership.
        // AppNavigator routes no-club members to the separate JoinClub screen.
        await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
          role: roles[selectedRole],
          clubId: null,
          teamIds: [],
        });
        showToast("Account created successfully.");
        // Auth state listener handles navigation
      }
    } catch (error) {
      console.error("Sign up error:", error.code, error.message);
      let message = "Sign up failed. Please try again.";
      const debugCode = error?.code ? ` (${error.code})` : "";
      if (error.code === "auth/email-already-in-use") {
        message = "This email is already registered. Try signing in.";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak. Use at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/network-request-failed") {
        message =
          "Network error. Please check your internet connection and try again.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait a moment and try again.";
      } else if (error.code === "auth/configuration-not-found") {
        message =
          "Firebase Auth is not configured for this project. In Firebase Console, enable Authentication and Email/Password sign-in, then restart Expo with: npx expo start --clear";
      } else if (
        String(error?.message || "").includes(
          "Firebase is not configured correctly",
        )
      ) {
        message =
          "App config missing in this APK build. Install latest APK from EAS build link.";
      }
      Alert.alert("Sign Up Failed", message);
      showToast(`${message}${debugCode}`, "Sign Up Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <UserPlus size={48} color={theme.colors.primary} />
            </View>
            <Text variant="h1" style={styles.title}>
              Create Account
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={styles.subtitle}
            >
              Join OurTeamHQ and manage your club
            </Text>
          </View>

          <View style={styles.formContainer}>
            {step === 1 ? (
              <>
                <View style={styles.inputContainer}>
                  <User
                    color={theme.colors.textSecondary}
                    size={20}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Mail
                    color={theme.colors.textSecondary}
                    size={20}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Lock
                    color={theme.colors.textSecondary}
                    size={20}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOff color={theme.colors.textSecondary} size={20} />
                    ) : (
                      <Eye color={theme.colors.textSecondary} size={20} />
                    )}
                  </TouchableOpacity>
                </View>

                <Button
                  title="Next"
                  onPress={handleNext}
                  style={styles.signUpButton}
                />
              </>
            ) : (
              <>
                <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
                  Select Your Role
                </Text>
                <SegmentedControl
                  options={roles}
                  selectedIndex={selectedRole}
                  onChange={setSelectedRole}
                />

                <View style={{ marginTop: theme.spacing.xl }}>
                  <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
                    {roles[selectedRole] === "Club Owner"
                      ? "Create Your Club"
                      : "Create Member Account"}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginBottom: theme.spacing.md }}
                  >
                    {roles[selectedRole] === "Club Owner"
                      ? "You will set up your club and subscription on the next screen."
                      : "After account creation, you will join your club on the separate Join Club screen using a 6-digit code."}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: theme.spacing.lg,
                    marginBottom: theme.spacing.xl,
                  }}
                >
                  <Button
                    title="Back"
                    variant="outline"
                    onPress={() => setStep(1)}
                    style={{ flex: 1, marginRight: theme.spacing.sm }}
                    disabled={loading}
                  />
                  <Button
                    title={
                      loading
                        ? "Creating..."
                        : roles[selectedRole] === "Club Owner"
                          ? "Next: Setup Club"
                          : "Create Account"
                    }
                    onPress={handleSignUp}
                    style={{ flex: 2, marginLeft: theme.spacing.sm }}
                    disabled={loading}
                  />
                </View>
              </>
            )}

            <View style={styles.footer}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text variant="body" color={theme.colors.primary} weight="600">
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl * 1.5,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  title: {
    marginBottom: theme.spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  eyeButton: {
    marginLeft: theme.spacing.sm,
    padding: 4,
  },
  signUpButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
