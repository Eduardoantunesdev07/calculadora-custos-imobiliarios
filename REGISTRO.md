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

Selos do RS podem ser substituidos por valores confirmados em Ajustes do registro, uma secao recolhida por padrao. No PR, a prenotacao e calculada pela tabela, mas selos, fundos e ISS devem ser informados nessa secao enquanto nao houver parametros verificados. Campos em branco sao pendentes; zero so e valido se informado explicitamente. Os selos totais do PR aparecem em linha separada para evitar falsa distribuicao por ato. A mudanca de municipio limpa ISS e ajustes da cidade anterior. Certidoes e averbacoes adicionais nao fazem parte do modelo; use orcamento manual quando necessario.

O modo manual continua em Ajustes do registro e permite usar o valor total do cartorio. O resumo impresso inclui o detalhamento, as bases automaticas, a identificacao de selos ajustados e os parametros de ISS.

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
