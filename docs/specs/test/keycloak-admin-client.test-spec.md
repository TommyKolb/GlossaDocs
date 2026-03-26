# Test specification: `keycloak-admin-client.ts` (backend)

**Source:** `backend/src/modules/identity-access/keycloak-admin-client.ts`  
**Automated tests:** `backend/test/unit/keycloak-admin-client.test.ts`

**User story:** Supports **identity and account administration** used by registration and password-reset flows: obtain an admin token, create users, and trigger Keycloak “execute actions” email. This complements the session cookie model in [`auth.ts`](../../../backend/src/modules/identity-access/auth.ts) by talking to Keycloak’s Admin REST API with a service account.

## Functions in this file

### Exported

| Function / type | Summary |
| --------------- | ------- |
| `KeycloakAdminClientError` | Error subclass carrying a `KeycloakAdminClientErrorCode`. |
| `isKeycloakAdminErrorCode(error, expectedCode)` | Returns whether `error` is (or looks like) a Keycloak admin error with the given `code`. |
| `HttpKeycloakAdminClient` | Concrete client: `createUser`, `sendPasswordResetEmail`. |
| `HttpKeycloakAdminClient.constructor(config)` | Stores admin URL, realm, and admin credentials. |
| `HttpKeycloakAdminClient.createUser({ email, password })` | Admin token → create user → set password. |
| `HttpKeycloakAdminClient.sendPasswordResetEmail({ email })` | Admin token → find user by email → `execute-actions-email` with `UPDATE_PASSWORD`. |
| `requireKeycloakAdminConfig(partial)` | Validates all admin fields are present or throws `ApiError` `CONFIG_KEYCLOAK_ADMIN_INCOMPLETE`. |

### Internal (covered via HTTP mocks)

| Function | Summary |
| -------- | ------- |
| `normalizeBaseUrl(url)` | Trims trailing slashes from the Keycloak base URL. |
| `getAdminAccessToken(config)` | Password grant against `master` realm; returns `access_token` or throws `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| `keycloakRequest(url, token, init)` | `fetch` with `Authorization: Bearer`; maps network failure to `KEYCLOAK_ADMIN_UNAVAILABLE`. |

---

## Test table

| Purpose | Function(s) under test | Test inputs | Expected result if the test passes |
| ------- | ------------------------ | ----------- | ----------------------------------- |
| `requireKeycloakAdminConfig` throws when a field is missing. | `requireKeycloakAdminConfig` | Partial config without `adminPassword` | Throws `ApiError`. |
| `requireKeycloakAdminConfig` returns a full config when valid. | `requireKeycloakAdminConfig` | All four fields set | Returned object matches input fields. |
| `isKeycloakAdminErrorCode` matches `KeycloakAdminClientError` instances. | `isKeycloakAdminErrorCode`, `KeycloakAdminClientError` | Error with `KEYCLOAK_USER_EXISTS` | `true` for same code, `false` for a different code. |
| `isKeycloakAdminErrorCode` matches plain objects with `code`. | `isKeycloakAdminErrorCode` | `{ code: "KEYCLOAK_USER_NOT_FOUND" }` | `true` when expected code matches. |
| `isKeycloakAdminErrorCode` returns false for primitives. | `isKeycloakAdminErrorCode` | String `"oops"` | `false`. |
| Admin token request returns non-OK HTTP. | `getAdminAccessToken` via `createUser` | First `fetch` resolves `{ ok: false }` | Rejects with `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Admin token JSON missing `access_token`. | `getAdminAccessToken` | First `fetch` resolves OK but JSON `{}` | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Token `fetch` rejects (network). | `getAdminAccessToken` | First `fetch` rejects | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Create user returns 409 conflict. | `createUser` | Token OK; POST `/users` returns 409 | `KEYCLOAK_USER_EXISTS`. |
| Password reset when user list is empty. | `sendPasswordResetEmail` | Token OK; GET users returns `[]` | `KEYCLOAK_USER_NOT_FOUND`. |
| Happy path: create user (token + 201 + Location + password PUT). | `createUser`, `normalizeBaseUrl`, `keycloakRequest`, `getAdminAccessToken` | Valid mocks for all three steps | Resolves with no value. |
| Create fails with non-409 after token (e.g. 500). | `createUser`, `keycloakRequest` | POST `/users` not OK, not 409 | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Create succeeds with 201 but no `Location` user id. | `createUser` | 201 without parseable user id in `Location` | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Password PUT fails after user create. | `createUser` | Create returns 201 + Location; reset-password returns error | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| `keycloakRequest` handles `fetch` rejection (no response). | `keycloakRequest` | Token OK; second `fetch` rejects | `KEYCLOAK_ADMIN_UNAVAILABLE` “request failed”. |
| Password reset happy path. | `sendPasswordResetEmail` | Token OK; user found; execute-actions OK | Resolves with no value. |
| User lookup HTTP not OK. | `sendPasswordResetEmail` | Token OK; GET users returns `ok: false` | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Execute-actions email HTTP not OK. | `sendPasswordResetEmail` | User found; last PUT fails | `KEYCLOAK_ADMIN_UNAVAILABLE`. |
| Empty local part before `@` uses default first name in create payload. | `createUser` | Email `"@example.com"`; successful create flow | POST body `firstName` is `"GlossaDocs"`. |

---

## Coverage

Unit tests aim for **high line coverage** on `keycloak-admin-client.ts` in the focused coverage run; every exported function or meaningful entry point above has at least one test row. Internal helpers are exercised through mocked `fetch` sequences (token URL, admin realm URLs, and failure modes). Re-run `npm run test:backend:coverage` after edits and treat coverage drops as a prompt to extend tests.
