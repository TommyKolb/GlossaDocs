import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Editor } from "@/app/components/Editor";

const { getUserSettingsMock, updateUserSettingsMock, getDocumentMock, saveDocumentMock, getAllFoldersMock } = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  getDocumentMock: vi.fn(),
  saveDocumentMock: vi.fn(),
  getAllFoldersMock: vi.fn()
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("@/app/data/settings-repository", async () => {
  const actual = await vi.importActual<typeof import("@/app/data/settings-repository")>(
    "@/app/data/settings-repository"
  );
  return {
    ...actual,
    getUserSettings: getUserSettingsMock,
    updateUserSettings: updateUserSettingsMock
  };
});

vi.mock("@/app/data/document-repository", async () => {
  const actual = await vi.importActual<typeof import("@/app/data/document-repository")>(
    "@/app/data/document-repository"
  );
  return {
    ...actual,
    getDocument: getDocumentMock,
    saveDocument: saveDocumentMock,
    getAllFolders: getAllFoldersMock
  };
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function buildApiDoc(id: string, title: string) {
  return {
    id,
    title,
    content: "<p>body</p>",
    language: "en" as const,
    folderId: null,
    fontFamily: "Inter",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

describe("Editor load-state handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserSettingsMock.mockResolvedValue({
      lastUsedLocale: "en-US",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    updateUserSettingsMock.mockResolvedValue({
      lastUsedLocale: "en-US",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    Object.defineProperty(window.document, "execCommand", {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true
    });
    Object.defineProperty(window.document, "queryCommandState", {
      value: vi.fn().mockReturnValue(false),
      writable: true,
      configurable: true
    });
    saveDocumentMock.mockImplementation(async (doc) => doc);
    getAllFoldersMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("does not fetch the document when initialDocument matches documentId", async () => {
    const doc = buildApiDoc("11111111-1111-4111-8111-000000000001", "From list");
    render(
      <Editor documentId={doc.id} initialDocument={doc} onBack={() => {}} />
    );

    const editor = await screen.findByRole("textbox", { name: /From list/i });
    expect(editor.textContent).toMatch(/body/i);
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("shows a fallback and lets users go back when a document is missing", async () => {
    const onBack = vi.fn();
    getDocumentMock.mockResolvedValue(null);

    render(<Editor documentId="11111111-1111-4111-8111-000000000001" onBack={onBack} />);

    expect(
      await screen.findByText(/This document no longer exists or you no longer have access/i)
    ).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /Back to documents/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("ignores stale document loads when documentId changes quickly", async () => {
    const first = deferred<ReturnType<typeof buildApiDoc> | null>();
    const second = deferred<ReturnType<typeof buildApiDoc> | null>();
    getDocumentMock.mockImplementation((id: string) => {
      if (id === "11111111-1111-4111-8111-000000000001") {
        return first.promise;
      }
      return second.promise;
    });

    const { rerender } = render(
      <Editor documentId="11111111-1111-4111-8111-000000000001" onBack={() => {}} />
    );
    rerender(<Editor documentId="22222222-2222-4222-8222-000000000002" onBack={() => {}} />);

    second.resolve(buildApiDoc("22222222-2222-4222-8222-000000000002", "Second document"));
    first.resolve(buildApiDoc("11111111-1111-4111-8111-000000000001", "First document"));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Second document/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("textbox", { name: /First document/i })).not.toBeInTheDocument();
  });

  it("hydrates editor content updates even when the document id is unchanged", async () => {
    const docId = "11111111-1111-4111-8111-000000000001";
    getDocumentMock.mockResolvedValue({
      ...buildApiDoc(docId, "Hydration doc"),
      content: "<p>initial content</p>"
    });
    saveDocumentMock.mockImplementation(async (doc) => ({
      ...doc,
      id: docId,
      content: "<p>server-normalized content</p>"
    }));

    render(<Editor documentId={docId} onBack={() => {}} />);
    const editor = await screen.findByRole("textbox", { name: /Hydration doc/i });
    expect(editor.innerHTML).toContain("initial content");

    editor.innerHTML = "<p>local content before save</p>";
    await userEvent.setup().keyboard("{Control>}s{/Control}");

    await waitFor(() => {
      expect(editor.innerHTML).toContain("server-normalized content");
    });
  });

  it("cancels pending autosave when switching documents", async () => {
    const firstDocId = "11111111-1111-4111-8111-000000000001";
    const secondDocId = "22222222-2222-4222-8222-000000000002";
    getDocumentMock.mockImplementation(async (id: string) =>
      id === firstDocId ? buildApiDoc(firstDocId, "First") : buildApiDoc(secondDocId, "Second")
    );

    const { rerender } = render(<Editor documentId={firstDocId} onBack={() => {}} />);
    const editor = await screen.findByRole("textbox", { name: /First/i });
    await userEvent.setup().type(editor, "x");
    expect(screen.getByLabelText(/document has unsaved changes/i)).toBeInTheDocument();

    rerender(<Editor documentId={secondDocId} onBack={() => {}} />);
    await screen.findByRole("textbox", { name: /Second/i });
    expect(screen.queryByLabelText(/document has unsaved changes/i)).not.toBeInTheDocument();
  });
});
