# Demonstração para o professor — 18/09

O site funciona como demonstração. A tela principal contém a escolha do orçamento, dos pesos e dos jogos; as informações técnicas ficam nas áreas recolhíveis. Use tela cheia (F11) e, se necessário, zoom do navegador. Aumentar o zoom não altera o algoritmo.

## 1. Problema e objetivo — 1 minuto

“Queremos selecionar o melhor conjunto de jogos da Steam respeitando orçamento e/ou espaço em disco, maximizando uma pontuação conjunta de avaliações positivas, satisfação e horas médias jogadas. É uma variação do Problema da Mochila.”

Mostre o catálogo de **140.940 registros**. Explique que usamos todas as linhas, sem amostra; o mínimo de 100 avaliações por jogo, dados ausentes e restrições determinam os jogos elegíveis de cada busca.

## 2. Demonstração principal — 2 minutos

1. Informe orçamento de US$ 100 e mantenha os pesos em 5/5/5.
2. Para mostrar uma lista menor na projeção, desative **Incluir gratuitos**. Diga que isso é um filtro escolhido para a demonstração.
3. Clique em **Encontrar jogos** e mostre as capas, o custo e a nota conjunta de cada jogo (0 a 10).
4. Mude o orçamento para 50, repita e compare a seleção.
5. Volte a 100 e altere os pesos para 10/2/0. Explique que satisfação passa a ter mais importância, avaliações ainda contribuem e horas são desativadas. A seleção pode mudar.
6. Mostre que 0/0/0 exibe uma orientação para escolher ao menos um peso positivo; não ocorre divisão por zero. Restaure os pesos para continuar.

## 3. Modelagem — 2 minutos

Abra **Configurações avançadas** somente durante esta explicação.

“Cada indivíduo é uma biblioteca candidata. Cada jogo recebe 0 ou 1, indicando se entra. População 60 significa 60 combinações competindo; não limita o catálogo a 60 jogos. Uma geração é uma rodada. A semente permite repetir os mesmos sorteios.”

“A seleção usa torneio de três; crossover mistura partes de dois pais; mutação inverte escolhas. Preservamos o melhor por elitismo. O reparo remove jogos quando um descendente ultrapassa os limites. Paramos no número de gerações definido.”

Caso o professor pergunte sobre desempenho: “Representamos o vetor binário de forma esparsa, armazenando os índices selecionados. Todos os genes elegíveis continuam disponíveis para a evolução. O cálculo roda em segundo plano.”

## 4. Fitness e resultados — 2 minutos

Abra **Ver evolução e análise do resultado**.

“O fitness soma o valor dos jogos e penaliza o excesso de recursos. O verde mostra o melhor indivíduo; o azul mostra a média da população. A linha do melhor não cai porque existe elitismo. Ela pode ficar horizontal se não houver melhoria.”

Explique a nota: cada métrica é normalizada para 0 a 10 e a média ponderada usa os pesos escolhidos. O fitness soma as notas dos jogos, por isso o total da biblioteca pode ultrapassar 10. Compare o AG, a referência por valor/recurso e a melhor combinação inicial usando os mesmos pesos. Na validação 5/5/5 a referência gulosa foi superior ao AG; não há garantia de ótimo global.

## 5. Dados e limitações — 1 minuto

Abra **Sobre o projeto**.

“As capas e métricas vêm do dataset. Os preços são exibidos em dólares americanos (US$), sem conversão cambial nem consulta de preços ao vivo. O arquivo não informa espaço em disco; nosso sistema aceita dados complementares, mas não inventa tamanhos.”

Se houver CSV real com `app_id,size_gb`, importe-o e demonstre o limite. Caso contrário, apresente a restrição de orçamento, permitida pelo objetivo ‘e/ou’.

“Sem limite de disco, jogos gratuitos com valor positivo sempre ajudam no nosso objetivo. A soma das notas pode favorecer muitos jogos baratos. A normalização por máximos pode comprimir a contribuição de jogos menos populares. Horas médias não são uma previsão individual de diversão.”

## Preparação final

- Preencher os nomes completos dos integrantes.
- Ensaiar a sequência acima e manter as configurações desejadas antes de iniciar.
- Ter internet para as capas; o cálculo e os textos funcionam offline.
- Salvar a seleção JSON para registrar dados, parâmetros e resultado da demonstração.
- Não usar os resultados da antiga amostra de 80 jogos para descrever o catálogo atual.


## Exemplo de busca por tipo de jogo
Selecione RPG, Co-op e Open World para mostrar filtros combinados antes da otimização. Abra Todas as características em um cartão e mostre os sistemas compatíveis. A compatibilidade é informativa; o mínimo de 100 avaliações continua valendo.



