// Contract test for the deployed Chart Color System MCP server. Runs against
// MCP_BASE (default: production) so it is the post-deploy verdict:
//   MCP_BASE=https://chart-color-mcp-xxxx.vercel.app npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.MCP_BASE || 'https://chart-color-mcp.vercel.app').replace(/\/$/, '');
const HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' };

async function rpc(method, params = {}, id = 1) {
  const res = await fetch(`${BASE}/mcp`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  assert.equal(res.status, 200, `${method} status`);
  const body = await res.text();
  const json = body.trim().startsWith('{') ? JSON.parse(body) : JSON.parse(body.split('\n').find((l) => l.startsWith('data:')).slice(5));
  assert.equal(json.error, undefined, `${method} error`);
  return json.result;
}
const call = async (name, args) => rpc('tools/call', { name, arguments: args });
const parse = (r) => JSON.parse(r.content[0].text);

test('initialize identifies the chart color system', async () => {
  const r = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(r.serverInfo.name, 'chart-color-system');
  assert.match(r.instructions, /colorblind/i);
});

test('GET is refused politely with a pointer to the docs', async () => {
  const res = await fetch(`${BASE}/mcp`, { headers: { accept: 'text/event-stream' } });
  assert.equal(res.status, 405);
  assert.match((await res.json()).error.message, /mcp-docs/);
});

test('tools/list: four read-only tools, annotated', async () => {
  const r = await rpc('tools/list');
  assert.deepEqual(r.tools.map((t) => t.name).sort(), ['audit_palette', 'build_ramp', 'simulate_palette', 'solve_palette']);
  for (const t of r.tools) {
    assert.equal(t.annotations?.readOnlyHint, true, t.name);
    assert.ok(t.description.length > 40, t.name);
  }
});

test('solve_palette keeps the anchor in slot 1 and returns an audited, linkable palette', async () => {
  const d = parse(await call('solve_palette', { n: 6, anchors: ['#0057b8'] }));
  assert.equal(d.palette.length, 6);
  assert.equal(d.palette[0].hex, '#0057b8');
  assert.equal(d.palette[0].locked, true);
  assert.ok(d.min_pair_delta_e > 0);
  assert.ok(['pass', 'warn', 'fail'].includes(d.audit.overall));
  assert.match(d.app_url, /socraticstatic\.github\.io\/Visualizations/);
});

test('solve_palette above the honest cap says so instead of pretending', async () => {
  const d = parse(await call('solve_palette', { n: 9 }));
  assert.equal(d.palette.length, 9);
  assert.match(d.note, /6/);
});

test('audit_palette fails grays one unit apart (engine floor is OKLab ΔE 1.0)', async () => {
  const d = parse(await call('audit_palette', { colors: ['#777777', '#787878', '#797979'], background: '#ffffff' }));
  assert.equal(d.overall, 'fail');
  assert.ok(d.per_vision.some((v) => v.pass === false));
});

test('simulate_palette returns one row per vision mode', async () => {
  const d = parse(await call('simulate_palette', { colors: ['#0057b8', '#d62828'] }));
  assert.deepEqual(Object.keys(d.simulated).sort(), ['achromatopsia', 'deutan', 'normal', 'protan', 'tritan']);
  assert.equal(d.simulated.deutan.length, 2);
});

test('build_ramp: sequential and diverging', async () => {
  const s = parse(await call('build_ramp', { kind: 'sequential', start: '#e0f2fe', end: '#0c4a6e', steps: 5 }));
  assert.equal(s.ramp.length, 5);
  assert.equal(s.ramp[0].hex, '#e0f2fe');
  const dv = parse(await call('build_ramp', { kind: 'diverging', start: '#b91c1c', mid: '#f5f5f4', end: '#1d4ed8', steps: 7 }));
  assert.equal(dv.ramp.length, 7);
});

test('a bad color is a tool error, not a crash', async () => {
  const r = await call('audit_palette', { colors: ['not-a-color'], background: '#ffffff' });
  assert.equal(r.isError, true);
});
