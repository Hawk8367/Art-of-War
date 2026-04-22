const { test, expect } = require("@playwright/test");

test("two players can create, join, lock characters, and reach the arena", async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await hostPage.goto(baseURL);
  await hostPage.getByLabel("Your Name").first().fill("Host");
  await hostPage.locator("#create-size").selectOption("2");
  await hostPage.getByRole("button", { name: "Create Lobby" }).click();

  await expect(hostPage.locator("#invite-link")).toContainText("/?lobby=");
  const inviteText = await hostPage.locator("#invite-link").textContent();
  const lobbyCode = inviteText.trim().split("lobby=")[1];

  await guestPage.goto(baseURL);
  await guestPage.locator("#join-name").fill("Guest");
  await guestPage.locator("#join-code").fill(lobbyCode);
  await guestPage.getByRole("button", { name: "Join Lobby" }).click();

  await expect(hostPage.locator("#lobby-roster")).toContainText("Host");
  await expect(hostPage.locator("#lobby-roster")).toContainText("Guest");

  await hostPage.locator("#setup-Parliament").selectOption({ index: 0 });
  await hostPage.locator("#setup-Base").selectOption({ index: 1 });
  await hostPage.locator("#setup-Office").selectOption({ index: 2 });
  await hostPage.locator("#ready-button").click();

  await guestPage.locator("#setup-Parliament").selectOption({ index: 3 });
  await guestPage.locator("#setup-Base").selectOption({ index: 4 });
  await guestPage.locator("#setup-Office").selectOption({ index: 5 });
  await guestPage.locator("#ready-button").click();

  await expect(hostPage.locator(".arena-board")).toBeVisible();
  await expect(hostPage.locator(".arena-dock")).toBeVisible();
  await expect(hostPage.locator(".arena-field .arena-tower")).toHaveCount(6);

  await hostContext.close();
  await guestContext.close();
});
