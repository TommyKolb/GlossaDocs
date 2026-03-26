import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "@/app/hooks/useAutoSave";
import { AUTO_SAVE_DELAY_MS } from "@/app/utils/constants";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onSave once after AUTO_SAVE_DELAY_MS when there are unsaved changes", () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave(true, onSave));

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not call onSave when there are no unsaved changes", () => {
    const onSave = vi.fn();
    renderHook(() => useAutoSave(false, onSave));

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("clears a pending save when unsaved changes become false before the delay elapses", () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(({ dirty }: { dirty: boolean }) => useAutoSave(dirty, onSave), {
      initialProps: { dirty: true }
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS - 1);
    });
    expect(onSave).not.toHaveBeenCalled();

    rerender({ dirty: false });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount so onSave does not run after unmount", () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useAutoSave(true, onSave));

    act(() => {
      vi.advanceTimersByTime(AUTO_SAVE_DELAY_MS - 1);
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});
