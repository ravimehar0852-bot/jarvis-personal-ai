// Paste your Firebase web app config here (Firebase Console > Project settings > Your apps).
// This config is public by design; security comes from Firestore rules.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};
export const CONFIGURED = !firebaseConfig.apiKey.startsWith("PASTE");
