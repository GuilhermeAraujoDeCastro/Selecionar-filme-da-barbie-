// Roda no build do Netlify (veja netlify.toml) pra gerar js/config.js a
// partir das variáveis de ambiente do site, em vez de commitar as chaves
// no repositório. Localmente isso não precisa rodar: edite js/config.js
// direto (veja o README, seção "Como rodar").
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
    `Aviso: faltam estas variáveis de ambiente no Netlify: ${faltando.join(", ")}. ` +
      "O site publica mesmo assim, mas a busca de filmes e/ou o login com Google não vão funcionar até configurar."
  );
}

const conteudo = `// Gerado automaticamente pelo build do Netlify (scripts/generate-config.js).
// Não edite este arquivo no repositório publicado — edite as variáveis de
// ambiente do site (Site configuration > Environment variables).
export const TMDB_API_KEY = ${JSON.stringify(process.env.TMDB_API_KEY || "")};

export const FIREBASE_CONFIG = {
  apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY || "")},
  authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || "")},
  projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID || "")},
  storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET || "")},
  messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || "")},
  appId: ${JSON.stringify(process.env.FIREBASE_APP_ID || "")},
};
`;

writeFileSync(new URL("../js/config.js", import.meta.url), conteudo);
console.log("js/config.js gerado a partir das variáveis de ambiente.");
