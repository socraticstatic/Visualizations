// Transparency in the audit_palette tool. A translucent color used to be
// measured as if solid: "transparent" on white came back as black at 21:1
// and passed. Runs without a deployment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditTool } from '../api/mcp.js';

test('a fully transparent color fails contrast instead of passing as black', () => {
  const out = auditTool({ colors: ['transparent'], background: '#ffffff' });
  assert.equal(out.per_color[0].hex, '#ffffff');
  assert.equal(out.per_color[0].contrast_vs_background, 1);
  assert.equal(out.per_color[0].alpha, 0);
  assert.equal(out.per_color[0].composited_over_background, true);
  assert.equal(out.bg_pass, false);
  assert.equal(out.overall, 'fail');
});

test('10% black on white is reported as the pale gray it renders as', () => {
  const out = auditTool({ colors: ['rgba(0, 0, 0, 0.1)'], background: '#ffffff' });
  assert.equal(out.per_color[0].hex, '#e6e6e6');
  assert.ok(out.per_color[0].contrast_vs_background < 1.5);
  assert.equal(out.bg_pass, false);
});

test('half black on white composites to #808080', () => {
  const out = auditTool({ colors: ['rgba(0, 0, 0, 0.5)'], background: '#ffffff' });
  assert.equal(out.per_color[0].hex, '#808080');
  assert.equal(out.per_color[0].alpha, 0.5);
});

test('an opaque palette is unchanged and carries no alpha', () => {
  const out = auditTool({ colors: ['#2456a4', '#b03a2e'], background: '#ffffff' });
  assert.deepEqual(out.per_color.map((c) => c.hex), ['#2456a4', '#b03a2e']);
  assert.ok(out.per_color.every((c) => !('alpha' in c)));
  assert.equal(out.bg_pass, true);
});

test('a translucent background is refused with the reason', () => {
  assert.throws(() => auditTool({ colors: ['#000000'], background: 'rgba(255, 255, 255, 0.5)' }), /background .* is translucent/);
});

test('an unrecognized color is still named', () => {
  assert.throws(() => auditTool({ colors: ['notacolor'], background: '#ffffff' }), /Unrecognized color "notacolor"/);
});
