import { CATEGORIES, SITE } from './lessons.js'

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  pageBg: '#070B14',
  surface: '#0E1525',
  surfaceHi: '#131D31',
  border: '#1B2840',
  borderHi: '#2A3A57',
  text: '#E8EEF7',
  muted: '#8597B0',
  dim: '#4A5C7A',
  accent: '#7C8CF8', // platform chrome (eyebrow, ring)
  ok: '#34D399',
  display: "'Space Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
}

const BASE = import.meta.env.BASE_URL // '/education/' in prod, '/' in dev
const href = (path) => `${BASE}${path}/`

const lessonCount = CATEGORIES.reduce((n, c) => n + c.lessons.length, 0)

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <>
      <Styles />
      <main style={{ background: T.pageBg, minHeight: '100vh', color: T.text }}>
        <div className="wrap">
          <Hero />

          {CATEGORIES.map((cat, ci) => (
            <Category key={cat.id} cat={cat} index={ci} />
          ))}

          <Footer />
        </div>
      </main>
    </>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <header className="hero rise" style={{ animationDelay: '40ms' }}>
      <div className="hero-text">
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 12,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: T.accent,
            marginBottom: 18,
          }}
        >
          {SITE.eyebrow}
        </div>

        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 700,
            fontSize: 'clamp(30px, 5.2vw, 54px)',
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
            margin: 0,
            maxWidth: 680,
          }}
        >
          {SITE.title}
        </h1>

        <p
          style={{
            marginTop: 20,
            maxWidth: 560,
            fontSize: 16,
            lineHeight: 1.65,
            color: T.muted,
          }}
        >
          {SITE.intro}
        </p>

        <div className="meta">
          <Stat value={lessonCount} label={plural(lessonCount, 'модуль', 'модулі', 'модулів')} />
          <Dot />
          <Stat value={CATEGORIES.length} label="теми" />
          <Dot />
          <a className="repo" href={SITE.repoUrl} target="_blank" rel="noreferrer">
            відкритий код ↗
          </a>
        </div>
      </div>

      <LoopMark />
    </header>
  )
}

function Stat({ value, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
      <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 18, color: T.text }}>
        {value}
      </span>
      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>{label}</span>
    </span>
  )
}

const Dot = () => <span style={{ color: T.dim }}>·</span>

// Ambient signature: an event-loop ring with a dot travelling around it.
function LoopMark() {
  return (
    <div className="loop" aria-hidden="true">
      <svg width="116" height="116" viewBox="0 0 116 116" fill="none">
        <circle cx="58" cy="58" r="50" stroke={T.border} strokeWidth="1.5" />
        <circle cx="58" cy="58" r="50" stroke={T.accent} strokeWidth="1.5"
          strokeDasharray="6 308" strokeLinecap="round" opacity="0.85" />
        <g className="loop-rotor">
          <circle cx="58" cy="8" r="4.5" fill={T.accent} />
          <circle cx="58" cy="8" r="9" fill={T.accent} opacity="0.18" />
        </g>
        <circle cx="58" cy="58" r="3" fill={T.dim} />
      </svg>
    </div>
  )
}

// ─── Category ────────────────────────────────────────────────────────────────
function Category({ cat, index }) {
  return (
    <section className="cat rise" style={{ animationDelay: `${140 + index * 90}ms` }}>
      <div className="cat-head">
        <span className="cat-dot" style={{ background: cat.color }} />
        <h2
          style={{
            fontFamily: T.mono,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: T.text,
          }}
        >
          {cat.label}
        </h2>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>— {cat.note}</span>
        <span className="cat-rule" style={{ background: `linear-gradient(90deg, ${cat.color}55, transparent)` }} />
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>
          {String(cat.lessons.length).padStart(2, '0')}
        </span>
      </div>

      <div className="grid">
        {cat.lessons.map((l) => (
          <LessonCard key={l.path} lesson={l} color={cat.color} />
        ))}
      </div>
    </section>
  )
}

