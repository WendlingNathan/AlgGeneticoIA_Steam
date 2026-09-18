const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {createOptimizer}=require('./optimizer.js');
const {CSVParser}=require('./ga.js');
const parsed=[];const parser=new CSVParser(row=>parsed.push(row));
parser.push('name,price\r\n"Game, "');parser.push('"A""\nB",2.5\n');parser.end();
assert.deepEqual(parsed,[['name','price'],['Game, "A"\nB','2.5']]);
const base={budget:500,useBudget:true,disk:10,useDisk:false,weights:{satisfaction:0,positive:10,playtime:0},population:30,generations:80,flips:2,crossover:.8,seed:42};
const fixture=[['1','A',300,80,20,60,'',4],['2','B',200,70,30,120,'',3],['3','C',400,90,10,180,'',6],['4','Grátis',0,10,90,30,'',2]];
function run(rows,config){const engine=createOptimizer(rows,config);while(engine.step());return engine.result();}
function verify(result,rows){const selected=result.selected.map(i=>rows[i]);assert.equal(new Set(result.selected).size,result.selected.length);assert(result.best.feasible);assert(selected.every(g=>g[2]>0));assert.equal(selected.reduce((s,g)=>s+g[2],0),result.best.cost);if(result.config.useBudget)assert(result.best.cost<=result.config.budget);if(result.config.useDisk)assert(result.best.size<=result.config.disk+1e-8);assert(result.history.every((h,i)=>!i||h.best>=result.history[i-1].best));const stats=Object.entries(result.stats).filter(([key])=>key!=='total').reduce((s,[,v])=>s+v,0);assert.equal(stats+result.candidates,rows.length);}
const tiny=run(fixture,base);assert(Math.abs(tiny.best.value-150/9)<1e-10);verify(tiny,fixture);assert.deepEqual(tiny,run(fixture,base));
assert.equal(run(fixture,{...base,budget:0}).best.value,0);
assert.equal(run(fixture,{...base,budget:0,includeFree:false}).selected.length,0);
// A regra é obrigatória, mesmo para configurações antigas que pedem gratuitos.
for(const limits of [{useBudget:true,useDisk:false},{useBudget:false,useDisk:true},{useBudget:true,useDisk:true}]){
  const result=run(fixture,{...base,...limits,includeFree:true});verify(result,fixture);assert.equal(result.config.includeFree,false);assert.equal(result.stats.freeExcluded,1);
}
const onlyFree=run([fixture[3]],{...base,includeFree:true});assert.equal(onlyFree.selected.length,0);assert.equal(onlyFree.greedy.value,0);assert.equal(onlyFree.random.value,0);assert.deepEqual(onlyFree.normalization,{positive:0,playtime:0});
assert.equal(run(fixture,{...base,useDisk:true,disk:5}).best.value,10);
const diskOnly=run(fixture,{...base,useBudget:false,useDisk:true,disk:6});assert.equal(diskOnly.best.value,10);verify(diskOnly,fixture);
verify(run(fixture,{...base,useDisk:true,disk:0.3}),fixture);
assert.equal(run([],base).selected.length,0);
assert.throws(()=>run(fixture,{...base,useBudget:false}));
assert.throws(()=>run(fixture,{...base,weights:{satisfaction:0,positive:0,playtime:0}}),/pelo menos um peso/);
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/catalogo.js','utf8'),ctx);
const rows=ctx.window.STEAM_CATALOG.rows;assert.equal(rows.length,140940);
const featured=fixture.map((r,i)=>[...r,i===0?['RPG']:['Action'],i===0?['Co-op']:['Single-player'],i===0?['Open World']:['Casual'],true,false,i===0]);
const matched=run(featured,{...base,genre:'RPG',category:'Co-op',tag:'Open World'});assert.deepEqual(matched.selected,[0]);verify(matched,featured);
assert.equal(run(featured,{...base,genre:'RPG',category:'Single-player'}).selected.length,0);
const stardew=rows.find(r=>r[0]==='413150');assert(stardew[8].includes('RPG'));assert(stardew[9].includes('Co-op'));assert(stardew[10].includes('Farming Sim'));assert.deepEqual(Array.from(stardew.slice(11)),[true,true,true]);
const filtered=run(rows,{...base,budget:10000,genre:'RPG',category:'Co-op',tag:'Open World'});assert(filtered.selected.length>0);verify(filtered,rows);assert(filtered.selected.every(i=>rows[i][8].includes('RPG')&&rows[i][9].includes('Co-op')&&rows[i][10].includes('Open World')));
const results=[];
// Equação ponderada, zeros e dados ausentes.
for(const invalid of [-1,11,NaN,Infinity,null,'5'])assert.throws(()=>run(fixture,{...base,weights:{satisfaction:invalid,positive:5,playtime:5}}));
const combined=run(fixture,{...base,weights:{satisfaction:2,positive:3,playtime:5}});
verify(combined,fixture);
for(const {index,score} of combined.selectedScores){const r=fixture[index];const expected=(2*(10*r[3]/(r[3]+r[4]))+3*(10*r[3]/90)+5*(10*r[5]/180))/10;assert(Math.abs(score-expected)<1e-10);assert(score>=0&&score<=10);}
assert.deepEqual(combined,run(fixture,{...base,weights:{satisfaction:2,positive:3,playtime:5}}));
const unknownHours=[['x','Sem horas',100,80,20,null,'',1]];
assert.equal(run(unknownHours,base).selected.length,1);
assert.equal(run(unknownHours,{...base,weights:{satisfaction:5,positive:5,playtime:5}}).stats.missingMetric,1);
const zeroMetrics=[['z','Sem positivas nem horas',100,0,100,0,'',1]];
for(const weights of [{satisfaction:0,positive:10,playtime:0},{satisfaction:0,positive:0,playtime:10},{satisfaction:5,positive:5,playtime:5}]){const result=run(zeroMetrics,{...base,weights});assert.equal(result.best.value,0);assert(result.history.every(h=>Number.isFinite(h.best)&&Number.isFinite(h.mean)));verify(result,zeroMetrics);}
const priorities=[['s','Satisfação',100,100,0,0,'',1],['p','Popular',100,900,100,0,'',1],['h','Horas',100,50,50,600,'',1]];
for(const [key,index] of [['satisfaction',0],['positive',1],['playtime',2]])assert.deepEqual(run(priorities,{...base,budget:100,weights:{satisfaction:0,positive:0,playtime:0,[key]:10}}).selected,[index]);
const blockedFixture=fixture.map((r,i)=>[...r,[],[],i===0?[' NSFW ']:i===1?['hEnTaI']:['Adventure'],true,false,false]);
for(const objective of ['satisfaction','positive','playtime']){
  const result=run(blockedFixture,{...base,weights:{satisfaction:0,positive:0,playtime:0,[objective]:10}});assert.equal(result.stats.blockedTags,2);assert(result.selected.every(i=>i>=2));verify(result,blockedFixture);
}
const boundary=[['a','99 votos',100,99,0,60,'',1],['b','100 votos',100,80,20,60,'',1],['c','101 votos',100,100,1,60,'',1],['d','Total desconhecido',100,200,null,60,'',1]];
for(const objective of ['satisfaction','positive','playtime']){
  const result=run(boundary,{...base,weights:{satisfaction:0,positive:0,playtime:0,[objective]:10}});
  assert.deepEqual(result.selected,[1,2]);assert.equal(result.stats.insufficientReviews,2);
  assert.equal(result.config.minReviews,100);verify(result,boundary);
}
for(const objective of ['satisfaction','positive','playtime']){
  const start=performance.now();const result=run(rows,{...base,budget:10000,weights:{satisfaction:0,positive:0,playtime:0,[objective]:10},population:60,generations:150,flips:3});verify(result,rows);
  assert(result.selected.every(i=>rows[i][3]+rows[i][4]>=100));
  assert(result.selected.every(i=>!(rows[i][10]||[]).some(tag=>['nsfw','hentai'].includes(String(tag).trim().toLowerCase()))));
  results.push({objective,weights:result.config.weights,normalization:result.normalization,milliseconds:Math.round(performance.now()-start),selected:result.selected.length,candidates:result.candidates,free:result.selected.filter(i=>rows[i][2]===0).length,best:result.best,initial:result.history[0].best,greedy:result.greedy,stats:result.stats});
}
const joint=run(rows,{...base,budget:10000,weights:{satisfaction:5,positive:5,playtime:5},population:60,generations:150,flips:3});verify(joint,rows);assert(joint.selectedScores.every(s=>Number.isFinite(s.score)&&s.score>=0&&s.score<=10));assert(Math.abs(joint.selectedScores.reduce((sum,s)=>sum+s.score,0)-joint.best.value)<1e-8);results.push({objective:'combined',weights:joint.config.weights,normalization:joint.normalization,selected:joint.selected.length,candidates:joint.candidates,best:joint.best,greedy:joint.greedy});
fs.writeFileSync(__dirname+'/resultados-catalogo.json',JSON.stringify(results,null,2));
console.log('Testes aprovados: exemplo de ótimo conhecido, determinismo, orçamento, disco, restrições combinadas, gratuitos, vazio, validação e catálogo completo.');
console.log(JSON.stringify(results));
