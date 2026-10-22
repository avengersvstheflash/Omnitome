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
  iconName: 'sparkles' | 'history' | 'cpu';
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
    id: 'clean',
    title: 'The Synthetica Codex: Volume I',
    subtitle: 'Pristine Digital Edition',
    badge: 'PRISTINE DIGITAL',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    description: 'Pure typography, nested headers, footnotes, and citation cross-references.',
    features: ['Clean Markdown', 'Footnotes & Citations', 'Hierarchical TOC'],
    coverGradient: 'from-emerald-950/60 via-emerald-900/30 to-emerald-950/80 border-emerald-500/30 text-emerald-300',
    iconName: 'sparkles',
  },
  {
    id: 'damaged',
    title: 'Chronicles of the Iron Vault (1894)',
    subtitle: 'Historical OCR Restoration',
    badge: 'HISTORICAL ARCHIVE',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    description: 'Simulated scanned PDF with OCR damage repair, margin notes, and degraded text reconstruction.',
    features: ['OCR Noise Repair', 'Marginalia Annotations', 'Archaic Syntax'],
    coverGradient: 'from-amber-950/60 via-amber-900/30 to-amber-950/80 border-amber-500/30 text-amber-300',
    iconName: 'history',
  },
  {
    id: 'technical',
    title: 'Neural Graph Traversal & Syntactic Synthesis',
    subtitle: 'Technical Monograph',
    badge: 'TECHNICAL SPEC',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    description: 'Code blocks, KaTeX mathematical proofs, algorithmic diagrams, and multi-level tables.',
    features: ['KaTeX Equations', 'Syntax Highlighting', 'Relational Graphs'],
    coverGradient: 'from-purple-950/60 via-purple-900/30 to-purple-950/80 border-purple-500/30 text-purple-300',
    iconName: 'cpu',
  },
];
