# Test specification: `document-service.ts` (backend)

**Source:** `backend/src/modules/documents/document-service.ts`  
**Automated tests:** `backend/test/unit/document-service.test.ts`

**User story:** Implements the **authenticated document and folder persistence** slice of [User Story 1: Basic editor with persistent save](../../specs/user-story-1-basic-editor-spec.md): ownership checks, HTML/title sanitization, font validation, and folder hierarchy rules before delegating to `DocumentRepository`.

## Functions in this file

### Exported

| Function | Summary |
| -------- | ------- |
| `constructor(repository: DocumentRepository)` | Stores the repository used for all operations. |
| `listByOwner(actorSub)` | Lists all documents for the actor. |
| `listFolders(actorSub)` | Lists all folders for the actor. |
| `getOwned(actorSub, id)` | Fetches one document if owned. |
| `getOwnedFolder(actorSub, id)` | Fetches one folder if owned. |
| `createOwned(actorSub, payload)` | Creates a document; validates folder ownership and font; sanitizes title/content. |
| `updateOwned(actorSub, id, patch)` | Updates a document; rejects empty patches; validates folder and font; sanitizes provided fields. |
| `deleteOwned(actorSub, id)` | Deletes an owned document. |
| `createFolder(actorSub, payload)` | Creates a folder; validates parent exists when set; sanitizes name. |
| `updateFolder(actorSub, id, patch)` | Updates folder name/parent; rejects empty patches, self-parent, missing parent, and descendant cycles. |
| `deleteFolder(actorSub, id)` | Deletes a folder and reparents children (repository responsibility). |

### Internal (covered via public methods)

| Function | Summary |
| -------- | ------- |
| `assertDocumentFolderOwnedIfNonNull(actorSub, folderId)` | Ensures `folderId` is null/undefined or belongs to the actor. |
| `assertFontFamilyAllowedIfNonNull(fontFamily)` | Ensures `fontFamily` is null/undefined or a supported catalog value. |

---

## Test table

| Purpose | Function(s) under test | Test inputs | Expected result if the test passes |
| ------- | ------------------------ | ----------- | ----------------------------------- |
| Reject document update with an empty patch. | `updateOwned` | `actorSub`, document id, `{}` | `ApiError` `DOCUMENT_UPDATE_EMPTY` (400). |
| Strip dangerous markup from title and content on create. | `createOwned`, `assertDocumentFolderOwnedIfNonNull` (null folder) | Payload with script in title, safe and unsafe HTML in content | Repository receives sanitized title/content (no script/onclick/iframe where applicable). |
| Sanitize title and content on update when those fields are present. | `updateOwned` | Patch with HTML in title; patch with iframe in content | Patched fields are sanitized before repository call. |
| Reject unsupported `fontFamily` on create. | `createOwned`, `assertFontFamilyAllowedIfNonNull` | `fontFamily: "NotARealFont"` | `DOCUMENT_FONT_UNSUPPORTED` (400). |
| Sanitize folder name on create. | `createFolder` | Name with HTML tags | Repository receives plain-text name. |
| Reject reparenting when the new parent would be a descendant (cycle). | `updateFolder`, `folderHasDescendant` via repository | `parentFolderId` pointing into a descendant chain | `FOLDER_INVALID_PARENT` (400) “cannot be a descendant”. |
| Reject create when `folderId` does not belong to the owner. | `createOwned`, `assertDocumentFolderOwnedIfNonNull` | `folderId` not in owner’s folders | `FOLDER_NOT_FOUND` (404). |
| List documents delegates to the repository. | `listByOwner` | `RecordingRepository` returning one document | One document with expected id. |
| List folders delegates to the repository. | `listFolders` | `RecordingRepository` returning one folder | One folder with expected id. |
| `getOwned` returns null when missing. | `getOwned` | `EmptyRepository` | `null`. |
| `getOwned` returns the document when present. | `getOwned` | `RecordingRepository` | Document id matches. |
| `getOwnedFolder` returns null when missing. | `getOwnedFolder` | `EmptyRepository` | `null`. |
| `getOwnedFolder` returns the folder when present. | `getOwnedFolder` | `RecordingRepository` | Folder name matches. |
| `deleteOwned` returns the repository boolean. | `deleteOwned` | `RecordingRepository` (delete returns `false`) | `false`. |
| `deleteFolder` returns the repository boolean. | `deleteFolder` | `RecordingRepository` | `true`. |
| Create nested folder when parent exists. | `createFolder`, `assertDocumentFolderOwnedIfNonNull` | `parentFolderId` set to an existing folder id | Insert payload has correct `parentFolderId`. |
| Reject create when parent id is set but not owned. | `createFolder` | `parentFolderId` not in owner’s folders | `FOLDER_NOT_FOUND` (404). |
| Reject empty folder update patch. | `updateFolder` | `{}` | `FOLDER_UPDATE_EMPTY` (400). |
| Reject folder as its own parent. | `updateFolder` | `parentFolderId` equal to folder id | `FOLDER_INVALID_PARENT` (400). |
| Reject parent change when new parent does not exist. | `updateFolder`, `ownerHasFolder` | `parentFolderId` not owned | `FOLDER_NOT_FOUND` (404). |
| Successful rename without changing parent. | `updateFolder` | `{ name: "Renamed" }` | Updated folder name; repository patch recorded. |
| Successful reparent when parent exists and no cycle. | `updateFolder` | `parentFolderId: "folder-2"` with both folders owned, no descendant | Updated `parentFolderId`. |
| Reject `updateOwned` when `folderId` points at a folder the owner does not have. | `updateOwned`, `assertDocumentFolderOwnedIfNonNull` | Patch with `title` and bad `folderId` | `FOLDER_NOT_FOUND` (404). |
| Pass explicit `folderId: null` through to the repository. | `updateOwned` | `{ folderId: null }` | Patch includes `folderId: null`. |
| Reject unsupported `fontFamily` on update. | `updateOwned`, `assertFontFamilyAllowedIfNonNull` | `fontFamily: "NotARealFont"` | `DOCUMENT_FONT_UNSUPPORTED` (400). |
| Include `language` in the patch when only language is updated. | `updateOwned` | `{ language: "ru" }` | Repository patch has `language: "ru"`. |

---

## Coverage

Target file line coverage from unit tests is **100%** (branch coverage may be slightly below 100% on optional chaining in sanitized spreads). Every exported method has at least one test row above; private helpers are exercised through the rows that mention them.
