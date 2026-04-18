import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { logoutMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(async () => undefined)
}));

vi.mock("@/app/utils/auth", async () => {
  const actual = await vi.importActual<typeof import("@/app/utils/auth")>("@/app/utils/auth");
  return {
    ...actual,
    logout: logoutMock
  };
});

import { DocumentListHero } from "@/app/components/DocumentListHero";

describe("DocumentListHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders signed-in identity and calls logout on sign out", async () => {
    render(
      <DocumentListHero
        user={{ id: "user-1", username: "alice", email: "alice@example.com", isGuest: false }}
        onCreateDocument={() => {}}
        onUploadDocument={() => {}}
      />
    );

    expect(screen.getByText(/signed in as/i)).toHaveTextContent("alice@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: /sign out of your account/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("shows guest mode helper and allows exiting guest mode", async () => {
    render(
      <DocumentListHero
        user={{ id: "guest_1", username: "Guest", isGuest: true }}
        onCreateDocument={() => {}}
        onUploadDocument={() => {}}
      />
    );

    expect(screen.getByText(/documents stay on this device only/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /exit guest mode/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
