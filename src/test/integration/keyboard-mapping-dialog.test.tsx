import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn()
  }
}));

import { KeyboardMappingDialog } from "@/app/components/KeyboardMappingDialog";

describe("KeyboardMappingDialog", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    // Radix dialog focus/presence can emit noisy act() warnings in jsdom.
    // Filter only those known warnings so genuine errors still surface.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === "string" &&
        message.includes("not wrapped in act(...)") &&
        args.some((value) => typeof value === "string" && value.includes("@radix-ui/react-"))
      ) {
        return;
      }
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function getDialog() {
    const dialogs = screen.getAllByRole("dialog", { name: /Customize keyboard/i });
    return dialogs[dialogs.length - 1];
  }

  it("keeps only the first character when a multi-character value reaches the input (e.g. paste)", async () => {
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{}}
        onSave={vi.fn()}
      />
    );
    const qInput = within(getDialog()).getByLabelText("Physical key for letter q");
    fireEvent.change(qInput, { target: { value: "ml" } });
    expect(qInput).toHaveValue("m");
  });

  it("marks both letters aria-invalid when two rows share the same physical key", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{}}
        onSave={vi.fn()}
      />
    );
    const dialog = getDialog();
    const qInput = within(dialog).getByLabelText("Physical key for letter q");
    const wInput = within(dialog).getByLabelText("Physical key for letter w");
    await user.clear(qInput);
    await user.type(qInput, "m");
    await user.clear(wInput);
    await user.type(wInput, "m");
    expect(qInput).toHaveAttribute("aria-invalid", "true");
    expect(wInput).toHaveAttribute("aria-invalid", "true");
  });

  it("toasts and does not save when two letters still share a physical key on Save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { toast } = await import("sonner");
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{}}
        onSave={onSave}
      />
    );
    const dialog = getDialog();
    const qInput = within(dialog).getByLabelText("Physical key for letter q");
    const wInput = within(dialog).getByLabelText("Physical key for letter w");
    await user.clear(qInput);
    await user.type(qInput, "m");
    await user.clear(wInput);
    await user.type(wInput, "m");
    await user.click(within(dialog).getByRole("button", { name: /Save mappings/i }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringContaining("same physical key")
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("toasts and does not save when any mapping is empty on Save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { toast } = await import("sonner");
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{}}
        onSave={onSave}
      />
    );
    const dialog = getDialog();
    const qInput = within(dialog).getByLabelText("Physical key for letter q");
    await user.clear(qInput);
    await user.click(within(dialog).getByRole("button", { name: /Save mappings/i }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringContaining("must be assigned")
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the diff and closes when mappings are valid", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        language="en"
        keyboardLayoutOverrides={{}}
        onSave={onSave}
      />
    );
    const dialog = getDialog();
    const qInput = within(dialog).getByLabelText("Physical key for letter q");
    // Use "9" so we do not collide with the physical key already used for another letter (e.g. "x" for x).
    fireEvent.change(qInput, { target: { value: "9" } });
    await user.click(within(dialog).getByRole("button", { name: /Save mappings/i }));
    expect(onSave).toHaveBeenCalledWith({ en: { q: "9" } });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the current language after confirming the alert", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "x" } }}
        onSave={onSave}
      />
    );
    const mainDialog = getDialog();
    await user.click(within(mainDialog).getByRole("button", { name: /Reset English/i }));
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: /^Reset$/i }));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it("resets all languages after confirming the alert", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={onOpenChange}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "x" }, ru: { й: "k" } }}
        onSave={onSave}
      />
    );

    const mainDialog = getDialog();
    await user.click(within(mainDialog).getByRole("button", { name: /Reset all languages/i }));
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: /^Reset$/i }));

    expect(onSave).toHaveBeenCalledWith({});
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not save when reset confirmation is canceled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "x" } }}
        onSave={onSave}
      />
    );

    const mainDialog = getDialog();
    await user.click(within(mainDialog).getByRole("button", { name: /Reset English/i }));
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: /^Cancel$/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("reloads rows from persisted overrides when reopened", async () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "9" } }}
        onSave={onSave}
      />
    );

    const qInput = within(getDialog()).getByLabelText("Physical key for letter q");
    fireEvent.change(qInput, { target: { value: "m" } });
    expect(qInput).toHaveValue("m");

    rerender(
      <KeyboardMappingDialog
        open={false}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "9" } }}
        onSave={onSave}
      />
    );
    rerender(
      <KeyboardMappingDialog
        open={true}
        onOpenChange={() => {}}
        language="en"
        keyboardLayoutOverrides={{ en: { q: "9" } }}
        onSave={onSave}
      />
    );

    expect(within(getDialog()).getByLabelText("Physical key for letter q")).toHaveValue("9");
  });
});
