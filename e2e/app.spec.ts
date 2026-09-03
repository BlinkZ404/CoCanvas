import { expect, test, type Page } from "@playwright/test";

async function fresh(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("cocanvas.board.v1");
    localStorage.setItem("cocanvas.theme", "light");
  });
  await page.goto("/");
}

test.describe("CoCanvas", () => {
  test("loads the board chrome", async ({ page }) => {
    await fresh(page);
    await expect(page.getByRole("heading", { name: "CoCanvas" })).toBeVisible();
    await expect(page.getByRole("main", { name: "Canvas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Rectangle" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
  });

  test("adds a shape, edits it, and undoes", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: "Add Rectangle" }).click();
    await expect(page.locator(".el-rectangle")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Rectangle" })).toBeVisible();

    await page.getByLabel("Label").fill("Delivery address");
    await expect(page.locator(".el-rectangle")).toContainText("Delivery address");

    await page.getByLabel("W", { exact: true }).fill("200");
    await expect(page.getByLabel("W", { exact: true })).toHaveValue("200");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByLabel("W", { exact: true })).toHaveValue("168");
  });

  test("writes a brief and drafts from the agent panel", async ({ page }) => {
    await fresh(page);
    const brief = page.getByRole("textbox", { name: "Brief" });
    await brief.fill("Start, process, end");
    await brief.blur();
    await page.getByRole("button", { name: /Draft from brief/ }).click();
    await expect(page.locator(".el")).not.toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".shape-label", { hasText: "Start" })).toBeVisible();
  });

  test("connects two nodes from the rail", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: "Add Ellipse" }).click();
    await page.getByRole("button", { name: "Add Rectangle" }).click();
    await page.getByLabel("X", { exact: true }).fill("320");
    await page.getByRole("button", { name: "Connect two nodes" }).click();
    await expect(page.getByText("Click the start node")).toBeVisible();
    await page.locator(".el-ellipse").click({ force: true });
    await expect(page.getByText("Click the end node")).toBeVisible();
    await page.locator(".el-rectangle").click({ force: true });
    await expect(page.locator(".connector-line")).toHaveCount(1);
  });

  test("clears the board from a confirm dialog", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: "Add Sticky" }).click();
    await page.getByRole("button", { name: "Clear canvas" }).click();
    await expect(page.getByRole("heading", { name: "Clear the canvas?" })).toBeVisible();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.locator(".el")).toHaveCount(0);
    await expect(page.getByText(/Drag a shape from the toolbar/)).toBeVisible();
  });

  test("switches theme", async ({ page }) => {
    await fresh(page);
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("stacks the inspector on a phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(page);
    const workspace = page.locator(".workspace");
    await expect(workspace).toHaveCSS("grid-template-columns", /390px|100%/);
    await expect(page.getByRole("button", { name: "Add Rectangle" })).toBeVisible();
    const canvas = page.locator(".canvas-surface");
    const side = page.locator(".side");
    const canvasBox = await canvas.boundingBox();
    const sideBox = await side.boundingBox();
    expect(canvasBox && sideBox && sideBox.y > canvasBox.y).toBeTruthy();
  });
});
