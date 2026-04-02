export enum PatientLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export type BetaBlockerStatus = 'none' | 'suspended' | 'active';

export interface PatientData {
  name: string;
  tc6m?: number;
  tc6mMaxHR?: number;
  sl5x: number;
  cycle: string;
  age: number;
  sex: 'M' | 'F';
  weight: number;
  height: number;
  restingHR: number;
  maxHR?: number;
  betaBlockerStatus: BetaBlockerStatus;
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
}

export interface ClinicalMetrics {
  predictedTc6m: number;
  percentageOfPredicted: number;
  cifClassification: string;
  vo2Max: number;
  mcidTarget: string;
  lin: number; // Lower Limit of Normal
  mdc: number; // Minimal Detectable Change
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
}
