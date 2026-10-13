# Calculo local do registro

O projeto usa HTML, CSS e JavaScript, sem dependencias. Abra index.html.
As tabelas ficam em REGISTRO_TABELAS, no inicio de script.js.
Os selos RS ficam em SELOS_RS. O parametro de ISS informado fica em ISS_INFORMADO.

## Interface e identidade visual

A tela usa a paleta preta, vermelha e branca da referencia RTx. O arquivo logo-rtx.jpeg foi copiado do logo original indicado pelo usuario, sem modificar a imagem. O enquadramento de exibicao e feito por CSS.

Os dados da operacao ficam ao lado das abas Resumo, ITBI, Registro e Taxas e despachante. Os indicadores superiores e o resumo usam os mesmos valores calculados. A troca de aba preserva os campos. Modificacoes nos campos invalidam resultados e auditorias anteriores ate novo calculo.

A aba ITBI calcula os padroes fornecidos pela RTx e mostra bases, aliquotas e imposto por parcela; permite tambem informar o valor manualmente. As regras e fontes do ITBI estao em ITBI.md. Registro mostra os atos e parametros existentes. Taxas apresenta a referencia bancaria, o valor sugerido, o valor utilizado e os ajustes; o despachante tem sua referencia e valor utilizado. A impressao inclui as conferencias de todas as abas, mesmo quando outra aba esta selecionada. Nao ha historico ou organizacao por atrasos nesta versao.

## Fontes e revisao

