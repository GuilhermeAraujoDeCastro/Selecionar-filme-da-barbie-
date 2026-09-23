// Atrasa a chamada de fn ate parar de ser chamado por delayMs seguidos -
// usado no campo de busca pra nao re-renderizar a cada tecla digitada.
export function debounce(fn, delayMs) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}
