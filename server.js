#!/usr/bin/env node
/**
 * photo-graph — explore a photo directory as an expandable force graph.
 *
 * Usage:  node server.js [rootDir] [port]
 *         node server.js ~/Pictures 8420
 *
 * Zero dependencies. Each folder may contain a `thisnode.png`
 * which is used as that folder's round node icon in the graph.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = parseInt(process.argv[3] || '8420', 10);
const PUBLIC = path.join(__dirname, 'public');

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.svg', '.jfif']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

const NODE_ICON = 'thisnode.png';

/** Resolve a client-supplied relative path safely inside ROOT. */
function safeResolve(rel) {
  const abs = path.resolve(ROOT, '.' + path.sep + (rel || ''));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

function isHidden(name) {
  return name.startsWith('.');
}

/** Shallow scan of one directory: subfolders + photos + icon presence. */
async function scanDir(rel) {
  const abs = safeResolve(rel);
  if (!abs) throw Object.assign(new Error('path escapes root'), { code: 'EDENY' });

  const entries = await fsp.readdir(abs, { withFileTypes: true });
  const folders = [];
  const photos = [];
  let hasIcon = false;

  for (const e of entries) {
    if (isHidden(e.name)) continue;
    const childRel = rel ? rel + '/' + e.name : e.name;

    if (e.isDirectory()) {
      // peek inside for counts + icon, so collapsed nodes can be sized
      let fc = 0, pc = 0, icon = false;
      try {
        const sub = await fsp.readdir(path.join(abs, e.name), { withFileTypes: true });
        for (const s of sub) {
          if (isHidden(s.name)) continue;
          if (s.isDirectory()) fc++;
          else if (IMG_EXT.has(path.extname(s.name).toLowerCase())) {
            if (s.name.toLowerCase() === NODE_ICON) icon = true;
            else pc++;
          }
        }
      } catch { /* unreadable dir: show it anyway */ }
      folders.push({ name: e.name, path: childRel, hasIcon: icon, folderCount: fc, photoCount: pc });
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!IMG_EXT.has(ext)) continue;
      if (e.name.toLowerCase() === NODE_ICON) { hasIcon = true; continue; }
      photos.push({ name: e.name, path: childRel });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { path: rel, name: rel ? path.basename(rel) : path.basename(ROOT), hasIcon, folders, photos };
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function sendJSON(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

async function serveFile(res, abs, cache) {
  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stat = await fsp.stat(abs);
  if (!stat.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    ...(cache ? { 'Cache-Control': 'max-age=3600' } : {}),
  });
  fs.createReadStream(abs).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return await serveFile(res, path.join(PUBLIC, 'index.html'));
    }
    if (url.pathname === '/d3.min.js') {
      return await serveFile(res, path.join(PUBLIC, 'd3.min.js'), true);
    }
    if (url.pathname === '/api/tree') {
      const rel = (url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
      return sendJSON(res, 200, await scanDir(rel));
    }
    if (url.pathname === '/img') {
      const rel = (url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
      const abs = safeResolve(rel);
      if (!abs) return sendJSON(res, 403, { error: 'forbidden' });
      if (!IMG_EXT.has(path.extname(abs).toLowerCase())) return sendJSON(res, 415, { error: 'not an image' });
      return await serveFile(res, abs, true);
    }
    return sendJSON(res, 404, { error: 'not found' });
  } catch (err) {
    if (err.code === 'ENOENT') return sendJSON(res, 404, { error: 'not found' });
    if (err.code === 'EDENY') return sendJSON(res, 403, { error: 'forbidden' });
    console.error(err);
    return sendJSON(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`photo-graph`);
  console.log(`  root : ${ROOT}`);
  console.log(`  url  : http://localhost:${PORT}`);
  console.log(`  icon : place a "${NODE_ICON}" in any folder to use it as that node's image`);
});
