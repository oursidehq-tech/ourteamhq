import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";

const STORAGE_ENABLED =
  (process.env.EXPO_PUBLIC_ENABLE_STORAGE || "true").toLowerCase() !== "false";
const IMAGE_PROVIDER = (process.env.EXPO_PUBLIC_IMAGE_PROVIDER || "cloudinary")
  .toString()
  .toLowerCase();
const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "dhb2yiyza";
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "greensports_uploads";

const hasCloudinaryConfig =
  !!CLOUDINARY_CLOUD_NAME && !!CLOUDINARY_UPLOAD_PRESET;

const deriveFolderFromPath = (path) => {
  const idx = (path || "").lastIndexOf("/");
  if (idx <= 0) return "greensports";
  return path.slice(0, idx);
};

const deriveFileName = (uri, fallback = "upload.jpg") => {
  const cleanUri = (uri || "").split("?")[0];
  const idx = cleanUri.lastIndexOf("/");
  if (idx < 0 || idx === cleanUri.length - 1) return fallback;
  return cleanUri.slice(idx + 1);
};

const uploadToCloudinary = async (uri, path) => {
  if (!hasCloudinaryConfig) {
    throw new Error(
      "Cloudinary upload requires EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: deriveFileName(uri),
    type: "image/jpeg",
  });
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", deriveFolderFromPath(path));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const payload = await response.json();
  if (!response.ok || !payload?.secure_url) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      "Unknown Cloudinary upload error.";
    throw new Error(`Cloudinary upload failed for ${path}: ${message}`);
  }

  return payload.secure_url;
};

const uriToBlob = async (uri) => {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fall back to XHR for older Android content URIs
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () =>
      reject(new Error("Failed to read local file for upload."));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

const wrapStorageError = (error, path) => {
  const raw =
    error?.customData?.serverResponse ||
    error?.serverResponse ||
    error?.message ||
    "Unknown storage error";

  const code = error?.code || "storage/unknown";
  const wrapped = new Error(
    `Storage upload failed for ${path}: ${raw} (${code})`,
  );
  wrapped.code = error?.code || "storage/unknown";
  wrapped.cause = error;
  return wrapped;
};

export const uploadImage = async (uri, path) => {
  if (!storage) {
    throw new Error("Storage is not initialized. Check Firebase config.");
  }
  const shouldUseCloudinary = IMAGE_PROVIDER === "cloudinary";

  if (shouldUseCloudinary) {
    if (hasCloudinaryConfig) {
      return uploadToCloudinary(uri, path);
    }
    if (!STORAGE_ENABLED) {
      console.warn(
        "Cloudinary selected but not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
      );
      return "";
    }
    console.warn(
      "Cloudinary selected but missing config, falling back to Firebase Storage.",
    );
  }

  if (!STORAGE_ENABLED) {
    if (hasCloudinaryConfig) {
      return uploadToCloudinary(uri, path);
    }
    console.warn(
      "Storage upload skipped: Firebase Storage disabled and Cloudinary not configured.",
    );
    return "";
  }

  const blob = await uriToBlob(uri);
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType: blob?.type || "image/jpeg",
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      null,
      (error) => reject(wrapStorageError(error, path)),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadUrl);
      },
    );
    uploadTask.then(
      () => {
        if (blob && typeof blob.close === "function") blob.close();
      },
      () => {
        if (blob && typeof blob.close === "function") blob.close();
      },
    );
  });
};

export const uploadClubLogo = (clubId, uri) =>
  uploadImage(uri, `clubs/${clubId}/logo_${Date.now()}.jpg`);

export const uploadClubBanner = (clubId, uri) =>
  uploadImage(uri, `clubs/${clubId}/banner_${Date.now()}.jpg`);

export const uploadPostImage = (clubId, postId, uri) =>
  uploadImage(uri, `clubs/${clubId}/posts/${postId}_${Date.now()}.jpg`);

export const uploadProductImage = (clubId, productId, uri) =>
  uploadImage(uri, `clubs/${clubId}/products/${productId}_${Date.now()}.jpg`);

export const uploadDrillImage = (clubId, drillId, uri) =>
  uploadImage(uri, `clubs/${clubId}/drills/${drillId}_${Date.now()}.jpg`);

export const uploadAvatar = (userId, uri) =>
  uploadImage(uri, `users/${userId}/avatar_${Date.now()}.jpg`);
