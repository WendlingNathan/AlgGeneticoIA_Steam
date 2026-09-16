// Lê o CSV completo por partes; preserva todas as linhas e apenas os campos usados.
const fs = require('node:fs');
const path = require('node:path');
const { CSVParser } = require('./ga.js');
const target = __dirname;
const input = process.argv[2] || path.join(target, 'dados', 'steam_games.csv');
const rows = []; let headers;
const number = value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
function characteristics(value) {
  if (!value?.trim()) return [];
  let parsed; try { parsed = JSON.parse(value); } catch { return value.split(/[,;]/).map(x=>x.trim()).filter(Boolean); }
  const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? Object.keys(parsed) : [parsed];
  return [...new Set(items.map(item=>typeof item==='string'?item:item?.description||item?.name||'').map(x=>x.trim()).filter(Boolean))];
}
const platform = value => /^true$/i.test(value||'') ? true : /^false$/i.test(value||'') ? false : null;
const parser = new CSVParser(row => {
  if (!headers) { headers = row; return; }
  const g = Object.fromEntries(headers.map((key, i) => [key, row[i]]));
  const price = number(g.price);
  rows.push([g.app_id, g.name || '', price === null ? null : Math.round(price * 100), number(g.positive), number(g.negative), number(g.average_playtime_forever), /^https:\/\//.test(g.header_image || '') ? g.header_image : '', number(g.size_gb), characteristics(g.genres), characteristics(g.categories), characteristics(g.tags), platform(g.windows), platform(g.mac), platform(g.linux)]);
});
(async () => {
  for await (const chunk of fs.createReadStream(input, { encoding: 'utf8' })) parser.push(chunk);
  parser.end();
  const meta = { source:'https://www.kaggle.com/datasets/hubertsidorowicz/steam-games-dataset-daily-updates', version:54, date:'2026-09-15', total:rows.length, withPrice:rows.filter(g=>g[2]!==null).length, withImage:rows.filter(g=>g[6]).length, withDisk:rows.filter(g=>g[7]!==null).length, columns:['app_id','name','price_cents','positive','negative','average_playtime_minutes','header_image','size_gb','genres','categories','tags','windows','mac','linux'], sampling:false };
  fs.writeFileSync(path.join(target,'catalogo.js'), 'window.STEAM_CATALOG = '+JSON.stringify({meta,rows})+';\n');
  fs.writeFileSync(path.join(target,'analise-catalogo.json'), JSON.stringify(meta,null,2));
  console.log(JSON.stringify(meta));
})().catch(error => { console.error(error); process.exitCode=1; });
