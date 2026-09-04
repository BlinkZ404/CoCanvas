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

  test("zooms the board from the dock", async ({ page }) => {
    await fresh(page);
    const reset = page.getByRole("button", { name: "Reset zoom" });
    await expect(reset).toHaveText("100%");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(reset).toHaveText("110%");
    await expect(page.getByRole("main", { name: "Canvas" })).toHaveAttribute("data-zoom", "1.1");
    await reset.click();
    await expect(reset).toHaveText("100%");
  });

  test("switches theme", async ({ page }) => {
    await fresh(page);
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("selects two nodes and exports a PNG", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: "Add Rectangle" }).click();
    await page.getByRole("button", { name: "Add Ellipse" }).click();
    await page.getByLabel("X", { exact: true }).fill("320");
    await page.locator(".el-rectangle").click({ modifiers: ["Shift"] });
    await expect(page.getByRole("heading", { name: "2 selected" })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export PNG" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test("keeps a tall canvas on a phone and opens the agent sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(page);
    const workspace = page.locator(".workspace");
    await expect(workspace).toHaveCSS("grid-template-columns", /390px|100%/);
    await expect(page.getByRole("button", { name: "Add Rectangle" })).toBeVisible();
    const canvas = page.locator(".canvas-surface");
    const side = page.locator(".side");
    const canvasBox = await canvas.boundingBox();
    const sideBox = await side.boundingBox();
    expect(canvasBox && sideBox && sideBox.y >= canvasBox.y + canvasBox.height - 2).toBeTruthy();
    expect(canvasBox && canvasBox.height >= 420).toBeTruthy();

    const status = page.getByRole("button", { name: "Not connected" });
    const statusBox = await status.boundingBox();
    expect(statusBox && statusBox.width >= 36 && statusBox.height >= 36).toBeTruthy();

    await page.getByRole("tab", { name: "Agent" }).click();
    const firstTask = page.getByRole("button", { name: /Astra from the source|Today's frontier|Frontier ranking/ });
    await expect(firstTask).toBeVisible();
    const openCanvas = await canvas.boundingBox();
    expect(openCanvas && openCanvas.height >= 280).toBeTruthy();
  });

  test("keeps every toolbar button on a 320-wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await fresh(page);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflowX).toBeFalsy();

    const names = [
      "Add Frame",
      "Add Rectangle",
      "Add Ellipse",
      "Add Text",
      "Add Sticky",
      "Connect two nodes",
      "Export PNG",
      "Clear canvas",
    ];
    for (const name of names) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box, name).toBeTruthy();
      expect(box!.x, name).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, name).toBeLessThanOrEqual(321);
    }

    const canvas = await page.locator(".canvas-surface").boundingBox();
    expect(canvas && canvas.height >= 200).toBeTruthy();
  });

  test("keeps a usable canvas in phone landscape", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await fresh(page);
    const canvas = await page.locator(".canvas-surface").boundingBox();
    expect(canvas && canvas.height >= 200 && canvas.width >= 600).toBeTruthy();

    const topbar = page.locator(".topbar");
    await expect(topbar).toHaveCSS("flex-wrap", "nowrap");

    const clear = await page.getByRole("button", { name: "Clear canvas" }).boundingBox();
    const toolbar = await page.locator(".toolbar").boundingBox();
    expect(clear && toolbar).toBeTruthy();
    expect(clear!.y).toBeGreaterThanOrEqual(toolbar!.y - 1);
    expect(clear!.y + clear!.height).toBeLessThanOrEqual(toolbar!.y + toolbar!.height + 1);
  });
});
