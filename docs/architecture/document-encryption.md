# Document encryption at rest (PostgreSQL)

## Goal

Protect document title and content so that anyone with access to the database (backup leak, stolen credentials, insider) cannot read plaintext without the encryption key.

## Scope

- **Encrypted**: `documents.title`, `documents.content`
- **Not encrypted**: `documents.id`, `owner_id`, `language`, `created_at`, `updated_at` (needed for querying, indexing, and ownership; no sensitive content)

## Algorithm and format

- **Algorithm**: AES-256-GCM (authenticated encryption: confidentiality and integrity).
- **Key**: 32-byte (256-bit) key. Supplied via environment (e.g. `DOCUMENT_ENCRYPTION_KEY` as base64) or from a secret store (e.g. AWS Secrets Manager). Never committed to code.
- **Per-field storage format**: Each encrypted value is stored as:
  - Prefix: `v1:` (version; allows future algorithm or format changes and distinguishes from legacy plaintext).
  - Body: base64(IV || ciphertext || authTag).
    - IV: 12 bytes, random per encryption (Node crypto default for GCM).
    - authTag: 16 bytes, produced by GCM.
- **Legacy**: If the key is configured but a stored value does not start with `v1:`, it is treated as plaintext (existing rows before encryption was enabled). New and updated rows are always written encrypted when a key is set.

## Where it runs

- **Layer**: Encryption and decryption happen only in the **repository** (`PgDocumentRepository`). The document service and API see only plaintext; the repository encrypts on write and decrypts on read.
- **Key optional**: If `DOCUMENT_ENCRYPTION_KEY` is not set, the repository does not encrypt or decrypt (backward compatibility and local dev without a key).

## Key management

- **Development**: Optional. Set `DOCUMENT_ENCRYPTION_KEY` (base64 of 32 random bytes) in `.env` to test encryption. Generate with e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- **Production (e.g. AWS Lambda)**: Prefer storing the key in AWS Secrets Manager (or Parameter Store). Fetch at cold start or inject into Lambda env; pass the key (or null) into the repository constructor. Never log or expose the key.

## Schema

No migration required. Existing `documents.title` and `documents.content` columns (type `text`) hold either plaintext (legacy) or the `v1:` + base64-encrypted value. No new columns.

## Performance characteristics

- Encryption and decryption happen in the application tier (Node.js) using AES-256-GCM.
- CPU cost scales roughly with the size of the document title/content being processed; larger documents and higher request rates will increase app CPU usage.
- Each write or read of a document with an active `DOCUMENT_ENCRYPTION_KEY` performs a full encrypt/decrypt of the `title` and `content` fields.
- For current local/dev usage this overhead is acceptable; for production, monitor application CPU and latency for document-heavy workloads and plan capacity accordingly.

## Migrating existing data

To encrypt existing plaintext rows:

1. Ensure `DOCUMENT_ENCRYPTION_KEY` is set.
2. Run a one-off job (script, Lambda, or migration task) that: for each row, if `title` or `content` does not start with `v1:`, encrypt the value and update the row. The application will then decrypt on read regardless.

(Optional; the app already supports mixed legacy plaintext + new encrypted rows.)

## Security notes

- **Key compromise**: If the key is lost, encrypted data cannot be recovered. If the key is stolen, an attacker can decrypt. Protect the key with the same rigor as the database credentials.
- **Integrity**: GCM authentication detects tampering; corrupted or modified ciphertext will fail to decrypt.
- **No search**: Encrypted content cannot be searched in the DB (e.g. full-text search). Queries remain on `owner_id`, `id`, `language`, and timestamps.

## Key backup and recovery

**Is “key lost = data gone” standard?** Yes. With symmetric encryption (one key for both encrypt and decrypt), only the key holder can read the data. So by design, if the key is gone, no one can decrypt—including you. That’s the same tradeoff as any system that encrypts data at rest (e.g. RDS encryption, encrypted backups).

**Practical mitigation:** Treat the key like a critical credential and back it up securely, the same way you protect database credentials or API keys:

- **Production**: Store the key in a secret manager (e.g. AWS Secrets Manager). Use a second, separate backup (e.g. another region, or an offline copy in a secure vault) if your policy requires recovery from total loss of the primary store. Restrict access with IAM or equivalent so only the app (and designated operators) can read it.
- **Document where the key lives** and who can access it, so a future team member or restore process can find it.
- **Rotation**: If you ever need to change the key, you must re-encrypt all rows with the new key (decrypt with old key, encrypt with new key). Plan that as a one-off migration; the current design uses a single key.

There is no built-in “recovery” that avoids the key: any such back door would weaken security.

## Single key and symmetric encryption

**Is one key + symmetric encryption insecure?** No. AES-256-GCM with a single key is standard and widely used (e.g. TLS, disk encryption, many apps). The algorithm and "one key" design are not the weak point. The risk is **key management**: where the key is stored, who can read it, and how it gets into the process.

**Where could someone steal the key?** The encryption code never stores or logs the key; it only receives it as an argument. The key enters the app from **configuration** (e.g. `DOCUMENT_ENCRYPTION_KEY` in the environment, or from a secret store). Theft is possible if:

- **Env or config is exposed**: On some systems, process environment is visible (e.g. `ps eww` or monitoring that dumps env). Avoid putting the raw key in env on shared hosts if you can; prefer fetching from a secret manager at startup and keeping it only in memory.
- **Logging**: Anything that logs `process.env` or the full config object could leak the key. The app must never log secrets.
- **Where the key is stored**: If the key lives in a `.env` file, anyone with file access can read it. If it's in AWS Secrets Manager (or similar), only identities with access to that secret can fetch it. So "stealing" usually means compromising the store (file, CI/CD, IAM, etc.), not the encryption code itself.
- **Memory**: While the process runs, the key exists in memory. A memory dump (crash dump, forensic image) could contain it. Mitigate by restricting who can capture memory and by not logging or persisting the key.

So: the code in `document-encryption.ts` does not add new ways to steal the key; it only uses a key it is given. Secure the place the key comes from (secret store, env, access control) and avoid logging or exposing config.

Backup the key; don't rely on a single copy.
