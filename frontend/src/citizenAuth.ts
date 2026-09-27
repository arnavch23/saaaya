export type CitizenProfile = {
  name: string;
  mobile: string;
  email: string;
  locality: string;
  locationPermission: boolean;
  occupation?: string;
  outdoorWorker?: boolean;
  ageGroup?: string;
  language?: string;
  emergencyContact?: string;
};

const sessionKey = "saaya.prototype.citizen-session";
const profileKey = "saaya.prototype.citizen-profile";

function read(key: string) {
  try { const value = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; }
}

export const citizenStore = {
  restore: (): CitizenProfile | null => read(sessionKey) as CitizenProfile | null,
  register: (profile: CitizenProfile) => { window.localStorage.setItem(profileKey, JSON.stringify(profile)); window.localStorage.setItem(sessionKey, JSON.stringify(profile)); return profile; },
  signIn: (identity: string, password: string): CitizenProfile | null => {
    if (!identity.trim() || !password) return null;
    const saved = read(profileKey) as CitizenProfile | null;
    const profile = saved && (saved.email === identity.trim() || saved.mobile === identity.trim()) ? saved : { name: "Pune Resident", mobile: identity.includes("@") ? "Not provided" : identity, email: identity.includes("@") ? identity : "Not provided", locality: "Shivajinagar", locationPermission: false, language: "English" };
    window.localStorage.setItem(sessionKey, JSON.stringify(profile)); return profile;
  },
  update: (profile: CitizenProfile) => { window.localStorage.setItem(profileKey, JSON.stringify(profile)); window.localStorage.setItem(sessionKey, JSON.stringify(profile)); return profile; },
  signOut: () => { window.localStorage.removeItem(sessionKey); window.sessionStorage.removeItem(sessionKey); },
};
