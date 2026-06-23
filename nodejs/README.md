# Node.js під капотом ⚡

Інтерактивна візуалізація архітектури Node.js: V8 Engine, libuv, Event Loop, черги задач.

## 🚀 Запуск локально

```bash
npm install
npm run dev
```

Відкрий http://localhost:5173/nodejs/

## 📦 Структура

```
nodejs/
├── src/
│   ├── App.jsx        # Основний компонент
│   └── main.jsx       # Entry point
├── .github/
│   └── workflows/
│       └── deploy.yml # Auto-deploy на GitHub Pages
├── index.html
├── vite.config.js
└── package.json
```

## 🌐 Деплой на GitHub Pages

1. Пуш на `main` гілку
2. GitHub Actions автоматично білдить і деплоїть
3. Живий сайт: `https://<твій-username>.github.io/nodejs/`