'use strict';
const $=id=>document.getElementById(id),fmt=(n,d=2)=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
const rows=STEAM_CATALOG.rows;
const labels={combined:'Pontuação conjunta somada'};
let last=null,worker=null,page=0,visible=[],busy=false;
for(const [id,column] of [['genre',8],['category',9],['tag',10]]){
  const choices=new Set();for(const r of rows){if(r[2]===0)continue;if((r[10]||[]).some(tag=>['nsfw','hentai'].includes(String(tag).trim().toLowerCase())))continue;for(const value of r[column]||[])choices.add(value);}
  const fragment=document.createDocumentFragment();for(const value of [...choices].sort((a,b)=>a.localeCompare(b))){const option=document.createElement('option');option.value=value;option.textContent=value;fragment.append(option);}$(id).append(fragment);
}
$('catalogCount').textContent=`${fmt(rows.length,0)} jogos no catálogo`;
$('dataExplanation').textContent=`Usamos todos os ${fmt(rows.length,0)} registros do Steam Games Dataset, versão ${STEAM_CATALOG.meta.version}, sem uma amostra reduzida. Só participam jogos com pelo menos 100 avaliações totais (positivas + negativas), dados necessários disponíveis e dentro dos seus filtros. O resumo de exclusões fica na análise do resultado.`;
function settings(){return {maxGames:Number($('maxGames').value),genre:$('genre').value,category:$('category').value,tag:$('tag').value,budget:Math.round(Number($('budget').value)*100),useBudget:$('useBudget').checked,disk:Number($('disk').value),useDisk:$('useDisk').checked,weights:{satisfaction:Number($('weightSatisfaction').value),positive:Number($('weightPositive').value),playtime:Number($('weightPlaytime').value)},objective:'combined',population:Number($('population').value),generations:Number($('generations').value),flips:Number($('flips').value),crossover:Number($('crossover').value)/100,seed:Number($('seed').value)};}
function locked(value){busy=value;$('controls').disabled=value;$('cancel').hidden=!value;$('progress').hidden=!value;$('download').disabled=value;}
function invalidate(){if(last){$('status').textContent='Preferências alteradas. Clique em Encontrar jogos para atualizar a seleção.';$('results').hidden=true;last=null;}}
$('form').addEventListener('input',event=>{if(event.target.id!=='diskFile')invalidate();});
$('useBudget').addEventListener('change',()=>{$('budget').disabled=!$('useBudget').checked;});
$('useDisk').addEventListener('change',()=>{$('diskField').hidden=!$('useDisk').checked;$('disk').required=$('useDisk').checked;});
// Worker em memória: funciona abrindo index.html diretamente, sem servidor.
const workerSource=`const createOptimizer=${createOptimizer.toString()};onmessage=function(e){try{const engine=createOptimizer(e.data.rows,e.data.config);let step;while((step=engine.step())){if(step.generation%5===0)postMessage({type:'progress',step});}postMessage({type:'done',result:engine.result()});}catch(error){postMessage({type:'error',message:error.message});}};`;
$('form').addEventListener('submit',event=>{
  event.preventDefault();if(busy||!$('form').reportValidity())return;
  const config=settings();if(!config.useBudget&&!config.useDisk){$('status').textContent='Ative pelo menos um limite: orçamento ou espaço em disco.';return;}
  if(Object.values(config.weights).every(w=>w===0)){$('status').textContent='Escolha pelo menos um peso maior que zero.';return;}
  invalidate();locked(true);$('status').textContent='Preparando o catálogo completo…';$('progress').max=config.generations;$('progress').value=0;
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  try{worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);locked(false);$('status').textContent=`Não foi possível iniciar a busca: ${error.message}`;return;}URL.revokeObjectURL(url);
  worker.onmessage=({data})=>{if(data.type==='progress'){$('progress').value=data.step.generation;$('status').textContent=`Buscando sua combinação · geração ${data.step.generation} de ${config.generations}`;}else if(data.type==='done'){worker.terminate();worker=null;locked(false);last=data.result;render();$('status').textContent=`Busca concluída · ${fmt(last.candidates,0)} jogos elegíveis em ${fmt(rows.length,0)} registros analisados.`;$('results').scrollIntoView({behavior:'instant',block:'start'});}else{stop(data.message);}};
  worker.onerror=event=>stop(`Não foi possível concluir: ${event.message}`);
  worker.postMessage({rows,config});
});
function stop(message){worker?.terminate();worker=null;locked(false);$('status').textContent=message;}
$('cancel').addEventListener('click',()=>stop('Busca cancelada. Ajuste os limites e tente novamente.'));
function render(){
  $('results').hidden=false;const {config,best}=last;
  $('count').textContent=fmt(last.selected.length,0);$('cost').textContent=fmt(best.cost/100);$('score').textContent=fmt(best.value,config.objective==='positive'?0:2);$('valueLabel').textContent=labels[config.objective];
  $('remainingLabel').textContent=config.useBudget?'Saldo · US$':'Espaço utilizado · GB';$('remaining').textContent=fmt(config.useBudget?(config.budget-best.cost)/100:best.size);

  $('resultNote').textContent=`${fmt(last.selected.length,0)} de até ${fmt(config.maxGames,0)} jogos pagos. ${config.useDisk?`Espaço: ${fmt(best.size)} de ${fmt(config.disk)} GB. `:''}Pesos: satisfação ${config.weights.satisfaction}, avaliações ${config.weights.positive}, horas ${config.weights.playtime}. Total: soma das notas de 0 a 10 por jogo. Semente ${config.seed}.`;
  if(last.selected.length<config.maxGames)$('resultNote').textContent+=' A busca encontrou menos jogos que o limite solicitado considerando os filtros, recursos e a pontuação; o algoritmo não garante preencher todas as vagas.';
  $('search').value='';updateGames();drawChart();
  $('comparison').replaceChildren();for(const [name,r] of [['Algoritmo Genético',last.best],['Seleção por valor / recurso',last.greedy],['Melhor combinação aleatória inicial',last.random]]){const tr=document.createElement('tr');[name,fmt(r.value),fmt(r.cost/100)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});$('comparison').append(tr);}
  const s=last.stats;
  $('filterReport').textContent=`Catálogo: ${fmt(s.total,0)}. Elegíveis: ${fmt(last.candidates,0)}. Exclusões, contadas uma vez por registro: tags bloqueadas ${fmt(s.blockedTags,0)}; dados básicos inválidos ${fmt(s.invalid,0)}; duplicados ${fmt(s.duplicates,0)}; menos de 100 avaliações ou total desconhecido ${fmt(s.insufficientReviews,0)}; fora das características escolhidas ${fmt(s.characteristicsMismatch,0)}; métrica ausente ${fmt(s.missingMetric,0)}; tamanho desconhecido ${fmt(s.missingDisk,0)}; gratuitos excluídos ${fmt(s.freeExcluded,0)}; preço acima do limite ${fmt(s.tooExpensive,0)}; tamanho acima do limite ${fmt(s.tooLarge,0)}; valor zero ${fmt(s.zeroValue,0)}.`;
  $('evolutionText').textContent=`Geração 0: ${fmt(last.history[0].best)} → geração ${config.generations}: ${fmt(best.value)}. População: ${config.population}; mutação por gene variável: ${fmt(last.mutationRate*100,5)}%.`;
}
function updateGames(){if(!last)return;const query=$('search').value.trim().toLocaleLowerCase('pt-BR'),scores=new Map(last.selectedScores.map(({index,score})=>[index,score]));visible=last.selected.filter(i=>rows[i][1].toLocaleLowerCase('pt-BR').includes(query)).sort((a,b)=>scores.get(b)-scores.get(a)||rows[a][1].localeCompare(rows[b][1]));page=0;renderPage();}
function fallback(){const div=document.createElement('div');div.className='cover cover-placeholder';div.textContent='Imagem indisponível';return div;}
function appendCharacteristics(info,r){
  const platforms=document.createElement('p');platforms.className='platforms';
  platforms.textContent=[['Windows',11],['macOS',12],['Linux',13]].map(([name,column])=>`${name}: ${r[column]===true?'sim':r[column]===false?'não':'não informado'}`).join(' · ');info.append(platforms);
  const genre=document.createElement('p');genre.className='game-secondary';genre.textContent=`Gêneros: ${(r[8]||[]).join(' · ')||'Não informados'}`;info.append(genre);
  const details=document.createElement('details');details.className='game-characteristics';const summary=document.createElement('summary');summary.textContent='Todas as características';details.append(summary);
  for(const [label,column] of [['Categorias / recursos',9],['Tags / estilos',10]]){const title=document.createElement('p');title.className='characteristic-label';title.textContent=label;details.append(title);const list=document.createElement('div');list.className='feature-list';for(const item of r[column]||[]){const span=document.createElement('span');span.textContent=item;list.append(span);}if(!list.childElementCount)list.textContent='Não informados';details.append(list);}info.append(details);
}
function renderPage(){
  $('games').replaceChildren();const pages=Math.max(1,Math.ceil(visible.length/12));page=Math.min(page,pages-1);
  for(const index of visible.slice(page*12,page*12+12)){
    const r=rows[index],card=document.createElement('article');card.className='game-card';
    if(/^https:\/\//.test(r[6])){const img=document.createElement('img');img.className='cover';img.src=r[6];img.alt=`Capa de ${r[1]}`;img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.replaceWith(fallback()),{once:true});card.append(img);}else card.append(fallback());
    const info=document.createElement('div');info.className='game-info';const h=document.createElement('h3');h.title=r[1];
    if(/^\d+$/.test(String(r[0]))){const a=document.createElement('a');a.href=`https://store.steampowered.com/app/${r[0]}/`;a.target='_blank';a.rel='noopener';a.textContent=r[1];h.append(a);}else h.textContent=r[1];info.append(h);
    const meta=document.createElement('div');meta.className='game-meta';const price=document.createElement('strong');price.textContent=`US$ ${fmt(r[2]/100)}`;const metric=document.createElement('span');
    metric.textContent=`Nota ${fmt(last.selectedScores.find(s=>s.index===index).score)} / 10`;meta.append(price,metric);info.append(meta);
    const extra=document.createElement('p');extra.className='game-secondary';extra.textContent=`${r[3]!==null&&r[4]!==null?fmt(r[3]+r[4],0)+' avaliações':'Avaliações não informadas'}${r[7]!==null?' · '+fmt(r[7])+' GB':''}`;info.append(extra);appendCharacteristics(info,r);card.append(info);$('games').append(card);
  }
  if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent='Nenhum jogo encontrado com estes limites ou filtros.';$('games').append(p);}
  $('shownCount').textContent=`${fmt(visible.length,0)} jogos`;$('pageLabel').textContent=`${page+1} / ${pages}`;$('previous').disabled=page===0;$('next').disabled=page>=pages-1;
}
$('search').addEventListener('input',updateGames);$('previous').addEventListener('click',()=>{page--;renderPage();});$('next').addEventListener('click',()=>{page++;renderPage();});
function drawChart(){const ctx=$('chart').getContext('2d'),h=last.history;ctx.clearRect(0,0,1100,360);const values=h.flatMap(x=>[x.best,x.mean]),min=Math.min(...values),max=Math.max(...values),padding=Math.max(1,(max-min)*.15),low=Math.max(0,min-padding),high=max+padding;ctx.font='20px system-ui';for(let i=0;i<=4;i++){const y=290-i*60;ctx.strokeStyle='#344149';ctx.beginPath();ctx.moveTo(170,y);ctx.lineTo(1060,y);ctx.stroke();ctx.fillStyle='#a6b6bf';ctx.fillText(fmt(low+(high-low)*i/4,0),12,y+6);}ctx.fillText('0',170,325);ctx.fillText('Geração',530,340);ctx.fillText(h.at(-1).generation,1000,325);for(const [key,color] of [['mean','#8faee9'],['best','#a8efc2']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();h.forEach((v,i)=>{const x=170+i/(h.length-1)*890,y=290-(v[key]-low)/(high-low)*240;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
$('download').addEventListener('click',()=>{if(!last)return;const selectedSet=new Set(last.selected);const output={...last,currency:'USD',source:STEAM_CATALOG.meta,chromosome:rows.map((_,i)=>selectedSet.has(i)?1:0).join(''),selected:last.selected.map(i=>Object.fromEntries(STEAM_CATALOG.meta.columns.map((name,j)=>[name,rows[i][j]])))};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='minha-biblioteca-steam.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('diskFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  busy=true;$('controls').disabled=true;
  try{if(file.size>20*1024*1024)throw new Error('O CSV de tamanhos deve ter até 20 MB.');let headers;const sizes=new Map();let invalid=0;const parser=new SteamGA.CSVParser(row=>{if(!headers){headers=row.map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase());if(!headers.includes('app_id')||!headers.includes('size_gb'))throw new Error('Use as colunas app_id,size_gb.');return;}const id=row[headers.indexOf('app_id')]?.trim(),raw=row[headers.indexOf('size_gb')]?.trim(),size=Number(raw);if(id&&raw&&Number.isFinite(size)&&size>0)sizes.set(id,size);else invalid++;});parser.push(await file.text());parser.end();let matched=0;for(const r of rows)if(sizes.has(String(r[0])))matched++;if(!matched)throw new Error('Nenhum app_id do arquivo corresponde ao catálogo.');for(const r of rows)if(sizes.has(String(r[0])))r[7]=sizes.get(String(r[0]));invalidate();$('useDisk').disabled=false;$('diskNote').textContent=`Espaço em disco disponível para ${fmt(rows.filter(r=>r[7]!==null).length,0)} jogos. Sem tamanho conhecido, o jogo fica fora da busca com limite de GB.`;$('status').textContent=`Tamanhos atualizados para ${fmt(matched,0)} jogos. ${invalid} linhas inválidas ignoradas.`;}catch(error){$('status').textContent=error.message;}finally{busy=false;$('controls').disabled=false;}
});





