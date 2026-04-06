import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Editor } from "@/app/components/Editor";

const { getUserSettingsMock, updateUserSettingsMock, getDocumentMock } = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  getDocumentMock: vi.fn()
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
    saveDocument: vi.fn()
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
  });

  afterEach(() => {
    cleanup();
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
});
