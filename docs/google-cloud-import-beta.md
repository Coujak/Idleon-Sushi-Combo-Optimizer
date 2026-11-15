# Experimental Google cloud import (development branch only)

**Status: prototype / not ready for production.** The public `main` branch continues
to use manual JSON imports. This work is gated behind an empty configuration so visitors
cannot accidentally start a broken sign-in. No passwords or OAuth secrets belong here.

## Research findings

Corgan's public Idleon optimizer uses a Google OAuth **device-code** flow followed by
Firebase sign-in and a Firestore `_data/<uid>` lookup in project `idlemmo`.
It also persists Firebase refresh tokens and full saves to browser storage.
Those are observations about the reference implementation, **not** a recommendation
to reuse its OAuth client ID, client secret, API key or token storage.

Sushi Station Lab instead experiments with Google's supported browser
**Google Identity Services** OAuth client. The user initiates the popup and
grants only `openid email profile`. The returned Google access token is passed
to Firebase Identity Toolkit's documented `accounts:signInWithIdp` endpoint
and the temporary Firebase ID token is used to read that user's own Firestore
`_data/<uid>` document. Successful data is converted to the same shape used by
the existing JSON parser. The preview **does not** retain OAuth or Firebase
tokens, refresh tokens, or imported game JSON in localStorage.

**Important blocker:** Google sign-in and access to Idleon's Firebase save are
distinct steps. An arbitrary Google OAuth client may be rejected by the game's
Identity Platform provider (`INVALID_IDP_RESPONSE`), even when Google sign-in
succeeds. Using a Google access token instead of an ID token is an **untested**
experiment, not proof of compatibility. We cannot bypass or guarantee the
game project's authentication or Firestore rules.

References:
- https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
- https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works
- https://firebase.google.com/docs/reference/rest/auth
- https://firebase.google.com/docs/auth/web/google-signin

## Testing setup (only with proper authorization)

1. Create a **Google OAuth Web application** client that you own. Under the
   Google Cloud project's JavaScript origins, authorize the exact origin
   used for testing (for example `http://localhost:8000`).
2. Confirm that your OAuth app is permitted to authenticate with the game's
   Firebase identity provider. Obtain the public Firebase Web API key from
   an authorized source. Do not copy another website's client secret.
3. Open the Google cloud import section on the development page. Enter the\n   **Google OAuth Web client ID** and **public Idleon Firebase Web API key**\n   in the test-configuration fields, then click **Use test configuration**.\n   Alternatively, configure their defaults in \`src/google-idleon-config.mjs\`.\n   The test fields exist only in memory and are not saved across reloads.\n   Never enter passwords, OAuth client secrets, OAuth tokens, or refresh tokens.
4. Serve the **development branch** through a local HTTP server from the
   project root; the popup flow requires an allowed origin.
5. Import using a **test account that you control**, verify the decoded
   Sushi Station values against a fresh Idleon Toolbox export, test denied
   access and cancelled sign-in, and check that Clear removes account data.

The configuration ships empty on purpose. Do not commit live credentials or
test-user information. Google's client ID and Firebase Web API key are public
identifiers, but they must still be configured for valid origins and authorized
project access.

## Security and release gates

- Keep the opt-in preview **development-only** until it works end-to-end in a
  real browser and uses only access explicitly authorized for the user's own account.
- Keep manual file upload / JSON paste completely functional.
- No client secret in browser or GitHub Pages, no credentials from Corgan's repo.
- No OAuth or Firebase token persistence, and no automatic background polling.
- Fail closed if configuration is missing, credentials are rejected, the save
  lacks Sushi Station data, or the browser blocks the request.
- Compare the cloud import's account values to the same user's local IT JSON.
- If a backend is later chosen, use a server-side OAuth authorization-code flow,
  protected credentials, validated session state, and rate-limited APIs.
