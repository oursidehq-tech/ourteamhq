import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFxuiuk1aAAxtO4j691zR5PdaeQS4sjqE",
  authDomain: "ourteamhq-fa67d.firebaseapp.com",
  projectId: "ourteamhq-fa67d",
  storageBucket: "ourteamhq-fa67d.firebasestorage.app",
  messagingSenderId: "490117764648",
  appId: "1:490117764648:web:c4fcf1207b3afe48f0471d",
  measurementId: "G-G28XRSNEPL",
};



const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || FALLBACK_FIREBASE_CONFIG.apiKey,
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    FALLBACK_FIREBASE_CONFIG.authDomain,
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    FALLBACK_FIREBASE_CONFIG.projectId,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    FALLBACK_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    FALLBACK_FIREBASE_CONFIG.messagingSenderId,
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || FALLBACK_FIREBASE_CONFIG.appId,
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    FALLBACK_FIREBASE_CONFIG.measurementId,
};

// Warn if critical config is missing (env vars not loaded)
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "Firebase config is missing critical values (apiKey/projectId).",
  );
}

let app = null;
let auth = null;
let db = null;
let storage = null;
let firebaseInitError = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // Handle hot-reload: initializeAuth can only be called once per app instance
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Auth was already initialized (happens during Expo hot reload)
    auth = getAuth(app);
  }

  // Initialize Firestore — use long-polling when env var is set (required for some Android devices/emulators)
  try {
    const forceLongPolling =
      String(process.env.EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING || "")
        .replace(/['"]/g, "")
        .trim()
        .toLowerCase() === "true";

    if (forceLongPolling) {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      });
    } else {
      db = getFirestore(app);
    }
  } catch (e) {
    // Already initialized (Expo hot reload) — reuse existing instance
    db = getFirestore(app);
  }

  storage = getStorage(app);
} catch (e) {
  firebaseInitError = e;
  console.error("Firebase initialization failed:", e);
}

export { app, auth, db, storage, firebaseInitError };
