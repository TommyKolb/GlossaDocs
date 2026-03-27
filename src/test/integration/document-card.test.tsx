import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentCard } from "@/app/components/DocumentCard";
import { minimalDocumentFixture } from "@/test/fixtures/document";

describe("DocumentCard", () => {
  const dragStub = vi.fn();

  const defaultProps = {
    document: minimalDocumentFixture(),
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onRequestMove: vi.fn(),
    onDragStartDocument: dragStub,
    onDragDocument: dragStub,
    onDragEndDocument: dragStub
  };

  it("calls onSelect when clicking the language badge (not a toolbar button)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DocumentCard {...defaultProps} onSelect={onSelect} />);
    const groups = screen.getAllByRole("group", { name: /Open document: Test Doc/i });
    const card = groups[groups.length - 1];
    await user.click(within(card).getByLabelText(/Document language: English/i));
    expect(onSelect).toHaveBeenCalledWith(defaultProps.document.id);
  });

  it("does not call onSelect when clicking delete", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(<DocumentCard {...defaultProps} onSelect={onSelect} onDelete={onDelete} />);
    const groups = screen.getAllByRole("group", { name: /Open document: Test Doc/i });
    const card = groups[groups.length - 1];
    await user.click(within(card).getByRole("button", { name: "Delete document: Test Doc" }));
    expect(onDelete).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when clicking Move", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRequestMove = vi.fn();
    render(<DocumentCard {...defaultProps} onSelect={onSelect} onRequestMove={onRequestMove} />);
    const groups = screen.getAllByRole("group", { name: /Open document: Test Doc/i });
    const card = groups[groups.length - 1];
    await user.click(within(card).getByRole("button", { name: "Move Test Doc to another folder" }));
    expect(onRequestMove).toHaveBeenCalledWith(defaultProps.document.id);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
