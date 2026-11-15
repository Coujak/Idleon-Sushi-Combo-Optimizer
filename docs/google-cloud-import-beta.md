# Google sign-in: development-only test

**Status: locally tested Google sign-in, with development-only automatic refresh not yet user-verified.** The public `main` site remains
unchanged; JSON upload and paste remain the reliable options.

## Findings from real Idleon companion projects

- Idleon Toolbox's published Firebase app config uses the game project
  `idlemmo` and `idlemmo.firebaseapp.com`. Its Google sign-in uses a
  **Google device-code flow** followed by Firebase `signInWithCredential`.
- Corgan's public optimizer also implements device-code Google sign-in.
- Idleoneer describes Google device-code approval and live account syncing
  in its published release notes.
- These examples explain why a random new Google OAuth Web client ID is
  unlikely to work with Idleon's Firebase credentials: the Google ID token
  must be accepted by the game project's Firebase authentication provider.

The other projects' **OAuth client identifiers and client secrets are not
our credentials**. Their availability in a public repository does not
give Sushi Station Lab permission to reuse them.

## What the development preview does

The **Sign in with Google** button sits alongside **Choose JSON file**,
**Paste JSON**, and **Clear** in the account import panel.

On a user click, it attempts `signInWithPopup` through Idleon's publicly
published Firebase configuration. If permitted, it reads only
`_data/<signed-in uid>` and imports the result into the existing JSON parser.

**Like Corgan:** After successful login, the button changes into
**Refresh (5:00)** with a countdown, automatically re-reads the current
cloud save every five minutes while the tab remains open, and offers
**Pause auto-refresh / Resume auto-refresh** beneath the buttons.
A manual click refreshes immediately. Manual JSON import or **Clear** ends
the connection and stops the timer.

The Firebase Auth SDK uses **in-memory persistence**: it keeps a temporary
session solely to permit recurring refreshes while the tab is open.
The feature does not save tokens or passwords to localStorage, sessionStorage,
URL parameters, or GitHub. Closing the tab discards the session.
We do **not** use Corgan's OAuth client secret or token cache.

**Likely blocker:** Idleon's Firebase project may reject
`coujak.github.io` (or `localhost`) as an unauthorized authentication
origin. If the page reports `auth/unauthorized-domain`, this is not a
bug to bypass by copying credentials from a competitor. We need a
legitimate OAuth device-code client registered for use with Idleon or
cooperation from the game developer / an authorized integration.

## Testing

1. Open the development branch on GitHub, choose **Code → Download ZIP**,
   and extract the archive on Windows.
2. Double-click **start-preview.bat** in the extracted project folder.
   It starts a local Python web server and opens `http://localhost:8765`.
   (If Python 3 isn't installed, the launcher explains what is needed.)
3. In **Import game data**, click **Sign in with Google**. No Google
   Cloud setup or app identifiers are needed.
4. If the popup succeeds, verify the save against Idleon Toolbox. The
   button becomes **Refresh (5:00)** and counts down, updating every five
   minutes. Test **Pause auto-refresh**, **Resume auto-refresh**, **Clear**,
   and manual JSON import.
5. If it fails, share only the displayed generic error text. **Never**
   share a Google password, Firebase token, OAuth code, account ID,
   access token, or a full network request/response.

The public website is unchanged. An attempt to deploy a separate GitHub Pages
beta preview was blocked by repository deployment restrictions, so this
local preview is the current testing method.

This attempt does not guarantee a successful sign-in. Its immediate
purpose is to verify, with a real browser and user click, whether the
Firebase project authorizes our website. We will not claim production
readiness or promote the feature to `main` until that is confirmed.

## Public references

- [Idleon Toolbox public authentication implementation](https://github.com/Morta1/IdleonToolbox/tree/main/services/auth)
- [Idleon Toolbox Firebase SDK configuration](https://github.com/Morta1/IdleonToolbox/blob/main/firebase/config.js)
- [Corgan's published authentication implementation](https://github.com/Corgan/idleon-research-optimizer/tree/main/js/auth)
- [Idleoneer release notes](https://idleoneer.com/patch-notes)
- [Firebase: Google authentication for web](https://firebase.google.com/docs/auth/web/google-signin)
