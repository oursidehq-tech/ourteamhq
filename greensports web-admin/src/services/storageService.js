import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from '../config/firebase';

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dhb2yiyza';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'greensports_uploads';

export const storageService = {
  /**
   * Helper to convert File object to Base64 Data URL
   */
  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Upload using Cloudinary unsigned preset with live progress tracking & abort capability.
   */
  uploadToCloudinary(file, path, { onProgress, setCancelHandler } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      if (path) {
        formData.append('folder', path.replace(/\/+$/, ''));
      }

      if (setCancelHandler) {
        setCancelHandler(() => {
          xhr.abort();
          const err = new Error('Upload cancelled');
          err.name = 'AbortError';
          reject(err);
        });
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (onProgress) onProgress(100);
            resolve({
              url: data.secure_url || data.url,
              publicId: data.public_id,
              name: file.name,
              provider: 'cloudinary'
            });
          } catch (e) {
            reject(new Error('Invalid response from Cloudinary: ' + e.message));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData?.error?.message || `Cloudinary upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Cloudinary upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
      xhr.onabort = () => {
        const err = new Error('Upload cancelled');
        err.name = 'AbortError';
        reject(err);
      };

      xhr.open('POST', url, true);
      xhr.send(formData);
    });
  },

  /**
   * Upload using Firebase Storage Resumable with live progress tracking & cancel capability.
   */
  uploadToFirebaseResumable(file, path, { onProgress, setCancelHandler } = {}) {
    return new Promise((resolve, reject) => {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, `${path}${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      if (setCancelHandler) {
        setCancelHandler(() => {
          uploadTask.cancel();
          const err = new Error('Upload cancelled');
          err.name = 'AbortError';
          reject(err);
        });
      }

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(percent);
          }
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({
              url: downloadURL,
              path: uploadTask.snapshot.ref.fullPath,
              name: file.name,
              provider: 'firebase'
            });
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  },

  /**
   * Primary upload method with live percentage progress, cancellation token,
   * Cloudinary priority (CORS-immune), Firebase fallback, and Data URL fallback.
   */
  async uploadFileWithProgress(file, path = 'uploads/', { onProgress = () => {}, setCancelHandler = () => {} } = {}) {
    onProgress(5);

    // 1. Try Cloudinary first because Cloudinary allows cross-origin requests from web browsers
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
      try {
        return await this.uploadToCloudinary(file, path, { onProgress, setCancelHandler });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('Cloudinary upload error, attempting Firebase Storage fallback:', err.message);
      }
    }

    // 2. Try Firebase Storage Resumable
    try {
      return await this.uploadToFirebaseResumable(file, path, { onProgress, setCancelHandler });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('Firebase Storage upload error, falling back to Data URL:', err.message);
    }

    // 3. Fallback to Base64 Data URL so user never gets stuck
    onProgress(90);
    const dataUrl = await this.readFileAsDataUrl(file);
    onProgress(100);
    return {
      url: dataUrl,
      path: `${path}${Date.now()}_${file.name}`,
      name: file.name,
      isFallback: true,
      provider: 'dataurl'
    };
  },

  /**
   * Standard upload for backward compatibility
   */
  async uploadFile(file, path) {
    return this.uploadFileWithProgress(file, path);
  },

  async deleteFile(filePath) {
    try {
      const storageRef = ref(storage, filePath);
      return await deleteObject(storageRef);
    } catch (e) {
      console.warn('Could not delete file:', e);
    }
  },

  async listFiles(path) {
    const listRef = ref(storage, path);
    const res = await listAll(listRef);
    return Promise.all(res.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      return {
        name: itemRef.name,
        url: url,
        path: itemRef.fullPath
      };
    }));
  }
};
