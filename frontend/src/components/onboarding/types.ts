import { Theme } from '../../types/domain';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export interface ArchetypeBook {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  description: string;
  features: string[];
  coverGradient: string;
  iconName: 'sparkles' | 'history' | 'cpu' | 'cat' | 'book' | 'compass' | 'brain';
}

export interface OnboardingWizardProps {
  onClose: () => void;
}

export interface OnboardingState {
  step: OnboardingStep;
  direction: 'forward' | 'backward';
  selectedTheme: Theme;
  aiProvider: 'openrouter' | 'local';
  openrouterApiKey: string;
  openrouterModel: string;
  localPreset: 'ollama' | 'lmstudio' | 'custom';
  localBaseUrl: string;
  localModel: string;
  starterPackStatus: 'idle' | 'installing' | 'installed' | 'skipped';
  starterPackProgress: number;
  isSaving: boolean;
  error: string | null;
}

export const STARTER_ARCHETYPES: ArchetypeBook[] = [
  {
    id: 'cats',
    title: 'The Curious World of Cats',
    subtitle: 'Ethology & Evolutionary Biology',
    badge: 'BIOLOGY ARCHIVE',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    description: 'Sensory neurobiology, obligate hypercarnivory, and commensal domestication in Felis catus.',
    features: ['Evolutionary Genomics', 'Anatomical Diagrams', 'Ethology Research'],
    coverGradient: 'from-amber-950/60 via-amber-900/30 to-amber-950/80 border-amber-500/30 text-amber-300',
    iconName: 'cat',
  },
  {
    id: 'reading',
    title: 'The Art and Science of Reading',
    subtitle: 'Cognitive Neuroscience & Orthography',
    badge: 'NEUROSCIENCE',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    description: 'Neuronal recycling, the Visual Word Form Area, and how primate visual circuits decode text.',
    features: ['Neuronal Recycling', 'Cognitive Science', 'Reading Fluency'],
    coverGradient: 'from-emerald-950/60 via-emerald-900/30 to-emerald-950/80 border-emerald-500/30 text-emerald-300',
    iconName: 'book',
  },
  {
    id: 'asterion',
    title: 'The Asterion Expedition',
    subtitle: 'Deep Pelagic Hard Sci-Fi',
    badge: 'HARD SCI-FI',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    description: 'Pelagic exploration narrative 41 kilometers beneath Asterion-IV investigating deep ocean acoustic signals.',
    features: ['Hard Sci-Fi Narrative', 'Acoustic Spectra', 'Deep Pelagic'],
    coverGradient: 'from-cyan-950/60 via-cyan-900/30 to-cyan-950/80 border-cyan-500/30 text-cyan-300',
    iconName: 'compass',
  },
  {
    id: 'ml',
    title: 'Machine Learning Field Notes',
    subtitle: 'Applied Engineering & Empirical Risk',
    badge: 'MACHINE LEARNING',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    description: 'Empirical risk minimization, feature leakage mitigation, and mathematical derivations on turbine telemetry.',
    features: ['Mathematical Proofs', 'Empirical Risk', 'Turbine Telemetry'],
    coverGradient: 'from-purple-950/60 via-purple-900/30 to-purple-950/80 border-purple-500/30 text-purple-300',
    iconName: 'brain',
  },
  {
    id: 'making-omnitome',
    title: 'The Making of Omnitome',
    subtitle: 'Technical Memoir & Architecture',
    badge: 'SYSTEMS MEMOIR',
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    description: 'The engineering story behind local-first neural reading: vector search, embeddings, and bounded compression.',
    features: ['Local-First Architecture', 'Neural Compression', 'Provenance Graph'],
    coverGradient: 'from-indigo-950/60 via-indigo-900/30 to-indigo-950/80 border-indigo-500/30 text-indigo-300',
    iconName: 'cpu',
  },
  {
    id: 'field-guide',
    title: 'The Omnitome Field Guide',
    subtitle: 'User Manual & Operational Protocol',
    badge: 'OPERATIONAL GUIDE',
    badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    description: 'Authoritative reader manual covering navigation shortcuts, TTS audio ergonomics, and synthesis.',
    features: ['Keyboard Shortcuts', 'TTS Voice Engine', 'Reading Workflow'],
    coverGradient: 'from-rose-950/60 via-rose-900/30 to-rose-950/80 border-rose-500/30 text-rose-300',
    iconName: 'sparkles',
  },
];
