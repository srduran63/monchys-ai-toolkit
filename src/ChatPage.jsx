import AppHeader from './AppHeader';
import { LegalFooter } from './Legal';
import { ChatView } from './MonchysChat';
import { CHAT_SEO } from '../shared/seo.js';

// /chat: the Monchys chat full size, with a short guide underneath for search engines and visitors.
export default function ChatPage() {
  return (
    <div className="min-h-screen bg-cream text-ink font-sans">
      <AppHeader />
      <main className="page py-4 md:py-6">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-balance">{CHAT_SEO.h1}</h1>
        <p className="text-ink/65 mt-1 mb-4 max-w-3xl">{CHAT_SEO.intro}</p>
        <ChatView variant="page" />

        <section className="max-w-3xl mt-12">
          <h2 className="font-display font-bold text-2xl">Cómo funciona</h2>
          <ol className="mt-3 list-decimal pl-6 space-y-1 text-ink/75">
            {CHAT_SEO.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <h2 className="font-display font-bold text-2xl mt-10">Preguntas frecuentes</h2>
          {CHAT_SEO.faq.map(([q, a]) => (
            <div key={q} className="mt-4">
              <h3 className="font-display font-semibold">{q}</h3>
              <p className="text-ink/70">{a}</p>
            </div>
          ))}
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
