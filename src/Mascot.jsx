// Mascot logo from /public/mascot-logo.png (transparent cutout, 411x568). The eyelids are
// positioned in percentages of the image so they stay aligned at any size.
const LIDS = [
  { left: '25.5%', top: '23.2%', width: '10%', height: '8.1%' },
  { left: '65.9%', top: '23.2%', width: '10.5%', height: '8.1%' },
];
// Lips that close over the open mouth when it bites or chews.
const MOUTH = { left: '27.8%', top: '35%', width: '46.2%', height: '22%' };

// Breathes and blinks on its own. Changing `hopKey` makes it jump once,
// changing `biteKey` makes it bite once, and `chewing` keeps it chewing.
export default function Mascot({ hopKey = 0, biteKey = 0, chewing = false, className = '' }) {
  return (
    <div className={`shrink-0 ${className}`} role="img" aria-label="Mascota de la tienda">
      <div key={hopKey} className={hopKey ? 'mascot-hop' : ''}>
        <div key={biteKey} className={`${biteKey ? 'mascot-chomp' : ''} ${chewing ? 'mascot-chewing' : ''}`}>
          <div className="relative aspect-[411/568] mascot-breathe">
            <img
              src="/mascot-logo.png"
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full select-none pointer-events-none"
            />
            {LIDS.map((style, i) => (
              <span key={i} className="mascot-lid" style={style} />
            ))}
            <span className="mascot-mouth" style={MOUTH}>
              <span className="mascot-lip mascot-lip-top" />
              <span className="mascot-lip mascot-lip-bottom" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
