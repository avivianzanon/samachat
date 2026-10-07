import IntegrationSetting from "../../models/IntegrationSetting";
import OpenAISetting from "../../models/OpenAISetting";

// Motores de IA que conversam com os leads. So um pode estar ativo.
export const ENGINES = ["openai", "gemini", "claude"];

export const isEngine = (provider: string): boolean => ENGINES.includes(provider);

// Quais OUTROS motores estao ativos (a OpenAI guarda o estado na tabela dela).
export const activeEnginesExcept = async (engine: string): Promise<string[]> => {
  const active: string[] = [];

  if (engine !== "openai") {
    const openai = await OpenAISetting.findOne();
    if (openai && openai.isActive) active.push("openai");
  }

  const others = ENGINES.filter(e => e !== "openai" && e !== engine);
  if (others.length) {
    const rows = await IntegrationSetting.findAll({
      where: { provider: others, isActive: true }
    });
    rows.forEach(r => active.push(r.provider));
  }

  return active;
};
