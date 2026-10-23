import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
async function files(directory) { const output = []; for (const name of await readdir(directory)) { if (['node_modules', '.git'].includes(name)) continue; const full = path.join(directory, name); if ((await stat(full)).isDirectory()) output.push(...await files(full)); else output.push(full); } return output; }
const all = await files(root); const js = all.filter((file) => /\.(m?js)$/.test(file));
for (const file of js) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) throw new Error(`${path.relative(root, file)}: ${result.stderr}`); }
for (const file of all.filter((item) => !/\.(zip|png|jpg|ico)$/.test(item))) { const content = await readFile(file, 'utf8'); if (/-----BEGIN (RSA |EC |)PRIVATE KEY-----/.test(content)) throw new Error(`Possível chave privada em ${path.relative(root, file)}`); }
const index = await readFile(path.join(root, 'index.html'), 'utf8');
for (const required of ['id="app"', './js/app.js', 'id="dialog"']) if (!index.includes(required)) throw new Error(`index.html sem ${required}`);
console.log(`${js.length} arquivos JavaScript validados; nenhum segredo óbvio encontrado.`);
