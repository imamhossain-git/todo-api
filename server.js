const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const APP_ENV = process.env.APP_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;

// config না থাকলে চালুই হবে না — ব্যর্থ হওয়ার চেয়ে স্পষ্ট ভুল ভালো
if (!DATABASE_URL) {
  console.error(JSON.stringify({
    ts: new Date().toISOString(), level: 'error', msg: 'DATABASE_URL is required',
  }));
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

const app = express();
app.use(express.json());

// স্কিমা তৈরি — এটাই আমাদের প্রথম "migration"
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  log('info', 'database ready');
};

// liveness: process বেঁচে আছে কি না — DB চেক করে না
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: APP_ENV, uptime: process.uptime() });
});

// readiness: ট্রাফিক নিতে পারবে কি না — DB চেক করে
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

app.get('/todos', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, title, done, created_at FROM todos ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
});

app.post('/todos', async (req, res, next) => {
  const title = (req.body.title || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO todos (title) VALUES ($1) RETURNING id, title, done, created_at',
    [title]
  );
  log('info', 'todo created', { id: rows[0].id });
  res.status(201).json(rows[0]);
});

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err, req, res, next) => {
  log('error', 'unhandled error', { error: err.message });
  res.status(500).json({ error: 'internal error' });
});

// শুধু সরাসরি চালালে (node server.js) এই অংশ চলবে — require() করলে নয়
const start = async () => {
  await initDb();
  const server = app.listen(PORT, () => {
    log('info', 'server started', { port: PORT, env: APP_ENV });
  });

  const shutdown = async (signal) => {
    log('info', 'shutting down', { signal });
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
  start().catch((err) => {
    log('error', 'startup failed', { error: err.message });
    process.exit(1);
  });
}

// test ও অন্য module-এর জন্য export
module.exports = { app, pool, initDb, log };