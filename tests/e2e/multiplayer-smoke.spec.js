const { test, expect } = require("@playwright/test");

async function attachDialogHandler(page) {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
}

async function createTwoPlayerMatch(browser, baseURL) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  await attachDialogHandler(hostPage);
  await attachDialogHandler(guestPage);

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
  await expect(guestPage.locator(".arena-board")).toBeVisible();

  return { hostContext, guestContext, hostPage, guestPage };
}

async function createFourPlayerMatch(browser, baseURL) {
  const hostContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const thirdContext = await browser.newContext();
  const fourthContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const secondPage = await secondContext.newPage();
  const thirdPage = await thirdContext.newPage();
  const fourthPage = await fourthContext.newPage();

  await Promise.all([
    attachDialogHandler(hostPage),
    attachDialogHandler(secondPage),
    attachDialogHandler(thirdPage),
    attachDialogHandler(fourthPage),
  ]);

  await hostPage.goto(baseURL);
  await hostPage.getByLabel("Your Name").first().fill("Host");
  await hostPage.locator("#create-size").selectOption("4");
  await hostPage.getByRole("button", { name: "Create Lobby" }).click();

  await expect(hostPage.locator("#invite-link")).toContainText("/?lobby=");
  const inviteText = await hostPage.locator("#invite-link").textContent();
  const lobbyCode = inviteText.trim().split("lobby=")[1];

  async function joinPlayer(page, name) {
    await page.goto(baseURL);
    await page.locator("#join-name").fill(name);
    await page.locator("#join-code").fill(lobbyCode);
    await page.getByRole("button", { name: "Join Lobby" }).click();
  }

  await joinPlayer(secondPage, "Second");
  await joinPlayer(thirdPage, "Third");
  await joinPlayer(fourthPage, "Fourth");

  await expect(hostPage.locator("#lobby-roster")).toContainText("Host");
  await expect(hostPage.locator("#lobby-roster")).toContainText("Second");
  await expect(hostPage.locator("#lobby-roster")).toContainText("Third");
  await expect(hostPage.locator("#lobby-roster")).toContainText("Fourth");

  async function setCharacters(page, indexes) {
    await page.locator("#setup-Parliament").selectOption({ index: indexes[0] });
    await page.locator("#setup-Base").selectOption({ index: indexes[1] });
    await page.locator("#setup-Office").selectOption({ index: indexes[2] });
    await page.locator("#ready-button").click();
  }

  await setCharacters(hostPage, [0, 1, 2]);
  await setCharacters(secondPage, [3, 4, 5]);
  await setCharacters(thirdPage, [6, 7, 8]);
  await setCharacters(fourthPage, [1, 8, 9]);

  await expect(hostPage.locator(".arena-board")).toBeVisible();
  await expect(secondPage.locator(".arena-board")).toBeVisible();
  await expect(thirdPage.locator(".arena-board")).toBeVisible();
  await expect(fourthPage.locator(".arena-board")).toBeVisible();

  return {
    hostContext,
    secondContext,
    thirdContext,
    fourthContext,
    hostPage,
    secondPage,
    thirdPage,
    fourthPage,
  };
}

async function queueStrike(page, enemySeat, towerName) {
  await page.locator('[data-category="attack"]').click();
  await page.locator('[data-move="Strike"]').click();
  await page.locator(`[data-tower-seat="${enemySeat}"][data-tower-name="${towerName}"]`).click();
}

test("two players can create, join, lock characters, and reach the arena", async ({ browser, baseURL }) => {
  const { hostContext, guestContext, hostPage } = await createTwoPlayerMatch(browser, baseURL);

  await expect(hostPage.locator(".arena-dock")).toBeVisible();
  await expect(hostPage.locator(".arena-field .arena-tower")).toHaveCount(6);
  await expect(hostPage.locator(".arena-board")).toContainText("No orders queued yet.");

  await hostContext.close();
  await guestContext.close();
});

test("four players can fill a lobby and load the 12-tower arena", async ({ browser, baseURL }) => {
  const {
    hostContext,
    secondContext,
    thirdContext,
    fourthContext,
    hostPage,
  } = await createFourPlayerMatch(browser, baseURL);

  await expect(hostPage.locator(".arena-dock")).toBeVisible();
  await expect(hostPage.locator(".arena-field .arena-tower")).toHaveCount(12);
  await expect(hostPage.locator(".arena-field .arena-nation")).toHaveCount(4);

  await hostContext.close();
  await secondContext.close();
  await thirdContext.close();
  await fourthContext.close();
});

test("players can submit turns and see logs update after day resolution", async ({ browser, baseURL }) => {
  const { hostContext, guestContext, hostPage, guestPage } = await createTwoPlayerMatch(browser, baseURL);

  await queueStrike(hostPage, 1, "Parliament");

  await expect(hostPage.locator(".orders-queue")).toContainText("Strike");
  await hostPage.locator('[data-submit-turn="1"]').click();
  await expect(hostPage.locator('[data-submit-turn="1"]')).toContainText("Turn Submitted");
  await expect(hostPage.locator('[data-submit-turn="1"]')).toBeDisabled();

  await guestPage.locator('[data-submit-turn="1"]').click();

  await expect(hostPage.locator("#turn-heading")).toContainText("Day 2");
  await expect(hostPage.locator("#log-tabs")).toContainText("Day 1");
  await expect(hostPage.locator("#global-log")).toContainText("Strike: Successful");
  await expect(hostPage.locator("#global-log")).toContainText("War Day:");

  await hostContext.close();
  await guestContext.close();
});
