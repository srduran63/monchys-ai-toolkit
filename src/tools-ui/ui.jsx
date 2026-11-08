import { useState } from 'react';
import { AlertTriangle, Sparkles, Upload, X } from 'lucide-react';

export const input =
  'w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 font-semibold focus:outline-none focus:border-blob focus:ring-4 focus:ring-blob/30';
export const label = 'block text-xs font-extrabold uppercase tracking-wider text-ink/50 mb-1';

export function Card({ className = '', children }) {
  return <section className={`bg-white rounded-[2rem] shadow-toy p-5 md:p-6 ${className}`}>{children}</section>;
}

export function ErrorBox({ error, onClose }) {
  if (!error) return null;
  return (
    <p className="bg-mouth/10 text-mouth rounded-xl text-sm font-bold p-3 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="flex-1">{error}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Cerrar">
          <X className="w-4 h-4" />
        </button>
      )}
    </p>
  );
}

// Shown where a feature needs Claude and the server has no API key.
export function AiOffNotice({ children = 'Esta función usa IA y todavía no está activada en el servidor.' }) {
  return (
    <p className="bg-cream rounded-xl text-sm font-bold text-ink/60 p-3 flex items-start gap-2">
      <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
      {children}
    </p>
  );
}

export function DropZone({ accept, multiple = false, onFiles, title, hint, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles([...e.dataTransfer.files]);
      }}
      className={`flex flex-col items-center justify-center text-center rounded-3xl border-3 border-dashed px-6 py-10 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed border-ink/20' : 'cursor-pointer'
      } ${dragging ? 'border-mouth bg-mouth/5' : 'border-blob bg-blob-soft/40 hover:bg-blob-soft'}`}
    >
      <div className="hex w-14 h-14 bg-blob flex items-center justify-center mb-3">
        <Upload className="w-6 h-6" />
      </div>
      <p className="font-display font-semibold text-lg">{title}</p>
      {hint && <p className="text-xs text-ink/50 mt-2 max-w-sm">{hint}</p>}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles([...e.target.files]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

// "X de Y este mes" usage meter (a single proportion, not a chart).
export function UsageMeter({ used, limit, unit }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-toy px-4 py-3 min-w-56">
      <p className="text-xs font-bold text-ink/50">Uso este mes</p>
      <p className="font-display font-bold">
        {used.toLocaleString('es')} <span className="text-ink/50 font-semibold">de {limit.toLocaleString('es')} {unit}</span>
      </p>
      <div className="h-1.5 bg-cream rounded-full mt-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-mouth' : 'bg-data'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const money = (n) => `$${Number(n).toLocaleString('es', { maximumFractionDigits: 2 })}`;
