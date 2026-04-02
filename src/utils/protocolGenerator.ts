import { PatientLevel, PatientData, Protocol, Workout, Exercise, ClinicalMetrics } from '../types';
import { EXERCISES, LEVEL_CONFIGS } from '../constants';

export function calculatePredictedTC6M(age: number, sex: 'M' | 'F', weight: number, height: number): number {
  const imc = weight / ((height / 100) ** 2);
  const sexCode = sex === 'M' ? 1 : 0;
  // Britto et al., 2013
  return 890.46 - (6.11 * age) + (0.0345 * (age ** 2)) + (48.87 * sexCode) - (4.87 * imc);
}

export function estimateMaxHR(age: number, betaBlockerStatus: string, isDAC: boolean): number {
  if (isDAC) {
    if (betaBlockerStatus === 'none') return Math.round(200 - (0.79 * age));
    if (betaBlockerStatus === 'suspended') return Math.round(193 - (0.71 * age));
    if (betaBlockerStatus === 'active') return Math.round(168 - (0.51 * age));
  }
  return Math.round(208 - (0.7 * age));
}

export function calculateMaxHR(data: PatientData): number {
  if (data.tc6mMaxHR) return data.tc6mMaxHR;
  if (data.maxHR) return data.maxHR;

  const isDAC = data.hasInfarto || data.isPostRVM || data.hasAngina || data.isSCA;
  return estimateMaxHR(data.age, data.betaBlockerStatus, isDAC);
}

export function calculateHRTarget(rfcRange: [number, number], data: PatientData, maxHR: number): string {
  if (data.isAFib || data.betaBlockerStatus === 'active') {
    return "Borg (11-14) / Teste da Fala";
  }
  
  if (data.isSCA || data.hasAngina) {
    const target = data.restingHR + 20;
    return `~${target} bpm (Angina < 2)`;
  }

  const lower = Math.round(data.restingHR + (rfcRange[0] / 100) * (maxHR - data.restingHR));
  const upper = Math.round(data.restingHR + (rfcRange[1] / 100) * (maxHR - data.restingHR));
  return `${lower}-${upper} bpm`;
}

export function calculateVO2(distance: number, data: PatientData): number {
  if (data.isHFrEF || data.isHFpEF) {
    // Cahalin et al., 1996
    return (0.03 * distance) + 3.98;
  } else {
    const sexCode = data.sex === 'M' ? 0 : 1; // 0 men, 1 women for Burr
    return 70.161 + (0.023 * distance) - (0.276 * data.weight) - (6.79 * sexCode) - (0.193 * data.restingHR) - (0.191 * data.age);
  }
}

export function classifyCIF(observed: number, predicted: number): string {
  const percent = (observed / predicted) * 100;
  if (percent > 95) return "Nenhuma (Qualificador 0)";
  if (percent >= 76) return "Leve (Qualificador 1)";
  if (percent >= 51) return "Moderada (Qualificador 2)";
  if (percent >= 5) return "Grave (Qualificador 3)";
  return "Completa (Qualificador 4)";
}

export function classifyPatient(tc6m: number | undefined, sl5x: number): PatientLevel {
  // If TC6M is missing, use equivalence from SL5x
  // SL5x > 9.5s correlates to TC6M < 300m (Level 1)
  // SL5x 8.8-9s correlates to TC6M < 400m (Level 2)
  
  const effectiveTc6m = tc6m ?? (sl5x > 9.5 ? 250 : sl5x > 8.7 ? 350 : 450);

  if (effectiveTc6m < 300 || sl5x > 9.5) return PatientLevel.LEVEL_1;
  if (effectiveTc6m > 401 || sl5x < 8.7) return PatientLevel.LEVEL_3;
  return PatientLevel.LEVEL_2;
}

function getIntensityLabel(borg: string): string {
  if (borg.includes("11-12")) return "Leve";
  if (borg.includes("12-13")) return "Leve a Moderado";
  if (borg.includes("13-14")) return "Moderado";
  if (borg.includes("14-16")) return "Cansativo";
  if (borg.includes("9-11")) return "Muito Leve a Leve";
  if (borg.includes("6-8")) return "Repouso / Muito Leve";
  return "Moderado";
}

