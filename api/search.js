import { verifyUser } from "./_auth.js";

// Optional web search using the Brave Search API. Needs BRAVE_API_KEY.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.BRAVE_API_KEY;
  if (!key) return res.status(503).json({ error: "Web search is not set up (BRAVE_API_KEY missing)." });
  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const q = String(req.body?.q ?? "").trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: "Empty query." });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch("https://api.search.brave.com/res/v1/web/search?count=5&q=" + encodeURIComponent(q), {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      signal: ctrl.signal,
    });
    if (!r.ok) return res.status(502).json({ error: `Search provider error (${r.status}).` });
    const j = await r.json();
    const results = (j.web?.results || [])
      .filter((x) => /^https?:\/\//.test(x.url))
      .slice(0, 5)
      .map((x) => ({ title: String(x.title || x.url).slice(0, 150), url: x.url, description: String(x.description || "").replace(/<[^>]*>/g, "").slice(0, 300) }));
    return res.status(200).json({ results });
  } catch {
    return res.status(504).json({ error: "Search timed out or failed." });
  } finally {
    clearTimeout(timer);
  }
}
