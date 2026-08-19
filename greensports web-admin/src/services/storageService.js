import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from '../config/firebase';

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
   * Uploads a file to Firebase Storage with a seamless Base64 fallback if CORS or network fails.
   */
  async uploadFile(file, path) {
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `${path}${fileName}`);
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        name: file.name
      };
    } catch (err) {
      console.warn('Firebase Storage upload failed (possibly CORS/network), falling back to Data URL:', err);
      const dataUrl = await this.readFileAsDataUrl(file);
      return {
        url: dataUrl,
        path: `${path}${fileName}`,
        name: file.name,
        isFallback: true
      };
    }
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
