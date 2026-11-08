import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';

const NAME = 'Monchys IA';
const LETTERS = [...NAME];
const BITE_MS = 95; // time per letter while eating
const REGROW_STAGGER_MS = 35;
const CHEW_MS = 0.34 * 5 * 1000; // five chews (matches the CSS chew cycle)

// Store logo: the mascot walks over the name eating it letter by letter, chews,
// then the letters grow back. Runs once on load. The logo links home; on the home page
// a click scrolls back to the top and replays the animation instead.
export default function Logo({ hopKey = 0 }) {
  const [eaten, setEaten] = useState(0); // number of letters currently eaten
  const [x, setX] = useState(0); // mascot horizontal offset in px
  const [moving, setMoving] = useState('none'); // none | bite | return
  const [biteKey, setBiteKey] = useState(0);
  const [burpKey, setBurpKey] = useState(0);
  const [chewing, setChewing] = useState(false);
  const mascotRef = useRef(null);
  const letterRefs = useRef([]);
  const timers = useRef([]);
  const busy = useRef(false);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const eat = () => {
    if (busy.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    busy.current = true;

    const m = mascotRef.current.getBoundingClientRect();
    const mouth = m.left + m.width / 2;

    LETTERS.forEach((_, i) => {
      later(() => {
        const r = letterRefs.current[i].getBoundingClientRect();
        setMoving('bite');
        setX(r.left + r.width / 2 - mouth);
        setEaten(i + 1);
        setBiteKey((k) => k + 1);
      }, i * BITE_MS);
    });

    const eatenAt = LETTERS.length * BITE_MS + 150;
    later(() => setChewing(true), eatenAt);
    const done = eatenAt + CHEW_MS;
    later(() => {
      setChewing(false);
      setBurpKey((k) => k + 1);
    }, done);
    later(() => {
      setMoving('return');
      setX(0);
    }, done + 450);
    later(() => setEaten(0), done + 900);
    later(() => {
      setMoving('none');
      busy.current = false;
    }, done + 900 + LETTERS.length * REGROW_STAGGER_MS + 400);
  };

  const goHome = (e) => {
    if (window.location.pathname !== '/') return;
    e.preventDefault();
    if (window.location.hash) history.replaceState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    eat();
  };

  useEffect(() => {
    let firstVisit = true;
    try {
      firstVisit = !sessionStorage.getItem('monchys-ate');
      sessionStorage.setItem('monchys-ate', '1');
    } catch {}
    const start = firstVisit ? setTimeout(eat, 900) : null;
    return () => {
      clearTimeout(start);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      busy.current = false;
      setChewing(false);
    };
  }, []);

  const transition =
    moving === 'bite'
      ? `transform ${BITE_MS}ms linear`
      : moving === 'return'
        ? 'transform 450ms cubic-bezier(0.3, 0.8, 0.4, 1.2)'
        : 'none';

  return (
    <a href="/" onClick={goHome} className="flex items-center gap-3 text-left" aria-label={`${NAME}, ir al inicio`}>
      <div ref={mascotRef} className="relative z-10" style={{ transform: `translateX(${x}px)`, transition }}>
        <Mascot hopKey={hopKey + burpKey} biteKey={biteKey} chewing={chewing} className="w-11" />
      </div>
      <div>
        <span className="block font-display font-bold text-xl md:text-2xl leading-none" aria-hidden="true">
          {LETTERS.map((ch, i) => {
            const gone = i < eaten;
            return (
              <span
                key={i}
                ref={(el) => (letterRefs.current[i] = el)}
                className="inline-block"
                style={{
                  transform: gone ? 'scale(0) translateX(-40%)' : 'none',
                  opacity: gone ? 0 : 1,
                  transition: gone
                    ? 'transform 120ms ease-in 60ms, opacity 120ms ease-in 60ms'
                    : `transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.5) ${i * REGROW_STAGGER_MS}ms, opacity 200ms ${i * REGROW_STAGGER_MS}ms`,
                }}
              >
                {ch === ' ' ? ' ' : ch}
              </span>
            );
          })}
        </span>
        <p className="hidden min-[400px]:block text-xs font-bold text-blob-deep mt-1">herramientas con IA que trabajan por ti</p>
      </div>
    </a>
  );
}
