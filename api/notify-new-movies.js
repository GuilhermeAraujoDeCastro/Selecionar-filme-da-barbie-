// Function agendada da Vercel (cron - veja o bloco "crons" em vercel.json)
// que checa a TMDB por filme novo da franquia Barbie e manda notificacao
// push (Web Push, sem servico de terceiro) pra quem ativou em "Ativar
// notificacoes" no Perfil (js/main.js). Reaproveita a mesma busca do
// site (js/tmdb.js) em vez de duplicar a logica.
//
// Usa o Firebase Admin SDK pra ler/escrever no Firestore - ele ignora as
// regras de seguranca de proposito (so' essa function, do lado do
// servidor, deveria conseguir ler a colecao inteira de inscricoes de
// push). Precisa das variaveis de ambiente de uma conta de servico do
// Firebase (Project Settings > Service Accounts > Generate new private
// key), nao do mesmo FIREBASE_CONFIG publico usado no navegador.

import * as Sentry from "@sentry/node";
import webpush from "web-push";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { searchBarbieMovies } from "../js/tmdb.js";

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export default async function handler(request, response) {
  // A Vercel manda esse header sozinha nas invocacoes de cron de verdade;
  // CRON_SECRET (opcional) trava chamadas manuais na URL publica da function.
  if (process.env.CRON_SECRET && request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    response.status(401).json({ error: "Nao autorizado." });
    return;
  }

  if (!process.env.TMDB_API_KEY) {
    response.status(500).json({ error: "TMDB_API_KEY nao configurada nas variaveis de ambiente da Vercel." });
    return;
  }

  try {
    const db = getDb();
    const movies = await searchBarbieMovies(process.env.TMDB_API_KEY);

    const knownRef = db.collection("meta").doc("knownMovies");
    const knownSnapshot = await knownRef.get();
    const isFirstRun = !knownSnapshot.exists;
    const knownIds = new Set(isFirstRun ? [] : knownSnapshot.data().ids || []);
    const newMovies = movies.filter((movie) => !knownIds.has(movie.id));

    await knownRef.set({ ids: movies.map((movie) => movie.id), updatedAt: Date.now() });

    // 1a execucao de sempre: so' guarda a lista atual como "conhecida", sem
    // notificar - senao todo o catalogo existente viraria "filme novo" e
    // inundaria quem se inscreveu com dezenas de notificacoes de uma vez.
    if (isFirstRun || newMovies.length === 0) {
      response.status(200).json({ checked: movies.length, notified: 0, firstRun: isFirstRun });
      return;
    }

    let notified = 0;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:contato@example.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );
      const payload = JSON.stringify({
        title: newMovies.length === 1 ? "Novo filme da Barbie!" : `${newMovies.length} filmes novos da Barbie!`,
        body: newMovies.map((movie) => movie.title).join(", "),
        url: ".",
      });
      const subscriptionsSnapshot = await db.collection("pushSubscriptions").get();
      await Promise.all(
        subscriptionsSnapshot.docs.map(async (doc) => {
          try {
            await webpush.sendNotification(doc.data().subscription, payload);
            notified += 1;
          } catch (error) {
            console.error(`Push falhou pra ${doc.id}:`, error.message);
          }
        }),
      );
    }

    response.status(200).json({ checked: movies.length, newMovies: newMovies.length, notified });
  } catch (error) {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
    console.error("Erro ao checar filmes novos da Barbie:", error);
    response.status(500).json({ error: error.message });
  }
}
