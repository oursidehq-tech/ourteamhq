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
   * Uploads a file to Firebase Storage
   * @param {File} file - The file to upload
   * @param {string} path - The path in storage (e.g., 'drills/videos/')
   */
  async uploadFile(file, path) {
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `${path}${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      url: downloadURL,
      path: snapshot.ref.fullPath,
      name: file.name
    };
  },

  async deleteFile(filePath) {
    const storageRef = ref(storage, filePath);
    return await deleteObject(storageRef);
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
