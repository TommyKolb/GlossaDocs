import userEvent from "@testing-library/user-event";
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Editor } from "@/app/components/Editor";

const { getUserSettingsMock, updateUserSettingsMock } = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn()
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

describe("Editor keyboard mapping integration", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getUserSettingsMock.mockResolvedValue({
      lastUsedLocale: "ru-RU",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    updateUserSettingsMock.mockResolvedValue({
      lastUsedLocale: "ru-RU",
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

  it("applies key remapping on keydown only while keyboard mode is visible", async () => {
    render(<Editor documentId={null} onBack={() => {}} />);
    const textbox = await screen.findByRole("textbox", { name: /Document editor for/i });

    const remappedEvent = createEvent.keyDown(textbox, { key: "j", code: "KeyJ" });
    fireEvent(textbox, remappedEvent);
    expect(remappedEvent.defaultPrevented).toBe(true);

    await userEvent.setup().click(screen.getByRole("button", { name: /Hide on-screen keyboard/i }));

    const plainEvent = createEvent.keyDown(textbox, { key: "j", code: "KeyJ" });
    fireEvent(textbox, plainEvent);
    expect(plainEvent.defaultPrevented).toBe(false);
  });

  it("does not remap while native composition is active", async () => {
    render(<Editor documentId={null} onBack={() => {}} />);
    const textbox = await screen.findByRole("textbox", { name: /Document editor for/i });

    const composingEvent = createEvent.keyDown(textbox, {
      key: "j",
      code: "KeyJ",
      isComposing: true
    });
    fireEvent(textbox, composingEvent);
    expect(composingEvent.defaultPrevented).toBe(false);
  });

  it("composes Simplified Chinese from pinyin typed in the editor", async () => {
    getUserSettingsMock.mockResolvedValueOnce({
      lastUsedLocale: "zh-CN",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    render(<Editor documentId={null} onBack={() => {}} />);
    const textbox = await screen.findByRole("textbox", { name: /Document editor for/i });

    for (const key of ["n", "i", "h", "a", "o"]) {
      const event = createEvent.keyDown(textbox, { key, code: `Key${key.toUpperCase()}` });
      fireEvent(textbox, event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(screen.getByRole("textbox", { name: /Pinyin buffer/i })).toHaveValue("nihao");

    const acceptFirst = createEvent.keyDown(textbox, { key: " " });
    fireEvent(textbox, acceptFirst);

    expect(acceptFirst.defaultPrevented).toBe(true);
    expect(window.document.execCommand).toHaveBeenCalledWith("insertText", false, "你好");
  });

  it("selects Traditional Chinese candidates by number and lets composition events pass through", async () => {
    getUserSettingsMock.mockResolvedValueOnce({
      lastUsedLocale: "zh-TW",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    render(<Editor documentId={null} onBack={() => {}} />);
    const textbox = await screen.findByRole("textbox", { name: /Document editor for/i });

    const composingEvent = createEvent.keyDown(textbox, {
      key: "x",
      code: "KeyX",
      isComposing: true
    });
    fireEvent(textbox, composingEvent);
    expect(composingEvent.defaultPrevented).toBe(false);

    for (const key of ["x", "i", "e", "x", "i", "e"]) {
      fireEvent.keyDown(textbox, { key, code: `Key${key.toUpperCase()}` });
    }

    const chooseFirst = createEvent.keyDown(textbox, { key: "1" });
    fireEvent(textbox, chooseFirst);

    expect(chooseFirst.defaultPrevented).toBe(true);
    expect(window.document.execCommand).toHaveBeenCalledWith("insertText", false, "謝謝");
  });

  it("clears the Chinese pinyin buffer when the input panel is hidden", async () => {
    getUserSettingsMock.mockResolvedValueOnce({
      lastUsedLocale: "zh-CN",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
    render(<Editor documentId={null} onBack={() => {}} />);
    const textbox = await screen.findByRole("textbox", { name: /Document editor for/i });
    const user = userEvent.setup();

    for (const key of ["n", "i"]) {
      fireEvent.keyDown(textbox, { key, code: `Key${key.toUpperCase()}` });
    }
    expect(screen.getByRole("textbox", { name: /Pinyin buffer/i })).toHaveValue("ni");

    await user.click(screen.getByRole("button", { name: /Hide pinyin input/i }));
    expect(screen.queryByRole("textbox", { name: /Pinyin buffer/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show pinyin input/i }));
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Pinyin buffer/i })).toHaveValue("");
    });
  });

  it("shows an error and restores previous mappings when saving overrides fails", async () => {
    const { toast } = await import("sonner");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      updateUserSettingsMock.mockRejectedValueOnce(new Error("network down"));

      render(<Editor documentId={null} onBack={() => {}} />);
      await screen.findByRole("button", { name: /Customize Russian keyboard mappings/i });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /Customize Russian keyboard mappings/i }));
      const dialog = screen.getByRole("dialog", { name: /Customize keyboard/i });
      const jInput = within(dialog).getByLabelText("Physical key for letter й");
      await user.clear(jInput);
      await user.type(jInput, "9");
      await user.click(within(dialog).getByRole("button", { name: /Save mappings/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          expect.stringContaining("Failed to save keyboard mappings")
        );
      });

      await user.click(screen.getByRole("button", { name: /Customize Russian keyboard mappings/i }));
      const reopened = screen.getByRole("dialog", { name: /Customize keyboard/i });
      expect(within(reopened).getByLabelText("Physical key for letter й")).toHaveValue("j");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
