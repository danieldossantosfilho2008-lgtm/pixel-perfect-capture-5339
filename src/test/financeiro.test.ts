import { describe, expect, it } from "vitest";
import { aceitaRecebimento, pendenciaFinanceira, resultadoCaixa, valorMaterial, periodoFinanceiro } from "@/lib/financeiro";
describe("regras financeiras aprovadas", () => {
  it("resultado é recebimento efetivo menos saída", () => expect(resultadoCaixa(150,40)).toBe(110));
  it("pagamento parcial reduz pendência", () => expect(pendenciaFinanceira("aprovado",150,40)).toBe(110));
  it("pagamento integral zera pendência", () => expect(pendenciaFinanceira("concluido",150,150)).toBe(0));
  it("cancelamento zera cobrança sem alterar dinheiro recebido", () => expect(pendenciaFinanceira("cancelado",150,40)).toBe(0));
  it("estorno de 10 sobre pagamento de 40 reabre pendência de 120", () => expect(pendenciaFinanceira("aprovado",150,40-10)).toBe(120));
  it("orçamento não recebe pagamentos", () => expect(aceitaRecebimento("orcamento")).toBe(false));
  it("aprovado pode receber pagamentos", () => expect(aceitaRecebimento("aprovado")).toBe(true));
  it("materiais usam preço histórico vezes consumo", () => expect(valorMaterial(10,6)).toBe(60));
  it("últimos 30 dias incluem o dia atual", () => expect(periodoFinanceiro("30","11","2026","2026-11-18")).toEqual({ inicio:"2026-10-20", fim:"2026-11-18" }));
});