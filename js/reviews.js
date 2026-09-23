// Validacao da resenha curta (texto livre por filme). Funcao pura, mesmo
// estilo de ratings.js: so aceita string dentro do limite, o resto vira
// null pra quem chamou decidir o que fazer (normalmente: nao salvar).

const MAX_LENGTH = 500;

export function validateReview(text) {
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length > MAX_LENGTH) {
    return null;
  }
  return trimmed;
}
