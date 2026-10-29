// Verifies the Firebase ID token with Google's REST API (no extra dependencies).
export async function verifyUser(req) {
  const fbKey = (process.env.FIREBASE_API_KEY || "").trim();
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!fbKey) return { status: 503, error: "Server not configured: FIREBASE_API_KEY missing in Vercel." };
  if (!token) return { status: 401, error: "Please log in." };
  try {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(fbKey), {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://" + (req.headers.host || "localhost") + "/" },
      body: JSON.stringify({ idToken: token }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const why = String(j.error?.message || r.status).slice(0, 120);
      return { status: 401, error: "Login verification failed: " + why };
    }
    return { ok: true };
  } catch {
    return { status: 502, error: "Could not reach Google to verify login." };
  }
}
