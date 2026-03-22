# GlossaDocs Backend Architecture

This page is the navigation index for backend architecture docs. The backend is organized as **five Fastify domain/cross-cutting modules**, each with a dedicated markdown file under [`docs/architecture/modules/`](modules/).

## System-Level Architecture

- [System Architecture](system.md) — composition, REST surface, config, security baseline

## Module Architecture

Every backend module listed here has an **associated architecture file** (verified):

| Module | Code path | Documentation |
|--------|-----------|----------------|
| API Edge | `backend/src/modules/api-edge/` | [API Edge Module](modules/api-edge-module.md) |
| Identity and Access | `backend/src/modules/identity-access/` | [Identity and Access Module](modules/identity-access-module.md) |
| Document | `backend/src/modules/documents/` | [Document Module](modules/document-module.md) |
| Input Preferences | `backend/src/modules/input-preferences/` | [Input Preferences Module](modules/input-preferences-module.md) |
| Operational Store | `backend/src/modules/operational-store/` | [Operational Store Module](modules/operational-store-module.md) |

### Quick links (same as table)

- [API Edge Module](modules/api-edge-module.md)
- [Identity and Access Module](modules/identity-access-module.md)
- [Document Module](modules/document-module.md)
- [Input Preferences Module](modules/input-preferences-module.md)
- [Operational Store Module](modules/operational-store-module.md)

## Security / Data

- [Document encryption at rest](document-encryption.md)

## Scope Covered

- Story 1: basic editor with persistent save
- Story 3: Russian on-screen keyboard with persisted preference
