import { Alert, Platform, ToastAndroid } from "react-native";

export const showToast = (message, title = "Info") => {
  const text = String(message || "").trim();
  if (!text) return;

  if (Platform.OS === "android") {
    ToastAndroid.show(text, ToastAndroid.SHORT);
    return;
  }

  Alert.alert(title, text);
};
