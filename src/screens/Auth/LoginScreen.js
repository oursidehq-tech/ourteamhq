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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, KeyRound, Eye, EyeOff } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { signIn, resetPassword } from "../../services/authService";
import { showToast } from "../../utils/toast";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showToast("Please fill in all fields", "Error");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      showToast("Login successful");
      // Auth state listener in AuthContext will handle navigation
    } catch (error) {
      let message = "Login failed. Please try again.";
      const debugCode = error?.code ? ` (${error.code})` : "";
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        message = "Invalid email or password.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later.";
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
      Alert.alert("Login Failed", message);
      showToast(`${message}${debugCode}`, "Login Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showToast("Enter your email first", "Reset Password");
      return;
    }
    try {
      await resetPassword(email.trim());
      showToast("Password reset email sent");
      Alert.alert(
        "Password Reset",
        "A password reset email has been sent to your inbox.",
      );
    } catch (error) {
      showToast("Could not send reset email", "Error");
      Alert.alert(
        "Error",
        "Could not send reset email. Check your email address.",
      );
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
              <KeyRound size={48} color={theme.colors.primary} />
            </View>
            <Text variant="h1" style={styles.title}>
              Welcome Back
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={styles.subtitle}
            >
              Sign in to continue to OurTeamHQ
            </Text>
          </View>

          <View style={styles.formContainer}>
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

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <Text variant="small" color={theme.colors.primary} weight="600">
                Forgot Password?
              </Text>
            </TouchableOpacity>

            <Button
              title={loading ? "Signing In..." : "Sign In"}
              onPress={handleLogin}
              style={styles.loginButton}
              disabled={loading}
            />

            <View style={styles.footer}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                <Text variant="body" color={theme.colors.primary} weight="600">
                  Sign Up
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: theme.spacing.xl,
  },
  loginButton: {
    marginBottom: theme.spacing.xl,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
