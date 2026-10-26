import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type Auth } from "../auth/AuthContext";
import { mount } from "../testing";
import { Gate } from "./Gate";

type Reply = { status: number; data?: unknown };
const get = vi.fn<(url: string) => Promise<Reply>>();
vi.mock("../api/client", () => ({
  apiClient: { get: (url: string) => get(url) },
  NotSignedIn: class NotSignedIn extends Error {},
}));

const { render, container } = mount();

async function renderGate(reply: () => Promise<Reply>) {
  get.mockImplementation(reply);
  const signOut = vi.fn();
  const auth: Auth = { signedIn: true, signIn: async () => null, signOut };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AuthContext value={auth}>
        <Gate>
          <p>the app</p>
        </Gate>
      </AuthContext>
    </QueryClientProvider>,
  );
  return { signOut };
}

describe("Gate", () => {
  it("renders the children on a 200, after asking GET /admin/me", async () => {
    await renderGate(async () => ({ status: 200, data: { environment: "staging" } }));
    expect(get).toHaveBeenCalledWith("/admin/me");
    expect(container().textContent).toContain("the app");
  });

  it("shows the not-allowed screen on a 403 and mounts nothing else", async () => {
    const { signOut } = await renderGate(async () => ({ status: 403, data: { error: "forbidden" } }));
    expect(container().textContent).toContain("This account is not allowed here");
    expect(container().textContent).not.toContain("the app");
    container().querySelector("button")!.click();
    expect(signOut).toHaveBeenCalled();
  });

  it("signs out on a 401, which shows sign-in", async () => {
    const { signOut } = await renderGate(async () => ({ status: 401 }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(container().textContent).not.toContain("the app");
  });

  it("shows a retry message on a network error, without the children", async () => {
    await renderGate(async () => {
      throw new Error("Network Error");
    });
    expect(container().textContent).toContain("Could not reach the API");
    expect(container().textContent).toContain("Try again");
    expect(container().textContent).not.toContain("the app");
  });

  it("keeps the session and offers a retry when the token refresh could not reach Cognito", async () => {
    const { signOut } = await renderGate(async () => {
      throw new Error("could not reach the sign-in service");
    });
    expect(container().textContent).toContain("Could not reach the API");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("shows only a status while the answer is pending", async () => {
    await renderGate(() => new Promise(() => {}));
    expect(container().textContent).toBe("Checking your access…");
  });
});
