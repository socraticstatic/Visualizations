import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/well-known.js';
import card from '../server.json' with { type: 'json' };

/** Minimal stand-in for the Vercel response object. */
function mockRes() {
  const res = {
    headers: {},
    statusCode: 0,
    body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
    json(b) { this.body = JSON.stringify(b); return this; },
  };
  return res;
}

test('serves the server card as JSON', () => {
  const res = mockRes();
  handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.deepEqual(JSON.parse(res.body), card);
});

test('refuses non-GET', () => {
  const res = mockRes();
  handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
});

test('the card fits the registry\'s limits', () => {
  // registry.modelcontextprotocol.io rejects a publish with 422 when these
  // overflow. Found the hard way: the first publish failed on a 212-character
  // description after the workflow had already tagged and authenticated.
  assert.ok(card.description.length <= 100, `description is ${card.description.length} chars, max 100`);
  assert.ok(card.name.length <= 200, 'name too long');
  assert.ok(card.title.length <= 100, 'title too long');
});

test('the card points at the live endpoint this project deploys', () => {
  const remote = card.remotes?.find((r) => r.type === 'streamable-http');
  assert.ok(remote, 'server.json must declare a streamable-http remote');
  assert.equal(remote.url, 'https://chart-color-mcp.vercel.app/mcp');
  // Registry namespaces are owner-scoped; a mismatch here is rejected at publish.
  assert.match(card.name, /^io\.github\.socraticstatic\//);
});
