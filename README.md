# JARVIS AI – Android-only setup (no computer needed)

Real app: Gemini chat (via Vercel backend), Firebase login, Firestore history, memories, notes, reminders, voice, optional web search.
**Not tested by the author's tooling in a live deployment – follow the checklist at the end.**

## 1. Put the files on GitHub (phone browser)
1. github.com > sign in > **+ > New repository** > name `jarvis-personal-ai` > Create.
2. **Add file > Create new file**. In the name box type the exact path, e.g. `api/chat.js` (typing `/` makes the folder). Paste the code, tap **Commit changes**.
3. Repeat for: `index.html`, `styles.css`, `app.js`, `firebase-config.js`, `package.json`, `vercel.json`, `.gitignore`, `api/_auth.js`, `api/chat.js`, `api/search.js`, `firestore.rules`, `README.md`.
(Tip: Chrome menu > "Desktop site" makes GitHub easier.)

## 2. Firebase
1. console.firebase.google.com > **Add project**.
2. **Build > Authentication > Get started > Email/Password > Enable**.
3. **Build > Firestore Database > Create database** (production mode).
4. **Firestore > Rules** tab: delete everything, paste `firestore.rules`, tap **Publish**.
5. **Project settings (gear) > Your apps > Web (`</>`)** > register > copy the config values. Edit `firebase-config.js` on GitHub (pencil icon) and replace the 4 `PASTE_...` values. Commit.
6. After Vercel gives you a URL: **Authentication > Settings > Authorized domains > Add domain** (e.g. `your-app.vercel.app`).

## 3. Gemini key
aistudio.google.com/apikey > Create API key. Keep it secret.
Default model is `gemini-2.5-flash`; if Google retires it, set `GEMINI_MODEL` (see ai.google.dev/gemini-api/docs/models).

## 4. Vercel
1. vercel.com > sign in with GitHub > **Add New > Project** > import the repo > **Deploy**.
2. **Project > Settings > Environment Variables**, add:
   | Name | Value | Required |
   |---|---|---|
   | `GEMINI_API_KEY` | your Gemini key | yes |
   | `FIREBASE_API_KEY` | the `apiKey` from Firebase config | yes |
   | `GEMINI_MODEL` | model name | no |
   | `BRAVE_API_KEY` | key from brave.com/search/api | only for web search |
3. **Deployments > latest > ⋯ > Redeploy.** Variables only apply after a redeploy.
Every GitHub commit redeploys automatically.

## What works / limits
- **Works:** chat with context, Hindi/Hinglish/English, stop button, login/logout/reset, saved chats, memories (manual only, `/remember text`), notes + search, reminders, voice in/out, light/dark theme.
- **Optional:** web search (needs `BRAVE_API_KEY`; otherwise a clear "unavailable" message; results shown as sources, never invented).
- **Limits:** reminders alert only while the page is open. Voice is not always-listening; depends on Chrome and installed voices. No streaming (Stop cancels the request). No per-user rate limiting.

## Troubleshooting
- *Server not configured*: env var missing or you forgot to redeploy.
- *AI provider error (400/403/404)*: wrong key or model name.
- *auth/unauthorized-domain*: add the Vercel domain in Firebase (step 2.6).
- *Missing or insufficient permissions*: rules not published.
- *Blank page / login does nothing*: `firebase-config.js` still has `PASTE_` values.
- *Mic not working*: Chrome > site settings > allow microphone; needs https (Vercel is).

## Android test checklist
Register > log in > send message > Stop mid-reply > new chat, reopen old chat > add/edit/delete memory > `/remember` > note search > reminder 1 min ahead > mic in English and Hindi > Speak toggle > Web search on (with and without key) > airplane mode shows "offline" > log out > reset email.
