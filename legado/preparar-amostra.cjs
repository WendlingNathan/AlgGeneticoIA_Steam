const fs = require('node:fs');
const {CSVParser, normalize, random} = require('./ga.js');
const rng = random(42), sample = [], seen = new Set();
let headers, total = 0, valid = 0, invalid = 0, duplicate = 0, free = 0;
const parser = new CSVParser(row => {
  if (!headers) { headers = row; return; }
  total++;
  const game = normalize(Object.fromEntries(headers.map((h,i) => [h,row[i]])));
  if (!game) { invalid++; return; }
  if (seen.has(game.id)) { duplicate++; return; } seen.add(game.id);
  // Jogos gratuitos tornam a mochila trivial: ficam fora desta amostra didática.
  if (game.price === 0) { free++; return; }
  valid++;
  if (sample.length < 80) sample.push(game);
  else { const j = Math.floor(rng() * valid); if (j < 80) sample[j] = game; }
});
(async () => {
  for await (const chunk of fs.createReadStream(process.argv[2] || 'steam_games.csv', {encoding:'utf8'})) parser.push(chunk);
  parser.end(); sample.sort((a,b) => a.name.localeCompare(b.name));
  const meta = {source:'https://www.kaggle.com/datasets/hubertsidorowicz/steam-games-dataset-daily-updates',version:54,date:'2026-09-15',total,valid,invalid,duplicate,free,sampleSize:sample.length,sampling:'Reservoir sampling; semente 42; jogos pagos com avaliações válidas',currency:'unidades monetárias do CSV; sem conversão para reais',disk:'Não há coluna de espaço em disco no arquivo steam_games.csv'};
  fs.writeFileSync('./data.js', 'window.STEAM_DATA = '+JSON.stringify({games:sample,meta},null,2)+';\n');
  fs.writeFileSync('./amostra.csv', 'app_id,name,price,positive,negative\n'+sample.map(g=>[g.id,JSON.stringify(g.name).replace(/\\"/g,'""'),(g.price/100).toFixed(2),g.positive,g.negative].join(',')).join('\n'));
  fs.writeFileSync('./analise-dataset.json', JSON.stringify(meta,null,2));
  console.log(JSON.stringify(meta));
})();

