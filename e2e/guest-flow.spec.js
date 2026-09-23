import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// TMDB de verdade nunca e' chamada nesse teste (routes mockadas abaixo) - o
// objetivo aqui e' testar o app, nao a TMDB. js/config.js fica de fora do
// git (.gitignore) e normalmente so' existe depois de rodar o build ou de
// copiar config.example.js a mao - aqui geramos um com uma chave falsa so'
// pra passar a checagem de "TMDB_API_KEY configurada"; o valor nunca e'
// usado de verdade, ja que toda chamada a api.themoviedb.org e' interceptada.
writeFileSync(
  join(import.meta.dirname, "..", "js", "config.js"),
  [
    'export const TMDB_API_KEY = "chave-de-teste";',
    "export const FIREBASE_CONFIG = null;",
    'export const SENTRY_DSN = "";',
    'export const VAPID_PUBLIC_KEY = "";',
    "",
  ].join("\n"),
);

const MOCK_MOVIES = [
  {
    id: 1,
    title: "Barbie as Rapunzel",
    release_date: "2002-10-08",
    poster_path: null,
    overview: "Uma Barbie presa numa torre, sonhando em ver o mundo.",
    genre_ids: [],
  },
];

async function mockTmdb(page) {
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
