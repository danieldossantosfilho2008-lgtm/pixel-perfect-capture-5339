import { describe, expect, it } from "vitest";
import { bloqueioTransicao, calcularConsumo, parseBRL, valorPedido } from "@/lib/pedidos";
import { calcularPrecoLimite, calcularPrecoReal } from "@/lib/precos";

const base = { preco_real: 100, preco_venda: 150, valor_cancelamento: 150 };

describe("valor do pedido por status", () => {
  it("Orçamento usa o preço real", () => expect(valorPedido({ ...base, status: "orcamento" })).toBe(100));
  it("Aprovado usa o preço de venda", () => expect(valorPedido({ ...base, status: "aprovado" })).toBe(150));
  it("Concluído usa o preço de venda", () => expect(valorPedido({ ...base, status: "concluido" })).toBe(150));
  it("Cancelado usa o valor preservado antes do cancelamento", () =>
    expect(valorPedido({ ...base, valor_cancelamento: 100, status: "cancelado" })).toBe(100));
  it("preço real não calculado fica nulo, não zero", () =>
    expect(valorPedido({ ...base, preco_real: null, status: "orcamento" })).toBeNull());
});

describe("transições", () => {
  it("bloqueia aprovar sem preço de venda", () => expect(bloqueioTransicao("orcamento", "aprovado", null)).not.toBeNull());
  it("permite aprovar com preço de venda", () => expect(bloqueioTransicao("orcamento", "aprovado", 10)).toBeNull());
  it("permite cancelar orçamento sem preço de venda", () =>
    expect(bloqueioTransicao("orcamento", "cancelado", null)).toBeNull());
});

describe("consumo", () => {
  it("tecido = largura × altura × peças", () => expect(calcularConsumo("tecido", 2, 1.5, 2)).toBe(6));
  it("tecido sem dimensões é inválido", () => expect(calcularConsumo("tecido", 1, null, 2)).toBeNull());
  it("dimensão negativa é inválida", () => expect(calcularConsumo("tecido", 1, -1, 2)).toBeNull());
  it("trilhos consome a quantidade em unidades", () => expect(calcularConsumo("trilhos", 3, 2, 1)).toBe(3));
});

describe("preços", () => {
  it("preço real não calculado sem percentual", () => expect(calcularPrecoReal([{ preco_unitario: 10, consumo: 1 }])).toBeNull());
  it("preço limite ainda não implementado", () => expect(calcularPrecoLimite([])).toBeNull());
  it("lê reais no padrão brasileiro", () => expect(parseBRL("R$ 1.250,50")).toBe(1250.5));
  it("rejeita valor negativo", () => expect(parseBRL("-5")).toBeNaN());
});
