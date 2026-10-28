// Verifies the Firebase ID token with Google's REST API (no extra dependencies).
export async function verifyUser(req) {
  const fbKey = process.env.FIREBASE_API_KEY;
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!fbKey) return { status: 503, error: "Server not configured: FIREBASE_API_KEY missing." };
  if (!token) return { status: 401, error: "Please log in." };
  try {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + fbKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!r.ok) return { status: 401, error: "Session expired. Please log in again." };
    return { ok: true };
  } catch {
    return { status: 502, error: "Could not verify login." };
  }
}