function generateExercisesForLevel(data: PatientData, level: PatientLevel, workoutId: string): Exercise[] {
  const exercises: Exercise[] = [];
  const restTime = level === PatientLevel.LEVEL_1 ? 60 : level === PatientLevel.LEVEL_2 ? 50 : 30;
  const maxHR = calculateMaxHR(data);
  let rfcRange: [number, number] = [50, 60]; // Default starting range (JACC/HF-ACTION)
  let borgTarget = "12-14";
  
  if (data.cycle !== 'Prescrição Inicial') {
    rfcRange = [60, 70];
    borgTarget = "13-15";
  }

  // HF-ACTION Protocol for Heart Failure
  if (data.isHFrEF || data.isHFpEF) {
    rfcRange = data.cycle === 'Prescrição Inicial' ? [60, 60] : [60, 70];
    borgTarget = "12-14";
  }

  // Adjust RFC for stable angina (40-80% RFC according to AHA/ACC)
  if (data.hasAngina) {
    rfcRange = [40, 60]; // Start conservative
    borgTarget = "11-13";
  }

  // Deconditioned patients
  const isDeconditioned = level === PatientLevel.LEVEL_1 || data.age >= 65 || (data.weight / ((data.height/100)**2)) > 30;
  if (isDeconditioned && data.cycle === 'Prescrição Inicial') {
    rfcRange = [40, 50];
    borgTarget = "11-12";
  }

  const intensityLabel = getIntensityLabel(borgTarget);
  const hrTarget = calculateHRTarget(rfcRange, data, maxHR);

  // Define exercise keys for each workout to ensure variety and clinical relevance
  const workoutMap: Record<string, string[]> = {
    'A': level === PatientLevel.LEVEL_3 
      ? ['AGACHAMENTO_PAREDE', 'SUBIDA_STEP', 'PRANCHA_ALTAS', 'DESLOCAMENTO_V', 'BICEPS_LATERAL', 'ELEVACAO_CALCANHAR']
      : ['SENTAR_LEVANTAR', 'ESCADAS', 'APOIO_PAREDE', 'CAMINHADA_FRACIONADA', 'BICEPS_LATERAL', 'ELEVACAO_CALCANHAR'],
    'B': level === PatientLevel.LEVEL_3
      ? ['ANDAR_LATERAL', 'DESLOCAMENTO_V', 'POLICHINELO_ADAPTADO', 'MARCHA_ESTACIONARIA', 'AGACHAMENTO_PAREDE', 'PRANCHA_ALTAS']
      : ['ANDAR_LATERAL', 'OBSTACULOS_PET', 'POLICHINELO_ADAPTADO', 'MARCHA_ESTACIONARIA', 'ABDUCAO_QUADRIL', 'EXTENSAO_JOELHO'],
    'C': level === PatientLevel.LEVEL_3
      ? ['SUBIDA_STEP', 'PRANCHA_ALTAS', 'BICEPS_LATERAL', 'ELEVACAO_CALCANHAR', 'AGACHAMENTO_PAREDE', 'DESLOCAMENTO_V']
      : ['SENTAR_LEVANTAR', 'APOIO_PAREDE', 'BICEPS_LATERAL', 'ELEVACAO_CALCANHAR', 'ABDUCAO_QUADRIL', 'EXTENSAO_JOELHO']
  };

  let selectedKeys = [...(workoutMap[workoutId] || workoutMap['A'])];

  // Specific adjustments for DAOP
  if (data.isPAD) {
    // Replace generic walking with intermittent walking for DAOP
    selectedKeys = selectedKeys.map(k => k === 'CAMINHADA_FRACIONADA' || k === 'MARCHA_ESTACIONARIA' ? 'CAMINHADA_INTERMITENTE_DAOP' : k);
    if (!selectedKeys.includes('CAMINHADA_INTERMITENTE_DAOP')) selectedKeys.unshift('CAMINHADA_INTERMITENTE_DAOP');
  }

  // Specific adjustments for Balance Deficit or Elderly
  if (data.hasBalanceDeficit || data.age >= 70) {
    // Replace treadmill/walking with cycle ergometer for stability
    selectedKeys = selectedKeys.map(k => k === 'CAMINHADA_FRACIONADA' || k === 'MARCHA_ESTACIONARIA' ? 'CICLOERGOMETRO' : k);
    if (!selectedKeys.includes('CICLOERGOMETRO')) selectedKeys.unshift('CICLOERGOMETRO');
    
    // Add balance exercises (JACC 2021)
    if (workoutId === 'A') selectedKeys.push('EQUILIBRIO_UNIPODAL');
    if (workoutId === 'B') selectedKeys.push('EQUILIBRIO_TANDEM');
    if (workoutId === 'C') {
      selectedKeys.push('EQUILIBRIO_DINAMICO');
      selectedKeys.push('TAI_CHI_ADAPTADO');
    }
  }

  selectedKeys.forEach(key => {
    const base = EXERCISES[key];
    if (base) {
      const reps = level === PatientLevel.LEVEL_1 ? "2 séries de 8-10" : level === PatientLevel.LEVEL_2 ? "3 séries de 10-12" : "3 séries de 15";
      const sets = level === PatientLevel.LEVEL_1 ? 2 : 3;
      
      exercises.push({
        name: base.name!,
        instruction: base.instruction!,
        rest: restTime,
        sets: sets,
        reps: reps,
        durationPerSet: 120,
        intensityBorg: borgTarget,
        intensityLabel: intensityLabel,
        anginaTarget: data.hasAngina ? "Grau < 2" : undefined,
        rfcTarget: `${rfcRange[0]}-${rfcRange[1]}% RFC`,
        hrTarget: hrTarget
      });
    }
  });

  return exercises;
}

