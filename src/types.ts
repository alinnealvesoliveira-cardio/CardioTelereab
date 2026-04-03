export enum PatientLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export type BetaBlockerStatus = 'none' | 'suspended' | 'active';

export interface PatientData {
  name: string;
  birthDate?: string;
  tc6m?: number;
  sl5x: number;
  cycle: string;
  age: number;
  sex: 'M' | 'F';
  weight: number;
  height: number;
  imc?: number;
  restingHR: number;
  fcMaxMedida?: number;
  fcMaxTC6M?: number;
  betaBlockerStatus: BetaBlockerStatus;
  hasNoHRMonitor: boolean;
  // Clinical Conditions
  isHFrEF: boolean; // IC FER
  isHFpEF: boolean; // IC FEP
  isSCA: boolean; // SCA
  isPostRVM: boolean; // Pós RVM
  isHypertensive: boolean; // HAS
  isAFib: boolean; // FA
  isPAD: boolean; // DAOP
  hasBalanceDeficit: boolean;
  hasInfarto: boolean;
  hasAngina: boolean;
  isDiabetic: boolean;
  useIntervalTraining: boolean;
  includeDiabeticHIIT: boolean;
  includeUnifiedHIIT: boolean;
  includeDAOPProtocol: boolean;
  evolveWorkout: boolean;
  therapistPhone?: string;
}

export interface ClinicalMetrics {
  predictedTc6m: number;
  percentageOfPredicted: number;
  cifClassification: string;
  vo2Max: number;
  mcidTarget: string;
  lin: number; // Lower Limit of Normal
  mdc: number; // Minimal Detectable Change
  sl5xInterpretation?: string;
  fallRisk?: string;
  vo2Burr?: number;
  vo2Cahalin?: number;
  isHeartFailure?: boolean;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: number; // seconds
  instruction: string;
  durationPerSet: number; // estimated seconds including execution
  intensityBorg: string; // e.g., "11-13"
  intensityLabel: string; // e.g., "Moderado"
  anginaTarget?: string; // e.g., "Grau 1"
  rfcTarget?: string; // e.g., "80-90% RFC"
  hrTarget?: string; // e.g., "120-130 bpm"
}

export interface Workout {
  id: string;
  title: string;
  warmup: Exercise[];
  mainWorkout: Exercise[];
  cooldown: Exercise[];
  totalDuration: number; // minutes
}

export interface Protocol {
  patientLevel: PatientLevel;
  weeklyGoalMinutes: number;
  sessionsPerWeek: number;
  workouts: Workout[];
  technicalOpinion: string;
  metrics: ClinicalMetrics;
  diabeticHIIT?: {
    introduction: string;
    parameters: string;
    protocols: {
      name: string;
      structure: string;
      intensity: string;
      duration: string;
      indication: string;
      refs: string;
    }[];
    practicalExamples: {
      title: string;
      warmup: string;
      main: string;
      reps: string;
      cooldown: string;
      frequency: string;
    }[];
    safetyConsiderations: string[];
    comparison: string;
    recommendation: string;
  };
  unifiedHIIT?: {
    progression: {
      phase1: string;
      phase2: string;
      phase3: string;
    };
    hiitAdapted: {
      title: string;
      warmup: string;
      mainPhase: string;
      cooldown: string;
      frequency: string;
      totalDuration: string;
      exercises: {
        name: string;
        instruction: string;
      }[];
    };
    absoluteContraindications: string[];
    relativeContraindications: string[];
    selectionCriteria: {
      criterion: string;
      requirement: string;
      justification: string;
    }[];
    riskStratification: {
      low: string[];
      moderate: string[];
      high: string[];
    };
  };
  daopProtocol?: {
    standardSET: {
      component: string;
      recommendation: string;
    }[];
    guidelines: string[];
    homeProgram: {
      description: string;
      features: string[];
      evidence: string;
    };
    diabeticConsiderations: string;
    contraindications: {
      absolute: string[];
      relative: string[];
    };
    comparison: string;
    teleSET?: {
      fase1: string[];
      fase2: {
        parametro: string;
        semanas1_4: string;
        semanas5_8: string;
        semanas9_12: string;
        ref: string;
      }[];
      fase3: string[];
      escalaDor: {
        nivel: string;
        descricao: string;
        orientacao: string;
      }[];
    };
  };
  diabeticHFpEF?: {
    evidence: string;
    optimExStudy: {
      modality: string;
      protocol: string;
      intensity: string;
      frequency: string;
      result: string;
    }[];
    recommendedProtocols: {
      title: string;
      warmup: string;
      main: string;
      frequency: string;
      progression?: string;
    }[];
    considerations: string[];
    practicalExample: string;
  };
}