- RS: [Tabela oficial TJRS 2026](https://www.tjrs.jus.br/static/2025/12/Tabela_de_Emolumentos_2026.pdf), paginas 7 a 9, item 1 do Registro de Imoveis.
- PR: [Tabela oficial TJPR, Lei 21.869/2023](https://extrajudicial.tjpr.jus.br/documents/d/foro-extrajudicial/lei-e-tabela-atualizada-2024-publicada-10-pdf), paginas 5 a 7, Tabela XIII. A [pagina de emolumentos do TJPR](https://extrajudicial.tjpr.jus.br/emolumentos) identifica essa lei como vigente na consulta de 13/10/2026.
- Garantia urbana no PR: IN 2/2008, conforme [Oficio Circular 13/2022 do TJPR](https://portal.tjpr.jus.br/publicacao_documentos/materias/ajax.do?tjpr.url.crypto=8a6c53f8698c7ff7801c49a82351569545dd27fb68d84af89c7272766cd6fc9fcbbde39ae42d211d8b613388c52df4458bf440087b6b30641a2fb19108057b53eef286ec70184c6e) e [acordao do TJPR](https://portal.tjpr.jus.br/jurisprudencia/j/2100000020427151/Ac%C3%B3rd%C3%A3o-0031664-54.2021.8.16.0014).
- Selos RS: [Provimento 80/2025-CGJ, vigente desde 01/01/2026](https://colegioregistralrs.org.br/img/midias/08038-3-4.pdf). Os registros com emolumentos acima de R$ 70 usam o valor do ato; o processamento usa a faixa do seu emolumento.
- SFH: [art. 290 da Lei 6.015/1973](https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm): reducao de 50% dos emolumentos na primeira aquisicao residencial financiada pelo SFH.

Revisado em 13/10/2026. Revisar novamente ate 31/12/2026, ou antes se houver mudanca normativa. A data e um prazo interno de revisao, nao uma afirmacao de revogacao da tabela. Depois desse prazo, o modo automatico deixa o registro pendente. O modo manual continua disponivel.

## Escopo e dados necessarios

Compra de um unico imovel urbano, a vista ou com alienacao fiduciaria. Outros titulos, imoveis rurais, hipoteca, multiplas matriculas e atos especiais exigem o valor informado pelo cartorio.

A pedido do usuario, a base estimada do registro e sempre o valor de compra do imovel, e a divida e sempre o valor financiado pelo banco. Nao existem perguntas adicionais para esses valores. FGTS e subsidio nao sao somados a divida. Essa escolha e uma aproximacao: se a avaliacao fiscal ou o titulo exigirem outro valor, usar o modo manual com orcamento do cartorio.

O calculo procura a faixa da base e aplica seu valor fixo integral, sem acumular faixas. Calcula separadamente aquisicao e garantia. No RS usa o item 1 para cada registro. No PR aplica 50% da faixa da divida a garantia urbana. Acima da ultima faixa usa o valor maximo da tabela. No PR, os limites cadastrados sao os da coluna em reais, nao os numeros em VRCext. CPC ja esta incluida nos valores publicados.

Na secao principal do registro existem somente tipo de contrato e o checkbox de 1a aquisicao SFH. Esse beneficio reduz os emolumentos em 50%, inclusive processamento RS e prenotacao PR. Nao reduz automaticamente os selos; o enquadramento deve ser confirmado pelo responsavel. Compra sem financiamento nao permite marcar SFH. O beneficio nao e inferido pelo banco, MCMV ou FGTS.

O antigo campo generico de complementos foi removido. No RS, cada registro gera processamento de R$ 7,30 e selo do processamento de R$ 2,20. Os selos de compra e garantia seguem as faixas oficiais. O detalhamento mostra emolumento, selo e subtotal por ato, subtotais gerais, ISS e total.

Porto Alegre tem o percentual efetivo de repasse do ISS de 5,26%, informado pelo usuario em 13/10/2026. Trata-se de parametro de estimativa, nao aliquota municipal verificada nem calculo exato de gross-up. Aplica o percentual informado diretamente sobre os emolumentos, arredondando em centavos. Nenhum outro municipio recebe esse parametro por presuncao. ISS desconhecido fica pendente, e o total vira subtotal.

Selos do RS podem ser substituidos por valores confirmados em Ajustes do registro, uma secao recolhida por padrao. Curitiba/PR agora possui padrao automatico para os adicionais abaixo. Campos de ajuste vazios usam o padrao; zero informado substitui a cobranca. Os selos totais do PR aparecem em linha separada para evitar falsa distribuicao por ato. A mudanca de municipio limpa ISS e ajustes da cidade anterior. Fora de Curitiba, adicionais do PR sem parametros continuam pendentes. Certidoes, buscas, arquivamentos e averbacoes adicionais nao fazem parte do modelo; use orcamento manual quando necessario.

## Referencia da calculadora do cartorio

Em 13/10/2026 o usuario encaminhou uma imagem com compra de R$ 200.000,00, financiamento de R$ 160.000,00 e total R$ 2.695,31. A composicao mostrada passou a ser a referencia dos adicionais de Curitiba: uma prenotacao e um arquivamento (R$ 1,94), com taxa judiciaria de 25% em cada um desses dois atos menores, arredondada por ato. Essa taxa e separada do FUNREJUS de 0,2% sobre a compra.

O usuario confirmou a origem: [Calculadora de Emolumentos RIB](https://www.registrodeimoveis.org.br/calculadora). Em 13/10/2026, uma consulta publica de Curitiba, compra R$ 200.000 e financiamento R$ 160.000, consulta 2, sem descontos, retornou exatamente os itens e o total da imagem. Nao usamos API privada nem implementamos integracao: as consultas pontuais de verificacao foram feitas pelo formulario publico.

Comparacoes em R$ 10.000, R$ 15.512, R$ 15.512,01, R$ 20.000, R$ 50.000, R$ 56.000, R$ 58.000, R$ 60.000 e R$ 100.000 confirmaram o comportamento do modelo local de compatibilidade. O site continua as faixas com limites R$ 57.062 / R$ 59.832 / R$ 62.602 e emolumentos R$ 1.255,36 / R$ 1.316,30 / R$ 1.377,24. Esses valores adicionais aparecem na Tabela XI, nao na Tabela XIII do PDF oficial consultado. A associacao das faixas intermediarias e uma inferencia do modelo de compatibilidade, apoiada nas respostas verificadas e na tabela publicada, nao afirmacao de que a RIB publique sua tabela interna nem certificacao da regra legal.

Nas consultas verificadas, a garantia foi metade do emolumento da compra, inclusive quando o financiamento foi mudado para R$ 1.000. Esse comportamento e diferente de calcular a faixa pela divida. REGISTRO_REFERENCIA_RIB separa esse padrao observado da REGISTRO_TABELAS.PR, que foi preservada. Curitiba usa RIB por padrao; Ajustes do registro permite escolher a Tabela XIII TJPR cadastrada. O detalhamento identifica a referencia e a base da garantia. Valores integrais individuais ainda podem ser ajustados antes do desconto SFH.

A resposta RIB informa UPF de abril/2024, R$ 139,79, no teto de 53 UPF. O projeto nao copia esse indice antigo: mantem UPF de outubro/2026, R$ 152,25. Valores altos podem, portanto, diferir. A comparacao externa foi realizada sem descontos; o SFH do projeto preserva as premissas de desconto registradas abaixo, nao implica validacao de todos os beneficios da calculadora externa.

Com esses ajustes: emolumentos R$ 2.070,57; FUNDEP R$ 103,53; selos R$ 16,50; taxa de 25% dos atos menores R$ 1,18; subtotal R$ 2.191,78; FUNREJUS R$ 400,00; ISS R$ 103,53; total R$ 2.695,31. Teste de regressao confere cada celula e o total.

## Adicionais automaticos de Curitiba/PR

- Selos FUNARPEN: R$ 8,00 por registro acima de R$ 32,00 de emolumentos (R$ 1,00 para ato pequeno) e R$ 0,25 pela prenotacao e pelo arquivamento. [IN 019/2023, tipos 512, 529 e 532](https://www.funarpen.com.br/funarpen/arquivos/INSTRUCAO_NORMATIVA_N_019-2023v3.pdf). O modelo contabiliza um registro de compra, outro de garantia se houver financiamento, uma prenotacao e um arquivamento. Atos adicionais exigem ajuste.
- FUNDEP: 5% dos emolumentos calculados, apos desconto SFH, sem selos, FUNREJUS ou ISS na base. [LC estadual 136/2011, art. 230, XII e paragrafo 2](https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=60033&tipoVisualizacao=compilado). Campo de ajuste substitui esse valor.
- FUNREJUS: 0,2% do valor de compra, limitado a 53 UPF/PR; nao soma financiamento, FGTS ou subsidio novamente. [Lei 12.216/1998, art. 3, VII](https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=exibir&codAto=1710&tipoVisualizacao=compilado). Base de compra e uma referencia estimada; a guia pode exigir outra avaliacao. Nao presume isencao pelo ITBI estimado ou pelo desconto SFH. O valor confirmado ou zero de isencao pode ser informado no ajuste.
- UPF/PR de outubro/2026: R$ 152,25, verificada em 13/10/2026 na [consulta oficial da ReceitaPR](https://www.arinternet.pr.gov.br/outros/_c_indice2.asp?eUser=&eDetalhe=UPF%2FPR&eMesini=202610&eMesfim=202610). Teto de FUNREJUS: R$ 8.069,25. Cadastro mensal em CURITIBA_REGISTRO.upfPorMes. Em outro mes, sem UPF cadastrada nem ajuste, FUNREJUS fica pendente; nao reutiliza silenciosamente o teto vencido.
- ISS: estimativa padrao de 5% sobre emolumentos, conforme a imagem fornecida pelo usuario. Nao e afirmado como aliquota municipal verificada: a [LC municipal 40/2001, arts. 4 e 13-B](https://legisladocexterno.curitiba.pr.gov.br/VisualizarHTML.aspx?id=41) consultada indica 4% para servicos cartorarios. Preservamos 5% como parametro ajustavel de comparacao com a referencia, aplicado diretamente, sem gross-up. A base nao soma selos, FUNDEP, FUNREJUS ou taxa judiciaria.

FUNREJUS aparece no rodape separado, somado uma unica vez ao registro. FUNDEP e taxa dos atos menores aparecem em colunas por ato; arredondamento feito por ato para reproduzir a imagem. Ajustes agregados de FUNDEP e selos aparecem em linhas proprias, substituindo as respectivas colunas dos atos sem duplicar despesas. Valores sao estimativas com premissas visiveis, nao orcamento vinculante. Sem ajustes, compra de R$ 200 mil e financiamento de R$ 160 mil, sem desconto: padrao RIB R$ 2.695,31; opcao Tabela XIII TJPR R$ 2.393,66. Nenhuma tabela oficial foi substituida para obter essa correspondencia.

O modo manual continua em Ajustes do registro e permite usar o valor total do cartorio, incluindo FUNREJUS quando devido. Nesse modo nao somamos ajustes adicionais. O resumo impresso e compacto: banco/modalidade, cidade/UF, despesas e total ou subtotal, data e observacao de confirmacao. O detalhamento fica somente nas abas da tela.

## Exemplo de comparacao

Para compra de R$ 200 mil, financiamento de R$ 160 mil, sem beneficio e ISS informado de 5,26%:

- Emolumentos dos dois registros: R$ 1.928,80; processamento: R$ 14,60.
- Selos oficiais 2026: R$ 80,80 por registro, mais R$ 4,40 do processamento.
- ISS estimado: R$ 102,22; total do registro: R$ 2.211,62.

A imagem fornecida pelo usuario mostra selos de R$ 59,80 por registro, diferindo das faixas oficiais para esses valores de ato. Quando esses dois valores forem confirmados pelo cartorio e informados nos ajustes, o projeto reproduz o total da imagem, R$ 2.169,62. Nao trata R$ 59,80 como valor padrao universal.

## Atualizacao periodica

1. Conferir as paginas oficiais de TJRS e TJPR, selos RS e normas de beneficios e garantia urbana.
2. Atualizar faixas, teto e regras, preservando limites inclusivos e valores em reais.
3. Atualizar fonte, versao, revisadoEm e revisarAte de cada estado. Revisar separadamente parametros de ISS com o cartorio e registrar a origem de cada parametro.
4. Executar `node teste-registro.cjs` e verificar exemplos nos cartorios.

A revisao das tabelas e manual: o aplicativo nao baixa PDFs nem consulta a API. A verificacao de prazo ocorre em cada calculo. Testes locais nao substituem confirmacao do enquadramento e do valor final pelo cartorio.
