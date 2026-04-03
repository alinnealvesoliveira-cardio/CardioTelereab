import { PatientLevel, Exercise } from './types';

export const EXERCISES: Record<string, Partial<Exercise>> = {
  SENTAR_LEVANTAR: {
    name: "Sentar e Levantar",
    instruction: "Sente-se e levante-se de uma cadeira firme sem usar os braços para apoio.",
  },
  ESCADAS: {
    name: "Escadas (Degraus Fracionados)",
    instruction: "Suba e desça degraus de forma fracionada (ex: 6x de 5 degraus ou 3x de 10 degraus), totalizando 30 degraus por série, respeitando seu ritmo.",
  },
  APOIO_PAREDE: {
    name: "Apoio na Parede (Flexão)",
    instruction: "Com as mãos na parede, realize o movimento de flexão de braços mantendo o corpo alinhado.",
  },
  CAMINHADA_FRACIONADA: {
    name: "Caminhada Fracionada",
    instruction: "Caminhe em blocos de 50 metros em terreno plano.",
  },
  BICEPS_LATERAL: {
    name: "Bíceps / Elevação Lateral (1kg)",
    instruction: "Use pesos de 1kg (ou garrafas de água) para alternar entre flexão de cotovelo e elevação lateral dos braços.",
  },
  ANDAR_LATERAL: {
    name: "Andar Lateral",
    instruction: "Caminhe lateralmente mantendo os joelhos levemente flexionados.",
  },
  OBSTACULOS_PET: {
    name: "Obstáculos (Garrafas PET)",
    instruction: "Caminhe desviando de garrafas PET posicionadas em linha reta.",
  },
  POLICHINELO_ADAPTADO: {
    name: "Polichinelo Adaptado",
    instruction: "Abra e feche braços e pernas sem saltar, apenas dando um passo lateral.",
  },
  MARCHA_ESTACIONARIA: {
    name: "Marcha Estacionária",
    instruction: "Simule uma caminhada sem sair do lugar, elevando bem os joelhos.",
  },
  ELEVACAO_CALCANHAR: {
    name: "Elevação de Calcanhar (Panturrilha)",
    instruction: "Apoie-se em uma cadeira e fique na ponta dos pés, descendo lentamente.",
  },
  ABDUCAO_QUADRIL: {
    name: "Abdução de Quadril",
    instruction: "Em pé, apoie-se em uma cadeira e afaste a perna lateralmente sem inclinar o tronco.",
  },
  EXTENSAO_JOELHO: {
    name: "Extensão de Joelho (Sentado)",
    instruction: "Sentado em uma cadeira, estenda uma perna à frente e retorne devagar.",
  },
  EQUILIBRIO_UNIPODAL: {
    name: "Equilíbrio Unipodal",
    instruction: "Fique em um pé só, mantendo a postura ereta. Use uma cadeira como apoio se necessário.",
  },
  EQUILIBRIO_TANDEM: {
    name: "Equilíbrio Tandem (Pé ante pé)",
    instruction: "Posicione um pé diretamente à frente do outro (calcanhar tocando os dedos). Tente manter o equilíbrio.",
  },
  EQUILIBRIO_DINAMICO: {
    name: "Equilíbrio Dinâmico (Alcance)",
    instruction: "Em pé, tente alcançar objetos imaginários à frente e aos lados sem tirar os pés do chão.",
  },
  AGACHAMENTO_PAREDE: {
    name: "Agachamento Isométrico (Parede)",
    instruction: "Encoste as costas na parede e deslize até que os joelhos estejam a 90 graus. Mantenha a posição.",
  },
  PRANCHA_ALTAS: {
    name: "Prancha Alta (Apoio em Mesa)",
    instruction: "Apoie as mãos em uma mesa firme e mantenha o corpo reto como uma prancha, ativando o abdômen.",
  },
  DESLOCAMENTO_V: {
    name: "Deslocamento em 'V'",
    instruction: "Dê dois passos à frente em diagonal (formando um V) e retorne de costas para o centro.",
  },
  SUBIDA_STEP: {
    name: "Subida no Degrau (Step)",
    instruction: "Suba e desça de um degrau baixo repetidamente, alternando a perna que inicia o movimento.",
  },
  CICLOERGOMETRO: {
    name: "Cicloergômetro ou Marcha Estacionária",
    instruction: "Pedale com carga leve a moderada. Caso não possua bicicleta, realize Marcha Estacionária (caminhar sem sair do lugar elevando joelhos) pelo mesmo tempo.",
  },
  CAMINHADA_INTERMITENTE_DAOP: {
    name: "Caminhada Intermitente (Protocolo DAOP)",
    instruction: "Caminhe até sentir dor de claudicação moderada a forte, pare e descanse até a dor passar completamente. Repita o ciclo.",
  },
  TAI_CHI_ADAPTADO: {
    name: "Tai Chi Adaptado (Estabilidade)",
    instruction: "Realize movimentos lentos e fluidos, focando na transferência de peso entre as pernas e respiração profunda.",
  },
  AGACHAMENTO_RAPIDO: {
    name: "Agachamento Rápido (HIIT)",
    instruction: "Realize o agachamento de forma rápida e controlada, mantendo a postura.",
  },
  MARCHA_JOELHOS_ALTOS: {
    name: "Marcha com Elevação de Joelhos",
    instruction: "Marcha estacionária elevando os joelhos o máximo possível em ritmo acelerado.",
  },
  STEP_LATERAL: {
    name: "Step Lateral (HIIT)",
    instruction: "Dê passos laterais rápidos sobre um degrau baixo ou marcação no chão.",
  },
};

export const LEVEL_CONFIGS = {
  [PatientLevel.LEVEL_1]: {
    goalMinutes: 150,
    borgTarget: "11-12",
    description: "Paciente com baixa capacidade funcional (TC6M < 300m). Foco em segurança, mobilidade básica e exercícios de baixa intensidade (Borg 11-12). Recomendação ASSOBRAFIR: Treino aeróbico fracionado e fortalecimento funcional."
  },
  [PatientLevel.LEVEL_2]: {
    goalMinutes: 225,
    borgTarget: "12-13",
    description: "Paciente com capacidade funcional moderada (TC6M 300-400m). Foco em resistência aeróbica e força progressiva (Borg 12-13). Recomendação ASSOBRAFIR: Treino aeróbico contínuo e exercícios resistidos de grandes grupos musculares."
  },
  [PatientLevel.LEVEL_3]: {
    goalMinutes: 300,
    borgTarget: "13-14",
    description: "Paciente com boa capacidade funcional (TC6M > 400m). Foco em manutenção de performance e desafios de equilíbrio dinâmico (Borg 13-14). Recomendação ASSOBRAFIR: Treino aeróbico de intensidade moderada e fortalecimento muscular avançado."
  }
};
