# Steam Select

Seleção de um conjunto de jogos da Steam respeitando orçamento e/ou espaço em disco, para maximizar uma pontuação conjunta de avaliações positivas, satisfação e horas médias jogadas.

## Executar

Abra `index.html` no navegador. Não há instalação, servidor nem biblioteca externa. A busca funciona offline; as capas precisam de internet. Também funciona pelo Live Server do VS Code.

1. Informe o orçamento em US$ (dólares americanos).
2. Ajuste os três pesos de 0 a 10 e clique em **Encontrar jogos**.
3. Veja custo, valor, jogos e capas. A seleção contém somente jogos pagos.
4. Abra **Ver evolução e análise do resultado** durante a explicação ao professor.
5. **Salvar seleção** exporta a moeda USD, parâmetros, histórico, exclusões, dados selecionados e cromossomo completo em JSON.

## Catálogo completo

Fonte: [Steam Games Dataset — Hubert Sidorowicz](https://www.kaggle.com/datasets/hubertsidorowicz/steam-games-dataset-daily-updates), versão 54, baixada em 15/09/2026. Licença declarada pelo Kaggle: MIT.

- 140.940 registros processados, sem amostragem e sem limite de 80 ou 200 jogos.
- 139.710 registros com preço numérico não negativo; um deles não tem nome válido, portanto a otimização descarta 1.231 registros com dados básicos inválidos.
- 140.842 registros têm um endereço de imagem HTTPS; disponibilidade remota pode variar.
- Nenhum registro tem tamanho em disco no CSV original.
- O catálogo leve tem aproximadamente 55,7 MB: preserva todas as linhas, carregando somente os campos utilizados. O original permanece em `dados/steam_games.csv`, com aproximadamente 953 MB.

O algoritmo examina todas as linhas em cada busca. Um jogo só pode entrar na seleção se tiver pelo menos 100 avaliações totais (positivas + negativas); totais desconhecidos também ficam fora. Esse mínimo vale para qualquer combinação de pesos. Exclui jogos com dados necessários ausentes, valor zero para o objetivo, preço/tamanho individual acima do limite, duplicados ou gratuitos. A exclusão de gratuitos é obrigatória, inclusive no limite apenas de disco; eles também não entram na normalização, nas referências de comparação nem nas opções dos filtros. A interface informa os motivos e as quantidades. Paginar os cartões não limita os jogos da otimização.

Os valores numéricos do dataset são exibidos em dólares americanos (US$), sem conversão cambial ou consulta de preços ao vivo. A soma usa centavos inteiros. Campos ausentes permanecem desconhecidos, em vez de receber valores inventados.

## Espaço em disco

O limite de GB fica indisponível até importar um CSV real contendo `app_id,size_gb`, em **Configurações avançadas**. O identificador deve corresponder ao catálogo; use ponto como separador decimal, vírgula como separador de campos e tamanhos positivos em GB. Não foi incluído um arquivo de tamanhos inventados.

Ao ativar o limite, apenas jogos com tamanho informado podem participar. É possível usar orçamento, espaço ou ambos; pelo menos um limite deve estar ativo. Os tamanhos adicionados duram até recarregar a página e aparecem na exportação. Novas importações atualizam os identificadores presentes e preservam os demais tamanhos já adicionados.

## O que significam os parâmetros?

**População** é um conjunto de combinações candidatas. Exemplo: uma população de 60 compara 60 bibliotecas diferentes por geração. Não significa restringir o catálogo a 60 jogos.

**Geração** é uma rodada da evolução. **Semente aleatória** inicializa os sorteios: com os mesmos dados, filtros, parâmetros e versão do código, a mesma semente reproduz a execução. Alterar a semente permite comparar execuções diferentes. O número 42 é apenas um padrão escolhido.

**Crossover** controla a chance de misturar dois pais. **Alterações por combinação** define o número esperado de bits invertidos; a taxa por gene é esse número dividido pela quantidade de genes variáveis, limitada a 100%. Assim a mutação se adapta ao catálogo grande.

## Modelagem do AG

### Pontuação conjunta

O usuário define pesos de 0 a 10 para satisfação, avaliações positivas e horas médias. O padrão é 5/5/5. Cada jogo recebe três notas normalizadas:

- `S = 10 × positivas / (positivas + negativas)`.
- `A = 10 × positivas / máximo de positivas entre os jogos elegíveis`.
- `H = 10 × minutos médios / máximo de minutos médios entre os jogos elegíveis`.

`Nota = (pesoS × S + pesoA × A + pesoH × H) / (pesoS + pesoA + pesoH)`.

A nota de cada jogo fica entre 0 e 10. O AG maximiza a soma dessas notas na biblioteca; o total pode ultrapassar 10. Peso zero desativa o critério. Se todos forem zero, a interface e o motor pedem ao menos um peso positivo antes de calcular. Se um máximo for zero, a respectiva nota é zero, sem divisão por zero. Horas desconhecidas excluem o jogo apenas quando o peso de horas é positivo; o mínimo de 100 avaliações continua obrigatório.

Os máximos são calculados após os filtros e restrições individuais, antes de descartar notas zero. Mudar filtros ou limites pode alterar a escala; compare métodos dentro da mesma execução. A normalização linear pode comprimir notas de jogos menos populares quando existem valores extremos. A soma pode favorecer muitos jogos baratos; horas registradas não preveem diversão individual. Pesos e máximos de normalização, além das notas individuais, acompanham a exportação JSON.

### Cromossomo e população inicial

O cromossomo é logicamente binário: 1 inclui e 0 exclui. Internamente, o AG guarda somente os índices dos bits 1, uma representação esparsa do vetor, para evitar percorrer dezenas de milhares de zeros em cada operação. O JSON exporta o vetor binário de 140.940 posições, na ordem original do catálogo, incluindo zeros para registros inelegíveis.

Jogos gratuitos ficam fora da busca. Os jogos pagos elegíveis participam da evolução e consomem orçamento e/ou espaço em disco conforme os limites ativos.

A população começa com uma solução que contém apenas os jogos fixos, mais construções aleatórias viáveis. Metade visita os jogos em ordem embaralhada; metade usa uma ordenação por valor/recurso com aceitação aleatória. A estratégia gulosa pura é calculada separadamente como referência; não é apresentada como resultado do AG nem inserida diretamente na população.

### Fitness, seleção e operadores

- **Fitness:** soma do objetivo menos penalidade. Se houver excesso: `(valor máximo possível + 1) × (1 + excesso relativo de orçamento + excesso relativo de disco)`. Um inviável fica com fitness negativo.
- **Seleção:** torneio de três indivíduos com reposição.
- **Crossover:** corte em um ponto da sequência de genes variáveis; combina os bits antes/depois do corte.
- **Mutação:** inversão de bits, com saltos geométricos equivalentes a decisões de Bernoulli independentes por posição. Isso evita visitar todos os zeros.
- **Reparo:** depois da mutação, remove genes selecionados em ordem aleatória até atender aos limites. Isso mantém os descendentes viáveis.
- **Elitismo:** preserva o melhor indivíduo sem alteração.
- **Parada:** número configurado de gerações (150 por padrão).

O cálculo roda em um Web Worker, em segundo plano. O botão Cancelar encerra esse trabalho. Nenhum dado pessoal é enviado para um servidor.

## Resultados reais de validação

Mínimo de 100 avaliações por jogo, orçamento de US$ 100, somente jogos pagos, população 60, 150 gerações, 3 inversões esperadas, crossover 80%, semente 42:

| Pesos (satisfação / avaliações / horas) | Jogos elegíveis | Selecionados | Custo (US$) | Pontuação do AG |
|---|---:|---:|---:|---:|
| 10 / 0 / 0 | 18.968 | 103 | 99,98 | 979,18 |
| 0 / 10 / 0 | 18.968 | 14 | 99,86 | 53,54 |
| 0 / 0 / 10 | 7.118 | 15 | 99,85 | 50,62 |
| 5 / 5 / 5 | 18.968 | 103 | 99,98 | 326,59 |

Todos os resultados acima contêm apenas jogos pagos. O dataset original é preservado; os gratuitos são descartados antes do cálculo das notas e da otimização.

Nessas execuções, a melhor solução inicial permaneceu a melhor até o final e a referência gulosa obteve valores superiores em satisfação e avaliações positivas; em horas médias, o AG ficou acima. O gráfico mostra tanto melhor solução quanto média da população. Uma linha do melhor indivíduo horizontal é um resultado válido, não uma melhoria inventada. O AG não garante o ótimo global nem superar a estratégia gulosa.

Resultados completos: `resultados-catalogo.json`. Rode `node testes-catalogo.cjs` para validar e gerar novamente.

## Organização dos arquivos

- `index.html` e `style.css`: interface.
- `app.js`: controles, Worker, cartões, gráfico e exportação.
- `optimizer.js`: algoritmo genético.
- `ga.js`: leitura incremental de CSV.
- `catalogo.js`: catálogo completo preparado para o navegador.
- `preparar-catalogo.cjs`: reconstrói o catálogo lendo o original por partes; execute `node preparar-catalogo.cjs dados/steam_games.csv`.
- `testes-catalogo.cjs`: testes do modelo com exemplos pequenos e pesos isolados e combinados no catálogo inteiro.
- `roteiro.md`: apoio para a apresentação.
- `legado/`: arquivos da primeira versão com amostra, sem uso na página atual.

## Entrega do tema

**Integrantes:** preencher os nomes completos (até cinco).

**Título:** Seleção otimizada de jogos da Steam com Algoritmo Genético.

**Descrição:** Selecionar jogos respeitando orçamento e/ou espaço em disco para maximizar uma pontuação conjunta de avaliações positivas, satisfação e horas médias jogadas, com interface HTML para demonstrar o AG e seus resultados.


## Busca por características

Gênero, categoria/recurso e tag/estilo usam todas as opções encontradas no catálogo. Filtros preenchidos são combinados com E: o jogo deve atender a todos antes de participar do AG. Deixar uma opção em Todos não restringe essa característica. Os termos mantêm os nomes da fonte.

Os cartões exibem gêneros e compatibilidade Windows/macOS/Linux; o detalhe Todas as características mostra todas as categorias e tags registradas, sem limitar a lista. Compatibilidade é apenas informativa e não filtra a busca. Valores desconhecidos são identificados. Apenas a capa é exibida, sem galeria ou vídeos. As características e plataformas também acompanham a exportação JSON.


## Exclusão por tags
Jogos com a tag NSFW ou Hentai não participam de nenhuma busca, objetivo ou referência de comparação. A regra ignora diferenças de maiúsculas/minúsculas e espaços nas extremidades. Esses jogos também não alimentam as opções de filtros. O arquivo original é preservado; 1.423 registros são excluídos por esta regra no catálogo atual.


