const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://todo:todo@localhost:5432/todoapp';

const { app, pool, initDb } = require('../server');

let server;
let base;

test.before(async () => {
  await initDb();
  await pool.query('DELETE FROM todos');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

test('GET /health returns ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.uptime >= 0);
});

test('GET /ready returns ready when db is up', async () => {
  const res = await fetch(`${base}/ready`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ready');
});

test('POST /todos creates a todo', async () => {
  const res = await fetch(`${base}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'from ci' }),
  });
  assert.equal(res.status, 201);
  const todo = await res.json();
  assert.equal(todo.title, 'from ci');
  assert.equal(todo.done, false);
});

test('POST /todos without title returns 400', async () => {
  const res = await fetch(`${base}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('GET /todos returns the created todo', async () => {
  const res = await fetch(`${base}/todos`);
  const todos = await res.json();
  assert.equal(todos.length, 1);
  assert.equal(todos[0].title, 'from ci');
});

test('unknown route returns 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});
