# GlossaDocs

GlossaDocs is a **browser-based writing app** built for **many languages and scripts**: you can set language and fonts per document, use on-screen keyboards and key remapping where a physical keyboard does not match the script (for example Cyrillic), use starter pinyin candidate input for common Simplified and Traditional Chinese words, and work in a simple flow—documents, nested folders, rich text, autosave, and import or export when you need it.

**Why it exists.** A lot of tools treat language as an afterthought. GlossaDocs is meant to keep **language choice and how you type** next to the document itself, not buried in system settings or separate tools.

**Privacy.** Your email is used for **sign-in and account recovery** only. It is not sold or used for marketing. Passwords are handled by the identity service your environment uses (for example AWS Cognito in production), not stored inside GlossaDocs application code.

---

## Using GlossaDocs in your browser

1. **Open the app** using your GlossaDocs web address. There is nothing to install for normal use.

2. **Choose how you want to work**
   - **Continue as Guest** — Start quickly. Your documents stay on **this device** in the browser. They are not synced to a server. Best for trying the app or local-only drafts.
   - **Create an account / Sign in** — Use this when the hosted version offers accounts. You can use the same login on other devices **if** your host has turned on cloud sync. Use **Forgot password** if you need to reset your password; follow the instructions sent to the email you registered with.

3. **Work with documents** — Create documents, organize them in **folders**, and edit in the main editor. Changes are **saved automatically** when you are online and using a synced account (or saved locally for guest mode, depending on your browser).

4. **Language and typing** — Pick the **language** (and fonts where offered) for a document when the app provides those options. **Arabic** documents use a right-to-left editing direction. If you work in a script that does not match your keyboard, use the **on-screen keyboard**, key remapping, or Chinese **starter pinyin candidate input** when those features appear, so you can type supported characters and words. The Chinese pinyin helper is not a full IME; installed browser/OS Chinese keyboards should still be used for unrestricted Chinese typing. Chinese candidate data is derived from [CC-CEDICT](https://cc-cedict.org/) under the [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

5. **Import and export** — Use the app’s menus for **import** or **export** if your host has enabled them, so you can move content in or out of GlossaDocs.

If something does not work (sign-in, reset email, or loading the app), please **open an issue on GitHub** in this repository’s **Issues** tab and describe what you tried and what you saw.

---

## For developers and operators

Technical setup, tests, architecture, and **AWS deployment** (Amplify, API Gateway, Lambda, Cognito, RDS, Redis, migrations) live in the docs below—not in this README.

| Topic | Document |
|--------|-----------|
| Run the stack on your machine (Docker, guest mode, env) | [docs/development/local-development.md](docs/development/local-development.md) |
| Tests and CI | [docs/testing.md](docs/testing.md) |
| Backend API, database, migrations, recovery | [backend/README.md](backend/README.md) |
| System and module architecture | [docs/architecture/system.md](docs/architecture/system.md) |
| Production deploy and auth configuration | [docs/deployment/aws-amplify-apigw-lambda-auth-runbook.md](docs/deployment/aws-amplify-apigw-lambda-auth-runbook.md) |
| Deploy from a fork / your AWS account | [docs/deployment/aws-fork-bootstrap.md](docs/deployment/aws-fork-bootstrap.md) |
| Cognito email limits and optional SES | [docs/deployment/cognito-email-and-ses.md](docs/deployment/cognito-email-and-ses.md) |
| Add a new language (code, fonts, keyboards, tests) | [docs/development/adding-a-language.md](docs/development/adding-a-language.md) |
| Third-party notices and data licenses | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |

Quick commands for contributors: **`npm test`** (quality gate), **`npm run dev:docker`** (full local stack—see local-development doc).
