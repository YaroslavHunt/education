# 🧩 education

> Інтерактивна платформа для вивчення **внутрішніх механізмів Node.js та NestJS** — наживо, крок за кроком.

[![Deploy](https://github.com/YaroslavHunt/education/actions/workflows/deploy.yml/badge.svg)](https://github.com/YaroslavHunt/education/actions/workflows/deploy.yml)
[![Демо](https://img.shields.io/badge/демо-yaroslavhunt.github.io%2Feducation-34D399?logo=github&logoColor=white)](https://yaroslavhunt.github.io/education/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)

Кожен модуль — окремий Vite + React застосунок, який візуалізує те, що зазвичай
ховається під капотом: фази Event Loop, чергу мікротасків, шлях HTTP-запиту крізь
pipeline Nest. Не теорія заради теорії — клікаєш і бачиш, як воно справді працює.

---

## 🚀 Живі демо

🏠 **Хаб (усі модулі):** https://yaroslavhunt.github.io/education/

| Модуль | Що показує | Відкрити |
| --- | --- | --- |
| **Event Loop під капотом** | V8, libuv і шість фаз Event Loop; чому `setTimeout(fn, 0)` — це не «одразу»; коли реально спрацьовують мікротаски та `process.nextTick` | [▶ запустити](https://yaroslavhunt.github.io/education/nodejs/event-loop/) |
| **Request Lifecycle** | Шлях запиту: Middleware → Guards → Interceptors → Pipes → Handler і назад; симуляція успіху й помилок; де ловить Exception Filter | [▶ запустити](https://yaroslavhunt.github.io/education/nest/lifecycle/) |

---

## 🧱 Структура

```
education/
├── home/                      # 🏠 головна сторінка-хаб
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx           # точка входу
│       ├── App.jsx            # компонент хаба
│       └── lessons.js         # ← реєстр модулів (єдине місце для редагування)
│
├── nodejs/
│   └── event-loop/            # ⚡ Event Loop, V8, libuv
│       ├── index.html
│       ├── vite.config.js
│       ├── package.json
│       └── src/{main,App}.jsx
│
├── nest/
│   └── lifecycle/             # 🔴 Request Lifecycle (Middleware → Filters)
│       ├── index.html
│       ├── vite.config.js
│       ├── package.json
│       └── src/{main,App}.jsx
│
├── config/
│   └── vite.lesson.js         # спільний Vite-конфіг (base рахується автоматично)
│
├── .github/workflows/
│   └── deploy.yml             # авто-деплой на GitHub Pages
│
├── package.json               # npm workspaces (один install на всіх)
└── .gitignore
```

Кожен модуль має **однакову структуру**: `index.html` + `vite.config.js` +
`package.json` + `src/{main,App}.jsx`. Точка входу скрізь та сама — `main.jsx`
імпортує `./App.jsx`. Жодних відмінностей у скелеті між «нодою» і «нестом».

---

## ⚙️ Як це влаштовано

Три речі роблять платформу зручною та розширюваною:

- **`base` рахується сам.** Спільний `config/vite.lesson.js` визначає публічний
  шлях із розташування теки: `home/` → `/education/`,
  `nodejs/event-loop/` → `/education/nodejs/event-loop/`. Додаючи модуль, ти
  **ніколи не правиш `base` руками**. Локально база — `/`, тож усе відкривається
  на `http://localhost:5173/`.
- **Деплой сам знаходить модулі.** Workflow шукає всі `vite.config.js`, збирає
  кожен і розкладає `dist` у відповідну підтеку сайту. Новий модуль не потребує
  правок YAML.
- **Один install на всіх.** Завдяки npm workspaces `npm install` у корені ставить
  залежності для всіх модулів одразу.

---

## 💻 Запуск локально

Потрібен **Node 20+**. Встановлення — один раз із кореня:

```bash
npm install
```

Запуск окремого модуля (кожен відкриється на http://localhost:5173/):

```bash
npm run dev:home        # головна сторінка-хаб
npm run dev:event-loop  # Node.js / Event Loop
npm run dev:lifecycle   # NestJS / Request Lifecycle
```

Зібрати все одразу:

```bash
npm run build
```

---

## ➕ Як додати новий модуль

1. **Скопіюй** теку наявного модуля як шаблон:
```bash
   cp -r nodejs/event-loop nodejs/streams
```
2. **Онови** `name` у `nodejs/streams/package.json` і напиши свій `src/App.jsx`.
   `vite.config.js`, `main.jsx`, `index.html` чіпати не треба — `base`
   (`/education/nodejs/streams/`) визначиться сам.
3. **Зареєструй** модуль у `home/src/lessons.js` — додай об'єкт у потрібну категорію:
```js
   {
     path: 'nodejs/streams',
     title: 'Streams і backpressure',
     blurb: 'Короткий опис модуля.',
     tags: ['Streams', 'Buffer', 'Backpressure'],
     status: 'ready',
   }
```
4. **Запуш** на `main` — GitHub Actions сам знайде теку, збере її й задеплоїть.

> Нова **категорія** (напр. `react/`) додається так само: створи теку
> `react/<lesson>/`, додай категорію в `lessons.js`, а в кореневому
> `package.json` допиши `"react/*"` до `workspaces`.

---

## 📦 Деплой

`push` у гілку `main` → GitHub Actions збирає всі модулі та публікує на GitHub Pages.
Розкладка на сайті повторює структуру репозиторію:

| Тека | URL |
| --- | --- |
| `home/` | `/education/` |
| `nodejs/event-loop/` | `/education/nodejs/event-loop/` |
| `nest/lifecycle/` | `/education/nest/lifecycle/` |

`base` у Vite, тека деплою та URL завжди збігаються, тож асети не б'ються.

> Один раз увімкни Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

---

## 🛠 Технології

**Vite 6** · **React 18** · **npm workspaces** · **GitHub Actions** · **GitHub Pages**
