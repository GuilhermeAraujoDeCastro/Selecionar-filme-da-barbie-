// Exportar/importar o progresso como JSON - sobretudo pro modo visitante,
// que perde tudo se limpar o navegador. Funcao pura: nao mexe em arquivo
// nem em DOM, so' monta/valida o objeto.

export function exportProgressPayload(profile, progress) {
  return {
    exportedAt: new Date().toISOString(),
    profileName: profile.name,
    progress: {
      watched: [...progress.watched],
      ratings: { ...progress.ratings },
      reviews: { ...progress.reviews },
    },
  };
}

// Devolve null em qualquer formato inesperado (JSON invalido, campo
// faltando, tipo errado) pra quem chamou decidir como avisar o usuario -
// mesmo padrao defensivo do resto do projeto (loadLocalProgress etc).
export function parseImportedProgress(rawJson) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const progress = parsed && typeof parsed === "object" ? parsed.progress : null;
  if (!progress || typeof progress !== "object") {
    return null;
  }

  const watched = Array.isArray(progress.watched) ? progress.watched.filter((id) => typeof id === "number") : [];

  const ratings =
    progress.ratings && typeof progress.ratings === "object"
      ? Object.fromEntries(
          Object.entries(progress.ratings).filter(([, value]) => typeof value === "number" && value >= 1 && value <= 5),
        )
      : {};

  const reviews =
    progress.reviews && typeof progress.reviews === "object"
      ? Object.fromEntries(Object.entries(progress.reviews).filter(([, value]) => typeof value === "string"))
      : {};

  return { watched, ratings, reviews };
}
