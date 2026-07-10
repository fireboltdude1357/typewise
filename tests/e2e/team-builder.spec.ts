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

test("signs in and round-trips a team through cloud sync", async ({
  isMobile,
  page,
}) => {
  const email = process.env.E2E_CLERK_EMAIL;
  const password = process.env.E2E_CLERK_PASSWORD;
  test.skip(isMobile, "The cloud round-trip runs once in the desktop project.");
  test.skip(!email || !password, "Clerk test credentials were not provided.");

  const teamName = `Production check ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: /Gen I Kanto/i }).click();
  await expect(
    page.getByRole("heading", { name: /Choose your Pokémon/i }),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Sign in to save" }).click();
  await page.getByLabel(/email address/i).fill(email!);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/^password$/i).fill(password!);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const savedTeams = page.getByLabel("Open a saved team");
  await expect(savedTeams).toBeEnabled({ timeout: 20_000 });
  await page.getByPlaceholder("Search name or #...").fill("Bulbasaur");
  await page
    .getByRole("button", { name: "Add Bulbasaur to team" })
    .click({ force: true });
  await page.getByPlaceholder("Name this team").fill(teamName);
  const savedOption = savedTeams.locator("option").filter({ hasText: teamName });
  const deleteSavedTeam = page.getByRole("button", {
    name: "Delete current saved team",
  });
  let saveAttempted = false;

  try {
    saveAttempted = true;
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(savedTeams).toBeEnabled({ timeout: 20_000 });
    await savedTeams.selectOption({ label: `${teamName} · Gen 1` });
    await expect(deleteSavedTeam).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Bulbasaur", { exact: true }).last(),
    ).toBeVisible();
  } finally {
    if (saveAttempted) {
      await savedOption
        .first()
        .waitFor({ state: "attached", timeout: 10_000 })
        .catch(() => undefined);
      if (await savedOption.count()) {
        if (!(await deleteSavedTeam.isVisible())) {
          await savedTeams.selectOption({ label: `${teamName} · Gen 1` });
          await deleteSavedTeam.waitFor({ state: "visible", timeout: 20_000 });
        }
        page.once("dialog", (dialog) => dialog.accept());
        await deleteSavedTeam.click();
      }
    }
  }

  await expect(savedOption).toHaveCount(0);
});