// ─── Lesson card ─────────────────────────────────────────────────────────────
function LessonCard({ lesson, color }) {
  return (
    
      className="card"
      href={href(lesson.path)}
      style={{ '--c': color }}
    >
      <span className="card-spine" />
      <div className="card-body">
        <div className="card-top">
          <h3
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 19,
              letterSpacing: '-0.01em',
              color: T.text,
            }}
          >
            {lesson.title}
          </h3>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: T.muted }}>
            {lesson.blurb}
          </p>

          <div className="tags">
            {lesson.tags.map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
          </div>
        </div>

        <div className="card-foot">
          <span className="status">
            <span className="status-led" />
            Готово
          </span>
          <span className="open">
            Відкрити <span className="arrow">→</span>
          </span>
        </div>
      </div>
    </a>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="foot rise" style={{ animationDelay: '320ms' }}>
      <p style={{ fontFamily: T.mono, fontSize: 12.5, lineHeight: 1.8, color: T.dim }}>
        Кожен модуль — окремий Vite-додаток у своїй теці.<br />
        Додати новий: створи теку в <span className="code">nodejs/</span> чи{' '}
        <span className="code">nest/</span> і зареєструй її в{' '}
        <span className="code">home/src/lessons.js</span>.
      </p>
    </footer>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function plural(n, one, few, many) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function Styles() {
  return (
    <style>{`
      .wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: clamp(40px, 8vw, 96px) clamp(20px, 5vw, 40px) 80px;
        font-family: ${T.display};
      }

      /* ── hero ── */
      .hero {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 32px; margin-bottom: clamp(48px, 9vw, 88px);
      }
      .hero-text { flex: 1; min-width: 0; }
      .meta {
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        margin-top: 30px; padding-top: 22px;
        border-top: 1px solid ${T.border};
      }
      .repo {
        font-family: ${T.mono}; font-size: 12px; color: ${T.muted};
        text-decoration: none; transition: color .18s;
      }
      .repo:hover { color: ${T.accent}; }

      .loop { flex-shrink: 0; margin-top: 6px; }
      .loop-rotor { transform-origin: 58px 58px; }

      /* ── category ── */
      .cat { margin-bottom: clamp(36px, 6vw, 56px); }
      .cat-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .cat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .cat-rule { flex: 1; height: 1px; }

      /* ── grid ── */
      .grid {
        display: grid; gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      }

      /* ── card ── */
      .card {
        position: relative; display: flex; overflow: hidden;
        border: 1px solid ${T.border}; border-radius: 14px;
        background: ${T.surface}; text-decoration: none;
        transition: transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease;
      }
      .card-spine {
        width: 3px; flex-shrink: 0; background: var(--c);
        transition: width .2s ease, box-shadow .2s ease;
      }
      .card-body {
        flex: 1; min-width: 0; padding: 20px 22px;
        display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
      }
      .card:hover {
        transform: translateY(-3px);
        background: ${T.surfaceHi};
        border-color: color-mix(in srgb, var(--c) 50%, ${T.border});
        box-shadow: 0 14px 34px -18px color-mix(in srgb, var(--c) 60%, transparent);
      }
      .card:hover .card-spine { width: 5px; box-shadow: 0 0 14px var(--c); }
      .card:focus-visible {
        outline: 2px solid var(--c); outline-offset: 2px;
      }

      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
      .tag {
        font-family: ${T.mono}; font-size: 11px; color: ${T.muted};
        padding: 3px 9px; border-radius: 999px;
        border: 1px solid ${T.border}; background: rgba(255,255,255,.012);
        transition: border-color .2s, color .2s;
      }
      .card:hover .tag { border-color: ${T.borderHi}; }

      .card-foot {
        display: flex; align-items: center; justify-content: space-between;
        padding-top: 14px; border-top: 1px solid ${T.border};
      }
      .status {
        display: inline-flex; align-items: center; gap: 7px;
        font-family: ${T.mono}; font-size: 12px; color: ${T.ok};
      }
      .status-led {
        width: 6px; height: 6px; border-radius: 50%; background: ${T.ok};
        box-shadow: 0 0 8px ${T.ok};
      }
      .open {
        font-family: ${T.mono}; font-size: 12.5px; color: ${T.muted};
        display: inline-flex; align-items: center; gap: 6px;
        transition: color .2s;
      }
      .card:hover .open { color: var(--c); }
      .arrow { display: inline-block; transition: transform .2s ease; }
      .card:hover .arrow { transform: translateX(4px); }

      /* ── footer ── */
      .foot { margin-top: 24px; padding-top: 28px; border-top: 1px solid ${T.border}; }
      .code {
        font-family: ${T.mono}; color: ${T.muted};
        background: ${T.surface}; border: 1px solid ${T.border};
        padding: 1px 6px; border-radius: 5px; font-size: 11.5px;
      }

      /* ── motion ── */
      @media (prefers-reduced-motion: no-preference) {
        .rise { opacity: 0; transform: translateY(14px); animation: rise .6s cubic-bezier(.2,.7,.2,1) forwards; }
        .loop-rotor { animation: loopspin 4.2s linear infinite; }
      }
      @keyframes rise { to { opacity: 1; transform: none; } }
      @keyframes loopspin { to { transform: rotate(360deg); } }

      /* ── responsive ── */
      @media (max-width: 720px) {
        .hero { flex-direction: column; }
        .loop { align-self: flex-end; margin-top: -8px; }
        .grid { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}
