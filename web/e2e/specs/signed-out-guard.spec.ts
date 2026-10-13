import { test, expect } from "../fixtures";
import { launchApp, visit } from "../pages/launch";
import { signIn } from "../pages/signIn";

test("a signed-out visitor on a signed-in page is sent to the sign-in screen", async ({ page, baseURL, fakeApi }) => {
  void fakeApi; // Every screen calls /healthz, so the fake API must be listening.

  await launchApp(page, baseURL!);
  await expect(page).toHaveURL(/\/signin$/);
  await signIn.expectVisible(page);

  await visit(page, "/chores");
  await expect(page).toHaveURL(/\/signin$/);
  await signIn.expectVisible(page);
});