export function generateProtocol(data: PatientData): Protocol {
  const level = classifyPatient(data.tc6m, data.sl5x);
  const config = { ...LEVEL_CONFIGS[level] };
  const maxHR = calculateMaxHR(data);
  
  // Add clinical notes to technical opinion
  config.description += " | ESTRATÉGIA COMBINADA: Usar FC do TC6M como parâmetro primário e Borg como auxiliar.";
  config.description += " | VALIDAÇÃO: Se FC no alvo E Borg 12-14 -> OK. Se FC no alvo MAS Borg >16 -> Reduzir intensidade. Se FC no alvo MAS Borg <10 -> Aumentar gradualmente.";
  
  if (data.isHFrEF) config.description += " | IC FER: Protocolo HF-ACTION (60-70% RFC, Borg 12-14).";
  if (data.isHFpEF) config.description += " | IC FEP: Foco em controle de sintomas e tolerância ao esforço.";
  if (data.isSCA) config.description += " | SCA: Monitoramento rigoroso de angina e ECG se possível.";
  if (data.isPostRVM) config.description += " | Pós RVM: Atenção à cicatrização esternal e expansibilidade pulmonar.";
  if (data.isHypertensive) config.description += " | HAS: Monitorar PA antes, durante e após a sessão.";
  if (data.isAFib) config.description += " | FA: FC irregular, priorizar Borg (12-14) como guia principal.";
  if (data.isPAD) config.description += " | DAOP: SET (Terapia de Exercício Supervisionado). Caminhada intermitente até claudicação moderada/forte (Borg Dor 3-4/5).";
  if (data.hasInfarto) config.description += " | Pós-Infarto: Monitorar sinais vitais rigorosamente.";
  if (data.isDiabetic) config.description += " | Diabetes: Treino intervalado (HIIT/MIIT) melhora HbA1c. Monitorar glicemia.";
  if (data.hasAngina) config.description += " | DAC (Angina Estável): Intensidade 40-80% RFC. Manter FC ~10 bpm abaixo do limiar isquêmico.";
  if (data.hasBalanceDeficit || data.age >= 70) config.description += " | Equilíbrio: Priorizar cicloergômetro. Adicionar treino de equilíbrio.";
  if (level === PatientLevel.LEVEL_3) config.description += " | Condicionado: Exercícios evoluídos com intervalos reduzidos.";
  if (data.tc6mMaxHR) config.description += " | TC6M: Utilizada FC máxima medida no teste para cálculo da reserva.";
  
  config.description += " | REAVALIAÇÃO: Repetir TC6M a cada 2-4 semanas para reajustar prescrição.";
  config.description += " | SEGURANÇA: Talk Test (deve conseguir falar com alguma dificuldade).";
  config.description += " | DESCONDICIONADOS: Se necessário, usar FC repouso + 20-30 bpm OU Borg <14.";

  // Calculate Metrics
  const predictedTc6m = calculatePredictedTC6M(data.age, data.sex, data.weight, data.height);
  const lin = predictedTc6m - 49.31;
  const observedTc6m = data.tc6m ?? (data.sl5x > 9.5 ? 290 : data.sl5x > 8.7 ? 380 : 420);
  
  const metrics: ClinicalMetrics = {
    predictedTc6m: Math.round(predictedTc6m),
    percentageOfPredicted: Math.round((observedTc6m / predictedTc6m) * 100),
    cifClassification: classifyCIF(observedTc6m, predictedTc6m),
    vo2Max: Number(calculateVO2(observedTc6m, data).toFixed(2)),
    mcidTarget: "Ganho > 30m (TC6M) e Redução ~2s (SL5x)",
    lin: Math.round(lin),
    mdc: 30
  };

  const workouts: Workout[] = ['A', 'B', 'C'].map(id => {
    const exercises = generateExercisesForLevel(data, level, id);
    const aerobicBorg = level === PatientLevel.LEVEL_1 ? "11-12" : "12-14";
    
    // JACC Focus Seminar 1/4: Warmup 40-50% RFC
    const warmupHR = calculateHRTarget([40, 50], data, maxHR);

    const warmup: Exercise[] = [
      {
        name: "Mobilidade Articular Ativa",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Movimentos circulares de pescoço, ombros, punhos, quadril e tornozelos.",
        durationPerSet: 300,
        intensityBorg: "9-11",
        intensityLabel: "Muito Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined,
        rfcTarget: "40-50% RFC",
        hrTarget: warmupHR
      },
      {
        name: "Caminhada Leve",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Caminhada em ritmo confortável para aquecimento global.",
        durationPerSet: 300,
        intensityBorg: "9-11",
        intensityLabel: "Muito Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined,
        rfcTarget: "40-50% RFC",
        hrTarget: warmupHR
      }
    ];

    const mainWorkout: Exercise[] = [...exercises];
    
    // JACC Focus Seminar 1/4: Interval Training
    // 4 intervals of 1 min at 80-90% RFC (or 75-85% for deconditioned/elderly/obese)
    const isDeconditioned = level === PatientLevel.LEVEL_1 || data.age >= 65 || (data.weight / ((data.height/100)**2)) > 30;
    const intervalRFC: [number, number] = isDeconditioned ? [75, 85] : [80, 90];
    const continuousRFC: [number, number] = isDeconditioned ? [50, 60] : [60, 70];
    const intervalHR = calculateHRTarget(intervalRFC, data, maxHR);
    const recoveryHR = calculateHRTarget([40, 50], data, maxHR);
    const continuousHR = calculateHRTarget(continuousRFC, data, maxHR);

    if (data.useIntervalTraining) {
      mainWorkout.push({
        name: "Caminhada Intervalada (Protocolo Clínico)",
        sets: 4,
        reps: "1 min (Pico) / 3 min (Rec)",
        rest: 0,
        instruction: `Alternar 1 minuto a ${intervalRFC[0]}-${intervalRFC[1]}% RFC (${intervalHR}) com 3 minutos de recuperação ativa a 40-50% RFC (${recoveryHR}).`,
        durationPerSet: 240,
        intensityBorg: isDeconditioned ? "13-15" : "15-17",
        intensityLabel: "Intervalado de Alta Intensidade",
        anginaTarget: data.hasAngina ? "Grau < 2" : undefined,
        rfcTarget: `${intervalRFC[0]}-${intervalRFC[1]}% RFC`,
        hrTarget: intervalHR
      });
    } else {
      mainWorkout.push({
        name: "Caminhada Contínua",
        sets: 1,
        reps: "15-20 minutos",
        rest: 0,
        instruction: `Caminhada em ritmo constante mantendo a intensidade entre ${continuousRFC[0]}-${continuousRFC[1]}% RFC (${continuousHR}).`,
        durationPerSet: 1200,
        intensityBorg: isDeconditioned ? "11-12" : "12-14",
        intensityLabel: "Contínuo Moderado",
        anginaTarget: data.hasAngina ? "Grau < 1" : undefined,
        rfcTarget: `${continuousRFC[0]}-${continuousRFC[1]}% RFC`,
        hrTarget: continuousHR
      });
    }

    const cooldown: Exercise[] = [
      {
        name: "Alongamento Estático",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Alongar principais grupos musculares (membros inferiores e superiores), mantendo 30s cada posição.",
        durationPerSet: 300,
        intensityBorg: "6-8",
        intensityLabel: "Muito Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined
      },
      {
        name: "Exercícios Respiratórios",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Inspiração profunda nasal e expiração lenta bucal (frenolabial).",
        durationPerSet: 300,
        intensityBorg: "6-8",
        intensityLabel: "Muito Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined
      }
    ];

    return {
      id,
      title: `Treino ${id}`,
      warmup,
      mainWorkout,
      cooldown,
      totalDuration: 60
    };
  });

  const sessionsPerWeek = Math.ceil(config.goalMinutes / 60);

  const diabeticHIIT = data.isDiabetic ? {
    introduction: "O ACSM e a ADA definem HIIT como exercício aeróbico realizado entre 75-95% da FC pico (ou 65-90% VO2pico) por 10 segundos a 4 minutos, intercalado com 12 segundos a 5 minutos de recuperação ativa ou passiva. O treino intervalado de alta intensidade (HIIT) é uma opção eficaz e eficiente em tempo para diabéticos tipo 2, com melhora superior da HbA1c (-0,12% a -0,37%) e do VO2pico (+1,3 a 4,1 mL/kg/min) comparado ao treino contínuo moderado. [1-2] Para ambiente domiciliar, protocolos baseados em caminhada intervalada são particularmente adequados por não exigirem equipamentos. [3-4]",
    parameters: "O ACSM e a ADA definem HIIT como exercício aeróbico realizado entre 75-95% da FC pico (ou 65-90% VO2pico) por 10 segundos a 4 minutos, intercalado com 12 segundos a 5 minutos de recuperação ativa ou passiva. [3-4]",
    protocols: [
      { name: "Caminhada intervalada", structure: "3 min rápido / 3 min lento", intensity: "70-90% FC máx / 50-60% FC máx", duration: "30-60 min", indication: "Iniciantes, domiciliar", refs: "[1-2]" },
      { name: "HIIT curto (10:20)", structure: "10 s sprint / 20 s recuperação", intensity: "85-95% FC máx / 40-50% FC máx", duration: "20-25 min", indication: "Condicionados", refs: "[2-3]" },
      { name: "HIIT longo (4×4)", structure: "4 min intenso / 3 min recuperação", intensity: "85-95% FC máx / 60-70% FC máx", duration: "40 min", indication: "Supervisionado inicialmente", refs: "[3]" },
      { name: "Low-volume HIIT", structure: "10 × 60 s / 60 s recuperação", intensity: "~90% FC máx", duration: "20 min", indication: "Tempo limitado", refs: "[2]" }
    ],
    practicalExamples: [
      {
        title: "Protocolo 1 - Caminhada Intervalada (Iniciantes) [3-4]",
        warmup: "5 min caminhada leve",
        main: "Alternar 3 min caminhada rápida (Borg 14-16) com 3 min caminhada lenta (Borg 10-12)",
        reps: "Repetir 5-8 ciclos (30-48 min)",
        cooldown: "5 min caminhada leve",
        frequency: "3-5×/semana"
      },
      {
        title: "Protocolo 2 - Escada/Subida (Intermediário)",
        warmup: "5 min caminhada",
        main: "1-2 min subindo escada ou ladeira (Borg 15-17) + 2-3 min descendo/plano (Borg 10-12)",
        reps: "Repetir 6-10 ciclos",
        cooldown: "5 min",
        frequency: "3×/semana"
      },
      {
        title: "Protocolo 3 - Exercícios Funcionais em Casa (Sem Equipamento)",
        warmup: "3-5 min marcha estacionária",
        main: "Circuito (30 s exercício / 30 s descanso): Agachamento rápido, Marcha com elevação de joelhos, Polichinelo modificado, Step lateral",
        reps: "Repetir circuito 3-4× (12-16 min)",
        cooldown: "3-5 min alongamento",
        frequency: "3×/semana"
      }
    ],
    safetyConsiderations: [
      "Monitorar glicemia antes e após o exercício, especialmente ao iniciar HIIT",
      "Hiperglicemia transitória pós-exercício pode ocorrer após HIIT intenso - não requer correção imediata na maioria dos casos",
      "Preferir treino no período da tarde - HIIT matinal em jejum pode aumentar glicemia [4]",
      "Evitar HIIT se glicemia >250 mg/dL com cetonúria ou >300 mg/dL sem cetonúria [6]",
      "Hipoglicemia tardia pode ocorrer 6-15h após exercício intenso em usuários de insulina ou secretagogos [3]",
      "Progressão gradual: iniciar com intensidade moderada e progredir para alta intensidade ao longo de 2-4 semanas [6]"
    ],
    comparison: "Ensaio clínico randomizado de 12 semanas demonstrou que ambos HIIT e treino combinado (aeróbico + resistência) reduziram significativamente a HbA1c (~3,3%) comparados ao controle. [7] O HIIT mostrou maior redução da glicemia de jejum (-29 mg/dL vs. -21 mg/dL) e maior ganho de massa muscular (+7,5 kg vs. +6,0 kg), enquanto o treino combinado proporcionou melhor redução de gordura subcutânea e qualidade de vida. [7]",
    recommendation: "Para diabéticos em ambiente domiciliar, a caminhada intervalada (3 min rápido / 3 min lento) é a opção mais segura e acessível, com evidência de melhora superior da glicemia, aptidão física e composição corporal comparada à caminhada contínua com mesmo gasto energético. [3] A frequência ideal é 3-5 sessões/semana, com duração mínima de 75 min/semana de atividade vigorosa ou equivalente."
  } : undefined;

  return {
    patientLevel: level,
    weeklyGoalMinutes: config.goalMinutes,
    sessionsPerWeek,
    workouts,
    technicalOpinion: config.description,
    metrics,
    diabeticHIIT
  };
}
