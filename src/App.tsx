import React, { useState, useRef } from 'react';
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
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PatientData, Protocol, PatientLevel, Exercise } from './types';
import { generateProtocol, estimateMaxHR } from './utils/protocolGenerator';

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
  // CORREÇÃO: Valores iniciais como undefined ou string vazia para facilitar a digitação
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    tc6m: undefined,
    sl5x: 0,
    cycle: 'Prescrição Inicial',
    age: undefined as any,
    sex: 'M',
    weight: undefined as any,
    height: undefined as any,
    restingHR: undefined as any,
    maxHR: undefined,
    tc6mMaxHR: undefined,
    betaBlockerStatus: 'none',
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
    useIntervalTraining: false
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
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Protocolo_${patientData.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      alert('Erro ao gerar PDF. Tente imprimir.');
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

  // Auto-calculate Max HR (Estimativa)
  React.useEffect(() => {
    if (patientData.age) {
      const isDAC = patientData.hasInfarto || patientData.isPostRVM || patientData.hasAngina || patientData.isSCA;
      const estimated = estimateMaxHR(patientData.age, patientData.betaBlockerStatus, isDAC);
      if (patientData.maxHR !== estimated) {
        setPatientData(prev => ({ ...prev, maxHR: estimated }));
      }
    }
  }, [patientData.age, patientData.betaBlockerStatus, patientData.hasInfarto, patientData.isPostRVM, patientData.hasAngina, patientData.isSCA]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientData.name || !patientData.age || !patientData.weight) {
      alert("Por favor, preencha os dados básicos (Nome, Idade, Peso e Altura).");
      return;
    }
    const generated = generateProtocol(patientData);
    setProtocol(generated);
  };

  const navLinks = [{ label: 'Gerador', id: 'Gerador' }, { label: 'Prontuário', id: 'Prontuário' }];

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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'Gerador' && !protocol && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold mb-3">Nova Prescrição Clínica</h2>
                <p className="text-stone-600">Insira os dados para gerar o protocolo de telereabilitação.</p>
              </div>

              <form onSubmit={handleGenerate} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">Nome do Paciente</label>
                    <input type="text" required className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-orange-500" value={patientData.name} onChange={e => setPatientData({ ...patientData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">Ciclo</label>
                    <select className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white outline-none" value={patientData.cycle} onChange={e => setPatientData({ ...patientData, cycle: e.target.value })}>
                      <option>Prescrição Inicial</option>
                      <option>Reavaliação 15 dias</option>
                      <option>Reavaliação 30 dias</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">Idade</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.age || ''} onChange={e => setPatientData({ ...patientData, age: e.target.value ? Number(e.target.value) : undefined as any })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">Peso (kg)</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.weight || ''} onChange={e => setPatientData({ ...patientData, weight: e.target.value ? Number(e.target.value) : undefined as any })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">Altura (cm)</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.height || ''} onChange={e => setPatientData({ ...patientData, height: e.target.value ? Number(e.target.value) : undefined as any })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-stone-500">FC Repouso</label>
                    <input type="number" className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none" value={patientData.restingHR || ''} onChange={e => setPatientData({ ...patientData, restingHR: e.target.value ? Number(e.target.value) : undefined as any })} />
                  </div>
                </div>

                <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2">
                  Gerar Protocolo Personalizado <ChevronRight size={20} />
                </button>
              </form>
            </motion.div>
          )}
          {/* O restante do código de exibição do protocolo segue a mesma lógica... */}
        </AnimatePresence>
      </main>
    </div>
  );
}