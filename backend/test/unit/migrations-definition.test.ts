import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_DOCUMENT_LANGUAGES } from "../../src/shared/document-languages.js";

const migrationsDir = path.resolve(import.meta.dirname, "../../migrations");

async function migrationText(fileName: string): Promise<string> {
  return readFile(path.join(migrationsDir, fileName), "utf8");
}

describe("migration file definitions", () => {
  it("000 enables pgcrypto extension", async () => {
    const text = await migrationText("000_enable_pgcrypto.js");
    expect(text).toContain('pgm.createExtension("pgcrypto"');
  });

  it("001 defines documents table, language constraint, and indexes", async () => {
    const text = await migrationText("001_create_documents.js");
    expect(text).toContain('pgm.createTable("documents"');
    expect(text).toContain("owner_id");
    expect(text).toContain("content");
    expect(text).toContain("language");
    expect(text).toContain("documents_language_check");
    expect(text).toContain("idx_documents_owner_updated");
    expect(text).toContain("idx_documents_id_owner");
  });

  it("002 defines user_settings with Story 3 defaults", async () => {
    const text = await migrationText("002_create_user_settings.js");
    expect(text).toContain('pgm.createTable("user_settings"');
    expect(text).toContain('default: "en-US"');
    expect(text).toContain("keyboard_visible");
    expect(text).toContain("default: true");
  });

  it("003 defines api_audit_events and created_at index", async () => {
    const text = await migrationText("003_create_api_audit_events.js");
    expect(text).toContain('pgm.createTable("api_audit_events"');
    expect(text).toContain("request_id");
    expect(text).toContain("actor_sub");
    expect(text).toContain("idx_api_audit_events_created_at");
  });

  it("004 defines folders and document folder linkage", async () => {
    const text = await migrationText("004_create_folders_and_document_folder_fk.js");
    expect(text).toContain('pgm.createTable("folders"');
    expect(text).toContain("parent_folder_id");
    expect(text).toContain("idx_folders_owner_parent");
    expect(text).toContain("idx_folders_owner_updated");
    expect(text).toContain("pgm.addColumn(\"documents\"");
    expect(text).toContain("folder_id");
    expect(text).toContain("fk_documents_folder_id");
    expect(text).toContain("idx_documents_owner_folder");
  });

  it("005 adds per-document font family column", async () => {
    const text = await migrationText("005_add_documents_font_family.js");
    expect(text).toContain('pgm.addColumn("documents"');
    expect(text).toContain("font_family");
  });

  it("006 adds keyboard_layout_overrides jsonb to user_settings", async () => {
    const text = await migrationText("006_add_keyboard_layout_overrides.js");
    expect(text).toContain('pgm.addColumn("user_settings"');
    expect(text).toContain("keyboard_layout_overrides");
    expect(text).toContain("jsonb");
  });

  it("010 up() CHECK constraint matches SUPPORTED_DOCUMENT_LANGUAGES", async () => {
    const text = await migrationText("010_extend_documents_language_check_for_chinese.js");
    expect(text).toContain('dropConstraint("documents", "documents_language_check")');
    const listInParens = `(${SUPPORTED_DOCUMENT_LANGUAGES.map((l) => `'${l}'`).join(",")})`;
    expect(text).toContain(`language in ${listInParens}`);
  });
});
