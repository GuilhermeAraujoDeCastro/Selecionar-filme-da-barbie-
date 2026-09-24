import { defineConfig } from "@playwright/test";

// So cobre o fluxo critico do modo visitante (js/main.js nao tem teste
// automatizado de outro jeito - precisa de navegador de verdade). Usa o
// mesmo servidor estatico do dev local (scripts/dev-static-server.js),
// numa porta propria pra nao brigar com um `npm run dev` que ja esteja rodando.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    // Service worker bloqueado: senao ele buscaria os arquivos por fora dos mocks de rede.
    serviceWorkers: "block",
  },
  webServer: {
    command: "node scripts/dev-static-server.js",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    env: { PORT: "4173" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
