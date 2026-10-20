const express = require('express');

const PORT = Number(process.env.PORT) || 3000;
const APP_ENV = process.env.APP_ENV || 'development';

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

const app = express();
app.use(express.json());

const todos = [];
let nextId = 1;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: APP_ENV, uptime: process.uptime() });
});

app.get('/todos', (req, res) => {
  res.json(todos);
});

app.post('/todos', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const todo = { id: nextId++, title, done: false };
  todos.push(todo);
  log('info', 'todo created', { id: todo.id });
  res.status(201).json(todo);
});

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

const server = app.listen(PORT, () => {
  log('info', 'server started', { port: PORT, env: APP_ENV });
});

const shutdown = (signal) => {
  log('info', 'shutting down', { signal });
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));