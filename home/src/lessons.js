// ─────────────────────────────────────────────────────────────────────────────
//  LESSON REGISTRY
//  This is the single place you edit to add a module to the platform.
//
//  To add a lesson:
//    1. Create a folder, e.g.  nodejs/streams/  (copy an existing lesson's files)
//    2. Add an entry below under the matching category
//    3. Push — the deploy workflow picks it up automatically (no YAML edits)
//
//  `path` must match the folder path from the repo root. The link is built as
//  import.meta.env.BASE_URL + path, so it works on GitHub Pages and locally.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE = {
  eyebrow: 'Інтерактивні візуалізації',
  title: 'Внутрянка Node.js і NestJS — наживо',
  intro:
    'Платформа, де кожен модуль розбирає внутрішні механізми покроково: ' +
    'від фаз Event Loop до шляху HTTP-запиту крізь pipeline Nest. ' +
    'Не теорія заради теорії — клікаєш і бачиш, як воно справді працює.',
  repoUrl: 'https://github.com/YaroslavHunt/education',
}

export const CATEGORIES = [
  {
    id: 'nodejs',
    label: 'Node.js',
    color: '#34D399',
    note: 'Як рантайм виконує твій код',
    lessons: [
      {
        path: 'nodejs/event-loop',
        title: 'Event Loop під капотом',
        blurb:
          'V8, libuv і шість фаз Event Loop. Чому setTimeout(fn, 0) — це не «одразу», ' +
          'і коли насправді спрацьовують мікротаски.',
        tags: ['V8', 'libuv', 'Event Loop', 'Microtasks', 'process.nextTick'],
        status: 'ready',
      },
    ],
  },
  {
    id: 'nest',
    label: 'NestJS',
    color: '#E0234E',
    note: 'Шлях запиту крізь фреймворк',
    lessons: [
      {
        path: 'nest/lifecycle',
        title: 'Request Lifecycle',
        blurb:
          'Запит проходить Middleware → Guards → Interceptors → Pipes → Handler і назад. ' +
          'Симулюй успіх і помилки, дивись де ловить Exception Filter.',
        tags: ['Middleware', 'Guards', 'Interceptors', 'Pipes', 'Filters'],
        status: 'ready',
      },
    ],
  },
]