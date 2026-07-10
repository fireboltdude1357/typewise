import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("builds a team, chooses a legal move, analyzes it, and restores the draft", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: /Know your weak side/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Gen IX Paldea/i }).click();
  await expect(
    page.getByRole("heading", { name: /Choose your Pokémon/i }),
  ).toBeVisible({ timeout: 20_000 });

  const pokemonSearch = page.getByPlaceholder("Search name or #...");
  await pokemonSearch.fill("Pikachu");
  await page
    .getByRole("button", { name: "Add Pikachu to team" })
    .click({ force: true });

  await expect(page.getByText("Pikachu", { exact: true }).last()).toBeVisible();
  const mobileMoveButton = page.getByRole("button", {
    name: "Edit Pikachu moves",
  });
  if (await mobileMoveButton.isVisible()) {
    await mobileMoveButton.click({ force: true });
  } else {
    await page.getByRole("button", { name: /Choose legal moves/i }).click();
  }
  await expect(
    page.getByRole("heading", { name: /Find the right coverage/i }),
  ).toBeVisible({ timeout: 20_000 });

  const moveSearch = page.getByPlaceholder("Search moves or effects...");
  await moveSearch.fill("Thunderbolt");
  const thunderbolt = page
    .getByRole("button", { name: /Thunderbolt.*Special.*Power 90/i })
    .last();
  await expect(thunderbolt).toBeVisible();
  await thunderbolt.click();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: /Here's where the team bends/i }),
  ).toBeVisible();
  await expect(page.getByText(/Thunderbolt/).last()).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Choose your Pokémon/i }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Thunderbolt/).last()).toBeVisible();
});

test("searches the full catalog and clears incompatible state when changing generations", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Gen VI Kalos/i }).click();
  await expect(
    page.getByRole("heading", { name: /Choose your Pokémon/i }),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder("Search name or #...").fill("700");
  await expect(page.getByText("Sylveon", { exact: true })).toBeVisible();
  const addSylveon = page.getByRole("button", { name: "Add Sylveon to team" });
  await addSylveon.evaluate((element) =>
    element.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await addSylveon.click({ force: true });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Gen VI/i }).click();
  await expect(
    page.getByRole("heading", { name: /Which era are you building for/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Gen I Kanto/i }).click();
  await expect(page.getByText("0/6 on team")).toBeVisible({ timeout: 20_000 });
});
