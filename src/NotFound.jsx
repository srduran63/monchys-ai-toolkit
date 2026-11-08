import AppHeader from './AppHeader';
import Mascot from './Mascot';
import { LegalFooter } from './Legal';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream text-ink font-sans">
      <AppHeader />
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <Mascot className="w-20 mx-auto" />
        <h1 className="font-display font-bold text-fluid-h1 mt-6">Monchys se comió esta página</h1>
        <p className="text-ink/65 mt-2">La dirección no existe o cambió. Prueba con nuestras herramientas:</p>
        <a href="/" className="btn btn-red px-6 py-3 mt-6">
          Ver todas las herramientas
        </a>
      </main>
      <LegalFooter />
    </div>
  );
}
