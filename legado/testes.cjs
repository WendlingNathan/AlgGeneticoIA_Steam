const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const GA = require('./ga.js');
const fixture = [{id:'a',name:'A',price:300,score:80},{id:'b',name:'B',price:200,score:70},{id:'c',name:'C',price:400,score:90}];
const conf = {budget:500,populationSize:100,generations:200,mutationRate:0.05,crossoverRate:0.8,seed:42};
const history = [...GA.evolve(fixture,conf)];
assert.equal(history.at(-1).best.value,150); // Ótimo por enumeração: A+B.
assert.deepEqual(history,[...GA.evolve(fixture,conf)]);
assert(history.every((h,i)=>h.best.feasible && (!i || h.best.fitness>=history[i-1].best.fitness)));
assert(GA.evaluate([1,1,1],fixture,500).fitness<0);
assert.equal([...GA.evolve(fixture,{...conf,budget:0})].at(-1).best.cost,0);
assert.equal([...GA.evolve(fixture,{...conf,budget:900})].at(-1).best.value,240);
assert.equal([...GA.evolve([{price:0,score:90}],{...conf,budget:0})].at(-1).best.value,90);
assert.deepEqual(GA.mutate([0,1],1,GA.random(1)),[1,0]);
assert.deepEqual(GA.mutate([0,1],0,GA.random(1)),[0,1]);
const parsed=GA.parseCSV('app_id,name,price,positive,negative\r\n1,"Jogo, ""A""\nB",2.5,9,1\r\n2,Ruim,,2,1\n1,Duplicado,2.5,9,1');
assert.equal(parsed.games[0].name,'Jogo, "A"\nB');assert.equal(parsed.invalid,1);assert.equal(parsed.duplicates,1);
assert.throws(()=>GA.parseCSV('name,price\nA,2'));
assert.throws(()=>GA.parseCSV('name,price,positive,negative\n"A,2,3,4'));
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/data.js','utf8'),ctx);
const games=JSON.parse(JSON.stringify(ctx.window.STEAM_DATA.games));
const imported=GA.parseCSV(fs.readFileSync(__dirname+'/amostra.csv','utf8')).games;
assert.deepEqual(imported,games);
const runs=[];
for(let seed=42;seed<47;seed++){
  const h=[...GA.evolve(games,{...conf,budget:10000,mutationRate:0.01,seed})];
  assert(h.at(-1).best.feasible);assert(h.every((x,i)=>!i || x.best.fitness>=h[i-1].best.fitness));
  runs.push({seed,score:h.at(-1).best.value,cost:h.at(-1).best.cost/100,initial:h[0].best.value});
}
const mean=runs.reduce((s,r)=>s+r.score,0)/runs.length;
const result={budget:100,populationSize:100,generations:200,mutationRate:0.01,crossoverRate:0.8,runs,mean,std:Math.sqrt(runs.reduce((s,r)=>s+(r.score-mean)**2,0)/runs.length),greedy:GA.greedy(games,10000)};
fs.writeFileSync(__dirname+'/resultados-exemplo.json',JSON.stringify(result,null,2));
console.log('Testes aprovados: ótimo conhecido, orçamento, elitismo, semente, operadores, CSV e cinco execuções reais.');
console.log(JSON.stringify({runs,mean,std:result.std,greedy:result.greedy.value}));
