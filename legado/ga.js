/* Núcleo do AG: também pode ser executado pelo Node para testes. */
(function (root) {
  'use strict';
  function random(seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Parser incremental: aceita vírgulas, aspas escapadas e quebras dentro de campos.
  class CSVParser {
    constructor(onRow) { this.onRow = onRow; this.row = []; this.field = ''; this.quoted = false; this.pending = false; }
    push(text) {
      for (const c of text) {
        if (this.pending) {
          this.pending = false;
          if (c === '"') { this.field += '"'; continue; }
          this.quoted = false;
        }
        if (this.quoted) { if (c === '"') this.pending = true; else this.field += c; }
        else if (c === '"' && !this.field) this.quoted = true;
        else if (c === ',') { this.row.push(this.field); this.field = ''; }
        else if (c === '\n') this.emit();
        else if (c !== '\r') this.field += c;
      }
    }
    emit() { this.row.push(this.field); if (this.row.some(x => x.trim())) this.onRow(this.row); this.row = []; this.field = ''; }
    end() { if (this.quoted && !this.pending) throw new Error('CSV com aspas não fechadas.'); if (this.field || this.row.length) this.emit(); }
  }
  function normalize(row) {
    const number = key => row[key] == null || String(row[key]).trim() === '' ? NaN : Number(row[key]);
    const price = number('price'), positive = number('positive'), negative = number('negative');
    if (!row.name?.trim() || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100)) || !Number.isSafeInteger(positive) || !Number.isSafeInteger(negative) || positive < 0 || negative < 0 || positive + negative === 0) return null;
    return { id: row.app_id || row.name, name: row.name.trim(), price: Math.round(price * 100), positive, negative, score: 100 * positive / (positive + negative) };
  }
  function parseCSV(text, limit = 200) {
    let headers; const games = [], ids = new Set(); let invalid = 0, duplicates = 0, valid = 0;
    const parser = new CSVParser(row => {
      if (!headers) { headers = row.map(x => x.replace(/^\uFEFF/, '').trim().toLowerCase()); for (const key of ['name', 'price', 'positive', 'negative']) if (!headers.includes(key)) throw new Error('Coluna obrigatória ausente: ' + key); return; }
      const obj = Object.fromEntries(headers.map((h, i) => [h, row[i]])), game = normalize(obj);
      if (!game) { invalid++; return; } if (ids.has(game.id)) { duplicates++; return; }
      ids.add(game.id); valid++; if (games.length < limit) games.push(game);
    });
    parser.push(text); parser.end();
    if (!games.length) throw new Error('Nenhum jogo válido com avaliações no CSV.');
    return { games, invalid, duplicates, valid };
  }
  function evaluate(bits, games, budget) {
    let cost = 0, value = 0;
    bits.forEach((bit, i) => { if (bit) { cost += games[i].price; value += games[i].score; } });
    // Penalidade maior que qualquer soma possível: todo inviável tem fitness negativo.
    const penalty = cost > budget ? (100 * games.length + 1) * (1 + (cost - budget) / Math.max(1, budget)) : 0;
    return { bits, cost, value, fitness: value - penalty, feasible: cost <= budget };
  }
  function crossover(a, b, rng) {
    if (a.length < 2) return a.slice();
    const cut = 1 + Math.floor(rng() * (a.length - 1));
    return a.slice(0, cut).concat(b.slice(cut));
  }
  function mutate(bits, rate, rng) { return bits.map(bit => rng() < rate ? 1 - bit : bit); }
  function tournament(population, rng) {
    let best = population[Math.floor(rng() * population.length)];
    for (let i = 1; i < 3; i++) { const other = population[Math.floor(rng() * population.length)]; if (other.fitness > best.fitness) best = other; }
    return best.bits;
  }
  function greedy(games, budget) {
    const bits = games.map(() => 0); let cost = 0;
    games.map((g, i) => ({ ...g, i })).sort((a, b) => (b.score / Math.max(b.price, 0.001)) - (a.score / Math.max(a.price, 0.001))).forEach(g => { if (cost + g.price <= budget) { bits[g.i] = 1; cost += g.price; } });
    return evaluate(bits, games, budget);
  }
  function* evolve(games, config) {
    const { budget, populationSize, generations, mutationRate, crossoverRate, seed } = config;
    if (!games.length || !Number.isSafeInteger(budget) || budget < 0 || !Number.isInteger(populationSize) || populationSize < 2 || !Number.isInteger(generations) || generations < 1 || !Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 1 || !Number.isFinite(crossoverRate) || crossoverRate < 0 || crossoverRate > 1) throw new Error('Parâmetros inválidos.');
    const rng = random(seed);
    const totalCost = games.reduce((s, g) => s + g.price, 0);
    const probability = Math.min(0.5, budget / Math.max(totalCost, 1));
    let population = Array.from({ length: populationSize }, (_, i) => evaluate(games.map(g => i === 0 ? 0 : +(rng() < (g.price === 0 ? 0.5 : probability))), games, budget));
    for (let generation = 0; generation <= generations; generation++) {
      population.sort((a, b) => b.fitness - a.fitness || a.cost - b.cost);
      yield { generation, best: population[0], meanFitness: population.reduce((s, p) => s + p.fitness, 0) / population.length };
      if (generation === generations) break;
      const next = [population[0]]; // Elitismo: preserva o melhor sem mutação.
      while (next.length < populationSize) {
        const a = tournament(population, rng), b = tournament(population, rng);
        const child = rng() < crossoverRate ? crossover(a, b, rng) : a.slice();
        next.push(evaluate(mutate(child, mutationRate, rng), games, budget));
      }
      population = next;
    }
  }
  const api = { random, CSVParser, normalize, parseCSV, evaluate, crossover, mutate, tournament, greedy, evolve };
  if (typeof module !== 'undefined') module.exports = api; else root.SteamGA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
