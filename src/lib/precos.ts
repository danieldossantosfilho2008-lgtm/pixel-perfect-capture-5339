/**
 * Regras de preço dos pedidos. Mantidas separadas da interface.
 * O preço real depende do percentual de lucro administrativo, que ainda não existe:
 * enquanto não houver configuração, o resultado é null ("Não calculado").
 * O preço limite terá função oficial futura; nesta etapa retorna sempre null.
 */
export interface ItemPreco {
  preco_unitario: number;
  consumo: number;
}

export function calcularPrecoReal(_itens: ItemPreco[], percentualLucro: number | null = null): number | null {
  if (percentualLucro == null) return null;
  // A fórmula oficial será definida junto com a configuração administrativa.
  return null;
}

export function calcularPrecoLimite(_itens: ItemPreco[]): number | null {
  return null;
}
