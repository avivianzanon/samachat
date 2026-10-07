import {
  assertInstanceName,
  normalizeInstance,
  toState
} from "../../../../services/EvolutionServices/EvolutionInstanceService";

describe("Evolution: instancias", () => {
  it("'open' e conectado; qr e connecting viram 'aguardando'", () => {
    expect(toState("open")).toBe("connected");
    expect(toState("connecting")).toBe("connecting");
    expect(toState("close")).toBe("disconnected");
    expect(toState(undefined)).toBe("disconnected");
  });

  it("le o formato novo (v2) da Evolution", () => {
    expect(
      normalizeInstance({
        name: "vendas",
        connectionStatus: "open",
        ownerJid: "5511999990000@s.whatsapp.net",
        profileName: "Chip"
      })
    ).toEqual({
      name: "vendas",
      state: "connected",
      number: "5511999990000",
      profileName: "Chip"
    });
  });

  it("le o formato antigo (v1), com os dados dentro de 'instance'", () => {
    expect(
      normalizeInstance({ instance: { instanceName: "suporte", state: "close" } })
    ).toEqual({ name: "suporte", state: "disconnected", number: null, profileName: null });
  });

  it("so aceita nomes seguros (letras, numeros, - e _)", () => {
    expect(() => assertInstanceName("vendas-01")).not.toThrow();
    expect(() => assertInstanceName("ab")).toThrow();
    expect(() => assertInstanceName("../etc")).toThrow();
    expect(() => assertInstanceName("nome com espaco")).toThrow();
    expect(() => assertInstanceName("a/b")).toThrow();
  });
});
