// Roda no build da Vercel (veja vercel.json) pra gerar js/config.js a
// partir das variaveis de ambiente do site, em vez de commitar as chaves
// no repositorio. Localmente isso nao precisa rodar: edite js/config.js
// direto (veja o README, secao "Como rodar").
import { writeFileSync } from "node:fs";

const obrigatorias = [
  "TMDB_API_KEY",
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];

const faltando = obrigatorias.filter((nome) => !process.env[nome]);
if (faltando.length > 0) {
  console.warn(
    `Aviso: faltam estas variaveis de ambiente na Vercel: ${faltando.join(", ")}. ` +
      "O site publica mesmo assim, mas a busca de filmes e/ou o login com Google nao vao funcionar ate configurar."
  );
}

const conteudo = `// Gerado automaticamente pelo build da Vercel (scripts/generate-config.js).
// Nao edite este arquivo no repositorio publicado: edite as variaveis de
// ambiente do projeto (Project Settings > Environment Variables).
export const TMDB_API_KEY = ${JSON.stringify(process.env.TMDB_API_KEY || "")};

export const FIREBASE_CONFIG = {
  apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY || "")},
  authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || "")},
  projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID || "")},
  storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET || "")},
  messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || "")},
  appId: ${JSON.stringify(process.env.FIREBASE_APP_ID || "")},
};

// Ambos opcionais - string vazia desativa, sem precisar de nenhuma conta
// pro resto do site funcionar (veja js/config.example.js).
export const SENTRY_DSN = ${JSON.stringify(process.env.SENTRY_DSN || "")};

export const VAPID_PUBLIC_KEY = ${JSON.stringify(process.env.VAPID_PUBLIC_KEY || "")};
`;

writeFileSync(new URL("../js/config.js", import.meta.url), conteudo);
console.log("js/config.js gerado a partir das variaveis de ambiente.");
