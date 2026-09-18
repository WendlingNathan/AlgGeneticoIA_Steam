/* AG com cromossomo binário esparso: guarda os índices dos bits 1.
   Todas as posições elegíveis podem participar; não existe amostragem. */
(function(root) {
  'use strict';
  function createOptimizer(rows, config) {
    // O mínimo usa o total de avaliações, independentemente do objetivo escolhido.
    config = { ...config, objective: 'combined', includeFree: false, weights: {satisfaction:5,positive:5,playtime:5,...config.weights}, minReviews: 100 };
    let state = config.seed >>> 0;
    const rng = () => {state += 0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
    const finite = x => typeof x==='number' && Number.isFinite(x) && x>=0;
    if(!Number.isInteger(config.population)||config.population<4||config.population>300||!Number.isInteger(config.generations)||config.generations<1||config.generations>1000||!Number.isInteger(config.seed)||config.seed<0||config.seed>4294967295||!finite(config.crossover)||config.crossover>1||!finite(config.flips)||config.flips>100||(!config.useBudget&&!config.useDisk)||(config.useBudget&&(!Number.isSafeInteger(config.budget)||config.budget<0))||(config.useDisk&&(!finite(config.disk)||config.disk<=0)))throw new Error('Confira os limites e as configurações.');
    const weights=config.weights;
    if(Object.values(weights).some(w=>!finite(w)||w>10))throw new Error('Os pesos devem estar entre 0 e 10.');
    const weightSum=weights.satisfaction+weights.positive+weights.playtime;
    if(weightSum===0)throw new Error('Escolha pelo menos um peso maior que zero.');
    const budget=config.useBudget?config.budget:Infinity,disk=config.useDisk?config.disk:Infinity;
    const eligible=[],fixed=[],seen=new Set();
    const stats={total:rows.length,blockedTags:0,invalid:0,insufficientReviews:0,characteristicsMismatch:0,missingMetric:0,missingDisk:0,tooExpensive:0,tooLarge:0,freeExcluded:0,zeroValue:0,duplicates:0};
    let fixedValue=0,fixedCost=0,fixedDisk=0;
    const candidates=[];
    const normalization={positive:0,playtime:0};
    for(let index=0;index<rows.length;index++){
      const r=rows[index];
      if((r[10]||[]).some(tag=>['nsfw','hentai'].includes(String(tag).trim().toLowerCase()))){stats.blockedTags++;continue;}
      if(!r[1]||!finite(r[2])||!Number.isSafeInteger(r[2])){stats.invalid++;continue;}
      const id=String(r[0]||r[1]);if(seen.has(id)){stats.duplicates++;continue;}seen.add(id);
      if(!finite(r[3])||!finite(r[4])||r[3]+r[4]<config.minReviews){stats.insufficientReviews++;continue;}
      if([[8,config.genre],[9,config.category],[10,config.tag]].some(([column,choice])=>choice&&!(r[column]||[]).includes(choice))){stats.characteristicsMismatch++;continue;}
      if(weights.playtime>0&&!finite(r[5])){stats.missingMetric++;continue;}
      if(config.useDisk&&!finite(r[7])){stats.missingDisk++;continue;}
      if(r[2]===0){stats.freeExcluded++;continue;}
      if(r[2]>budget){stats.tooExpensive++;continue;}
      const size=config.useDisk?r[7]:0;
      if(size>disk){stats.tooLarge++;continue;}
      candidates.push({index,price:r[2],size});
      normalization.positive=Math.max(normalization.positive,r[3]);
      normalization.playtime=Math.max(normalization.playtime,finite(r[5])?r[5]:0);
    }
    const scores={};
    for(const candidate of candidates){
      const {index}=candidate,r=rows[index];
      const satisfaction=10*r[3]/(r[3]+r[4]);
      const positive=normalization.positive>0?10*r[3]/normalization.positive:0;
      const playtime=normalization.playtime>0&&finite(r[5])?10*r[5]/normalization.playtime:0;
      const value=(weights.satisfaction*satisfaction+weights.positive*positive+weights.playtime*playtime)/weightSum;
      if(value<=0){stats.zeroValue++;continue;}
      scores[index]=value;
      const game={...candidate,value},size=game.size;
      // Com valor positivo e sem consumir recursos ativos, incluir é sempre vantajoso.
      if((!config.useBudget||game.price===0)&&(!config.useDisk||size===0)){fixed.push(index);fixedValue+=value;fixedCost+=game.price;fixedDisk+=size;}
      else eligible.push(game);
    }
    const n=eligible.length;
    const mutationRate=n?Math.min(1,config.flips/n):0;
    const maxValue=eligible.reduce((s,g)=>s+g.value,0)+fixedValue+1;
    function evaluate(genes){let cost=fixedCost,size=fixedDisk,value=fixedValue;for(const i of genes){const g=eligible[i];cost+=g.price;size+=g.size;value+=g.value;}const excess=(config.useBudget?Math.max(0,cost-budget)/Math.max(1,budget):0)+(config.useDisk?Math.max(0,size-disk)/Math.max(1,disk):0);return {genes,cost,size,value,fitness:excess?value-maxValue*(1+excess):value,feasible:!excess};}
    const fits=(cost,size,g)=>cost+g.price<=budget&&size+g.size<=disk;
    function repair(genes){let value=evaluate(genes);if(value.feasible)return value;const shuffled=genes.slice();for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}while(shuffled.length&&(value.cost>budget||value.size>disk)){const g=eligible[shuffled.pop()];value.cost-=g.price;value.size-=g.size;}shuffled.sort((a,b)=>a-b);return evaluate(shuffled);}
    function construct(order,probability=1){const genes=[];let cost=fixedCost,size=fixedDisk;for(const i of order){const g=eligible[i];if(fits(cost,size,g)&&(probability===1||rng()<probability)){genes.push(i);cost+=g.price;size+=g.size;}}genes.sort((a,b)=>a-b);return evaluate(genes);}
    const order=Array.from({length:n},(_,i)=>i);
    const density=g=>g.value/Math.max(1e-12,(config.useBudget?g.price/Math.max(1,budget):0)+(config.useDisk?g.size/Math.max(1,disk):0));
    const ranked=order.slice().sort((a,b)=>density(eligible[b])-density(eligible[a]));
    const greedy=construct(ranked);
    let population=[evaluate([])],randomBest=evaluate([]);
    for(let p=1;p<config.population;p++){
      for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      // Metade usa ordem aleatória, metade usa densidade com aceitação aleatória.
      // A referência gulosa pura não é inserida na população.
      const candidate=p%2?construct(ranked,0.1+0.8*rng()):construct(order);population.push(candidate);if(candidate.fitness>randomBest.fitness)randomBest=candidate;
    }
    function tournament(){let best=population[Math.floor(rng()*population.length)];for(let i=1;i<3;i++){const c=population[Math.floor(rng()*population.length)];if(c.fitness>best.fitness)best=c;}return best;}
    function child(){const a=tournament(),b=tournament();let genes;
      if(n>1&&rng()<config.crossover){const cut=1+Math.floor(rng()*(n-1));genes=a.genes.filter(i=>i<cut).concat(b.genes.filter(i=>i>=cut));}else genes=a.genes.slice();
      const bits=new Set(genes);
      // Saltos geométricos são equivalentes a testar cada bit, sem percorrer todos os zeros.
      if(mutationRate>=1){for(let i=0;i<n;i++){if(bits.has(i))bits.delete(i);else bits.add(i);}}
      else if(mutationRate>0){const log=Math.log1p(-mutationRate);let i=-1;while(true){i+=1+Math.floor(Math.log(1-rng())/log);if(i>=n)break;if(bits.has(i))bits.delete(i);else bits.add(i);}}
      return repair([...bits].sort((a,b)=>a-b));
    }
    const history=[];let generation=0,finished=false;
    function snapshot(){population.sort((a,b)=>b.fitness-a.fitness||a.cost-b.cost);const best=population[0];history.push({generation,best:best.value,mean:population.reduce((s,p)=>s+p.fitness,0)/population.length});return {generation,best:best.value};}
    snapshot();
    function step(){if(finished)return null;if(generation>=config.generations){finished=true;return null;}const next=[population[0]];while(next.length<config.population)next.push(child());population=next;generation++;return snapshot();}
    function result(){const best=population[0];return {config,normalization,selectedScores:fixed.concat(best.genes.map(i=>eligible[i].index)).map(index=>({index,score:scores[index]})),stats,candidates:n+fixed.length,variableGenes:n,fixedCount:fixed.length,mutationRate,history,selected:fixed.concat(best.genes.map(i=>eligible[i].index)),best:{value:best.value,cost:best.cost,size:best.size,feasible:best.feasible},greedy:{value:greedy.value,cost:greedy.cost,size:greedy.size},random:{value:randomBest.value,cost:randomBest.cost,size:randomBest.size}};}
    return {step,result};
  }
  if(typeof module!=='undefined')module.exports={createOptimizer};else root.createOptimizer=createOptimizer;
})(typeof globalThis!=='undefined'?globalThis:this);
