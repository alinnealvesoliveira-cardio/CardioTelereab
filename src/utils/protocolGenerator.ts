import { PatientLevel, PatientData, Protocol, Workout, Exercise, ClinicalMetrics } from '../types';
import { EXERCISES, LEVEL_CONFIGS } from '../constants';

export function calculatePredictedTC6M(age: number, sex: 'M' | 'F', weight: number, height: number): number {
  if (!height || height <= 0) return 0;
  const imc = weight / ((height / 100) ** 2);
  const sexCode = sex === 'M' ? 1 : 0;
  // Britto et al., 2013
  return 890.46 - (6.11 * age) + (0.0345 * (age ** 2)) + (48.87 * sexCode) - (4.87 * imc);
}

export function calculateMaxHR(data: PatientData): number {
  // AHA/AACVPR 2024: Priority to measured values. No automatic age-based formulas.
  if (data.fcMaxMedida) return data.fcMaxMedida;
  if (data.fcMaxTC6M) return data.fcMaxTC6M;
  
  return 0; // Return 0 if no measured value is provided
}

export function calculateHRTarget(rfcRange: [number, number], data: PatientData, maxHR: number): string {
  if (data.hasNoHRMonitor || data.isAFib || !maxHR || maxHR <= data.restingHR) {
    return "Borg (12-14) / Teste da Fala";
  }
  
  const lower = Math.round(data.restingHR + (rfcRange[0] / 100) * (maxHR - data.restingHR));
  const upper = Math.round(data.restingHR + (rfcRange[1] / 100) * (maxHR - data.restingHR));
  return `${lower}-${upper} bpm`;
}

