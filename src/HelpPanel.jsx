import { HeartHandshake, Phone } from 'lucide-react';

// Crisis help lines (Diario emocional and the Monchys chat).
export default function HelpPanel({ prominent = false, onClose }) {
  return (
    <section
      className={`rounded-[2rem] p-5 md:p-6 ${prominent ? 'bg-coal text-white shadow-toy-lg animate-pop-in' : 'bg-white shadow-toy'}`}
      role={prominent ? 'alert' : undefined}
    >
      <h3 className="font-display font-semibold text-lg flex items-center gap-2">
        <HeartHandshake className="w-5 h-5" /> {prominent ? 'No tienes que pasar por esto a solas' : 'Si necesitas ayuda'}
      </h3>
      <p className={`text-sm mt-1 ${prominent ? 'text-white/80' : 'text-ink/65'}`}>
        {prominent
          ? 'Lo que escribiste suena muy difícil. Hablar con alguien ahora puede ayudar. Si estás en peligro, llama a emergencias.'
          : 'Este diario no sustituye la atención de un profesional de la salud mental.'}
      </p>
      <ul className={`text-sm mt-3 space-y-1.5 ${prominent ? 'text-white' : ''}`}>
        <li className="flex items-start gap-2">
          <Phone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Emergencias: <strong>911</strong> (México, EE. UU. y gran parte de América) · <strong>112</strong> (España y UE)
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Phone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            España, atención a la conducta suicida: <strong>024</strong>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Phone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            México, Línea de la Vida: <strong>800 911 2000</strong>
          </span>
        </li>
        <li className={`text-xs ${prominent ? 'text-white/60' : 'text-ink/50'}`}>En otros países, busca la línea de prevención del suicidio de tu país o acude al servicio de urgencias más cercano.</li>
      </ul>
      {onClose && (
        <button onClick={onClose} className="btn btn-blue px-4 py-2 text-sm mt-4">
          Entendido
        </button>
      )}
    </section>
  );
}
