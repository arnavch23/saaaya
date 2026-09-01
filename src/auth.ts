export type AdministratorProfile = { name: string; role: "Municipal Administrator" };

const sessionKey = "saaya.prototype.municipal-session";

const readSession = (): AdministratorProfile | null => {
  try {
    const saved = window.localStorage.getItem(sessionKey) ?? window.sessionStorage.getItem(sessionKey);
    return saved ? JSON.parse(saved) as AdministratorProfile : null;
  } catch { return null; }
};

// Adapter boundary for a future municipal identity provider or API.
// This local prototype only validates that internal identifiers and a password were supplied.
export const authStore = {
  restore: readSession,
  signIn: (municipalId: string, adminId: string, password: string, remember = true): AdministratorProfile | null => {
    if (!municipalId.trim() || !adminId.trim() || !password) return null;
    const profile: AdministratorProfile = { name: "Municipal Administrator", role: "Municipal Administrator" };
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(sessionKey, JSON.stringify(profile));
    return profile;
  },
  signOut: () => { window.localStorage.removeItem(sessionKey); window.sessionStorage.removeItem(sessionKey); },
};
