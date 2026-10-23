import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const server = http.createServer(async (request, response) => { try { const relative = request.url === '/' ? 'index.html' : request.url.replace(/^\//, ''); const file = path.resolve(root, relative); if (!file.startsWith(root)) throw new Error('fora da raiz'); await stat(file); response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }); response.end(await readFile(file)); } catch { response.writeHead(404); response.end(); } });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
for (const url of ['/', '/js/app.js', '/css/style.css']) { const response = await fetch(`http://127.0.0.1:${port}${url}`); if (!response.ok) throw new Error(`Smoke falhou em ${url}: ${response.status}`); }
server.close(); console.log('Smoke HTTP concluído.');
