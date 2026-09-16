// Discovery document for this MCP server, served at two paths:
//   /.well-known/mcp/server-card.json  (SEP-1649)
//   /.well-known/mcp                   (SEP-1960)
//
// Both SEPs are still open proposals rather than merged spec, so this is a
// cheap bet, not a standard we can lean on: the registry entry in server.json
// is what actually drives discovery today. Serving it from a function rather
// than a static file because Vercel's static handling is unreliable for
// dotted directories, and the card has to stay in step with the server it
// describes - VERSION and the tool list are read from the same module the
// /mcp handler exports.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CARD = JSON.parse(
  readFileSync(new URL('../server.json', import.meta.url), 'utf8'),
);

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Static document; a day of cache is fine and keeps the function cold-path
  // off the discovery path for repeat crawlers.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return res.status(200).send(JSON.stringify(CARD, null, 2));
}
