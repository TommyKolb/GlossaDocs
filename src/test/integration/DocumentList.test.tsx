import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}));

vi.mock("@/app/data/document-repository", () => ({
  getAllDocuments: vi.fn(),
  getAllFolders: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  deleteDocument: vi.fn(),
  saveDocument: vi.fn()
}));

import * as docRepo from "@/app/data/document-repository";
import { DocumentList } from "@/app/components/DocumentList";

/** Toolbar actions are duplicated in this test environment; use the first match. */
function firstButton(name: RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  expect(buttons.length).toBeGreaterThan(0);
  return buttons[0]!;
}

function lastButton(name: RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  expect(buttons.length).toBeGreaterThan(0);
  return buttons[buttons.length - 1]!;
}

async function waitForDocumentListShell() {
  await waitFor(() => {
    expect(screen.getAllByRole("heading", { name: /your documents/i }).length).toBeGreaterThan(0);
  });
}

const sampleDoc = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Doc",
  content: "<p>x</p>",
  language: "en" as const,
  folderId: null,
  fontFamily: "Inter",
  createdAt: 1,
  updatedAt: 1
};

const sampleFolder = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Projects",
  parentFolderId: null as string | null,
  createdAt: 1,
  updatedAt: 1
};

describe("DocumentList folder dialogs", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(docRepo.getAllDocuments).mockResolvedValue([sampleDoc]);
    vi.mocked(docRepo.getAllFolders).mockResolvedValue([]);
    vi.mocked(docRepo.createFolder).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Created",
      parentFolderId: null,
      createdAt: 1,
      updatedAt: 1
    });
    vi.mocked(docRepo.updateFolder).mockImplementation(async (folder) => folder);
    vi.mocked(docRepo.deleteFolder).mockResolvedValue(undefined);
  });

  it("opens create-folder dialog and calls createFolder with trimmed name at root", async () => {
    render(<DocumentList onSelectDocument={() => {}} />);

    await waitForDocumentListShell();

    await user.click(firstButton(/new folder/i));

    expect(await screen.findByRole("dialog", { name: /new folder/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^folder name$/i), "  My Folder  ");
    await user.click(firstButton(/^create$/i));

    await waitFor(() => {
      expect(docRepo.createFolder).toHaveBeenCalledWith("My Folder", null);
    });
  });

  it("passes active folder id when creating a nested folder", async () => {
    vi.mocked(docRepo.getAllFolders).mockResolvedValue([sampleFolder]);

    render(<DocumentList onSelectDocument={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /open folder projects/i }).length).toBeGreaterThan(0);
    });

    await user.click(lastButton(/open folder projects/i));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /up to parent folder/i }).length).toBeGreaterThan(0);
    });

    await user.click(lastButton(/new folder/i));

    await user.type(await screen.findByLabelText(/^folder name$/i), "Nested");
    await user.click(lastButton(/^create$/i));

    await waitFor(() => {
      expect(docRepo.createFolder).toHaveBeenCalledWith("Nested", sampleFolder.id);
    });
  });

  it("opens rename dialog and calls updateFolder with new name", async () => {
    vi.mocked(docRepo.getAllFolders).mockResolvedValue([sampleFolder]);
    vi.mocked(docRepo.getAllDocuments).mockResolvedValue([]);

    render(<DocumentList onSelectDocument={() => {}} />);

    await waitForDocumentListShell();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /open folder projects/i }).length).toBeGreaterThan(0);
    });

    await user.click(lastButton(/open folder projects/i));

    await user.click(lastButton(/rename folder/i));

    const renameDlg = await screen.findByRole("dialog", { name: /rename folder/i });
    expect(renameDlg).toBeInTheDocument();

    const nameInput = within(renameDlg).getByLabelText(/^folder name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    await user.click(within(renameDlg).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(docRepo.updateFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: sampleFolder.id,
          name: "Renamed"
        })
      );
    });
  });

  it("confirms delete folder via alert dialog", async () => {
    vi.mocked(docRepo.getAllFolders).mockResolvedValue([sampleFolder]);
    vi.mocked(docRepo.getAllDocuments).mockResolvedValue([]);

    render(<DocumentList onSelectDocument={() => {}} />);

    await waitForDocumentListShell();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /open folder projects/i }).length).toBeGreaterThan(0);
    });

    await user.click(lastButton(/open folder projects/i));

    await user.click(lastButton(/delete folder/i));

    const alert = await screen.findByRole("alertdialog");
    expect(alert).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: /^delete folder$/i }));

    await waitFor(() => {
      expect(docRepo.deleteFolder).toHaveBeenCalledWith(sampleFolder.id);
    });
  });
});