export function calculateVO2(distance: number, data: PatientData): { burr: number, cahalin: number } {
  const sexCode = data.sex === 'M' ? 0 : 1; // 0 men, 1 women for Burr
  
  return {
    burr: 70.161 + (0.023 * distance) - (0.276 * data.weight) - (6.79 * sexCode) - (0.193 * data.restingHR) - (0.191 * data.age),
    cahalin: (0.03 * distance) + 3.98
  };
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
  // If TC6M is missing, use equivalence from SL5x (Fuentes-Abolafio et al., 2022c)
  // < 8.8s -> Good (>400m) -> Level 3
  // 8.8s to 9.5s -> Reduced (<400m) -> Level 2
  // > 9.5s -> Severely reduced (<300m) -> Level 1
  
  if (tc6m !== undefined) {
    if (tc6m < 300) return PatientLevel.LEVEL_1;
    if (tc6m > 400) return PatientLevel.LEVEL_3;
    return PatientLevel.LEVEL_2;
  }

  // Use SL5x as proxy for aerobic capacity in heart failure
  if (sl5x > 9.5) return PatientLevel.LEVEL_1;
  if (sl5x < 8.8) return PatientLevel.LEVEL_3;
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
  let rfcRange: [number, number] = [40, 80]; // Default target zone 40-80%
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
      let reps = level === PatientLevel.LEVEL_1 ? "2 séries de 8-10" : level === PatientLevel.LEVEL_2 ? "3 séries de 10-12" : "3 séries de 15";
      let sets = level === PatientLevel.LEVEL_1 ? 2 : 3;

      if (data.evolveWorkout) {
        if (level === PatientLevel.LEVEL_1) {
          reps = "3 séries de 10-12";
          sets = 3;
        } else if (level === PatientLevel.LEVEL_2) {
          reps = "3 séries de 15";
          sets = 3;
        } else {
          reps = "4 séries de 15-20";
          sets = 4;
        }
      }

      // Specific adjustments for Sit-to-Stand (User request: 50-75 total reps fracionadas)
      if (key === 'SENTAR_LEVANTAR') {
        if (level === PatientLevel.LEVEL_1) {
          sets = 10;
          reps = "10 séries de 5 repetições";
        } else if (level === PatientLevel.LEVEL_2) {
          sets = 6;
          reps = "6 séries de 10 repetições";
        } else {
          sets = 5;
          reps = "5 séries de 15 repetições";
        }
      }

      // Specific adjustments for Stairs (User request: 6x5 for deconditioned)
      if (key === 'ESCADAS') {
        if (level === PatientLevel.LEVEL_1) {
          sets = 6;
          reps = "6 séries de 5 degraus";
        } else {
          sets = 3;
          reps = "3 séries de 10 degraus";
        }
      }

      // Specific adjustments for Balance (User request: 10-12 seconds)
      if (key === 'EQUILIBRIO_UNIPODAL' || key === 'EQUILIBRIO_TANDEM') {
        reps = `${sets} séries de 10-12 segundos`;
      }
      
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
  if (data.betaBlockerStatus === 'active') config.description += " | Atenção: Em uso de BB, considerar limite de 62% da RFC para triagem de incompetência cronotrópica (AHA 2024).";
  if (data.isHFpEF) config.description += " | IC FEP: Foco em controle de sintomas e tolerância ao esforço.";
  if (data.isSCA) config.description += " | SCA: Monitoramento rigoroso de angina e ECG se possível.";
  if (data.isPostRVM) config.description += " | Pós RVM: Atenção à cicatrização esternal e expansibilidade pulmonar.";
  if (data.isHypertensive) config.description += " | HAS: Monitorar PA antes, durante e após a sessão.";
  if (data.isAFib) config.description += " | FA: FC irregular, priorizar Borg (12-14) como guia principal.";
  if (data.isPAD) config.description += " | DAOP: SET (Terapia de Exercício Supervisionado). Caminhada intermitente até claudicação moderada/forte (Borg Dor 3-4/5).";
  if (data.hasInfarto) config.description += " | Pós-Infarto: Monitorar sinais vitais rigorosamente.";
  if (data.isDiabetic) config.description += " | Diabetes: O HIIT melhora HbA1c (-0,12% a -0,37%) e VO2pico (+1,3 a 4,1 mL/kg/min) superior ao contínuo. Monitorar glicemia (evitar se >250-300 mg/dL).";
  if (data.hasAngina) config.description += " | DAC (Angina Estável): Intensidade 40-80% RFC. Manter FC ~10 bpm abaixo do limiar isquêmico.";
  if (data.hasBalanceDeficit || data.age >= 70) config.description += " | Equilíbrio: Priorizar cicloergômetro. Adicionar treino de equilíbrio.";
  if (level === PatientLevel.LEVEL_3) config.description += " | Condicionado: Exercícios evoluídos com intervalos reduzidos.";
  if (data.evolveWorkout) config.description += " | EVOLUÇÃO: Protocolo com aumento de volume (séries/repetições) para progressão de carga.";
  if (data.fcMaxTC6M) config.description += " | TC6M: Utilizada FC máxima medida no teste para cálculo da reserva.";
  
  if (data.tc6m === undefined && data.sl5x > 0) {
    const sl5xNote = data.sl5x < 8.8 ? "Boa capacidade funcional" : data.sl5x <= 9.5 ? "Capacidade funcional reduzida" : "Capacidade funcional severamente reduzida";
    config.description += ` | ESTIMATIVA AERÓBICA: Baseada no SL5x (${data.sl5x}s) - ${sl5xNote}.`;
  }

  config.description += " | REAVALIAÇÃO: Repetir TC6M a cada 2-4 semanas para reajustar prescrição.";
  config.description += " | SEGURANÇA: Talk Test (deve conseguir falar com alguma dificuldade).";
  config.description += " | DESCONDICIONADOS: Se necessário, usar FC repouso + 20-30 bpm OU Borg <14.";

  // Calculate Metrics
  const predictedTc6m = calculatePredictedTC6M(data.age, data.sex, data.weight, data.height);
  const lin = predictedTc6m - 49.31;
  const observedTc6m = data.tc6m ?? (data.sl5x > 9.5 ? 290 : data.sl5x >= 8.8 ? 380 : 420);
  const vo2Results = calculateVO2(observedTc6m, data);
  const isHeartFailure = data.isHFrEF || data.isHFpEF;
  
  // SL5x Interpretation (Fuentes-Abolafio et al., 2022c; Gonzalez-Bautista et al., 2023)
  let sl5xInterpretation = "Não realizado";
  let fallRisk = "Baixo";
  
  if (data.sl5x > 0) {
    if (data.sl5x < 8.8) {
      sl5xInterpretation = "Boa capacidade funcional (correlaciona-se a >400m no TC6M)";
    } else if (data.sl5x <= 9.5) {
      sl5xInterpretation = "Capacidade funcional reduzida (correlaciona-se a <400m no TC6M)";
    } else {
      sl5xInterpretation = "Capacidade funcional severamente reduzida (correlaciona-se a <300m no TC6M)";
    }

    if (data.sl5x >= 10) {
      fallRisk = "Elevado (Risco de queda e incapacidade funcional)";
    }
  }

  const metrics: ClinicalMetrics = {
    predictedTc6m: Math.round(predictedTc6m),
    percentageOfPredicted: Math.round((observedTc6m / predictedTc6m) * 100),
    cifClassification: classifyCIF(observedTc6m, predictedTc6m),
    vo2Max: Number((isHeartFailure ? vo2Results.cahalin : vo2Results.burr).toFixed(2)),
    vo2Burr: Number(vo2Results.burr.toFixed(2)),
    vo2Cahalin: Number(vo2Results.cahalin.toFixed(2)),
    mcidTarget: "Ganho > 30m (TC6M) ou Redução ≥ 2s (SL5x)",
    lin: Math.round(lin),
    mdc: 30,
    sl5xInterpretation,
    fallRisk,
    isHeartFailure
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
        instruction: "Movimentos circulares de pescoço, ombros, punhos, quadril e tornozelos. Foco em amplitude de movimento sem dor.",
        durationPerSet: 300,
        intensityBorg: "9-11",
        intensityLabel: "Muito Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined,
        rfcTarget: "40-50% RFC",
        hrTarget: warmupHR
      },
      {
        name: "Aquecimento Dinâmico",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Realize marcha estacionária (caminhar sem sair do lugar) e elevação de joelhos de forma controlada para ativação muscular e aumento da temperatura corporal.",
        durationPerSet: 300,
        intensityBorg: "10-11",
        intensityLabel: "Leve",
        anginaTarget: data.hasAngina ? "Grau 0" : undefined,
        rfcTarget: "40-50% RFC",
        hrTarget: warmupHR
      }
    ];

    if (data.includeDAOPProtocol) {
      warmup.push({
        name: "Ativação Muscular Específica (DAOP)",
        sets: 1,
        reps: "5 minutos",
        rest: 0,
        instruction: "Foco em ativação de glúteos e panturrilha (elevação de calcanhar dinâmica e pequenos passos laterais). Evite alongamentos estáticos nesta fase.",
        durationPerSet: 300,
        intensityBorg: "10-11",
        intensityLabel: "Leve",
        rfcTarget: "40-50% RFC",
        hrTarget: warmupHR
      });
    }

    let mainWorkout: Exercise[] = [...exercises];
    
    if (data.includeDAOPProtocol) {
      // Override main workout for DAOP as requested by user
      const daopPhase = data.cycle === 'Prescrição Inicial' || data.cycle === 'Ciclo 1 (15 dias)' ? 1 :
                        data.cycle === 'Ciclo 2 (30 dias)' ? 2 : 3;
      
      const daopExercises: Exercise[] = [];
      
      // Intermittent Walking Parameters based on Phase
      let walkingReps = "20-30 min totais";
      let walkingDuration = 1800;
      let walkingIntensity = "Início da Dor";
      let walkingBorg = "11-12";
      let walkingRFC: [number, number] = [40, 50];
      let walkingInstruction = "Caminhe até o início da dor (Borg 2-3 na escala de claudicação). Pare e repouse quando a dor atingir nível moderado. Repita o ciclo até completar o tempo total.";

      if (daopPhase === 2) {
        walkingReps = "30-40 min totais";
        walkingDuration = 2400;
        walkingIntensity = "Dor Moderada";
        walkingBorg = "13-14";
        walkingRFC = [50, 60];
        walkingInstruction = "Caminhe até dor moderada (Borg 3-4 na escala de claudicação). Aumentar velocidade ou inclinação conforme tolerância. Repouse se a dor for limitante.";
      } else if (daopPhase === 3) {
        walkingReps = "45-60 min totais";
        walkingDuration = 3600;
        walkingIntensity = "Dor Moderada-Máxima";
        walkingBorg = "14-16";
        walkingRFC = [60, 70];
        walkingInstruction = "Caminhe até dor moderada-máxima (Borg 4-5 na escala de claudicação). Meta: 30-45 min de caminhada ativa por sessão. Repouse conforme necessário.";
      }

      // Special for Workout B: 30 min total walking
      if (id === 'B') {
        walkingReps = "30 min totais";
        walkingDuration = 1800;
      }

      daopExercises.push({
        name: `Caminhada Intermitente (Fase ${daopPhase})`,
        sets: 1,
        reps: walkingReps,
        rest: 0,
        instruction: walkingInstruction,
        durationPerSet: walkingDuration,
        intensityBorg: walkingBorg,
        intensityLabel: walkingIntensity,
        rfcTarget: `${walkingRFC[0]}-${walkingRFC[1]}% RFC`,
        hrTarget: calculateHRTarget(walkingRFC, data, maxHR)
      });

      // Workout B: Fortalecimento (Subir e Descer)
      if (id === 'B') {
        daopExercises.push({
          name: "Fortalecimento: Subir e Descer Degraus",
          sets: 1,
          reps: "14 subidas e descidas",
          rest: 60,
          instruction: "Realize 14 subidas e descidas de degraus de forma intermitente. Pare se atingir dor moderada e descanse. O objetivo é completar as 14 repetições.",
          durationPerSet: 300,
          intensityBorg: "12-14",
          intensityLabel: "Moderada",
          rfcTarget: "50-60% RFC",
          hrTarget: calculateHRTarget([50, 60], data, maxHR)
        });
      }

      // Workout C: Sentar e Levantar + Biceps
      if (id === 'C') {
        daopExercises.push({
          name: "Sentar e Levantar",
          sets: 10,
          reps: "10 séries de 5 repetições",
          rest: 30,
          instruction: "Sente-se e levante-se de uma cadeira firme sem usar os braços para apoio. Realize 10 séries de 5 repetições com intervalo curto.",
          durationPerSet: 60,
          intensityBorg: "11-12",
          intensityLabel: "Leve-Moderada",
          rfcTarget: "40-50% RFC",
          hrTarget: calculateHRTarget([40, 50], data, maxHR)
        });
        daopExercises.push({
          name: "Bíceps (Carga: 1kg)",
          sets: 3,
          reps: "3 séries de 12-15 repetições",
          rest: 45,
          instruction: "Use um peso de 1kg (ex: 1kg de alimento) para realizar flexão de cotovelo. Mantenha o movimento controlado.",
          durationPerSet: 60,
          intensityBorg: "11-12",
          intensityLabel: "Leve",
          rfcTarget: "40-50% RFC",
          hrTarget: calculateHRTarget([40, 50], data, maxHR)
        });
      }
      
      mainWorkout = daopExercises;
    }
    
    // JACC Focus Seminar 1/4: Interval Training
    // 4 intervals of 1 min at 80-90% RFC (or 75-85% for deconditioned/elderly/obese)
    const isDeconditioned = level === PatientLevel.LEVEL_1 || data.age >= 65 || (data.weight / ((data.height/100)**2)) > 30;
    const intervalRFC: [number, number] = isDeconditioned ? [75, 85] : [80, 90];
    const continuousRFC: [number, number] = isDeconditioned ? [50, 60] : [60, 70];
    const intervalHR = calculateHRTarget(intervalRFC, data, maxHR);
    const recoveryHR = calculateHRTarget([40, 50], data, maxHR);
    const continuousHR = calculateHRTarget(continuousRFC, data, maxHR);

    if (data.useIntervalTraining && !data.includeDAOPProtocol) {
      if (data.isDiabetic) {
        mainWorkout.push({
          name: "Caminhada Intervalada (Protocolo Diabético)",
          sets: 6,
          reps: "3 min (Rápido) / 3 min (Lento)",
          rest: 0,
          instruction: "Alternar 3 minutos de caminhada rápida (Borg 14-16) com 3 minutos de caminhada lenta (Borg 10-12).",
          durationPerSet: 360,
          intensityBorg: "14-16",
          intensityLabel: "Intervalado de Alta Intensidade",
          anginaTarget: data.hasAngina ? "Grau < 2" : undefined,
          rfcTarget: "70-90% FC máx",
          hrTarget: intervalHR
        });
      } else {
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
      }
    } else if (!data.includeDAOPProtocol) {
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

  let sessionsPerWeek = Math.ceil(config.goalMinutes / 60);
  if (data.includeDAOPProtocol) {
    sessionsPerWeek = (data.cycle === 'Prescrição Inicial' || data.cycle === 'Ciclo 1 (15 dias)') ? 3 : 4;
  }
  const diabeticHIIT = (data.isDiabetic && data.includeDiabeticHIIT) ? {
    introduction: "O treino intervalado de alta intensidade (HIIT) é uma opção eficaz e eficiente em tempo para diabéticos tipo 2, com melhora superior da HbA1c (-0,12% a -0,37%) e do VO2pico (+1,3 a 4,1 mL/kg/min) comparado ao treino contínuo moderado. [1-2] Para ambiente domiciliar, protocolos baseados em caminhada intervalada são particularmente adequados por não exigirem equipamentos. [3-4]",
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

  const diabeticHFpEF = (data.isDiabetic && data.isHFpEF) ? {
    evidence: "Para diabéticos com ICFEp, tanto o treino contínuo moderado (MCT) quanto o HIIT são eficazes, com melhora do VO2pico de 1,1-2,0 mL/kg/min. O MCT pode ser preferível nesta população frequentemente idosa e frágil, com melhor aderência a longo prazo. O estudo OptimEx-Clin (JAMA 2021) comparou HIIT vs. MCT vs. controle.",
    optimExStudy: [
      { modality: "HIIT", protocol: "4×4 min intervalos + 3 min recuperação", intensity: "80-90% RFC", frequency: "3×/semana", result: "+1,1 mL/kg/min" },
      { modality: "MCT", protocol: "40 min contínuo", intensity: "35-50% RFC", frequency: "5×/semana", result: "+1,6 mL/kg/min" },
      { modality: "Controle", protocol: "Orientação única", intensity: "-", frequency: "-", result: "-0,6 mL/kg/min" }
    ],
    recommendedProtocols: [
      {
        title: "Protocolo 1 - MCT Domiciliar (Preferencial para Iniciantes/Frágeis)",
        warmup: "5-10 min caminhada leve",
        main: "20-60 min de caminhada contínua a 35-50% RFC (Borg 11-13)",
        frequency: "3-5×/semana",
        progression: "Iniciar com 20 min e aumentar 5 min/semana até 40-60 min. Para pacientes frágeis: múltiplas sessões curtas (10-15 min, 2-3×/dia)"
      },
      {
        title: "Protocolo 2 - HIIT Adaptado (Pacientes Estáveis)",
        warmup: "10 min a 35-50% RFC",
        main: "4×4 min a 80-90% RFC (Borg 15-17) intercalados com 3 min recuperação a 50-60% RFC",
        frequency: "3×/semana"
      },
      {
        title: "Protocolo 3 - Combinado (Aeróbico + Resistência + Dieta)",
        warmup: "Aquecimento aeróbico",
        main: "Exercício aeróbico (3×/semana, 60 min) + Treino resistido (2×/semana) + Restrição calórica (-400 kcal/dia)",
        frequency: "Combinada"
      }
    ],
    considerations: [
      "Usar % da reserva de FC (não % FC máx) devido à alta prevalência de incompetência cronotrópica",
      "Em pacientes com fibrilação atrial: usar escala de Borg (15-17 para HIIT, 11-13 para MCT)",
      "Verificar glicemia antes e após exercício; atenção à hipoglicemia tardia",
      "Inibidores SGLT2: Dapagliflozina e empagliflozina são terapia de primeira linha; manter hidratação adequada",
      "Meta de perda de peso: 6-10% do peso corporal em obesos"
    ],
    practicalExample: "Semanas 1-4: MCT 20-30 min, 3×/semana (Borg 11-12). Semanas 5-8: MCT 30-40 min, 4×/semana (Borg 12-13) + Resistência 2×/semana. Semanas 9-12: MCT 40-60 min (5×/semana) ou HIIT 3×/semana (3 min rápido / 3 min lento)."
  } : undefined;

  const unifiedHIIT = (data.includeUnifiedHIIT && (data.isDiabetic || data.hasAngina || data.isHFrEF || data.isHFpEF)) ? {
    progression: {
      phase1: "Semanas 1-4: MCT 20-40 min, 3-5×/semana, 50-60% RFC",
      phase2: "Semanas 5-8: Introduzir intervalos curtos (1 min a 75-85% RFC / 2-3 min recuperação)",
      phase3: "Semanas 9+: Progredir para 4×4 min (80-90% RFC / 3 min recuperação) se tolerado"
    },
    hiitAdapted: {
      title: "HIIT Adaptado (Pacientes Estáveis)",
      warmup: "10 min a 35-50% RFC",
      mainPhase: "4×4 min a 80-90% RFC (Borg 15-17) intercalados com 3 min recuperação a 50-60% RFC",
      cooldown: "5 min",
      frequency: "3×/semana",
      totalDuration: "~40 min",
      exercises: [
        { name: "Polichinelo Adaptado", instruction: "Realizar polichinelo em ritmo vigoroso durante o intervalo de pico (HIIT), focando em amplitude e velocidade controlada." },
        { name: "Caminhada Vigorosa", instruction: "Caminhada em passo rápido ou subida durante o intervalo de pico, mantendo a FC no alvo." },
        { name: "Caminhada Lateral", instruction: "Deslocamento lateral dinâmico (passo-fecho) com leve agachamento, alternando os lados durante o intervalo de pico." },
        { name: "Recuperação Ativa", instruction: "Caminhada lenta ou marcha estacionária leve durante os 3 minutos de descanso entre os picos de 4 minutos." }
      ]
    },
    absoluteContraindications: [
      "Angina instável ou isquemia miocárdica induzida por esforço não controlada",
      "Insuficiência cardíaca descompensada (NYHA IV ou descompensação recente)",
      "Arritmias ventriculares complexas não controladas",
      "Estenose aórtica grave sintomática",
      "Cardiomiopatia hipertrófica obstrutiva sintomática",
      "Hipertensão arterial não controlada (PAS >180 mmHg ou PAD >110 mmHg)",
      "Dissecção aórtica aguda ou aneurisma de aorta em expansão",
      "Miocardite, pericardite ou endocardite ativa",
      "Tromboembolismo pulmonar ou trombose venosa profunda recente",
      "Infarto agudo do miocárdio (<7 dias)"
    ],
    relativeContraindications: [
      "Capacidade funcional muito baixa (<3 METs)",
      "Fragilidade ou sarcopenia significativa",
      "Incompetência cronotrópica grave",
      "Fibrilação atrial com resposta ventricular não controlada",
      "Dispositivos cardíacos implantados (CDI, LVAD) - requer protocolo específico",
      "Transplante cardíaco recente",
      "Doença arterial coronariana multiarterial não revascularizada",
      "Diabetes com complicações microvasculares avançadas"
    ],
    selectionCriteria: [
      { criterion: "Estabilidade clínica", requirement: "≥4-6 semanas sem eventos", justification: "Permite adaptação cardiovascular segura" },
      { criterion: "Terapia médica otimizada", requirement: "Medicações ajustadas", justification: "Reduz risco de eventos durante exercício" },
      { criterion: "Teste de esforço negativo", requirement: "Sem isquemia ou arritmias", justification: "Confirma segurança para alta intensidade" },
      { criterion: "Capacidade funcional", requirement: "≥3-4 METs", justification: "Abaixo disso, MCT já é percebido como HIIT" },
      { criterion: "Classe funcional", requirement: "NYHA I-III estável", justification: "NYHA IV é contraindicação" },
      { criterion: "Fase de adaptação prévia", requirement: "4-6 semanas de MCT", justification: "Progressão gradual reduz risco" }
    ],
    riskStratification: {
      low: [
        "DAC estável, revascularização completa",
        "ICFEr/ICFEp estável, NYHA I-II",
        "Teste de esforço sem isquemia ou arritmias",
        "Capacidade funcional >5 METs",
        "Sem eventos cardíacos nos últimos 6 meses"
      ],
      moderate: [
        "DAC com revascularização incompleta, mas assintomático",
        "ICFEr/ICFEp NYHA II-III",
        "Capacidade funcional 3-5 METs",
        "Arritmias controladas com medicação"
      ],
      high: [
        "Isquemia induzida por esforço",
        "Arritmias ventriculares complexas",
        "NYHA III-IV instável",
        "Capacidade funcional <3 METs",
        "Evento cardíaco recente (<4 semanas)"
      ]
    }
  } : undefined;

  const daopProtocol = (data.isPAD && data.includeDAOPProtocol) ? {
    standardSET: [
      { component: "Semanas 1-4 (Adaptação)", recommendation: "Caminhada até início da dor (Borg 2-3 na escala de claudicação). 20-30 min totais, 3×/semana. Repouso quando dor atinge nível moderado." },
      { component: "Semanas 5-8 (Progressão)", recommendation: "Caminhada até dor moderada (Borg 3-4). 30-40 min totais, 3-5×/semana. Aumentar velocidade ou inclinação conforme tolerância." },
      { component: "Semanas 9-12+ (Manutenção)", recommendation: "Caminhada até dor moderada-máxima (Borg 4-5). 45-60 min totais, 3-5×/semana. Meta: 30-45 min de caminhada ativa por sessão." }
    ],
    guidelines: [
      "Classe I, Nível A: SET é recomendada para melhorar desempenho de caminhada, status funcional e qualidade de vida",
      "O protocolo principal deve ser focado na caminhada intermitente, respeitando o limiar de dor isquêmica.",
      "Aquecimento dinâmico e ativação muscular devem preceder a caminhada para preparar o sistema musculoesquelético, reservando o alongamento estático para após a sessão."
    ],
    homeProgram: {
      description: "Quando SET não está disponível, a diretriz recomenda programa domiciliar estruturado com:",
      features: [
        "Prescrição de exercício por profissional qualificado",
        "Técnicas de mudança comportamental (coaching virtual, monitores de atividade)",
        "Aconselhamento sobre como iniciar, manter e progredir o programa",
        "Sessões supervisionadas periódicas para avaliar progresso e ajustar prescrição"
      ],
      evidence: "O estudo LITE demonstrou que exercício domiciliar de alta intensidade (com sintomas isquêmicos) foi superior ao de baixa intensidade para melhora do TC6M."
    },
    diabeticConsiderations: "A ACC (2025) recomenda que, embora existam contraindicações ao exercício, muitas barreiras (amputação, uso de cadeira de rodas) podem ser contornadas com alternativas à caminhada (ergometria de braço). Os benefícios do exercício geralmente não são duráveis, necessitando reforço contínuo para manter a melhora funcional.",
    contraindications: {
      absolute: [
        "Isquemia crítica de membro (CLTI) com dor em repouso ou lesões tróficas não cicatrizadas",
        "Infecção ativa ou gangrena",
        "Trombose venosa profunda aguda",
        "Condições cardiovasculares instáveis (angina instável, IC descompensada, arritmias não controladas)",
        "Hipertensão não controlada (PAS >180 mmHg ou PAD >110 mmHg)"
      ],
      relative: [
        "Amputação prévia → usar ergometria de braço ou bicicleta",
        "Uso de cadeira de rodas → modalidades alternativas",
        "Neuropatia diabética grave → atenção a lesões nos pés",
        "Doença coronariana concomitante → monitorização cardíaca",
        "Fragilidade/sarcopenia → progressão mais lenta"
      ]
    },
    comparison: "Meta-análise Cochrane demonstrou que SET é superior ao exercício domiciliar, com diferença de aproximadamente 120-210 metros na distância máxima de caminhada após 3 meses. Entretanto, programas domiciliares com monitorização (coaching, pedômetros) alcançam resultados equivalentes ao SET.",
    teleSET: {
      fase1: [
        "Realizar TC6M basal para estabelecer capacidade funcional",
        "Identificar distância de claudicação inicial (DCI) e distância máxima de caminhada (DMC)",
        "Avaliar comorbidades e contraindicações",
        "Fornecer monitor de atividade (pedômetro ou smartwatch) se disponível"
      ],
      fase2: [
        { parametro: "Frequência", semanas1_4: "3x/semana", semanas5_8: "4x/semana", semanas9_12: "5x/semana", ref: "[1]" },
        { parametro: "Duração ativa", semanas1_4: "15-20 min", semanas5_8: "25-35 min", semanas9_12: "35-45 min", ref: "[1]" },
        { parametro: "Intensidade", semanas1_4: "Até dor moderada (3-4/5)", semanas5_8: "Até dor moderada-intensa (3-4/5)", semanas9_12: "Até dor moderada-intensa (3-4/5)", ref: "[1-2]" },
        { parametro: "Progressão", semanas1_4: "+5 min/semana", semanas5_8: "+5 min/semana", semanas9_12: "Manter", ref: "[1][2-3]" }
      ],
      fase3: [
        "Coaching semanal: Ligações telefônicas ou videochamadas de 15-20 minutos [2][4]",
        "Diário de exercício: Paciente registra distância, tempo, nível de dor [2]",
        "App ou monitor de atividade: Rastreamento de passos e minutos de caminhada [5]",
        "Reavaliação mensal: TC6M domiciliar ou presencial [2]"
      ],
      escalaDor: [
        { nivel: "0", descricao: "Sem dor", orientacao: "Continue caminhando" },
        { nivel: "1", descricao: "Desconforto leve", orientacao: "Continue caminhando" },
        { nivel: "2", descricao: "Dor moderada", orientacao: "Continue caminhando" },
        { nivel: "3", descricao: "Dor intensa", orientacao: "Zona ideal - continue até 4" },
        { nivel: "4", descricao: "Dor muito intensa", orientacao: "PARE e descanse" },
        { nivel: "5", descricao: "Dor máxima insuportável", orientacao: "Evitar chegar neste nível" }
      ]
    }
  } : undefined;

  const technicalOpinion = `
O Teste de Caminhada de 6 Minutos (TC6M) é um dos testes submáximos mais utilizados na prática clínica e em pesquisa para avaliar a capacidade funcional de um indivíduo. A variável primária obtida nesse teste é a distância percorrida (DTC6M) que transcende a simples métrica de desempenho, atuando também como um poderoso marcador prognóstico.
Estudos demonstram que a DTC6M possui uma correlação linear com a capacidade aeróbica (VO2máx ou pico) e serve como preditor independente de morbidade. Em pacientes com insuficiência cardíaca, por exemplo, distâncias inferiores a 350 metros estão frequentemente associadas a piores desfechos clínicos e maior risco de hospitalização. (Chronis et al., 2025; Sohn et al., 2025).

A prescrição atual foca no Diagnóstico Fisioterapêutico de ${metrics.cifClassification.toLowerCase()} da capacidade aeróbica, com metas de MCID de +30m no TC6M e -2s no SL5x.

${config.description}
  `.trim();

  return {
    patientLevel: level,
    weeklyGoalMinutes: config.goalMinutes,
    sessionsPerWeek,
    workouts,
    technicalOpinion,
    metrics,
    diabeticHIIT,
    unifiedHIIT,
    daopProtocol
  };
}
