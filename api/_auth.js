// api/_auth.js
// Verify Firebase ID tokens using Google's Identity Toolkit API.

export async function verifyUser(req) {
  const fbKey = process.env.FIREBASE_API_KEY;

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";

  if (!fbKey) {
    return {
      ok: false,
      status: 503,
      error: "Server configuration error: FIREBASE_API_KEY is missing in Vercel."
    };
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Please log in to JARVIS again."
    };
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idToken: token
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(result.users) || !result.users.length) {
      return {
        ok: false,
        status: 401,
        error: "Login verification failed. Log out and log in again."
      };
    }

    return {
      ok: true,
      uid: result.users[0].localId,
      email: result.users[0].email || null
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Could not connect to Firebase for login verification."
    };
  }
}
