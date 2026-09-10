// Validacao da nota de 1 a 5 estrelas. So aceita inteiro nesse intervalo;
// qualquer outra coisa (texto, decimal, fora do intervalo) volta null pra
// quem chamou decidir o que fazer (normalmente: nao salvar a nota).

export function validateRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }
  return rating;
}

export function averageRating(ratings) {
  const values = Object.values(ratings).filter((value) => value !== null && value !== undefined);
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
