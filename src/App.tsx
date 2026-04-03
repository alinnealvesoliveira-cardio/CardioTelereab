import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  ClipboardList, 
  User, 
  Timer, 
  ArrowRight, 
  FileText, 
  Printer, 
  RefreshCcw,
  ChevronRight,
  Info,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Menu,
  X,
  ArrowLeft,
  Heart,
  Settings,
  Smartphone,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PatientData, Protocol, PatientLevel, Exercise, ClinicalMetrics } from './types';
import { generateProtocol, calculatePredictedTC6M, calculateVO2, classifyCIF } from './utils/protocolGenerator';

const Logo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
    <path d="M7 12h2l1-2 2 4 1-2h2" />
    <path d="M17 2a6 6 0 0 1 5 5" className="opacity-40" />
    <path d="M19 4a3 3 0 0 1 2 2" className="opacity-60" />
  </svg>
);

export default function App() {
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    birthDate: '',
    tc6m: undefined,
    sl5x: 0,
    cycle: 'Prescrição Inicial',
    age: 0,
    sex: 'M',
    weight: undefined as any,
    height: undefined as any,
    imc: undefined,
    restingHR: undefined as any,
    fcMaxMedida: undefined,
    fcMaxTC6M: undefined,
    betaBlockerStatus: 'none',
    hasNoHRMonitor: false,
    isHFrEF: false,
    isHFpEF: false,
    isSCA: false,
    isPostRVM: false,
    isHypertensive: false,
    isAFib: false,
    isPAD: false,
    hasBalanceDeficit: false,
    hasInfarto: false,
    hasAngina: false,
    isDiabetic: false,
    useIntervalTraining: false,
    includeDiabeticHIIT: false,
    includeUnifiedHIIT: false,
    includeDAOPProtocol: false,
    evolveWorkout: false
  });

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [observations, setObservations] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('cardio_telereab_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('Gerador');
  const [isSaving, setIsSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const liveMetrics = (() => {
    if (!patientData.age || !patientData.sex || !patientData.weight || !patientData.height) return null;
    
    const predictedTc6m = calculatePredictedTC6M(patientData.age, patientData.sex, patientData.weight, patientData.height);
    const lin = predictedTc6m - 49.31;
    const observedTc6m = patientData.tc6m ?? (patientData.sl5x > 9.5 ? 290 : patientData.sl5x >= 8.8 ? 380 : 420);
    const vo2Results = calculateVO2(observedTc6m, patientData);
    const isHeartFailure = patientData.isHFrEF || patientData.isHFpEF;
    
    return {
      predictedTc6m: Math.round(predictedTc6m),
      percentageOfPredicted: Math.round((observedTc6m / predictedTc6m) * 100),
      cifClassification: classifyCIF(observedTc6m, predictedTc6m),
      vo2Max: Number((isHeartFailure ? vo2Results.cahalin : vo2Results.burr).toFixed(2)),
      vo2Burr: Number(vo2Results.burr.toFixed(2)),
      vo2Cahalin: Number(vo2Results.cahalin.toFixed(2)),
      lin: Math.round(lin),
      sl5xInterpretation: patientData.sl5x > 0 ? (patientData.sl5x < 8.8 ? "Boa capacidade funcional" : patientData.sl5x <= 9.5 ? "Capacidade funcional reduzida" : "Capacidade funcional severamente reduzida") : "Não realizado",
      fallRisk: patientData.sl5x >= 10 ? "Elevado (Risco de queda)" : "Baixo"
    };
  })();

  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      alert('A impressão direta pode estar bloqueada. Use "Baixar PDF".');
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsSaving(true);
    try {
      // Small delay to ensure all animations are finished
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Ensure we are at the top to avoid capture offsets
      window.scrollTo(0, 0);
      
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Ensure the cloned element is visible and has correct dimensions
          const element = clonedDoc.getElementById('protocol-print-area');
          if (element) {
            element.style.display = 'block';
            element.style.width = '800px'; // Force a width for consistent rendering
            element.style.overflow = 'visible'; // Ensure all content is captured
            element.style.boxShadow = 'none'; // Remove shadow for cleaner capture
            element.style.borderRadius = '0'; // Remove border radius for cleaner capture
            element.style.backgroundColor = '#ffffff'; // Force white background
            
            // Aggressively remove all oklch/oklab references from the cloned document
            const allElements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              const style = clonedDoc.defaultView?.getComputedStyle(el);
              if (style) {
                if (style.color?.includes('oklch') || style.color?.includes('oklab')) el.style.color = '#57534e';
                if (style.backgroundColor?.includes('oklch') || style.backgroundColor?.includes('oklab')) el.style.backgroundColor = 'transparent';
                if (style.borderColor?.includes('oklch') || style.borderColor?.includes('oklab')) el.style.borderColor = '#e7e5e4';
              }
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Protocolo_${patientData.name.replace(/\s+/g, '_') || 'Paciente'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente utilizar a opção "Imprimir" e selecione "Salvar como PDF".');
    } finally {
      setIsSaving(false);
    }
  };

  const saveToRecords = () => {
    if (!protocol) return;
    setIsSaving(true);
    const newEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      patientData: { ...patientData },
      protocol: { ...protocol },
      observations
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('cardio_telereab_history', JSON.stringify(updatedHistory));
    setTimeout(() => {
      setIsSaving(false);
      alert('Salvo no prontuário!');
    }, 800);
  };

  const deleteFromHistory = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('cardio_telereab_history', JSON.stringify(updatedHistory));
    }
  };

  const loadFromHistory = (item: any) => {
    setPatientData(item.patientData);
    setProtocol(item.protocol);
    setObservations(item.observations);
    setActiveTab('Gerador');
  };

  const handleReevaluation = (item: any) => {
    setPatientData({
      ...item.patientData,
      cycle: 'Reavaliação',
      tc6m: undefined,
      sl5x: 0,
      tc6mMaxHR: undefined,
      includeDiabeticHIIT: item.patientData.includeDiabeticHIIT || false,
      includeUnifiedHIIT: item.patientData.includeUnifiedHIIT || false,
      includeDAOPProtocol: item.patientData.includeDAOPProtocol || false,
      evolveWorkout: false
    });
    setProtocol(null);
    setObservations('');
    setActiveTab('Gerador');
  };

  useEffect(() => {
    if (patientData.birthDate) {
      const birth = new Date(patientData.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (patientData.age !== age) {
        setPatientData(prev => ({ ...prev, age }));
      }
    }
  }, [patientData.birthDate]);

  useEffect(() => {
    if (patientData.weight && patientData.height) {
      const imc = Number((patientData.weight / ((patientData.height / 100) ** 2)).toFixed(1));
      if (patientData.imc !== imc) {
        setPatientData(prev => ({ ...prev, imc }));
      }
    }
  }, [patientData.weight, patientData.height]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientData.fcMaxMedida && !patientData.fcMaxTC6M) {
      alert("⚠️ Atenção: Para seguir as diretrizes atuais, insira a FC Máxima Medida (Teste de Esforço ou TC6M). Fórmulas preditivas por idade não são recomendadas para cardiopatas.");
      return;
    }

    if (!patientData.name || !patientData.restingHR || !patientData.sl5x) {
      alert("Por favor, preencha Nome, FC Repouso e SL5x.");
      return;
    }

    const generated = generateProtocol(patientData);
    setProtocol(generated);
  };

  const reset = () => {
    setProtocol(null);
    setPatientData({ 
      name: '', 
      birthDate: '',
      tc6m: undefined, 
      sl5x: 0, 
      cycle: 'Prescrição Inicial',
      age: 0,
      sex: 'M',
      weight: undefined as any,
      height: undefined as any,
      imc: undefined,
      restingHR: undefined as any,
      fcMaxMedida: undefined,
      fcMaxTC6M: undefined,
      betaBlockerStatus: 'none',
      hasNoHRMonitor: false,
      isHFrEF: false,
      isHFpEF: false,
      isSCA: false,
      isPostRVM: false,
      isHypertensive: false,
      isAFib: false,
      isPAD: false,
      hasBalanceDeficit: false,
      hasInfarto: false,
      hasAngina: false,
      isDiabetic: false,
      useIntervalTraining: false,
      includeDiabeticHIIT: false,
      includeUnifiedHIIT: false,
      includeDAOPProtocol: false,
      evolveWorkout: false,
      therapistPhone: ''
    });
    setObservations('');
  };

  const navLinks = [
    { label: 'Gerador', id: 'Gerador' }, 
    { label: 'Segurança', id: 'Segurança' },
    { label: 'Prontuário', id: 'Prontuário' }
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-stone-600 font-sans selection:bg-orange-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20 print:hidden">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 relative">
            <button onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)} className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white hover:bg-orange-700 shadow-sm">
              <Logo size={20} />
            </button>
            <h1 className="font-bold text-xl tracking-tight">Cardio_Telereab</h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button key={link.id} onClick={() => setActiveTab(link.id)} className={`text-sm font-bold tracking-wide ${activeTab === link.id ? 'text-orange-600' : 'text-stone-500 hover:text-stone-600'}`}>
                {link.label}
              </button>
            ))}
          </nav>
          <button className="md:hidden p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 md:hidden" />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-16 bottom-0 w-64 bg-white border-l border-stone-200 z-20 md:hidden shadow-xl">
                <nav className="flex flex-col p-6 gap-4">
                  {navLinks.map((link) => (
                    <button key={link.id} onClick={() => { setActiveTab(link.id); setIsMenuOpen(false); }} className={`text-left py-3 px-4 rounded-xl font-bold transition-colors ${activeTab === link.id ? 'bg-orange-50 text-orange-600' : 'text-stone-600 hover:bg-stone-50'}`}>
                      {link.label}
                    </button>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'Segurança' ? (
            <motion.div key="safety" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-12">
                <div className="flex items-center gap-4 border-b border-stone-100 pb-6">
                  <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-stone-900 tracking-tight">Protocolo de Segurança</h2>
                    <p className="text-stone-500 font-medium">Diretrizes AHA/AACVPR 2024 para Reabilitação Cardiovascular</p>
                  </div>
                </div>

                {/* 1. Talk Test */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-bold text-stone-800 uppercase tracking-wider">1. Tabela Talk Test (Teste da Fala)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase text-xs">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Positivo
                      </div>
                      <p className="text-xl font-black text-emerald-900">Fala Bem</p>
                      <p className="text-sm text-emerald-700 leading-relaxed">O paciente consegue conversar normalmente sem pausas para respirar.</p>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 font-bold uppercase text-xs">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" /> Equívoco
                      </div>
                      <p className="text-xl font-black text-blue-900">Fala mas não canta</p>
                      <p className="text-sm text-blue-700 leading-relaxed">Consegue falar frases curtas, mas sente falta de ar se tentar cantar ou falar muito.</p>
                    </div>
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-2">
                      <div className="flex items-center gap-2 text-red-700 font-bold uppercase text-xs">
                        <div className="w-2 h-2 bg-red-500 rounded-full" /> Negativo
                      </div>
                      <p className="text-xl font-black text-red-900">Ofegante</p>
                      <p className="text-sm text-red-700 leading-relaxed">Incapaz de falar uma frase completa sem interromper para respirar.</p>
                    </div>
                  </div>
                </section>

                {/* 2. Escala de Borg */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-orange-600 rounded-full" />
                    <h3 className="text-lg font-bold text-stone-800 uppercase tracking-wider">2. Escala de Borg (Intensidade Moderada)</h3>
                  </div>
                  <div className="bg-stone-50 p-8 rounded-3xl border border-stone-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                      <div className="space-y-6">
                        <div className="flex items-end gap-4">
                          <div className="text-5xl font-black text-orange-600">12-14</div>
                          <div className="text-sm font-bold text-stone-500 uppercase pb-1">Escala 6-20</div>
                        </div>
                        <div className="flex items-end gap-4">
                          <div className="text-5xl font-black text-blue-600">3-4</div>
                          <div className="text-sm font-bold text-stone-500 uppercase pb-1">Escala 0-10</div>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <p className="text-sm font-bold text-stone-800 mb-2 uppercase tracking-widest">Definição AHA 2024</p>
                        <p className="text-stone-600 leading-relaxed">
                          A intensidade moderada é o "ponto ideal" para a maioria dos cardiopatas estáveis, onde os benefícios cardiovasculares são maximizados com risco mínimo.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Sinais de Alerta */}
                <section className="bg-red-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={32} className="text-red-400" />
                    <h3 className="text-2xl font-black uppercase tracking-tight">Sinais de Alerta e Conduta</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                      <p className="text-lg font-bold mb-1">Tontura</p>
                      <p className="text-xs opacity-70">Sensação de desmaio ou vertigem.</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                      <p className="text-lg font-bold mb-1">Palpitação</p>
                      <p className="text-xs opacity-70">Batimentos irregulares ou acelerados.</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                      <p className="text-lg font-bold mb-1">Dor no Peito</p>
                      <p className="text-xs opacity-70">Angina, aperto ou desconforto torácico.</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-white/20">
                    <div className="flex-1 bg-white text-red-900 p-4 rounded-xl font-black text-center uppercase tracking-widest">
                      Se ocorrer: PARAR IMEDIATAMENTE
                    </div>
                    <div className="flex-1 bg-red-800 text-white p-4 rounded-xl font-black text-center uppercase tracking-widest border border-white/20">
                      Se persistir: CONTATAR MÉDICO
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          ) : activeTab === 'Prontuário' ? (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Prontuário de Pacientes</h2>
                <button onClick={() => setActiveTab('Gerador')} className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-700 transition-all">
                  Novo Protocolo
                </button>
              </div>

              {history.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-stone-200">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-500">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-600">Nenhum registro encontrado</h3>
                  <p className="text-stone-600 max-w-xs mx-auto mt-2">Os protocolos que você salvar aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(history.reduce((acc: any, item: any) => {
                    const name = item.patientData.name;
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(item);
                    return acc;
                  }, {})).map(([name, items]: [string, any]) => (
                    <div key={name} className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                      <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                            <User size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-stone-600">{name}</h3>
                            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">{items.length} registro(s)</p>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {items.map((item: any) => (
                          <div key={item.id} className="p-6 flex items-center justify-between hover:bg-stone-50/50 transition-colors group">
                            <div className="flex items-center gap-6">
                              <div className="text-center min-w-[60px]">
                                <div className="text-[10px] font-bold text-stone-500 uppercase">Data</div>
                                <div className="font-bold text-stone-600 text-sm">{new Date(item.timestamp).toLocaleDateString('pt-BR')}</div>
                              </div>
                              <div className="text-center min-w-[80px]">
                                <div className="text-[10px] font-bold text-stone-500 uppercase">Nível</div>
                                <div className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${item.protocol.patientLevel === PatientLevel.LEVEL_1 ? 'bg-red-50 text-red-600' : item.protocol.patientLevel === PatientLevel.LEVEL_2 ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  Nível {item.protocol.patientLevel}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleReevaluation(item)} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                <RefreshCcw size={14} /> Reavaliar
                              </button>
                              <button onClick={() => loadFromHistory(item)} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition-all">
                                <ArrowRight size={14} /> Abrir
                              </button>
                              <button onClick={() => deleteFromHistory(item.id)} className="p-2 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : !protocol ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold mb-3">Nova Prescrição Clínica</h2>
                <p className="text-stone-600">Insira os dados para gerar o protocolo personalizado.</p>
              </div>

              <form onSubmit={handleGenerate} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 space-y-10">
                {/* 1. Dados Pessoais */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <User size={18} className="text-orange-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">1. Dados Pessoais</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-xs font-bold uppercase text-stone-500">Nome do Paciente</label>
                      <input type="text" required className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" value={patientData.name} onChange={e => setPatientData({ ...patientData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Data de Nascimento</label>
                      <input type="date" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" value={patientData.birthDate} onChange={e => setPatientData({ ...patientData, birthDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Idade (anos)</label>
                      <input type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" value={patientData.age || ''} onChange={e => setPatientData({ ...patientData, age: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">WhatsApp Fisioterapeuta</label>
                      <input type="tel" placeholder="Ex: 5511999999999" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" value={patientData.therapistPhone || ''} onChange={e => setPatientData({ ...patientData, therapistPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Sexo</label>
                      <select className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white outline-none" value={patientData.sex} onChange={e => setPatientData({ ...patientData, sex: e.target.value as any })}>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Peso (kg)</label>
                      <input type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.weight || ''} onChange={e => setPatientData({ ...patientData, weight: e.target.value ? Number(e.target.value) : undefined as any })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Altura (cm)</label>
                      <input type="number" required className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.height || ''} onChange={e => setPatientData({ ...patientData, height: e.target.value ? Number(e.target.value) : undefined as any })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">IMC</label>
                      <div className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50 font-bold text-stone-600">
                        {patientData.imc || '---'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">Ciclo</label>
                      <select className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white outline-none" value={patientData.cycle} onChange={e => setPatientData({ ...patientData, cycle: e.target.value })}>
                        <option>Prescrição Inicial</option>
                        <option>Reavaliação 7 dias</option>
                        <option>Reavaliação 15 dias</option>
                        <option>Reavaliação 30 dias</option>
                        <option>Reavaliação 60 dias</option>
                        <option>Reavaliação 90 dias</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* 2. Dados Funcionais */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <Activity size={18} className="text-orange-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">2. Parâmetros de Carga (AHA 2024)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">FC de Repouso (bpm)</label>
                      <input 
                        type="number" 
                        required 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" 
                        value={patientData.restingHR || ''} 
                        onChange={e => setPatientData({ ...patientData, restingHR: Number(e.target.value) })} 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500 flex items-center gap-1">
                        FC Máxima Medida (Esforço) <Info size={14} className="text-blue-500" />
                      </label>
                      <input 
                        type="number" 
                        placeholder="Obrigatório para Karvonen"
                        className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/30 outline-none focus:border-blue-500" 
                        value={patientData.fcMaxMedida || ''} 
                        onChange={e => setPatientData({ ...patientData, fcMaxMedida: e.target.value ? Number(e.target.value) : undefined })} 
                      />
                      <p className="text-[10px] text-stone-500">Priorize o valor do teste ergométrico.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">TC6M (Metros)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" 
                        value={patientData.tc6m || ''} 
                        onChange={e => setPatientData({ ...patientData, tc6m: e.target.value ? Number(e.target.value) : undefined })} 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">FC Máxima no TC6M (bpm)</label>
                      <input 
                        type="number" 
                        placeholder="Backup se não houver ergometria"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" 
                        value={patientData.fcMaxTC6M || ''} 
                        onChange={e => setPatientData({ ...patientData, fcMaxTC6M: e.target.value ? Number(e.target.value) : undefined })} 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">SL5x (Segundos)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        required 
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" 
                        value={patientData.sl5x || ''} 
                        onChange={e => setPatientData({ ...patientData, sl5x: Number(e.target.value) })} 
                      />
                    </div>
                  </div>

                  {/* Aviso AHA 2024 */}
                  {!patientData.fcMaxMedida && !patientData.fcMaxTC6M && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start">
                      <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Recomendação AHA/AACVPR 2024:</strong> Evite fórmulas baseadas na idade. Insira uma <strong>FC Máxima Medida</strong> para garantir uma prescrição segura via Reserva de FC.
                      </p>
                    </div>
                  )}
                </section>

                {/* 3. Quadro de Capacidade Aeróbica (OMS 2001 / CIF) */}
                {liveMetrics && (
                  <section className="space-y-6 bg-blue-50/30 p-6 rounded-3xl border border-blue-100">
                    <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                      <ClipboardList size={18} className="text-blue-600" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-blue-800">3. Quadro de Capacidade Aeróbica (OMS 2001)</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Predito (Britto)</p>
                          <p className="text-lg font-black text-blue-900">{liveMetrics.predictedTc6m}m</p>
                          <p className="text-[10px] text-blue-500 mt-1">LIN: {liveMetrics.lin}m</p>
                        </div>
                        
                        <div className={`p-5 rounded-2xl border shadow-md transition-all ${
                          liveMetrics.percentageOfPredicted > 95 ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
                          liveMetrics.percentageOfPredicted >= 76 ? "bg-blue-50 border-blue-200 text-blue-900" :
                          liveMetrics.percentageOfPredicted >= 51 ? "bg-yellow-50 border-yellow-200 text-yellow-900" :
                          "bg-red-50 border-red-200 text-red-900"
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Classificação CIF (OMS)</p>
                            <span className="text-2xl font-black">{liveMetrics.percentageOfPredicted}%</span>
                          </div>
                          <p className="text-xl font-black leading-tight">{liveMetrics.cifClassification}</p>
                          <div className="mt-3 w-full bg-white/50 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                liveMetrics.percentageOfPredicted > 95 ? "bg-emerald-500" :
                                liveMetrics.percentageOfPredicted >= 76 ? "bg-blue-500" :
                                liveMetrics.percentageOfPredicted >= 51 ? "bg-yellow-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(liveMetrics.percentageOfPredicted, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] mt-2 font-bold opacity-60 italic">Atingiu {liveMetrics.percentageOfPredicted}% da distância predita para idade e sexo.</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Estimativa VO2 (Cahalin / Burr)</p>
                          <p className="text-lg font-black text-emerald-900">{liveMetrics.vo2Cahalin} / {liveMetrics.vo2Burr} <span className="text-[10px] font-normal">mL/kg/min</span></p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                          <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">SL5x: {patientData.sl5x}s</p>
                          <p className="text-sm font-bold text-orange-900">{liveMetrics.sl5xInterpretation}</p>
                          <p className="text-[10px] text-red-600 font-medium mt-1">Risco de Queda: {liveMetrics.fallRisk}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* 4. Dados Clínicos */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <Heart size={18} className="text-orange-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">4. Dados Clínicos e Betabloqueadores</h3>
                  </div>
                  
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-4">
                    <label className="text-xs font-bold uppercase text-stone-500">Uso de Betabloqueador</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="bb" checked={patientData.betaBlockerStatus === 'none'} onChange={() => setPatientData({ ...patientData, betaBlockerStatus: 'none' })} className="accent-orange-600" />
                        <span className="text-sm font-medium">Não utiliza</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="bb" checked={patientData.betaBlockerStatus === 'active'} onChange={() => setPatientData({ ...patientData, betaBlockerStatus: 'active' })} className="accent-orange-600" />
                        <span className="text-sm font-medium">Em uso (Ativo)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="bb" checked={patientData.betaBlockerStatus === 'suspended'} onChange={() => setPatientData({ ...patientData, betaBlockerStatus: 'suspended' })} className="accent-orange-600" />
                        <span className="text-sm font-medium">Suspenso para o teste</span>
                      </label>
                    </div>
                  </div>

                  {(!patientData.cycle.includes('15') && !patientData.cycle.includes('30') && !patientData.cycle.includes('60')) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <ConditionCheckbox id="hfr" label="IC FER (HFrEF)" checked={patientData.isHFrEF} onChange={v => setPatientData({ ...patientData, isHFrEF: v })} />
                      <ConditionCheckbox id="hfp" label="IC FEP (HFpEF)" checked={patientData.isHFpEF} onChange={v => setPatientData({ ...patientData, isHFpEF: v })} />
                      <ConditionCheckbox id="sca" label="SCA (Angina Instável)" checked={patientData.isSCA} onChange={v => setPatientData({ ...patientData, isSCA: v })} />
                      <ConditionCheckbox id="rvm" label="Pós RVM" checked={patientData.isPostRVM} onChange={v => setPatientData({ ...patientData, isPostRVM: v })} />
                      <ConditionCheckbox id="has" label="Hipertensão (HAS)" checked={patientData.isHypertensive} onChange={v => setPatientData({ ...patientData, isHypertensive: v })} />
                      <ConditionCheckbox id="fa" label="Fibrilação Atrial (FA)" checked={patientData.isAFib} onChange={v => setPatientData({ ...patientData, isAFib: v })} />
                      <ConditionCheckbox id="daop" label="DAOP" checked={patientData.isPAD} onChange={v => setPatientData({ ...patientData, isPAD: v, includeDAOPProtocol: v ? patientData.includeDAOPProtocol : false })} />
                      <ConditionCheckbox id="infarto" label="Infarto Prévio" checked={patientData.hasInfarto} onChange={v => setPatientData({ ...patientData, hasInfarto: v })} />
                      <ConditionCheckbox id="angina" label="DAC (Angina Estável)" checked={patientData.hasAngina} onChange={v => setPatientData({ ...patientData, hasAngina: v })} />
                      <ConditionCheckbox id="diabetes" label="Diabetes Mellitus" checked={patientData.isDiabetic} onChange={v => setPatientData({ ...patientData, isDiabetic: v, includeDiabeticHIIT: v ? patientData.includeDiabeticHIIT : false })} />
                      <ConditionCheckbox id="balance" label="Déficit de Equilíbrio" checked={patientData.hasBalanceDeficit} onChange={v => setPatientData({ ...patientData, hasBalanceDeficit: v })} />
                    </div>
                  )}
                </section>

                {/* 5. Cálculo de Zona de Treinamento */}
                {patientData.age > 0 && patientData.restingHR > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                      <Timer size={18} className="text-orange-600" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">5. Cálculo de Zona de Treinamento (Karvonen)</h3>
                    </div>
                    <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-orange-600 uppercase">FC Máxima Utilizada</p>
                          <p className="text-xl font-black text-orange-900">{(patientData.fcMaxMedida || patientData.fcMaxTC6M || 0) || '---'} bpm</p>
                          <p className="text-[10px] text-orange-700 italic">
                            {patientData.fcMaxMedida ? 'Fonte: Teste de Esforço' : patientData.fcMaxTC6M ? 'Fonte: TC6M' : 'Atenção: Nenhuma FC máxima medida informada.'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-orange-600 uppercase">Zona Alvo (40% - 80% RFC)</p>
                          <p className="text-xl font-black text-orange-900">
                            {(patientData.fcMaxMedida || patientData.fcMaxTC6M || 0) > 0 ? (
                              `${Math.round(patientData.restingHR + 0.4 * ((patientData.fcMaxMedida || patientData.fcMaxTC6M || 0) - patientData.restingHR))} - ${Math.round(patientData.restingHR + 0.8 * ((patientData.fcMaxMedida || patientData.fcMaxTC6M || 0) - patientData.restingHR))} bpm`
                            ) : (
                              'Borg (12-14) / Teste da Fala'
                            )}
                          </p>
                          <p className="text-[10px] text-orange-700 italic">RFC = (FCmax_medida - FCrepouso) x % + FCrepouso</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* 6. Configuração de Protocolos */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <Settings size={18} className="text-orange-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">6. Configuração de Protocolos</h3>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-900">Monitoramento Domiciliar</h4>
                        <p className="text-xs text-blue-700">O paciente possui frequencímetro (relógio/cinta)?</p>
                      </div>
                    </div>
                    <ConditionCheckbox 
                      id="no-hr" 
                      label="Não possui frequencímetro" 
                      checked={patientData.hasNoHRMonitor} 
                      onChange={v => setPatientData({ ...patientData, hasNoHRMonitor: v })} 
                    />
                  </div>

                  {(patientData.cycle.includes('15') || patientData.cycle.includes('30') || patientData.cycle.includes('60') || patientData.cycle.includes('90')) && (
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                      <ConditionCheckbox 
                        id="evolve" 
                        label="Evoluir Treino (Aumentar dificuldade/repetições)" 
                        checked={patientData.evolveWorkout} 
                        onChange={v => setPatientData({ ...patientData, evolveWorkout: v })} 
                      />
                    </div>
                  )}
                </section>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-orange-50 p-8 rounded-3xl border border-orange-100 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
                        <Activity size={18} />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-orange-900">7. Seleção de Protocolos Específicos</h3>
                    </div>
                    
                    <p className="text-xs text-orange-700 font-medium">Selecione os protocolos que deseja incluir na prescrição com base na avaliação funcional e clínica:</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4 bg-white p-6 rounded-2xl border border-orange-100 shadow-sm">
                        <h4 className="text-[10px] font-bold uppercase text-orange-600 tracking-widest">Treino Aeróbico Principal</h4>
                        <div className="flex flex-col gap-3">
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-orange-200 cursor-pointer transition-colors">
                            <input 
                              type="radio" 
                              name="trainingType" 
                              checked={!patientData.useIntervalTraining && !patientData.includeDAOPProtocol} 
                              onChange={() => setPatientData({ ...patientData, useIntervalTraining: false, includeDAOPProtocol: false })} 
                              className="w-4 h-4 accent-orange-600" 
                            />
                            <span className="text-sm font-semibold text-stone-700">Protocolo Convencional (Contínuo)</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-orange-200 cursor-pointer transition-colors">
                            <input 
                              type="radio" 
                              name="trainingType" 
                              checked={patientData.useIntervalTraining && !patientData.includeDAOPProtocol} 
                              onChange={() => setPatientData({ ...patientData, useIntervalTraining: true, includeDAOPProtocol: false })} 
                              className="w-4 h-4 accent-orange-600" 
                            />
                            <span className="text-sm font-semibold text-stone-700">Treino Intervalado (HIIT)</span>
                          </label>
                          {patientData.isPAD && (
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-orange-200 cursor-pointer transition-colors">
                              <input 
                                type="radio" 
                                name="trainingType" 
                                checked={patientData.includeDAOPProtocol} 
                                onChange={() => setPatientData({ ...patientData, includeDAOPProtocol: true, useIntervalTraining: false })} 
                                className="w-4 h-4 accent-orange-600" 
                              />
                              <span className="text-sm font-semibold text-stone-700">Protocolo SET para DAOP</span>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 bg-white p-6 rounded-2xl border border-orange-100 shadow-sm">
                        <h4 className="text-[10px] font-bold uppercase text-orange-600 tracking-widest">Protocolos Específicos</h4>
                        <div className="flex flex-col gap-3">
                          {patientData.isDiabetic && (
                            <ConditionCheckbox id="hiit-diabetic" label="Protocolo HIIT (Diabéticos)" checked={patientData.includeDiabeticHIIT} onChange={v => setPatientData({ ...patientData, includeDiabeticHIIT: v })} />
                          )}
                          {(patientData.isDiabetic || patientData.hasAngina || patientData.isHFrEF || patientData.isHFpEF) && (
                            <ConditionCheckbox id="hiit-unified" label="Protocolo HIIT Unificado (DAC, IC)" checked={patientData.includeUnifiedHIIT} onChange={v => setPatientData({ ...patientData, includeUnifiedHIIT: v })} />
                          )}
                          {!patientData.isDiabetic && !patientData.isPAD && !(patientData.hasAngina || patientData.isHFrEF || patientData.isHFpEF) && (
                            <p className="text-xs text-stone-400 italic">Nenhum protocolo específico adicional disponível para as condições marcadas.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2">
                  Gerar Protocolo <ChevronRight size={20} />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
                <button onClick={() => setProtocol(null)} className="flex items-center gap-2 text-stone-600 hover:text-orange-600 font-bold transition-colors">
                  <ArrowLeft size={18} /> Voltar
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-stone-200 px-4 py-2.5 rounded-xl font-bold hover:bg-stone-50 transition-all">
                    <Printer size={18} /> Imprimir
                  </button>
                  <button onClick={handleDownloadPDF} disabled={isSaving} className="flex items-center gap-2 bg-white border border-stone-200 px-4 py-2.5 rounded-xl font-bold hover:bg-stone-50 transition-all">
                    {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <FileText size={18} />} PDF
                  </button>
                  <button onClick={saveToRecords} disabled={isSaving} className="flex items-center gap-2 bg-stone-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-stone-500 transition-all">
                    {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Salvar
                  </button>
                </div>
              </div>

              <div ref={printRef} id="protocol-print-area" className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden print:shadow-none print:border-none">
                <div className="bg-stone-500 text-white p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Logo size={32} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold mb-1">Protocolo de Exercícios</h2>
                        <div className="flex items-center gap-2 text-stone-200 font-bold text-sm uppercase tracking-widest">
                          Cardio_Telereab • Telereabilitação
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-200 mb-1">Nível</div>
                      <div className={`px-4 py-1 rounded-full text-sm font-bold inline-block ${protocol.patientLevel === PatientLevel.LEVEL_1 ? 'bg-red-500/20 text-red-200' : protocol.patientLevel === PatientLevel.LEVEL_2 ? 'bg-orange-500/20 text-orange-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        Nível {protocol.patientLevel}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-200">Paciente</div>
                      <div className="text-lg font-semibold">{patientData.name}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-200">Ciclo</div>
                      <div className="text-lg font-semibold">{patientData.cycle}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-200">Meta Semanal</div>
                      <div className="text-lg font-semibold">{protocol.weeklyGoalMinutes} min</div>
                    </div>
                  </div>
                </div>

                <div className="p-10 space-y-12">
                  <section className="bg-stone-50 rounded-2xl p-8 border border-stone-200">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-6 flex items-center gap-2">
                      <Activity size={14} /> Análise Funcional
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                      <MetricCard label="TC6M" value={patientData.tc6m ? `${patientData.tc6m}m` : '---'} sub={`Predito: ${protocol.metrics.predictedTc6m}m`} />
                      <MetricCard label="% do Predito" value={`${protocol.metrics.percentageOfPredicted}%`} sub={protocol.metrics.cifClassification} />
                      <MetricCard label="VO2 Máx Est." value={protocol.metrics.vo2Max.toString()} sub="ml/kg/min" />
                    </div>
                    {patientData.sl5x > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-stone-200">
                        <MetricCard label="Sentar e Levantar (5x)" value={`${patientData.sl5x}s`} sub={protocol.metrics.sl5xInterpretation || ''} />
                        <MetricCard label="Risco de Queda" value={protocol.metrics.fallRisk || 'Baixo'} sub="Avaliação de Equilíbrio e Potência" />
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 flex items-center gap-2">
                      <Info size={14} /> Parecer Técnico
                    </h3>
                    <div className="bg-stone-50 border-l-4 border-orange-500 p-6 rounded-r-2xl italic text-stone-600">
                      {protocol.technicalOpinion}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 flex items-center gap-2">
                      <Smartphone size={14} /> Monitoramento Domiciliar
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                          <h4 className="font-bold text-blue-900 flex items-center gap-2">
                            <Activity size={18} /> Orientações de Intensidade
                          </h4>
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                              <p className="text-sm text-blue-800">
                                <span className="font-bold">Aquecimento/Resfriamento:</span> PSE (Borg) 9-11. A fala deve ser confortável e você deve conseguir cantar.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                              <p className="text-sm text-orange-800">
                                <span className="font-bold">Intensidade Moderada (Alvo):</span> PSE (Borg) 12-14. Você deve conseguir falar frases curtas, mas não cantar.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                              <p className="text-sm text-red-800 font-bold">
                                ALERTA VERMELHO: PSE ≥ 17 ou incapacidade de falar. Interrompa o exercício imediatamente e descanse.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                          <p className="text-xs text-stone-600 leading-relaxed">
                            <span className="font-bold">Nota:</span> O monitoramento pelo esforço percebido (Borg) e pelo Teste da Fala é uma alternativa validada cientificamente para o controle da intensidade do exercício quando não há disponibilidade de frequencímetro.
                          </p>
                        </div>
                      </div>

                      <BorgTalkTestComparison />
                    </div>
                  </section>

                  <section className="space-y-10">
                    {protocol.workouts.map((workout) => (
                      <div key={workout.id} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center font-bold text-stone-600 border border-stone-200">
                            {workout.id}
                          </div>
                          <h4 className="text-xl font-bold text-stone-600">{workout.title}</h4>
                        </div>

                        <ExerciseSection title="Aquecimento" exercises={workout.warmup} />
                        <ExerciseSection title="Treino Principal" exercises={workout.mainWorkout} />
                        <ExerciseSection title="Volta à Calma" exercises={workout.cooldown} />
                      </div>
                    ))}
                  </section>

                  {protocol.diabeticHIIT && (
                    <section className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-emerald-900">HIIT para Diabéticos</h3>
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Protocolo Baseado em Evidências</p>
                        </div>
                      </div>

                      <div className="prose prose-emerald max-w-none">
                        <p className="text-emerald-800 leading-relaxed">{protocol.diabeticHIIT.introduction}</p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                          <Info size={16} /> Parâmetros do HIIT
                        </h4>
                        <div className="bg-white p-6 rounded-2xl border border-emerald-100 text-emerald-800 text-sm leading-relaxed">
                          {protocol.diabeticHIIT.parameters}
                        </div>
                      </div>

                      <div className="space-y-4 overflow-x-auto">
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Protocolos Sugeridos</h4>
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-emerald-200">
                              <th className="py-3 px-4 font-bold text-emerald-900">Protocolo</th>
                              <th className="py-3 px-4 font-bold text-emerald-900">Estrutura</th>
                              <th className="py-3 px-4 font-bold text-emerald-900">Intensidade</th>
                              <th className="py-3 px-4 font-bold text-emerald-900">Duração</th>
                              <th className="py-3 px-4 font-bold text-emerald-900">Indicação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-100">
                            {protocol.diabeticHIIT.protocols.map((p, i) => (
                              <tr key={i} className="hover:bg-emerald-100/30 transition-colors">
                                <td className="py-3 px-4 font-semibold text-emerald-900">{p.name}</td>
                                <td className="py-3 px-4 text-emerald-800">{p.structure}</td>
                                <td className="py-3 px-4 text-emerald-800">{p.intensity}</td>
                                <td className="py-3 px-4 text-emerald-800">{p.duration}</td>
                                <td className="py-3 px-4 text-emerald-700 italic">{p.indication}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Exemplos Práticos para Treino Domiciliar</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {protocol.diabeticHIIT.practicalExamples.map((ex, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                              <h5 className="font-bold text-emerald-900 mb-3 flex items-center justify-between">
                                {ex.title}
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">{ex.frequency}</span>
                              </h5>
                              <div className="space-y-3 text-sm">
                                <div><span className="font-bold text-emerald-700">Aquecimento:</span> <span className="text-emerald-800">{ex.warmup}</span></div>
                                <div><span className="font-bold text-emerald-700">Fase Principal:</span> <span className="text-emerald-800">{ex.main}</span></div>
                                <div><span className="font-bold text-emerald-700">Volume:</span> <span className="text-emerald-800">{ex.reps}</span></div>
                                <div><span className="font-bold text-emerald-700">Desaquecimento:</span> <span className="text-emerald-800">{ex.cooldown}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert size={16} className="text-emerald-600" /> Considerações de Segurança
                          </h4>
                          <ul className="space-y-2">
                            {protocol.diabeticHIIT.safetyConsiderations.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-emerald-800">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Evidência Científica</h4>
                          <div className="bg-emerald-100/50 p-6 rounded-2xl border border-emerald-100 text-emerald-800 text-sm leading-relaxed italic">
                            {protocol.diabeticHIIT.comparison}
                          </div>
                        </div>
                      </div>

                      <div className="bg-emerald-900 text-emerald-50 p-6 rounded-2xl shadow-lg">
                        <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Recomendação Final</h4>
                        <p className="text-sm leading-relaxed opacity-90">{protocol.diabeticHIIT.recommendation}</p>
                      </div>
                    </section>
                  )}

                  {protocol.unifiedHIIT && (
                    <section className="bg-orange-50 rounded-3xl p-8 border border-orange-100 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-orange-900">Protocolo HIIT Unificado</h3>
                          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Aplicável a DAC, ICFEr, ICFEp</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-orange-100">
                          <h5 className="text-xs font-bold text-orange-600 uppercase mb-2">Fase 1</h5>
                          <p className="text-sm text-orange-900 font-medium">{protocol.unifiedHIIT.progression.phase1}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-orange-100">
                          <h5 className="text-xs font-bold text-orange-600 uppercase mb-2">Fase 2</h5>
                          <p className="text-sm text-orange-900 font-medium">{protocol.unifiedHIIT.progression.phase2}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-orange-100">
                          <h5 className="text-xs font-bold text-orange-600 uppercase mb-2">Fase 3</h5>
                          <p className="text-sm text-orange-900 font-medium">{protocol.unifiedHIIT.progression.phase3}</p>
                        </div>
                      </div>

                      {protocol.unifiedHIIT.hiitAdapted && (
                        <div className="space-y-6">
                          <div className="bg-white p-8 rounded-3xl border border-orange-200 shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-bold text-orange-900">{protocol.unifiedHIIT.hiitAdapted.title}</h4>
                              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full uppercase tracking-wider">
                                {protocol.unifiedHIIT.hiitAdapted.frequency}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Aquecimento</p>
                                <p className="text-sm text-orange-900 font-semibold">{protocol.unifiedHIIT.hiitAdapted.warmup}</p>
                              </div>
                              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Fase Principal</p>
                                <p className="text-sm text-orange-900 font-semibold">{protocol.unifiedHIIT.hiitAdapted.mainPhase}</p>
                              </div>
                              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Duração Total</p>
                                <p className="text-sm text-orange-900 font-semibold">{protocol.unifiedHIIT.hiitAdapted.totalDuration}</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h5 className="text-xs font-bold text-orange-600 uppercase tracking-widest">Circuito de Exercícios (Fase de Pico)</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {protocol.unifiedHIIT.hiitAdapted.exercises.map((ex, i) => (
                                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-stone-100 bg-stone-50/50">
                                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                                      {i + 1}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-stone-800 mb-1">{ex.name}</p>
                                      <p className="text-xs text-stone-600 leading-relaxed">{ex.instruction}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-stone-900 text-white p-4 rounded-2xl text-xs flex items-center gap-3">
                              <Info size={16} className="text-orange-400" />
                              <p><strong>Nota:</strong> O desaquecimento deve ser de {protocol.unifiedHIIT.hiitAdapted.cooldown} com caminhada leve e alongamentos.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert size={16} className="text-red-600" /> Contraindicações Absolutas
                          </h4>
                          <ul className="space-y-2 bg-red-50/50 p-4 rounded-2xl border border-red-100">
                            {protocol.unifiedHIIT.absoluteContraindications.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-red-900">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider flex items-center gap-2">
                            <Info size={16} className="text-orange-600" /> Contraindicações Relativas
                          </h4>
                          <ul className="space-y-2 bg-white p-4 rounded-2xl border border-orange-100">
                            {protocol.unifiedHIIT.relativeContraindications.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-orange-800">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider">Critérios de Seleção - Paciente Ideal</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-orange-200">
                                <th className="py-3 px-4 font-bold text-orange-900">Critério</th>
                                <th className="py-3 px-4 font-bold text-orange-900">Requisito</th>
                                <th className="py-3 px-4 font-bold text-orange-900">Justificativa</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-100">
                              {protocol.unifiedHIIT.selectionCriteria.map((c, i) => (
                                <tr key={i} className="bg-white/50">
                                  <td className="py-3 px-4 font-semibold text-orange-900">{c.criterion}</td>
                                  <td className="py-3 px-4 text-orange-800">{c.requirement}</td>
                                  <td className="py-3 px-4 text-orange-700 italic">{c.justification}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider">Estratificação de Risco para HIIT (AHA)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                            <h5 className="text-xs font-bold text-green-700 uppercase mb-3">Risco Baixo</h5>
                            <ul className="space-y-2">
                              {protocol.unifiedHIIT.riskStratification.low.map((item, i) => (
                                <li key={i} className="text-xs text-green-800 flex gap-2">
                                  <div className="mt-1 w-1 h-1 rounded-full bg-green-500 shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
                            <h5 className="text-xs font-bold text-yellow-700 uppercase mb-3">Risco Moderado</h5>
                            <ul className="space-y-2">
                              {protocol.unifiedHIIT.riskStratification.moderate.map((item, i) => (
                                <li key={i} className="text-xs text-yellow-800 flex gap-2">
                                  <div className="mt-1 w-1 h-1 rounded-full bg-yellow-500 shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                            <h5 className="text-xs font-bold text-red-700 uppercase mb-3">Risco Alto</h5>
                            <ul className="space-y-2">
                              {protocol.unifiedHIIT.riskStratification.high.map((item, i) => (
                                <li key={i} className="text-xs text-red-800 flex gap-2">
                                  <div className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {protocol.daopProtocol && (
                    <section className="bg-blue-50 rounded-3xl p-8 border border-blue-100 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-blue-900">Protocolo Padrão de SET para DAOP</h3>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Baseado em Diretrizes ACC/AHA</p>
                        </div>
                      </div>

                      {protocol.daopProtocol.teleSET && (
                        <div className="bg-white rounded-3xl p-8 border border-blue-200 space-y-8 shadow-sm">
                          <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
                            <Smartphone size={24} className="text-blue-600" />
                            <h3 className="text-xl font-bold text-blue-900">Protocolo Prático de Tele-SET para DAOP</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Fase 1: Avaliação Inicial</h4>
                              <ul className="space-y-2">
                                {protocol.daopProtocol.teleSET.fase1.map((item, i) => (
                                  <li key={i} className="flex gap-3 text-sm text-blue-800">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Fase 3: Monitoramento Remoto</h4>
                              <ul className="space-y-2">
                                {protocol.daopProtocol.teleSET.fase3.map((item, i) => (
                                  <li key={i} className="flex gap-3 text-sm text-blue-800">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Fase 2: Prescrição do Exercício Domiciliar</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm border-collapse border border-blue-100">
                                <thead>
                                  <tr className="bg-blue-600 text-white">
                                    <th className="py-3 px-4 font-bold">Parâmetro</th>
                                    <th className="py-3 px-4 font-bold">Semanas 1-4</th>
                                    <th className="py-3 px-4 font-bold">Semanas 5-8</th>
                                    <th className="py-3 px-4 font-bold">Semanas 9-12</th>
                                    <th className="py-3 px-4 font-bold">Ref</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-100">
                                  {protocol.daopProtocol.teleSET.fase2.map((row, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                                      <td className="py-3 px-4 font-bold text-blue-900">{row.parametro}</td>
                                      <td className="py-3 px-4 text-blue-800">{row.semanas1_4}</td>
                                      <td className="py-3 px-4 text-blue-800">{row.semanas5_8}</td>
                                      <td className="py-3 px-4 text-blue-800">{row.semanas9_12}</td>
                                      <td className="py-3 px-4 text-xs text-blue-400">{row.ref}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Escala de Dor de Claudicação para Automonitoramento</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {protocol.daopProtocol.teleSET.escalaDor.map((item, i) => (
                                <div key={i} className={`p-4 rounded-2xl border flex items-center gap-4 ${
                                  item.nivel === '3' || item.nivel === '4' ? 'bg-orange-50 border-orange-200' : 
                                  item.nivel === '5' ? 'bg-red-50 border-red-200' : 'bg-white border-blue-100'
                                }`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
                                    item.nivel === '3' || item.nivel === '4' ? 'bg-orange-500' : 
                                    item.nivel === '5' ? 'bg-red-600' : 'bg-blue-500'
                                  }`}>
                                    {item.nivel}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm text-stone-700">{item.descricao}</div>
                                    <div className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">{item.orientacao}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Componentes do Treino Supervisionado (SET)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-blue-200">
                                <th className="py-3 px-4 font-bold text-blue-900">Componente</th>
                                <th className="py-3 px-4 font-bold text-blue-900">Recomendação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-100">
                              {protocol.daopProtocol.standardSET.map((item, i) => (
                                <tr key={i} className="bg-white/50">
                                  <td className="py-3 px-4 font-semibold text-blue-900">{item.component}</td>
                                  <td className="py-3 px-4 text-blue-800">{item.recommendation}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                            <Info size={16} className="text-blue-600" /> Recomendações ACC/AHA 2024
                          </h4>
                          <ul className="space-y-3">
                            {protocol.daopProtocol.guidelines.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-blue-800 bg-white p-3 rounded-xl border border-blue-100">
                                <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                            <Activity size={16} className="text-blue-600" /> Programa Domiciliar Estruturado
                          </h4>
                          <div className="bg-white p-6 rounded-2xl border border-blue-100 space-y-4">
                            <p className="text-sm text-blue-900 font-medium">{protocol.daopProtocol.homeProgram.description}</p>
                            <ul className="space-y-2">
                              {protocol.daopProtocol.homeProgram.features.map((f, i) => (
                                <li key={i} className="flex gap-2 text-xs text-blue-800">
                                  <div className="mt-1 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs italic text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
                              {protocol.daopProtocol.homeProgram.evidence}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Considerações para Diabéticos com DAOP</h4>
                        <div className="bg-blue-900 text-blue-50 p-6 rounded-2xl shadow-lg text-sm leading-relaxed">
                          {protocol.daopProtocol.diabeticConsiderations}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert size={16} className="text-red-600" /> Contraindicações Absolutas
                          </h4>
                          <ul className="space-y-2 bg-red-50/50 p-4 rounded-2xl border border-red-100">
                            {protocol.daopProtocol.contraindications.absolute.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-red-900">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                            <Info size={16} className="text-blue-600" /> Contraindicações Relativas
                          </h4>
                          <ul className="space-y-2 bg-white p-4 rounded-2xl border border-blue-100">
                            {protocol.daopProtocol.contraindications.relative.map((item, i) => (
                              <li key={i} className="flex gap-3 text-sm text-blue-800">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-blue-100/50 p-6 rounded-2xl border border-blue-100">
                        <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-3">SET vs. Exercício Domiciliar</h4>
                        <p className="text-sm text-blue-800 leading-relaxed italic">
                          {protocol.daopProtocol.comparison}
                        </p>
                      </div>
                    </section>
                  )}

                  {protocol.diabeticHFpEF && (
                    <section className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <Activity size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-emerald-900">Protocolos para Diabético com ICFEp</h3>
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Baseado em OptimEx-Clin (JAMA 2021)</p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-emerald-100 italic text-sm text-emerald-800 leading-relaxed">
                        {protocol.diabeticHFpEF.evidence}
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Estudo OptimEx-Clin (Resultados 3 meses)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-emerald-200">
                                <th className="py-3 px-4 font-bold text-emerald-900">Modalidade</th>
                                <th className="py-3 px-4 font-bold text-emerald-900">Protocolo</th>
                                <th className="py-3 px-4 font-bold text-emerald-900">Intensidade</th>
                                <th className="py-3 px-4 font-bold text-emerald-900">Resultado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-100">
                              {protocol.diabeticHFpEF.optimExStudy.map((item, i) => (
                                <tr key={i} className="bg-white/50">
                                  <td className="py-3 px-4 font-semibold text-emerald-900">{item.modality}</td>
                                  <td className="py-3 px-4 text-emerald-800">{item.protocol}</td>
                                  <td className="py-3 px-4 text-emerald-800">{item.intensity}</td>
                                  <td className="py-3 px-4 font-bold text-emerald-600">{item.result}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {protocol.diabeticHFpEF.recommendedProtocols.map((p, i) => (
                          <div key={i} className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-3">
                            <h5 className="font-bold text-emerald-900 text-sm leading-tight">{p.title}</h5>
                            <div className="space-y-2 text-xs text-emerald-800">
                              <p><strong>Aquecimento:</strong> {p.warmup}</p>
                              <p><strong>Principal:</strong> {p.main}</p>
                              <p><strong>Frequência:</strong> {p.frequency}</p>
                              {p.progression && <p className="italic text-emerald-600">{p.progression}</p>}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Considerações Específicas</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {protocol.diabeticHFpEF.considerations.map((c, i) => (
                            <div key={i} className="flex gap-3 text-sm text-emerald-800 bg-white p-4 rounded-xl border border-emerald-100">
                              <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-emerald-900 text-emerald-50 p-6 rounded-2xl shadow-lg">
                        <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Exemplo Prático Domiciliar</h4>
                        <p className="text-sm leading-relaxed">{protocol.diabeticHFpEF.practicalExample}</p>
                      </div>
                    </section>
                  )}

                  <section className="bg-stone-50 rounded-3xl p-8 border border-stone-200 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Timer size={24} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-stone-900">Aba de Monitoramento: Validação da Intensidade</h3>
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">AHA/AACVPR 2024 - Métodos Auxiliares</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm space-y-4">
                        <h4 className="font-bold text-stone-800 flex items-center gap-2">
                          <div className="w-2 h-6 bg-orange-500 rounded-full" />
                          Escala de Borg (Esforço Percebido)
                        </h4>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          Como a FC pode ser pouco confiável em cardiopatas (devido a medicamentos ou arritmias), a Escala de Borg é o padrão-ouro para validação.
                        </p>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                          <p className="text-xs font-bold text-orange-800 uppercase mb-2">Zona Alvo:</p>
                          <p className="text-sm text-orange-900 font-medium">Manter entre 12-14 (Moderado) na escala 6-20.</p>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm space-y-4">
                        <h4 className="font-bold text-stone-800 flex items-center gap-2">
                          <div className="w-2 h-6 bg-blue-500 rounded-full" />
                          Talk Test (Teste da Fala)
                        </h4>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          Método prático e seguro para garantir que a intensidade não ultrapasse o limiar ventilatório.
                        </p>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-800 uppercase mb-2">Regra de Ouro:</p>
                          <p className="text-sm text-blue-900 font-medium">O paciente deve conseguir falar frases curtas, mas não deve conseguir cantar.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <AerobicCapacitySection metrics={protocol.metrics} />

                  <IncidentReporter 
                    therapistPhone={patientData.therapistPhone} 
                    patientName={patientData.name} 
                  />

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">Observações</h3>
                    <textarea
                      className="w-full min-h-[100px] p-4 rounded-2xl border border-stone-200 outline-none focus:border-orange-500 resize-none"
                      placeholder="Notas do fisioterapeuta..."
                      value={observations}
                      onChange={e => setObservations(e.target.value)}
                    />
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ConditionCheckbox({ id, label, checked, onChange }: { id: string, label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 hover:border-orange-200 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
      <input type="checkbox" id={id} className="w-5 h-5 accent-orange-600" checked={checked} onChange={e => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-sm font-medium text-stone-600 cursor-pointer">{label}</label>
    </div>
  );
}

const BorgTalkTestComparison = () => (
  <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
    <div className="bg-stone-800 text-white p-4 font-bold text-center uppercase tracking-widest text-[10px]">
      Comparativo: Esforço Percebido vs Teste da Fala
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[10px] border-collapse">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="p-3 font-bold text-stone-600">Borg (6-20)</th>
            <th className="p-3 font-bold text-stone-600">Borg (0-10)</th>
            <th className="p-3 font-bold text-stone-600">Intensidade</th>
            <th className="p-3 font-bold text-stone-600">Teste da Fala (Talk Test)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          <tr>
            <td className="p-3 font-bold text-blue-600">6 - 8</td>
            <td className="p-3 font-bold text-blue-600">0 - 1</td>
            <td className="p-3 text-stone-500">Muito Leve</td>
            <td className="p-3 text-stone-500">Fala normal, sem esforço.</td>
          </tr>
          <tr className="bg-emerald-50/30">
            <td className="p-3 font-bold text-emerald-600">9 - 11</td>
            <td className="p-3 font-bold text-emerald-600">2 - 3</td>
            <td className="p-3 text-emerald-700 font-medium">Leve (Aquecimento)</td>
            <td className="p-3 text-emerald-700">Fala confortável, consegue cantar.</td>
          </tr>
          <tr className="bg-orange-50/30">
            <td className="p-3 font-bold text-orange-600">12 - 14</td>
            <td className="p-3 font-bold text-orange-600">4 - 6</td>
            <td className="p-3 text-orange-700 font-bold">Moderado (Alvo)</td>
            <td className="p-3 text-orange-700">Fala frases curtas, mas não consegue cantar.</td>
          </tr>
          <tr className="bg-red-50/30">
            <td className="p-3 font-bold text-red-600">15 - 16</td>
            <td className="p-3 font-bold text-red-600">7 - 8</td>
            <td className="p-3 text-red-700 font-bold">Cansativo</td>
            <td className="p-3 text-red-700">Fala entrecortada, frases de 1-2 palavras.</td>
          </tr>
          <tr className="bg-red-100/50">
            <td className="p-3 font-bold text-red-800">≥ 17</td>
            <td className="p-3 font-bold text-red-800">9 - 10</td>
            <td className="p-3 text-red-900 font-black">Exaustivo (ALERTA)</td>
            <td className="p-3 text-red-900 font-bold">Incapaz de falar. Interromper imediatamente!</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const AerobicCapacitySection = ({ metrics }: { metrics: ClinicalMetrics }) => {
  return (
    <section className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-stone-900">Capacidade Aeróbica</h3>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Interpretação Funcional (TC6M & SL5x)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TC6M Interpretation */}
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Teste de Caminhada de 6 Minutos (TC6M)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Predito (Britto)</p>
                <p className="text-lg font-black text-blue-900">{metrics.predictedTc6m}m</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Limite Inferior (LIN)</p>
                <p className="text-lg font-black text-blue-900">{metrics.lin}m</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">% do Predito</p>
                <p className="text-lg font-black text-blue-900">{metrics.percentageOfPredicted}%</p>
              </div>
            </div>
            
            <div className={`p-5 rounded-2xl border shadow-md ${
              metrics.percentageOfPredicted > 95 ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
              metrics.percentageOfPredicted >= 76 ? "bg-blue-50 border-blue-200 text-blue-900" :
              metrics.percentageOfPredicted >= 51 ? "bg-yellow-50 border-yellow-200 text-yellow-900" :
              "bg-red-50 border-red-200 text-red-900"
            }`}>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Classificação CIF (OMS)</p>
              <p className="text-xl font-black leading-tight">{metrics.cifClassification}</p>
              <p className="text-[10px] mt-2 font-bold opacity-60 italic">O paciente atingiu {metrics.percentageOfPredicted}% da distância predita.</p>
            </div>
          </div>

          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
            <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Estimativa de VO2 (Capacidade Aeróbica)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">VO2 pico (Cahalin)</p>
                <p className="text-lg font-black text-emerald-900">{metrics.vo2Cahalin} <span className="text-[10px] font-normal">mL/kg/min</span></p>
                <p className="text-[8px] text-emerald-600 italic mt-1">Indicado para Insuficiência Cardíaca</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">VO2 máx (Burr)</p>
                <p className="text-lg font-black text-emerald-900">{metrics.vo2Burr} <span className="text-[10px] font-normal">mL/kg/min</span></p>
                <p className="text-[8px] text-emerald-600 italic mt-1">Indicado para Adultos Saudáveis</p>
              </div>
            </div>
            <div className="bg-emerald-900 text-emerald-50 p-4 rounded-xl text-xs leading-relaxed">
              <strong>Nota Clínica:</strong> O VO2 pico (Cahalin) reflete melhor a economia de movimento e limitação metabólica em cardiopatas.
            </div>
          </div>
        </div>

        {/* SL5x Interpretation */}
        <div className="space-y-6">
          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-4">
            <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider">Sentar e Levantar 5 Vezes (SL5x)</h4>
            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Interpretação Funcional</p>
              <p className="text-sm font-bold text-orange-900 leading-tight">{metrics.sl5xInterpretation}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Risco de Queda / Fragilidade</p>
              <p className="text-sm font-bold text-red-600">{metrics.fallRisk}</p>
            </div>
            <div className="bg-orange-100/50 p-4 rounded-xl text-[10px] text-orange-800 leading-relaxed italic">
              O SL5x avalia força explosiva e equilíbrio dinâmico. Em cardiopatas, valores &gt; 9,5s indicam capacidade severamente reduzida (&lt; 300m no TC6M).
            </div>
          </div>

          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-4">
            <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Metas de Melhora (MCID)</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100">
                <span className="text-xs font-bold text-stone-600 uppercase">TC6M (Ganho Real)</span>
                <span className="text-sm font-black text-emerald-600">+ 30 metros</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100">
                <span className="text-xs font-bold text-stone-600 uppercase">SL5x (Melhora Real)</span>
                <span className="text-sm font-black text-emerald-600">- 2.0 segundos</span>
              </div>
            </div>
            <p className="text-[9px] text-stone-500 italic leading-tight">
              A Diferença Mínima Clinicamente Importante (MCID) indica uma melhora funcional real que supera o erro de medida do teste.
            </p>
          </div>
        </div>
      </div>

      {/* CIF Table */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Classificação da Gravidade (CIF)</h4>
        <div className="overflow-hidden rounded-2xl border border-stone-200">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-stone-800 text-white">
                <th className="p-3 font-bold uppercase tracking-widest">Qualificador</th>
                <th className="p-3 font-bold uppercase tracking-widest">Gravidade</th>
                <th className="p-3 font-bold uppercase tracking-widest">% Deficiência</th>
                <th className="p-3 font-bold uppercase tracking-widest">% do Predito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr className={metrics.percentageOfPredicted > 95 ? "bg-emerald-50 font-bold" : ""}>
                <td className="p-3">0</td>
                <td className="p-3">Nenhuma</td>
                <td className="p-3">0 - 4%</td>
                <td className="p-3">&gt; 95%</td>
              </tr>
              <tr className={metrics.percentageOfPredicted >= 76 && metrics.percentageOfPredicted <= 95 ? "bg-emerald-50 font-bold" : ""}>
                <td className="p-3">1</td>
                <td className="p-3">Leve</td>
                <td className="p-3">5 - 24%</td>
                <td className="p-3">76% a 95%</td>
              </tr>
              <tr className={metrics.percentageOfPredicted >= 51 && metrics.percentageOfPredicted <= 75 ? "bg-emerald-50 font-bold" : ""}>
                <td className="p-3">2</td>
                <td className="p-3">Moderada</td>
                <td className="p-3">25 - 49%</td>
                <td className="p-3">51% a 75%</td>
              </tr>
              <tr className={metrics.percentageOfPredicted >= 5 && metrics.percentageOfPredicted <= 50 ? "bg-emerald-50 font-bold" : ""}>
                <td className="p-3">3</td>
                <td className="p-3">Grave</td>
                <td className="p-3">50 - 95%</td>
                <td className="p-3">5% a 50%</td>
              </tr>
              <tr className={metrics.percentageOfPredicted < 5 ? "bg-emerald-50 font-bold" : ""}>
                <td className="p-3">4</td>
                <td className="p-3">Completa</td>
                <td className="p-3">96 - 100%</td>
                <td className="p-3">&lt; 5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

function MetricCard({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm h-full">
      <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-black text-stone-600 mb-1">{value}</div>
      <div className="text-xs text-stone-400 font-medium leading-tight">{sub}</div>
    </div>
  );
}

function ExerciseSection({ title, exercises }: { title: string, exercises: Exercise[] }) {
  return (
    <div className="space-y-3">
      <h5 className="text-xs font-bold text-orange-600 uppercase tracking-wider">{title}</h5>
      <div className="grid grid-cols-1 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden">
        {exercises.map((ex, idx) => (
          <div key={idx} className="bg-white p-4 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1">
              <div className="font-bold text-stone-600">{ex.name}</div>
              <div className="text-sm text-stone-500">{ex.instruction}</div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="text-center min-w-[60px]">
                <div className="text-[10px] font-bold uppercase text-stone-400">Volume</div>
                <div className="font-semibold text-stone-600">{ex.reps}</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-[10px] font-bold uppercase text-stone-400">Descanso</div>
                <div className="font-semibold text-stone-600">{ex.rest}s</div>
              </div>
              <div className="text-center min-w-[80px]">
                <div className="text-[10px] font-bold uppercase text-stone-400">Intensidade</div>
                <div className="font-bold text-orange-600">{ex.intensityLabel}</div>
                <div className="text-[9px] text-stone-400">Borg: {ex.intensityBorg}</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-[10px] font-bold uppercase text-red-400">Angina</div>
                <div className="font-bold text-red-600">{ex.anginaTarget || "Não"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentReporter({ therapistPhone, patientName }: { therapistPhone?: string, patientName: string }) {
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const symptoms = [
    'Dor no peito (Angina)',
    'Falta de ar excessiva',
    'Tontura ou desmaio',
    'Palpitações / Arritmia',
    'Fadiga extrema',
    'Náuseas ou vômitos',
    'Dor forte nas pernas',
    'Outro (especificar na mensagem)'
  ];

  const handleReport = () => {
    if (!therapistPhone) {
      alert('Número do fisioterapeuta não configurado.');
      return;
    }
    if (!selectedSymptom) {
      alert('Por favor, selecione um sintoma.');
      return;
    }

    const message = `Olá, sou o paciente ${patientName}. Gostaria de relatar uma intercorrência durante o exercício: ${selectedSymptom}.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${therapistPhone.replace(/\D/g, '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section className="bg-red-50 p-8 rounded-3xl border border-red-100 space-y-6 print:hidden">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-900">Relatar Intercorrência</h3>
          <p className="text-xs text-red-700">Comunique sintomas anormais imediatamente ao seu fisioterapeuta.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select 
          className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white outline-none focus:border-red-500 text-sm"
          value={selectedSymptom}
          onChange={(e) => setSelectedSymptom(e.target.value)}
        >
          <option value="">Selecione o sintoma...</option>
          {symptoms.map((s, i) => (
            <option key={i} value={s}>{s}</option>
          ))}
        </select>
        
        <button 
          onClick={handleReport}
          className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200"
        >
          <MessageCircle size={18} />
          Relatar via WhatsApp
        </button>
      </div>
    </section>
  );
}
