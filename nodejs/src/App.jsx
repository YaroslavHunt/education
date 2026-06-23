import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const T = {
  bg: '#06091280',
  pageBg: '#060912',
  surface: '#0B1020',
  card: '#0F1828',
  cardAlt: '#141F34',
  border: '#1A2640',
  borderBright: '#253550',
  text: '#E4EBF8',
  muted: '#7A8FA6',
  dim: '#3D5070',
  v8: '#FBBF24',
  libuv: '#34D399',
  api: '#818CF8',
  stack: '#F87171',
  heap: '#FB923C',
  micro: '#F472B6',
  macro: '#60A5FA',
  nextTick: '#C084FC',
};

const PHASE_COLORS = ['#F97316', '#EF4444', '#8B5CF6', '#22C55E', '#3B82F6', '#EC4899'];

const PHASES = [
  {
    id: 0, key: 'timers', angle: 270, color: '#F97316', icon: '⏰', name: 'Timers',
    badge: 'setTimeout / setInterval',
    detail: `Виконує колбеки таймерів, чий поріг (threshold) вже минув.\n\n⚠️ setTimeout(fn, 0) не означає "одразу". Це означає "щонайменше через 0мс". Реально — мінімум 1мс, а зазвичай після I/O колбеків поточної ітерації.`,
    example: `setTimeout(() => {\n  console.log('⏰ timer!');\n}, 0);\n\n// Запуститься в НАСТУПНІЙ ітерації\n// Event Loop, у фазі "timers"`,
  },
  {
    id: 1, key: 'pending', angle: 330, color: '#EF4444', icon: '⚠️', name: 'Pending I/O',
    badge: 'Системні I/O помилки',
    detail: `Виконує колбеки I/O операцій, відкладених з попередньої ітерації.\n\nЦе здебільшого помилки TCP-з'єднань: ECONNREFUSED, EADDRINUSE. Такі помилки не можна обробити одразу в poll фазі, тому вони потрапляють сюди на наступній ітерації.`,
    example: `const net = require('net');\nconst client = net.connect(9999, 'localhost');\n\nclient.on('error', (err) => {\n  // ⚠️ Потрапляє в pending callbacks!\n  console.log(err.code); // ECONNREFUSED\n});`,
  },
  {
    id: 2, key: 'idle', angle: 30, color: '#8B5CF6', icon: '🔧', name: 'Idle/Prepare',
    badge: 'Тільки для Node.js internals',
    detail: `Ця фаза — виключно для внутрішнього використання Node.js.\n\nЯк розробник, ти тут нічого не контролюєш і не бачиш. Node.js використовує її для підготовки до poll фази (наприклад, оновлення таймерів та відкладена ініціалізація).`,
    example: `// 🔒 Ця фаза недоступна розробникам\n// Node.js використовує її для:\n// - підготовки I/O операцій\n// - внутрішньої оптимізації\n// - libuv idle handlers\n\n// Ти це не бачиш, але це відбувається!`,
  },
  {
    id: 3, key: 'poll', angle: 90, color: '#22C55E', icon: '📡', name: 'Poll',
    badge: 'Нові I/O події — серце Event Loop',
    detail: `Найважливіша фаза! Event Loop тут:\n\n1️⃣ Обчислює скільки часу він може блокуватись\n2️⃣ Виконує I/O колбеки з черги\n3️⃣ Якщо черга порожня — чекає на нові I/O події\n4️⃣ Якщо є setImmediate — переходить до check\n5️⃣ Якщо таймери готові — переходить до timers`,
    example: `const fs = require('fs');\n\nfs.readFile('./data.txt', (err, data) => {\n  // 📡 Виконується ТУТ, у poll фазі!\n  console.log('Файл:', data.length, 'байт');\n});`,
  },
  {
    id: 4, key: 'check', angle: 150, color: '#3B82F6', icon: '✅', name: 'Check',
    badge: 'setImmediate',
    detail: `Виконує колбеки setImmediate().\n\nsetImmediate vs setTimeout(fn, 0):\n✅ setImmediate: ЗАВЖДИ після poll у цій ітерації\n⏰ setTimeout: у НАСТУПНІЙ ітерації, у timers фазі\n\nВсередині I/O колбека — setImmediate ЗАВЖДИ раніше за setTimeout(fn, 0).`,
    example: `const fs = require('fs');\n\nfs.readFile('./data.txt', () => {\n  setTimeout(() => console.log('timeout'), 0);\n  setImmediate(() => console.log('immediate'));\n});\n// Вивід: immediate → timeout (ЗАВЖДИ!)`,
  },
  {
    id: 5, key: 'close', angle: 210, color: '#EC4899', icon: '🚪', name: 'Close',
    badge: 'socket.on("close"), server.close()',
    detail: `Остання фаза ітерації. Виконує "закриваючі" колбеки.\n\nПісля цього Event Loop або починає НОВУ ітерацію (якщо є робота), або завершує процес Node.js (якщо більше нема жодних завдань, таймерів, відкритих з'єднань).`,
    example: `const server = require('http').createServer();\n\nserver.close(() => {\n  // 🚪 Виконується у close callbacks фазі\n  console.log('Сервер зупинено');\n  process.exit(0);\n});`,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function polar(angleDeg, r, cx = 210, cy = 210) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// ─── UI Components ──────────────────────────────────────────────────────────
function Code({ children, accent = T.v8 }) {
  return (
    <pre style={{
      background: '#040810',
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      padding: '14px 16px',
      margin: '10px 0 0',
      fontSize: 12.5,
      lineHeight: 1.7,
      color: '#93C5FD',
      overflowX: 'auto',
      fontFamily: '"Fira Code","Cascadia Code","Consolas",monospace',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {children}
    </pre>
  );
}

function Badge({ children, color = '#fff' }) {
  return (
    <span style={{
      display: 'inline-block',
      background: color + '1A',
      color,
      border: `1px solid ${color}35`,
      borderRadius: 5,
      padding: '2px 9px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'monospace',
      letterSpacing: 0.3,
    }}>
      {children}
    </span>
  );
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderTop: accent ? `3px solid ${accent}` : undefined,
      borderRadius: 12,
      padding: 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Heading({ children, accent, level = 2 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 8 }}>
      {accent && <div style={{ width: 3, height: 18, background: accent, borderRadius: 2, flexShrink: 0 }} />}
      {level === 1
        ? <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>{children}</h1>
        : <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>{children}</h2>}
    </div>
  );
}

function Para({ children }) {
  return <p style={{ color: T.muted, lineHeight: 1.75, margin: '0 0 16px', fontSize: 13.5 }}>{children}</p>;
}

// ─── Tab: Архітектура ────────────────────────────────────────────────────────
function ArchTab() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Heading accent={T.api} level={1}>Node.js — що це насправді?</Heading>
      <Para>
        Більшість думає: "Node.js — це просто JavaScript на сервері". Але під капотом три окремі потужні компоненти, кожен зі своєю роллю.
      </Para>

      {/* Architecture diagram */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 22 }}>
        {/* Your code */}
        <div style={{ background: '#0A2010', border: `2px dashed #4ade8040`, borderRadius: 10, padding: '12px 20px', textAlign: 'center', marginBottom: 6 }}>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>📝 Твій JavaScript код</div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>app.js, server.js, index.js …</div>
        </div>
        <div style={{ textAlign: 'center', color: T.dim, fontSize: 18, lineHeight: 1 }}>↓</div>

        {/* Node.js APIs */}
        <div style={{ background: '#10122A', border: `1px solid ${T.api}35`, borderRadius: 10, padding: '12px 16px', margin: '6px 0' }}>
          <div style={{ color: T.api, fontWeight: 700, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>🔌 Node.js Core APIs</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
            {['fs','http','https','net','crypto','dns','path','os','stream','child_process','events','buffer'].map(a => (
              <Badge key={a} color={T.api}>{a}</Badge>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', color: T.dim, fontSize: 18, lineHeight: 1 }}>↓</div>

        {/* V8 + libuv */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '6px 0' }}>
          <div style={{ background: '#1A1200', border: `1px solid ${T.v8}35`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>⚡</div>
            <div style={{ color: T.v8, fontWeight: 800, fontSize: 15, marginBottom: 8 }}>V8 Engine</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.7 }}>
              Виконує JS код<br/>Компілює JS → машинний код<br/>Call Stack<br/>Memory Heap<br/>Garbage Collector
            </div>
          </div>
          <div style={{ background: '#001810', border: `1px solid ${T.libuv}35`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>🔧</div>
            <div style={{ color: T.libuv, fontWeight: 800, fontSize: 15, marginBottom: 8 }}>libuv</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.7 }}>
              Event Loop (6 фаз)<br/>Async I/O операції<br/>Thread Pool (4 потоки)<br/>Таймери, DNS lookup<br/>Черга подій
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: T.dim, fontSize: 18, lineHeight: 1 }}>↓</div>

        {/* OS */}
        <div style={{ background: '#120A00', border: `1px solid #78350f40`, borderRadius: 10, padding: '10px 16px', textAlign: 'center', marginTop: 6 }}>
          <div style={{ color: '#92400e', fontWeight: 700, fontSize: 12 }}>🖥️ Операційна система (Linux / macOS / Windows)</div>
          <div style={{ color: T.dim, fontSize: 11, marginTop: 3 }}>Kernel · Filesystem · Network · Hardware</div>
        </div>
      </div>

      {/* Key insight */}
      <div style={{ background: `${T.api}0F`, border: `1px solid ${T.api}25`, borderRadius: 12, padding: 18, marginBottom: 22 }}>
        <div style={{ color: T.api, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>💡 Головна ідея: чому Node.js не "блокується"?</div>
        <Para>
          JavaScript — однопотоковий. В одну мить виконується ТІЛЬКИ один рядок коду. Тоді як Node.js обробляє тисячі запитів одночасно?
        </Para>
        <Para>
          Відповідь: libuv + Event Loop. Поки V8 виконує твій JS, libuv у фоні обробляє I/O через ядро ОС та Thread Pool. Коли результат готовий — колбек ставиться в чергу, і Event Loop передає його у V8 для виконання. Жодного блокування!
        </Para>
      </div>

      {/* Three analogies */}
      <Heading accent={T.libuv}>Аналогії для розуміння</Heading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { color: T.v8, emoji: '🧠', title: 'V8 = Мозок', desc: 'Знає лише одну мову — JavaScript. Читає, думає, виконує. Але нічого не робить "вручну".' },
          { color: T.libuv, emoji: '💪', title: 'libuv = Тіло', desc: 'Виконує фізичну роботу: читає файли, відправляє мережеві запити, керує таймерами.' },
          { color: T.api, emoji: '🤝', title: 'Node APIs = Перекладач', desc: 'Перетворює твій JS-код (fs.readFile) у виклики libuv і системні операції.' },
        ].map(({ color, emoji, title, desc }) => (
          <Card key={title} accent={color}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
            <div style={{ color, fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{title}</div>
            <div style={{ color: T.muted, fontSize: 12.5, lineHeight: 1.65 }}>{desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: V8 Engine ─────────────────────────────────────────────────────────
function V8Tab() {
  const codeSteps = [
    { desc: 'Код ще не виконується. Call Stack порожній.', stack: [], out: null },
    { desc: 'main() починає виконуватись — входить у стек.', stack: ['main()'], out: null },
    { desc: 'console.log("start") — входить у стек.', stack: ['console.log("start")', 'main()'], out: 'start' },
    { desc: 'console.log повернувся, виходить зі стека.', stack: ['main()'], out: null },
    { desc: 'greet("Vasyl") викликається — входить у стек.', stack: ['greet("Vasyl")', 'main()'], out: null },
    { desc: 'Всередині greet: concat — виконується, повертає значення.', stack: ['greet("Vasyl")', 'main()'], out: null },
    { desc: 'greet() повернув результат, виходить зі стека.', stack: ['main()'], out: null },
    { desc: 'console.log(msg) — входить у стек.', stack: ['console.log(msg)', 'main()'], out: 'Hello, Vasyl!' },
    { desc: 'console.log виконано, виходить зі стека.', stack: ['main()'], out: null },
    { desc: 'main() завершився. Стек порожній ✅', stack: [], out: null },
  ];
  const [step, setStep] = useState(-1);
  const cur = step >= 0 ? codeSteps[step] : null;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Heading accent={T.v8} level={1}>⚡ V8 — Серце Node.js</Heading>
      <Para>
        V8 — JavaScript-рушій від Google (той самий, що в Chrome). Він перетворює твій JS у машинний код і виконує його. Але сам V8 — однопотоковий і має лише один Call Stack.
      </Para>

      {/* Call Stack + Heap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        <Card accent={T.stack}>
          <div style={{ color: T.stack, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📚 Call Stack — Стек викликів</div>
          <Para>Структура LIFO — як стопка тарілок. Кожен виклик функції додає новий "кадр" зверху. Повернення — прибирає зверху.</Para>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['greet("World")', 'sayHi()', 'main()'].map((f, i) => (
              <div key={f} style={{
                background: '#040810',
                border: `1px solid ${i === 0 ? T.stack + 'AA' : T.border}`,
                borderRadius: 6, padding: '7px 12px',
                color: i === 0 ? T.stack : T.muted,
                fontSize: 12.5, fontFamily: 'monospace',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{f}</span>
                {i === 0 && <span style={{ fontSize: 10, color: T.stack }}>← поточна</span>}
              </div>
            ))}
          </div>
        </Card>

        <Card accent={T.heap}>
          <div style={{ color: T.heap, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>💾 Memory Heap — Купа пам'яті</div>
          <Para>Тут живуть об'єкти, масиви, функції. V8 автоматично керує пам'яттю через Garbage Collector.</Para>
          <div style={{ background: '#040810', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
            {[
              { addr: '0x1A2B', val: '{ name: "Vasyl" }', color: T.heap },
              { addr: '0x3C4D', val: '[1, 2, 3, 4, 5]', color: '#34D399' },
              { addr: '0x5E6F', val: 'function greet() {}', color: '#818CF8' },
              { addr: '0x7A8B', val: '"Hello, World"', color: '#F472B6' },
            ].map(({ addr, val, color }) => (
              <div key={addr} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                <span style={{ color: T.dim }}>{addr}:</span>
                <span style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Interactive Call Stack */}
      <Card accent={T.v8} style={{ marginBottom: 22 }}>
        <div style={{ color: T.v8, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🎮 Інтерактивно: як Call Stack працює</div>
        <Para>Натискай "Наступний крок" і дивись як функції входять і виходять зі стека:</Para>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Код:</div>
            <Code accent={T.v8}>{`function greet(name) {
  return "Hello, " + name;
}

// main:
console.log("start");
const msg = greet("Vasyl");
console.log(msg);`}</Code>
            {cur && (
              <div style={{ marginTop: 10, background: `${T.v8}12`, border: `1px solid ${T.v8}30`, borderRadius: 8, padding: 10 }}>
                <div style={{ color: T.muted, fontSize: 12 }}>
                  📍 <strong style={{ color: T.text }}>Крок {step + 1}/{codeSteps.length}:</strong> {cur.desc}
                </div>
                {cur.out && (
                  <div style={{ marginTop: 6, color: '#4ade80', fontSize: 12, fontFamily: 'monospace' }}>
                    console → "{cur.out}"
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Call Stack (верх = поточна функція):</div>
            <div style={{ background: '#040810', border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, minHeight: 130, display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
              {(!cur || cur.stack.length === 0)
                ? <div style={{ color: T.dim, fontSize: 12, textAlign: 'center', margin: 'auto' }}>{step < 0 ? 'Натисни кнопку нижче' : '✅ Стек порожній'}</div>
                : cur.stack.map((frame, i) => (
                  <div key={i} style={{
                    background: i === 0 ? `${T.stack}20` : T.card,
                    border: `1px solid ${i === 0 ? T.stack + '70' : T.border}`,
                    borderRadius: 6, padding: '6px 12px',
                    color: i === 0 ? T.stack : T.muted,
                    fontSize: 12.5, fontFamily: 'monospace', textAlign: 'center',
                  }}>{frame}</div>
                ))
              }
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setStep(s => Math.min(s + 1, codeSteps.length - 1))}
                disabled={step >= codeSteps.length - 1}
                style={{ flex: 1, padding: '8px', background: T.v8, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: step >= codeSteps.length - 1 ? 'not-allowed' : 'pointer', opacity: step >= codeSteps.length - 1 ? 0.45 : 1 }}>
                ▶ Наступний крок
              </button>
              <button onClick={() => setStep(-1)}
                style={{ padding: '8px 12px', background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                ↺
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Stack Overflow */}
      <Card accent={T.stack} style={{ marginBottom: 22 }}>
        <div style={{ color: T.stack, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚠️ Stack Overflow</div>
        <Para>Якщо функції викликають одна одну нескінченно, Call Stack переповнюється. Node.js кидає: <code style={{ color: T.stack }}>RangeError: Maximum call stack size exceeded</code></Para>
        <Code accent={T.stack}>{`function infinite() {
  return infinite(); // ❌ STACK OVERFLOW!
}
infinite(); // RangeError: Maximum call stack size exceeded`}</Code>
      </Card>

      {/* JIT */}
      <Heading accent={T.v8}>🚀 JIT компіляція — чому V8 такий швидкий</Heading>
      <Para>V8 не просто інтерпретує JS — він його компілює "на льоту" (Just-In-Time) прямо під час виконання.</Para>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { icon: '📝', title: 'Parsing', desc: 'JS → AST (абстрактне синтаксичне дерево)', color: '#60A5FA' },
          { icon: '⚙️', title: 'Ignition', desc: 'AST → байткод (швидкий старт)', color: '#818CF8' },
          { icon: '🔥', title: 'TurboFan', desc: '"Гарячий" код → оптимізований машинний', color: T.v8 },
          { icon: '♻️', title: 'GC', desc: 'Garbage Collector прибирає невикористану пам\'ять', color: T.libuv },
        ].map(({ icon, title, desc, color }) => (
          <Card key={title}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ color, fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{title}</div>
            <div style={{ color: T.muted, fontSize: 11.5, lineHeight: 1.6 }}>{desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: libuv ──────────────────────────────────────────────────────────────
function LibuvTab() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Heading accent={T.libuv} level={1}>🔧 libuv — Асинхронна магія Node.js</Heading>
      <Para>
        libuv — бібліотека написана на C, спеціально для Node.js. Вона реалізує Event Loop, асинхронний I/O, Thread Pool і таймери. Без libuv Node.js заблоковувався б при кожній операції вводу-виводу.
      </Para>

      {/* Two paths */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        <Card accent={T.macro}>
          <div style={{ color: T.macro, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔵 Kernel Async I/O</div>
          <div style={{ color: T.muted, fontSize: 12.5, lineHeight: 1.7, marginBottom: 10 }}>
            <strong style={{ color: T.text }}>Без потоків!</strong> ОС сама сповіщає через epoll (Linux) / kqueue (macOS) / IOCP (Windows) коли дані готові.
          </div>
          {[['🌐 TCP/UDP сокети', 'http, net, socket.io'],['🔗 Unix pipes', 'process.stdin/stdout'],['🔌 Named pipes (IPC)', 'child_process, cluster']].map(([n, e]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: T.text }}>{n}</span>
              <Badge color={T.macro}>{e}</Badge>
            </div>
          ))}
        </Card>

        <Card accent={T.heap}>
          <div style={{ color: T.heap, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🟠 Thread Pool (4 потоки)</div>
          <div style={{ color: T.muted, fontSize: 12.5, lineHeight: 1.7, marginBottom: 10 }}>
            <strong style={{ color: T.text }}>Потребують фонових потоків.</strong> ОС не підтримує повністю async API для цих операцій.
          </div>
          {[['📁 File System','fs.readFile, fs.writeFile'],['🔐 Crypto','bcrypt, pbkdf2, randomBytes'],['🌍 DNS lookup','dns.lookup()'],['🗜️ zlib','gzip, deflate, brotli']].map(([n,e]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: T.text }}>{n}</span>
              <Badge color={T.heap}>{e}</Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Thread Pool Visual */}
      <Card accent={T.libuv} style={{ marginBottom: 22 }}>
        <div style={{ color: T.libuv, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>👷 Thread Pool — 4 невтомних робітники</div>
        <Para>За замовчуванням libuv створює 4 потоки. Можна збільшити через змінну <code style={{ color: T.libuv }}>UV_THREADPOOL_SIZE=16</code> (максимум 1024).</Para>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { id: 1, status: 'busy', task: 'fs.readFile' },
            { id: 2, status: 'busy', task: 'crypto.pbkdf2' },
            { id: 3, status: 'idle', task: null },
            { id: 4, status: 'idle', task: null },
          ].map(({ id, status, task }) => (
            <div key={id} style={{ background: '#040810', border: `1px solid ${status === 'busy' ? T.libuv + '50' : T.border}`, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>👷</div>
              <div style={{ color: T.muted, fontSize: 11, marginBottom: 5 }}>Потік #{id}</div>
              {task ? <Badge color={T.libuv}>{task}</Badge> : <div style={{ color: T.dim, fontSize: 11 }}>вільний</div>}
            </div>
          ))}
        </div>
        <div style={{ background: '#040810', borderRadius: 8, padding: '10px 14px' }}>
          <span style={{ color: '#F97316', fontWeight: 600, fontSize: 12 }}>⚠️ Увага:</span>
          <span style={{ color: T.muted, fontSize: 12 }}> Якщо всі 4 потоки зайняті, нові задачі чекають! bcrypt з великою кількістю salt rounds може зупинити весь Node.js. Рішення: збільшити UV_THREADPOOL_SIZE або використовувати окремий воркер-процес.</span>
        </div>
      </Card>

      {/* Flow */}
      <Heading accent={T.libuv}>Схема: як async запит проходить через libuv</Heading>
      <Card>
        {[
          { n: '1', t: 'Твій JS код викликає fs.readFile() → повертається ОДРАЗУ ⚡', c: '#4ade80' },
          { n: '2', t: 'Node.js API передає запит у libuv', c: T.libuv },
          { n: '3', t: 'libuv ставить задачу в Thread Pool (черга завдань)', c: T.heap },
          { n: '4', t: 'Вільний потік #N читає файл з диску (паралельно з твоїм JS!)', c: '#F97316' },
          { n: '5', t: 'Читання завершено → колбек + дані поміщаються в Event Queue', c: T.macro },
          { n: '6', t: 'Event Loop у poll фазі бере колбек із черги', c: T.api },
          { n: '7', t: 'Event Loop передає колбек у V8 для виконання', c: T.v8 },
        ].map(({ n, t, c }, i, arr) => (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: c + '20', border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c }}>{n}</div>
              {i < arr.length - 1 && <div style={{ width: 2, height: 18, background: T.border, margin: '2px 0' }} />}
            </div>
            <div style={{ paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
              <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6 }}>{t}</div>
            </div>
          </div>
        ))}
        <Code accent={T.libuv}>{`const fs = require('fs');

// Цей виклик повертається ОДРАЗУ — не блокує!
fs.readFile('./large-file.txt', (err, data) => {
  // Виконується ПІСЛЯ, коли файл прочитано (крок 7)
  console.log('Розмір файлу:', data.length, 'байт');
});

// Цей рядок виконується ДРУГИМ, не чекаючи файлу!
console.log('Цей рядок — другий');`}</Code>
      </Card>
    </div>
  );
}

// ─── Tab: Event Loop ─────────────────────────────────────────────────────────
function LoopTab() {
  const [active, setActive] = useState(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setActive(a => (a === null ? 0 : (a + 1) % 6));
      }, 1400);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const toggle = () => {
    if (playing) { clearInterval(timerRef.current); setPlaying(false); setActive(null); }
    else { setPlaying(true); setActive(0); }
  };

  // CSS circle layout
  const containerSize = 420;
  const cx = 210, cy = 210, r = 140;
  const boxW = 76, boxH = 54;
  const sel = active !== null ? PHASES[active] : null;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      <Heading accent={T.api} level={1}>🔄 Event Loop — Серце Node.js</Heading>
      <Para>
        Event Loop — це нескінченний цикл у libuv. Він постійно перевіряє: "Є завдання для виконання?" — і виконує їх по черзі через 6 фаз. Клікни на фазу або запусти анімацію!
      </Para>

      <div style={{ display: 'grid', gridTemplateColumns: `${containerSize}px 1fr`, gap: 22, marginBottom: 22 }}>
        {/* Phase Circle */}
        <div>
          <Card style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: containerSize, height: containerSize, flexShrink: 0 }}>
              {/* Ring */}
              <div style={{
                position: 'absolute',
                top: cy - r, left: cx - r,
                width: r * 2, height: r * 2,
                borderRadius: '50%',
                border: `1.5px solid ${T.border}`,
                pointerEvents: 'none',
              }} />

              {/* Center */}
              <div style={{
                position: 'absolute',
                top: cy - 32, left: cx - 32,
                width: 64, height: 64,
                borderRadius: '50%',
                background: T.card,
                border: `1.5px solid ${sel ? sel.color + '50' : T.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
                transition: 'border-color 0.3s',
              }}>
                <div style={{ color: T.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>Event</div>
                <div style={{ color: sel ? sel.color : T.api, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>Loop</div>
                <div style={{ color: T.dim, fontSize: 16, lineHeight: 1 }}>∞</div>
              </div>

              {/* Phase nodes */}
              {PHASES.map((phase) => {
                const pos = polar(phase.angle, r, cx, cy);
                const isActive = active === phase.id;
                const left = pos.x - boxW / 2;
                const top = pos.y - boxH / 2;
                return (
                  <div key={phase.id}
                    onClick={() => { if (!playing) setActive(isActive ? null : phase.id); }}
                    style={{
                      position: 'absolute',
                      left, top,
                      width: boxW, height: boxH,
                      background: isActive ? phase.color + '25' : T.card,
                      border: `2px solid ${isActive ? phase.color : T.border}`,
                      borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                      cursor: playing ? 'default' : 'pointer',
                      transition: 'all 0.3s',
                      boxShadow: isActive ? `0 0 16px ${phase.color}40` : 'none',
                      zIndex: 2,
                    }}>
                    <span style={{ fontSize: 16 }}>{phase.icon}</span>
                    <span style={{ color: isActive ? phase.color : T.muted, fontSize: 9.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{phase.name}</span>
                  </div>
                );
              })}

              {/* Arrows connecting phases */}
              <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={containerSize} height={containerSize}>
                <defs>
                  <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0,8 3,0 6" fill={T.dim} />
                  </marker>
                </defs>
                {PHASES.map((phase, i) => {
                  const next = PHASES[(i + 1) % 6];
                  const fromAngle = phase.angle + 22;
                  const toAngle = next.angle - 22;
                  const from = polar(fromAngle, r, cx, cy);
                  const to = polar(toAngle, r, cx, cy);
                  const isActiveArc = playing && active === phase.id;
                  return (
                    <line key={i}
                      x1={from.x} y1={from.y}
                      x2={to.x} y2={to.y}
                      stroke={isActiveArc ? phase.color : T.dim}
                      strokeWidth={isActiveArc ? 2 : 1}
                      strokeOpacity={isActiveArc ? 0.8 : 0.4}
                      markerEnd="url(#arr)"
                    />
                  );
                })}
              </svg>
            </div>

            <button onClick={toggle} style={{
              padding: '8px 22px',
              background: playing ? T.card : T.api,
              color: playing ? T.muted : '#fff',
              border: `1px solid ${playing ? T.border : T.api}`,
              borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {playing ? '⏹ Зупинити' : '▶ Запустити анімацію'}
            </button>
            <div style={{ color: T.dim, fontSize: 11 }}>
              {playing ? `Активна фаза: ${sel?.name}` : '← Клікни на фазу для деталей'}
            </div>
          </Card>
        </div>

        {/* Details panel */}
        <div>
          {sel ? (
            <div style={{
              background: T.card, border: `1px solid ${sel.color}40`, borderLeft: `4px solid ${sel.color}`,
              borderRadius: 12, padding: 20, height: '100%', boxSizing: 'border-box',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 26 }}>{sel.icon}</span>
                <div>
                  <div style={{ color: sel.color, fontWeight: 800, fontSize: 16 }}>{sel.name}</div>
                  <Badge color={sel.color}>{sel.badge}</Badge>
                </div>
              </div>
              <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                {sel.detail}
              </div>
              <Code accent={sel.color}>{sel.example}</Code>
            </div>
          ) : (
            <div style={{ background: T.card, border: `2px dashed ${T.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 14 }}>
              <div style={{ fontSize: 40 }}>👆</div>
              <div style={{ color: T.dim, textAlign: 'center', fontSize: 13, lineHeight: 1.7 }}>Клікни на будь-яку фазу в колі, щоб побачити детальний опис та приклад коду</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {PHASES.map(p => <Badge key={p.id} color={p.color}>{p.icon} {p.name}</Badge>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Microtasks between phases */}
      <Card accent={T.micro} style={{ marginBottom: 22 }}>
        <div style={{ color: T.micro, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚡ Критично важливо: мікрозавдання між КОЖНОЮ фазою</div>
        <Para>
          Перед переходом між будь-якими фазами Event Loop повністю спустошує черги мікрозавдань. Тобто: Promise.then і process.nextTick завжди виконаються перш ніж Event Loop перейде до наступної фази!
        </Para>
        <div style={{ background: '#040810', borderRadius: 10, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {PHASES.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge color={p.color}>{p.icon} {p.name}</Badge>
              {i < PHASES.length - 1 && (
                <>
                  <span style={{ color: T.dim, fontSize: 11 }}>→</span>
                  <Badge color={T.micro}>nextTick + Promises</Badge>
                  <span style={{ color: T.dim, fontSize: 11 }}>→</span>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Iteration lifecycle */}
      <Heading accent={T.api}>Одна ітерація Event Loop — покроково</Heading>
      <Card>
        {[
          { n: '1', t: 'nextTick черга — виконати всі process.nextTick() колбеки', c: T.nextTick },
          { n: '2', t: 'Microtask черга — виконати всі Promise.then() колбеки', c: T.micro },
          { n: '3', t: 'Timers фаза — виконати setTimeout/setInterval колбеки', c: '#F97316' },
          { n: '4', t: 'nextTick + Microtask черги (знову після кожної фази!)', c: T.micro },
          { n: '5', t: 'Pending I/O фаза — відкладені I/O помилки', c: '#EF4444' },
          { n: '6', t: 'Idle/Prepare — внутрішнє Node.js', c: '#8B5CF6' },
          { n: '7', t: 'Poll фаза — нові I/O події, СЕРЦЕ Event Loop', c: '#22C55E' },
          { n: '8', t: 'Check фаза — setImmediate() колбеки', c: '#3B82F6' },
          { n: '9', t: 'Close Callbacks — закриваючі події', c: '#EC4899' },
          { n: '↺', t: 'Нова ітерація (або вихід якщо нема роботи)', c: T.api },
        ].map(({ n, t, c }, i, arr) => (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: c + '20', border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: c }}>{n}</div>
              {i < arr.length - 1 && <div style={{ width: 2, height: 14, background: T.border }} />}
            </div>
            <div style={{ paddingBottom: i < arr.length - 1 ? 8 : 0, paddingTop: 4 }}>
              <div style={{ color: T.text, fontSize: 12.5, lineHeight: 1.6 }}>{t}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Tab: Черги ─────────────────────────────────────────────────────────────
function QueuesTab() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Heading accent={T.micro} level={1}>📋 Мікрозавдання vs Макрозавдання</Heading>
      <Para>
        Не всі async операції однакові. Є два типи черг із різним пріоритетом. Саме це визначає порядок виконання — і саме це питають на технічних інтерв'ю.
      </Para>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        {/* Microtasks */}
        <Card accent={T.micro}>
          <div style={{ color: T.micro, fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🔥 Мікрозавдання</div>
          <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 14, lineHeight: 1.65 }}>
            Виконуються <strong style={{ color: T.text }}>між фазами</strong>. ЗАВЖДИ до будь-якого макрозавдання. Черга повністю спустошується перед переходом.
          </div>
          {[
            { l: 'process.nextTick(fn)', c: T.nextTick, p: '1st', d: 'Спеціальна черга Node.js. Навіть перед Promise!' },
            { l: 'Promise.resolve().then(fn)', c: T.micro, p: '2nd', d: 'Стандартна microtask черга' },
            { l: 'queueMicrotask(fn)', c: T.micro, p: '2nd', d: 'Те саме, що Promise.then' },
          ].map(({ l, c, p, d }) => (
            <div key={l} style={{ background: '#040810', border: `1px solid ${c}25`, borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <code style={{ color: c, fontSize: 11.5 }}>{l}</code>
                <Badge color={c}>{p}</Badge>
              </div>
              <div style={{ color: T.muted, fontSize: 11 }}>{d}</div>
            </div>
          ))}
        </Card>

        {/* Macrotasks */}
        <Card accent={T.macro}>
          <div style={{ color: T.macro, fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🔵 Макрозавдання</div>
          <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 14, lineHeight: 1.65 }}>
            Виконуються <strong style={{ color: T.text }}>у певних фазах</strong> Event Loop. По ОДНОМУ за ітерацію (тоді мікрозавдання).
          </div>
          {[
            { l: 'setImmediate(fn)', c: '#3B82F6', p: 'check', d: 'Після poll у цій ітерації' },
            { l: 'setTimeout(fn, 0)', c: '#F97316', p: 'timers', d: 'У наступній ітерації, мінімум ~1мс' },
            { l: 'setInterval(fn, ms)', c: '#F97316', p: 'timers', d: 'Повторювані таймери' },
            { l: 'I/O колбеки', c: '#22C55E', p: 'poll', d: 'fs.readFile, http.get, net...' },
          ].map(({ l, c, p, d }) => (
            <div key={l} style={{ background: '#040810', border: `1px solid ${c}25`, borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <code style={{ color: c, fontSize: 11.5 }}>{l}</code>
                <Badge color={c}>{p}</Badge>
              </div>
              <div style={{ color: T.muted, fontSize: 11 }}>{d}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Priority order */}
      <Heading accent={T.api}>Порядок виконання (від вищого до нижчого пріоритету)</Heading>
      <Card style={{ marginBottom: 22 }}>
        {[
          { p: '1', l: 'Синхронний код', e: 'console.log(), for-loop, обчислення...', c: T.v8, tag: 'Call Stack' },
          { p: '2', l: 'process.nextTick()', e: 'nextTick черга — Node.js специфічно', c: T.nextTick, tag: 'Microtask #1' },
          { p: '3', l: 'Promise.then / queueMicrotask', e: 'Стандартна microtask черга', c: T.micro, tag: 'Microtask #2' },
          { p: '4', l: 'setImmediate()', e: 'Check фаза Event Loop', c: T.macro, tag: 'Macrotask' },
          { p: '5', l: 'setTimeout(fn, 0) / setInterval', e: 'Timers фаза Event Loop', c: '#F97316', tag: 'Macrotask' },
          { p: '6', l: 'I/O колбеки (fs, net, http...)', e: 'Poll фаза Event Loop', c: '#22C55E', tag: 'Macrotask' },
        ].map(({ p, l, e, c, tag }) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: '#040810', borderRadius: 8, marginBottom: 6 }}>
            <div style={{ width: 24, height: 24, background: c + '20', border: `1.5px solid ${c}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c, flexShrink: 0 }}>{p}</div>
            <div style={{ flex: 1 }}>
              <code style={{ color: c, fontSize: 12.5 }}>{l}</code>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 1 }}>{e}</div>
            </div>
            <Badge color={c}>{tag}</Badge>
          </div>
        ))}
      </Card>

      {/* Visual example */}
      <Heading accent={T.micro}>Наочний приклад: nextTick vs Promise vs setTimeout</Heading>
      <Card>
        <Code accent={T.micro}>{`// Що виведе цей код? Подумай перед тим як читати далі...

console.log('A');                              // 1. Sync
setTimeout(() => console.log('B'), 0);         // 5. Macrotask (timers)
Promise.resolve().then(() => console.log('C')); // 3. Microtask (Promise)
process.nextTick(() => console.log('D'));       // 2. Microtask (nextTick)
setImmediate(() => console.log('E'));           // 4. Macrotask (check)
console.log('F');                              // 1. Sync

// Вивід: A → F → D → C → E → B`}</Code>
      </Card>
    </div>
  );
}

// ─── Tab: Практика ───────────────────────────────────────────────────────────
function PracticeTab() {
  const steps = [
    { code: "console.log('1');", out: '1', q: 'Синхронний код. Виконується ОДРАЗУ. Call Stack: [main()]', c: T.v8 },
    { code: "setTimeout(() => console.log('2'), 0);", out: null, q: 'Реєструємо таймер. Колбек іде в чергу timers фази — виконається в НАСТУПНІЙ ітерації.', c: '#F97316' },
    { code: "Promise.resolve().then(() => console.log('3'));", out: null, q: 'Реєструємо Promise. Колбек іде в Microtask чергу — до таймера, але після nextTick.', c: T.micro },
    { code: "process.nextTick(() => console.log('4'));", out: null, q: 'Реєструємо nextTick. Це пріоритетніша мікрозадача — виконається перш за Promise!', c: T.nextTick },
    { code: "console.log('5');", out: '5', q: 'Синхронний код. Виконується ОДРАЗУ. Call Stack порожній.', c: T.v8 },
    { code: "// → nextTick черга виконується", out: '4', q: 'Call Stack порожній → виконуються всі nextTick колбеки. process.nextTick друкує "4".', c: T.nextTick },
    { code: "// → Microtask черга виконується", out: '3', q: 'nextTick черга спустошена → виконуються Promise.then. Друкує "3".', c: T.micro },
    { code: "// → Event Loop: timers фаза", out: '2', q: 'Мікрозавдання закінчились → Event Loop переходить до timers фази. setTimeout друкує "2".', c: '#F97316' },
  ];
  const [step, setStep] = useState(-1);
  const [revealed, setRevealed] = useState(false);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Heading accent={T.v8} level={1}>🧪 Класичне завдання з інтерв'ю</Heading>
      <Para>
        Це запитання задають на кожному технічному інтерв'ю для Node.js розробників. Спробуй передбачити порядок виводу! Це перевіряє розуміння всього, що ми вивчили.
      </Para>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Код:</div>
          <Code accent={T.v8}>{`console.log('1');

setTimeout(() => {
  console.log('2');
}, 0);

Promise.resolve().then(() => {
  console.log('3');
});

process.nextTick(() => {
  console.log('4');
});

console.log('5');`}</Code>
        </div>
        <div>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Порядок виводу:</div>
          {!revealed
            ? (
              <div style={{ background: T.card, border: `2px dashed ${T.border}`, borderRadius: 12, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 200, justifyContent: 'center' }}>
                <div style={{ fontSize: 36 }}>🤔</div>
                <div style={{ color: T.muted, textAlign: 'center', fontSize: 13 }}>Яким буде порядок виводу?</div>
                <button onClick={() => setRevealed(true)} style={{ padding: '9px 22px', background: T.api, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Показати відповідь
                </button>
              </div>
            ) : (
              <Card>
                <div style={{ color: T.muted, fontSize: 12, marginBottom: 10 }}>Вивід консолі (порядок):</div>
                {[
                  { v: '1', label: 'Sync', color: T.v8 },
                  { v: '5', label: 'Sync', color: T.v8 },
                  { v: '4', label: 'process.nextTick', color: T.nextTick },
                  { v: '3', label: 'Promise.then', color: T.micro },
                  { v: '2', label: 'setTimeout', color: '#F97316' },
                ].map(({ v, label, color }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, background: color + '20', border: `1.5px solid ${color}60`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontFamily: 'monospace', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{v}</div>
                    <Badge color={color}>{label}</Badge>
                  </div>
                ))}
                <div style={{ marginTop: 12, background: '#040810', borderRadius: 8, padding: '8px 12px', color: '#4ade80', fontFamily: 'monospace', fontSize: 12 }}>
                  Відповідь: 1 → 5 → 4 → 3 → 2
                </div>
              </Card>
            )
          }
        </div>
      </div>

      {/* Step by step */}
      <Card accent={T.api}>
        <div style={{ color: T.api, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔬 Покроковий розбір</div>
        <Para>Натискай "Наступний крок" щоб пройти виконання рядок за рядком:</Para>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setStep(s => Math.min(s + 1, steps.length - 1))}
            disabled={step >= steps.length - 1}
            style={{ padding: '8px 18px', background: T.api, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: step >= steps.length - 1 ? 'not-allowed' : 'pointer', opacity: step >= steps.length - 1 ? 0.45 : 1 }}>
            ▶ Наступний крок {step >= 0 ? `(${step + 2 <= steps.length ? `${step + 2}/${steps.length}` : 'кінець'})` : ''}
          </button>
          <button onClick={() => setStep(-1)} style={{ padding: '8px 12px', background: T.card, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>↺ Скинути</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {step < 0
            ? <div style={{ color: T.dim, textAlign: 'center', padding: '20px', fontSize: 13 }}>Натисни кнопку вище щоб почати покроковий розбір...</div>
            : steps.slice(0, step + 1).map((s, i) => (
              <div key={i} style={{
                background: i === step ? s.c + '15' : '#040810',
                border: `1px solid ${i === step ? s.c + '60' : T.border}`,
                borderLeft: `3px solid ${s.c}`,
                borderRadius: 8, padding: '10px 14px',
                transition: 'all 0.2s',
              }}>
                <code style={{ color: s.c, fontSize: 12 }}>{s.code}</code>
                {s.out && (
                  <div style={{ display: 'inline-block', marginLeft: 12, background: s.c + '20', border: `1px solid ${s.c}40`, borderRadius: 5, padding: '1px 8px', color: s.c, fontFamily: 'monospace', fontSize: 12 }}>
                    → "{s.out}"
                  </div>
                )}
                <div style={{ color: T.muted, fontSize: 11.5, marginTop: 4 }}>{s.q}</div>
              </div>
            ))
          }
        </div>
      </Card>

      {/* Bonus */}
      <div style={{ marginTop: 22 }}>
        <Heading accent={T.macro}>🎁 Бонус: setImmediate vs setTimeout — де має значення</Heading>
        <Card accent={T.macro}>
          <Para>Всередині I/O колбека setImmediate ЗАВЖДИ виконується перед setTimeout(fn, 0). Зовні I/O — порядок залежить від навантаження CPU і не визначений.</Para>
          <Code accent={T.macro}>{`const fs = require('fs');

// ✅ ВСЕРЕДИНІ I/O — порядок ЗАВЖДИ визначений:
fs.readFile('./file', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // Вивід: immediate → timeout (ЗАВЖДИ!)
  // Бо check фаза ПОТОЧНОЇ ітерації раніше за timers НАСТУПНОЇ
});

// ⚠️ ЗОВНІ I/O — порядок НЕ визначений:
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Може бути будь-який порядок залежно від CPU!`}</Code>
        </Card>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState(0);

  const tabs = [
    { emoji: '🏗', title: 'Архітектура', Component: ArchTab },
    { emoji: '⚡', title: 'V8 Engine', Component: V8Tab },
    { emoji: '🔧', title: 'libuv', Component: LibuvTab },
    { emoji: '🔄', title: 'Event Loop', Component: LoopTab },
    { emoji: '📋', title: 'Черги', Component: QueuesTab },
    { emoji: '🧪', title: 'Практика', Component: PracticeTab },
  ];

  const { Component } = tabs[tab];

  return (
    <div style={{
      background: T.pageBg,
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
      color: T.text,
    }}>
      {/* Header */}
      <div style={{
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        padding: '18px 28px 0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44,
              background: `linear-gradient(135deg, ${T.v8} 0%, ${T.libuv} 100%)`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>Node.js під капотом</div>
              <div style={{ color: T.muted, fontSize: 12.5, marginTop: 2 }}>V8 Engine · libuv · Event Loop · Черги · Практика</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {tabs.map(({ emoji, title }, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2.5px solid ${tab === i ? T.api : 'transparent'}`,
                color: tab === i ? T.text : T.muted,
                fontSize: 13,
                fontWeight: tab === i ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'color 0.15s',
              }}>
                <span>{emoji}</span><span>{title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Component />
    </div>
  );
}