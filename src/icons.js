import {
  CalendarCheck,
  Wallet,
  Mic,
  FileText,
  Image,
  ArrowLeftRight,
  Briefcase,
  Heart,
  Crown,
  Code,
  Music,
  Box,
  Cpu,
  Terminal,
  Zap,
  ShieldCheck,
  Download,
  Minimize2,
  Captions,
  Megaphone,
  Languages,
  Sparkles,
  Tag,
  FilePen,
  WandSparkles,
  Clapperboard,
} from 'lucide-react';

export const ICONS = {
  calendar: CalendarCheck,
  wallet: Wallet,
  mic: Mic,
  'file-text': FileText,
  image: Image,
  convert: ArrowLeftRight,
  briefcase: Briefcase,
  heart: Heart,
  crown: Crown,
  code: Code,
  music: Music,
  box: Box,
  cpu: Cpu,
  terminal: Terminal,
  zap: Zap,
  shield: ShieldCheck,
  download: Download,
  minimize: Minimize2,
  subtitles: Captions,
  megaphone: Megaphone,
  languages: Languages,
  sparkles: Sparkles,
  tag: Tag,
  pen: FilePen,
  wand: WandSparkles,
  clapper: Clapperboard,
};

export const getIcon = (name) => ICONS[name] ?? Box;

// "$29", "$4.50", "Gratis"
export const money = (n) => (n === 0 ? 'Gratis' : Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
// "/mes" suffix for paid memberships
export const perLabel = (p) => (p.period === 'month' && p.price > 0 ? '/mes' : '');
