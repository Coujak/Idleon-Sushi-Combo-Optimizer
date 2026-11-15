# Google device-code sign-in (development branch only)

**Status:** Working device-code implementation and test UI; **not yet verified with
a real Google/Idleon sign-in**. The public `main` website has been restored
to the known-good manual JSON importer. Do not release this integration to
`main` until it authenticates successfully on GitHub Pages and the data
matches the player's save.

## Why device code?

Our prior Firebase Google popup succeeded at `localhost` but failed on
`coujak.github.io` because the game's Firebase project does not authorize
that website as a popup origin. Idleon Toolbox and Corgan use a
Google OAuth **device authorization** flow instead, followed by a Firebase
credential exchange. This is a different authorization method; it does not
guarantee that Firebase will accept every OAuth client.

Google's device-code flow is intended for **TVs and Limited Input devices**.
Google's documentation specifies a matching device client ID **and**
client secret for the polling request. It is not interchangeable with
a Google OAuth **Web application** client.

The user supplied the **public client ID**
`1010237426756-l184h7psanvrhhss1hk2qcu8690kcj8d.apps.googleusercontent.com`
for development testing. **The client's application type and authorization
by Idleon's Firebase are not verified.** No matching client secret has
been supplied, committed, or requested in chat.

## What is implemented

- **Sign in with Google** appears among the import buttons in the
  development build and opens an inline device-code form.
- Client ID is prefilled from the user's supplied public identifier.
  **Generate sign-in code** uses that public ID alone. If it is not a
  registered TV/limited-input client, Google will reject it.
- Once a code is shown, approval polling requires the matching device-client
  secret, entered by the owner **locally in the browser, never in chat or
  source control**. The secret is cleared on completion, cancellation,
  failure, or Clear. No credentials are saved to browser storage.
- **Generate sign-in code** contacts Google's official `device/code`
  endpoint with only `openid email profile` scopes.
- A **Copy code** button and an official
  [google.com/device](https://www.google.com/device) link let the user
  approve the pending request. The app polls Google's official token endpoint,
  respecting `interval`, `slow_down`, expiration, and cancellation.
- Upon approval, only Google's **ID token** is passed to Firebase's
  `signInWithCredential`. Firebase must still accept the OAuth audience and
  authorize reading the signed-in user's own `_data/<uid>` save.
- When successful, cloud data uses the existing JSON import parser and
  the in-memory Firebase session can refresh every five minutes. The
  Refresh countdown, Pause/Resume, unchanged-save detection, and Clear
  controls are retained.
- Google access and refresh tokens are **discarded**, and Firebase Auth
  uses `inMemoryPersistence` so closing the tab ends the session.
  No user passwords or OAuth access tokens are requested from the user.

## Testing — development branch only

1. In the development branch, **Code → Download ZIP**, extract,
   then double-click `start-preview.bat` on Windows (requires Python 3).
2. In **Import game data**, click **Sign in with Google**.
3. Check that your OAuth client is of type **TVs and Limited Input devices**.
   The supplied client ID should already be filled in.
4. Click **Generate sign-in code**. This first step requires
   only the supplied public client ID. If Google rejects the request,
   check the OAuth client application type in Google Cloud.
5. If a code appears, copy it, open the official `google.com/device`
   page, and approve your own account.
6. **Only on your local preview**, enter the matching device-client secret,
   then click **Check approval and connect**. The secret is required for
   polling, but is never stored; **never share it in chat**.
7. Verify your imported account information, five-minute refresh, Pause,
   Resume, manual JSON import, and Clear. If sign-in fails, share only
   the generic status or error message, never credentials or network data.

The user code is a short-lived approval code, not a password. It is shown
only in the local browser session. If the OAuth client type is wrong,
Google may reject the device-code request with `invalid_client`. If the
audience is not accepted by Idleon's Firebase, login may still fail after
Google approval. **Do not bypass authorization or reuse another website's
OAuth client secret.**

## References

- [Google Sign-In on TVs and Limited Input Devices](https://developers.google.com/identity/gsi/web/guides/devices)
- [Google OAuth Device Authorization](https://developers.google.com/identity/protocols/oauth2/limited-input-device)
- [Idleon Toolbox OAuth implementation](https://github.com/Morta1/IdleonToolbox/tree/main/services/auth)
- [Corgan's device authentication](https://github.com/Corgan/idleon-research-optimizer/blob/main/js/auth/device-auth.js)
- [Firebase Google credential sign-in](https://firebase.google.com/docs/auth/web/google-signin)
