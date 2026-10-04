// Unit tests for the /mcp handler's metadata, run without a deployment. The
// contract tests in mcp.test.mjs are the post-deploy verdict; these catch the
// two drifts that reached production once: a server that reported a version
// the registry card did not, and a CORS fallback that was a URL with a path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { VERSION } from '../api/mcp.js';
import card from '../server.json' with { type: 'json' };

function mockRes() {
  return {
    headers: {}, statusCode: 0, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    end() { this.ended = true; return this; },
    json(b) { this.body = b; return this; },
    on() {},
  };
}

test('the live server reports the version the registry card declares', () => {
  assert.equal(VERSION, card.version);
});

test('CORS fallback is an origin, never a URL with a path', async () => {
  const res = mockRes();
  await handler({ method: 'OPTIONS', headers: {} }, res);
  assert.equal(res.statusCode, 204);
  const o = res.headers['access-control-allow-origin'];
  assert.equal(o, new URL(o).origin, `"${o}" is not a bare origin`);
});

test('the card names the monorepo subfolder and a same-site https icon', () => {
  assert.equal(card.repository.subfolder, 'mcp');
  assert.ok(Array.isArray(card.icons) && card.icons.length > 0, 'icons[] missing');
  const site = new URL(card.websiteUrl).origin;
  for (const icon of card.icons) {
    assert.match(icon.src, /^https:\/\//);
    assert.equal(new URL(icon.src).origin, site, 'icon must be served from the websiteUrl host');
    assert.ok(/^image\/(png|svg\+xml|jpeg|webp)$/.test(icon.mimeType), `mimeType ${icon.mimeType}`);
  }
});
