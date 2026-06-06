// Polyfill to fix "Cannot assign to property 'protocol' which has only a getter"
// This issue occurs in RN 0.81+ where the native URL implementation has read-only properties.
// Expo's internal getManifestBaseUrl tries to assign to protocol/hostname/pathname.

if (typeof globalThis !== 'undefined' && globalThis.URL) {
  const OriginalURL = globalThis.URL;
  
  class PatchedURL {
    constructor(input, base) {
      const url = new OriginalURL(input, base);
      // Copy all readable properties to make them writable
      this._url = url;
      this.hash = url.hash;
      this.host = url.host;
      this.hostname = url.hostname;
      this.href = url.href;
      this.origin = url.origin;
      this.password = url.password;
      this.pathname = url.pathname;
      this.port = url.port;
      this.protocol = url.protocol;
      this.search = url.search;
      this.searchParams = url.searchParams;
      this.username = url.username;
    }
    
    toString() {
      return this.href;
    }
    
    toJSON() {
      return this.href;
    }

    static createObjectURL(blob) {
      return OriginalURL.createObjectURL(blob);
    }

    static revokeObjectURL(url) {
      return OriginalURL.revokeObjectURL(url);
    }

    static canParse(url, base) {
      if (OriginalURL.canParse) {
        return OriginalURL.canParse(url, base);
      }
      try {
        new OriginalURL(url, base);
        return true;
      } catch {
        return false;
      }
    }
  }

  globalThis.URL = PatchedURL;
}
