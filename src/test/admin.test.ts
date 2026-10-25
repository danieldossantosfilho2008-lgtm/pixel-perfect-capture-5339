import { describe, expect, it } from "vitest";
import { agruparPorDia, calcularComissao, corTexto } from "@/lib/admin";

describe("comissão = % sobre o preço de venda", () => {
  it("5% de R$ 1.000 = R$ 50", () => expect(calcularComissao(1000, 5)).toBe(50));
  it("sem preço de venda não calcula", () => expect(calcularComissao(null, 5)).toBeNull());
  it("sem percentual não calcula", () => expect(calcularComissao(1000, null)).toBeNull());
});

describe("contraste dos cards", () => {
  it("texto branco sobre azul escuro", () => expect(corTexto("#1e3a8a")).toBe("#ffffff"));
  it("texto escuro sobre amarelo claro", () => expect(corTexto("#fde68a")).toBe("#111111"));
});

describe("agrupamento de vendas concluídas", () => {
  const vendas = [
    { pedido_id: "a", concluido_em: "2026-10-02T15:00:00", preco_venda: 1000 },
    { pedido_id: "b", concluido_em: "2026-10-02T16:00:00", preco_venda: null },
    { pedido_id: "c", concluido_em: "2026-10-03T10:00:00", preco_venda: 500 },
  ];
  it("total igual à soma do gráfico e vendas sem preço contadas mas fora dos valores", () => {
    const r = agruparPorDia(vendas, "2026-10-01", "2026-10-03", 10);
    expect(r.pontos).toHaveLength(3);
    expect(r.total).toBe(3);
    expect(r.valor).toBe(1500);
    expect(r.comissao).toBe(150);
    expect(r.semPreco).toBe(1);
  });
  it("sem percentual, comissão fica não calculada", () => {
    expect(agruparPorDia(vendas, "2026-10-01", "2026-10-03", null).comissao).toBeNull();
  });
});
