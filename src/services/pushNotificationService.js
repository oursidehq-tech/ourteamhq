import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === "web") {
    return { status: "unavailable", token: "" };
  }

  if (!Device.isDevice) {
    return { status: "unavailable", token: "" };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return { status: finalStatus, token: "" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  return { status: finalStatus, token: tokenResponse.data || "" };
};

export const sendPushNotification = async ({
  expoPushToken,
  title,
  body,
  data = {},
}) => {
  if (!expoPushToken) return null;

  const payload = {
    to: expoPushToken,
    sound: "default",
    title: title || "Notification",
    body: body || "",
    data,
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
};
