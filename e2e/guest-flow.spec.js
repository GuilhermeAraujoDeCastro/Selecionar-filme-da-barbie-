import { test, expect } from "@playwright/test";

// A TMDB de verdade nunca e' chamada: config.js e a API sao interceptados na rede.
// Nada e' gravado em disco, entao o js/config.js local de quem roda o teste fica intacto.
const FAKE_CONFIG = [
  'export const TMDB_API_KEY = "chave-de-teste";',
  "export const FIREBASE_CONFIG = null;",
  'export const SENTRY_DSN = "";',
  'export const VAPID_PUBLIC_KEY = "";',
  "",
].join("\n");

const MOCK_MOVIES = [
  {
    id: 1,
    title: "Barbie as Rapunzel",
    release_date: "2002-10-08",
    poster_path: null,
    overview: "Uma Barbie presa numa torre, sonhando em ver o mundo.",
    genre_ids: [16, 10751],
    original_language: "en",
    vote_count: 1296,
  },
];

async function mockTmdb(page) {
  await page.route("**/js/config.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_CONFIG }),
  );
  await page.route("**/3/discover/movie**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [], total_pages: 1 }) }),
  );
  await page.route("**/3/search/movie**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: MOCK_MOVIES, total_pages: 1 }) }),
  );
  await page.route("**/3/search/collection**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) }),
  );
  await page.route("**/3/genre/movie/list**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ genres: [] }) }),
  );
}

test("modo visitante: marcar assistido, dar nota, e o progresso sobrevive a um reload", async ({ page }) => {
  await mockTmdb(page);

  await page.goto("/");
  await page.getByPlaceholder("Ex: Ana").fill("Malibu");
  await page.locator("#guest-form button[type=submit]").click();

  const collectionCard = page.locator("#movie-grid .movie-card", { hasText: "Barbie as Rapunzel" });
  await expect(collectionCard).toBeVisible();
  await collectionCard.locator(".watched-checkbox").check();
  await collectionCard.getByRole("button", { name: "Dar nota 5" }).click();

  await page.locator('.nav-btn[data-view="profile"]').click();
  const profileCard = page.locator("#watched-grid .movie-card", { hasText: "Barbie as Rapunzel" });
  await expect(profileCard).toBeVisible();
  await expect(profileCard.locator(".star.filled")).toHaveCount(5);

  // Recarrega a pagina - o app reabre a sessao do ultimo visitante sozinho
  // (tryAutoLoginGuest em js/main.js), sem pedir o nome de novo, entao o
  // progresso deve continuar la' vindo do localStorage.
  await page.reload();
  await page.locator('.nav-btn[data-view="profile"]').click();
  await expect(page.locator("#watched-grid .movie-card", { hasText: "Barbie as Rapunzel" })).toBeVisible();
});

test("abrir a ficha do filme mostra a sinopse e guarda a resenha", async ({ page }) => {
  await mockTmdb(page);
  await page.route("**/3/movie/1?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        overview: "Sinopse completa vinda da ficha do filme.",
        runtime: 81,
        credits: { cast: [{ name: "Kelsey Grammer" }] },
      }),
    }),
  );

  await page.goto("/");
  await page.getByPlaceholder("Ex: Ana").fill("Skipper");
  await page.locator("#guest-form button[type=submit]").click();

  await page.locator("#movie-grid .movie-card h3").first().click();
  await expect(page.locator("#detail-content")).toContainText("Sinopse completa vinda da ficha do filme.");
  await expect(page.locator("#detail-content")).toContainText("Kelsey Grammer");

  await page.locator("#review-textarea").fill("Adorei esse classico!");
  await page.waitForTimeout(600); // da tempo do debounce (400ms) salvar antes de fechar
  await page.locator("#detail-close-btn").click();

  await page.locator("#movie-grid .movie-card h3").first().click();
  await expect(page.locator("#review-textarea")).toHaveValue("Adorei esse classico!");
});

test("card focado abre a ficha com Enter e Esc fecha", async ({ page }) => {
  await mockTmdb(page);
  await page.goto("/");
  await page.getByPlaceholder("Ex: Ana").fill("Teresa");
  await page.locator("#guest-form button[type=submit]").click();

  const card = page.locator("#movie-grid .movie-card").first();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Detalhes do filme" })).toBeVisible();
  await expect(page.locator("#detail-close-btn")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Detalhes do filme" })).toBeHidden();
});

test("sair da conta volta pra tela inicial em vez de entrar num visitante salvo", async ({ page }) => {
  await mockTmdb(page);
  await page.goto("/");
  await page.getByPlaceholder("Ex: Ana").fill("Chelsea");
  await page.locator("#guest-form button[type=submit]").click();
  await page.locator('.nav-btn[data-view="profile"]').click();
  await page.locator("#logout-btn").click();
  await page.reload();
  await expect(page.locator("#onboarding")).toBeVisible();
});
