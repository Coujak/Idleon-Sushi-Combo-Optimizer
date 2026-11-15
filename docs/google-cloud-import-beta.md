# Google sign-in: development-only test

**Status: one-click prototype, not a verified integration.** The public `main` site remains
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

## What the new development preview does

The collapsed **Google cloud import · DEV TEST** section has a
**Try Google sign-in** button. It loads the official Firebase browser SDK
using the publicly published `idlemmo` Firebase configuration.

On a user click, it attempts `signInWithPopup` via Google's identity
provider. If the game authorizes this website's domain and the account
can read its own cloud save, the temporary Firebase ID token is used to
retrieve only `_data/<signed-in uid>`. We then feed the result through
the same parser used for manual JSON imports.

The Firebase Auth SDK uses **in-memory persistence**; this feature does
not copy tokens into localStorage, sessionStorage, URL parameters, or GitHub.
It signs out from Firebase after each attempt. Google sign-in is optional;
manual JSON import is unaffected. It does not ask for the user's password
or game tokens.

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
3. Expand **Google cloud import · DEV TEST** and click
   **Try Google sign-in**. No Google Cloud setup or app identifiers are needed.
4. If the Firebase project allows the popup, check your sushi values
   against a fresh Idleon Toolbox export; try **Clear** and manual JSON import.
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
