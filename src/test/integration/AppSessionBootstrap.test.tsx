import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthenticatedUserFromBackendMock, setSessionOverrideMock } = vi.hoisted(() => ({
  getAuthenticatedUserFromBackendMock: vi.fn(),
  setSessionOverrideMock: vi.fn()
}));

vi.mock("@/app/components/DocumentList", () => ({
  DocumentList: () => <div data-testid="document-list">Document list</div>
}));
vi.mock("@/app/components/Editor", () => ({
  Editor: () => <div />
}));
vi.mock("@/app/components/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));
vi.mock("@/app/components/ui/sonner", () => ({
  Toaster: () => <div />
}));
vi.mock("@/app/utils/auth", async () => {
  const actual = await vi.importActual<typeof import("@/app/utils/auth")>("@/app/utils/auth");
  return {
    ...actual,
    getAuthenticatedUserFromBackend: getAuthenticatedUserFromBackendMock,
    setSessionOverride: setSessionOverrideMock
  };
});

import App from "@/app/App";

describe("App session bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders authenticated shell when backend session bootstrap succeeds", async () => {
    getAuthenticatedUserFromBackendMock.mockResolvedValue({
      id: "user-1",
      username: "alice",
      email: "alice@example.com",
      isGuest: false
    });

    render(<App />);
    expect(await screen.findByTestId("document-list")).toBeInTheDocument();
    expect(setSessionOverrideMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", isGuest: false })
    );
  });

  it("renders unauthenticated shell when backend session is unavailable", async () => {
    getAuthenticatedUserFromBackendMock.mockResolvedValue(null);

    render(<App />);
    expect(await screen.findByTestId("create-account-button")).toBeInTheDocument();
  });
});
