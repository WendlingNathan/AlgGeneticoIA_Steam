const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {createOptimizer}=require('./optimizer.js');
const {CSVParser}=require('./ga.js');
const parsed=[];const parser=new CSVParser(row=>parsed.push(row));
parser.push('name,price\r\n"Game, "');parser.push('"A""\nB",2.5\n');parser.end();
assert.deepEqual(parsed,[['name','price'],['Game, "A"\nB','2.5']]);
const base={budget:500,useBudget:true,disk:10,useDisk:false,includeFree:true,objective:'positive',population:30,generations:80,flips:2,crossover:.8,seed:42};
const fixture=[['1','A',300,80,20,60,'',4],['2','B',200,70,30,120,'',3],['3','C',400,90,10,180,'',6],['4','Grátis',0,10,90,30,'',2]];
function run(rows,config){const engine=createOptimizer(rows,config);while(engine.step());return engine.result();}
function verify(result,rows){const selected=result.selected.map(i=>rows[i]);assert.equal(new Set(result.selected).size,result.selected.length);assert(result.best.feasible);assert.equal(selected.reduce((s,g)=>s+g[2],0),result.best.cost);if(result.config.useBudget)assert(result.best.cost<=result.config.budget);if(result.config.useDisk)assert(result.best.size<=result.config.disk+1e-8);assert(result.history.every((h,i)=>!i||h.best>=result.history[i-1].best));const stats=Object.entries(result.stats).filter(([key])=>key!=='total').reduce((s,[,v])=>s+v,0);assert.equal(stats+result.candidates,rows.length);}
const tiny=run(fixture,base);assert.equal(tiny.best.value,160);verify(tiny,fixture);assert.deepEqual(tiny,run(fixture,base));
assert.equal(run(fixture,{...base,budget:0}).best.value,10);
assert.equal(run(fixture,{...base,budget:0,includeFree:false}).selected.length,0);
assert.equal(run(fixture,{...base,useDisk:true,disk:5}).best.value,80);
const diskOnly=run(fixture,{...base,useBudget:false,useDisk:true,disk:6});assert.equal(diskOnly.best.value,90);verify(diskOnly,fixture);
verify(run(fixture,{...base,useDisk:true,disk:0.3}),fixture);
assert.equal(run([],base).selected.length,0);
assert.throws(()=>run(fixture,{...base,useBudget:false}));
assert.throws(()=>run(fixture,{...base,objective:'unknown'}));
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/catalogo.js','utf8'),ctx);
const rows=ctx.window.STEAM_CATALOG.rows;assert.equal(rows.length,140940);
const featured=fixture.map((r,i)=>[...r,i===0?['RPG']:['Action'],i===0?['Co-op']:['Single-player'],i===0?['Open World']:['Casual'],true,false,i===0]);
const matched=run(featured,{...base,genre:'RPG',category:'Co-op',tag:'Open World'});assert.deepEqual(matched.selected,[0]);verify(matched,featured);
assert.equal(run(featured,{...base,genre:'RPG',category:'Single-player'}).selected.length,0);
const stardew=rows.find(r=>r[0]==='413150');assert(stardew[8].includes('RPG'));assert(stardew[9].includes('Co-op'));assert(stardew[10].includes('Farming Sim'));assert.deepEqual(Array.from(stardew.slice(11)),[true,true,true]);
const filtered=run(rows,{...base,budget:10000,genre:'RPG',category:'Co-op',tag:'Open World'});assert(filtered.selected.length>0);verify(filtered,rows);assert(filtered.selected.every(i=>rows[i][8].includes('RPG')&&rows[i][9].includes('Co-op')&&rows[i][10].includes('Open World')));
const results=[];
const blockedFixture=fixture.map((r,i)=>[...r,[],[],i===0?[' NSFW ']:i===1?['hEnTaI']:['Adventure'],true,false,false]);
for(const objective of ['satisfaction','positive','playtime']){
  const result=run(blockedFixture,{...base,objective});assert.equal(result.stats.blockedTags,2);assert(result.selected.every(i=>i>=2));verify(result,blockedFixture);
}
const boundary=[['a','99 votos',0,99,0,60,'',1],['b','100 votos',0,80,20,60,'',1],['c','101 votos',0,100,1,60,'',1],['d','Total desconhecido',0,200,null,60,'',1]];
for(const objective of ['satisfaction','positive','playtime']){
  const result=run(boundary,{...base,objective});
  assert.deepEqual(result.selected,[1,2]);assert.equal(result.stats.insufficientReviews,2);
  assert.equal(result.config.minReviews,100);verify(result,boundary);
}
for(const objective of ['satisfaction','positive','playtime']){
  const start=performance.now();const result=run(rows,{...base,budget:10000,objective,population:60,generations:150,flips:3});verify(result,rows);
  assert(result.selected.every(i=>rows[i][3]+rows[i][4]>=100));
  assert(result.selected.every(i=>!(rows[i][10]||[]).some(tag=>['nsfw','hentai'].includes(String(tag).trim().toLowerCase()))));
  results.push({objective,milliseconds:Math.round(performance.now()-start),selected:result.selected.length,candidates:result.candidates,free:result.fixedCount,best:result.best,initial:result.history[0].best,greedy:result.greedy,stats:result.stats});
}
fs.writeFileSync(__dirname+'/resultados-catalogo.json',JSON.stringify(results,null,2));
console.log('Testes aprovados: exemplo de ótimo conhecido, determinismo, orçamento, disco, restrições combinadas, gratuitos, vazio, validação e catálogo completo.');
console.log(JSON.stringify(results));
