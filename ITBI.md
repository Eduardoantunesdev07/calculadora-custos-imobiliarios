# Padroes do ITBI

O calculo padrao e automatico, usando os dados da operacao. A aba ITBI permite mudar para valor informado manualmente. O resumo, os indicadores e a impressao usam o mesmo valor considerado. Trocar o municipio limpa ajustes manuais e o enquadramento de Curitiba.

## Padroes fornecidos pela RTx em 13/10/2026

| Municipio RS | Financiamento | FGTS | Recursos proprios | Limite combinado |
| --- | --- | --- | --- | --- |
| Porto Alegre | 0,5% | 0,5% | 3% | R$ 410.794,80 |
| Canoas | 0,5% | 3% | 3% | Sem limite |
| Novo Hamburgo | 1% | 2% | 2% | Sem limite |
| Sao Leopoldo | 0,5% | 0,5% | 2% | Sem limite |
| Alvorada | 1% | 3% | 3% | Sem limite |

Esses valores foram fornecidos pelo usuario como parametros da estimativa; nao representam uma certificacao independente da legislacao de cada municipio. Recursos proprios = compra - financiamento - FGTS - subsidio. O subsidio nao integra as parcelas tributadas desses padroes.

Em Porto Alegre, o limite e compartilhado pelo financiamento e FGTS, nunca aplicado duas vezes. O financiamento ocupa primeiro o limite, e o FGTS utiliza o saldo; ambos tem a mesma aliquota reduzida. O excedente aparece em linha separada, a 3%, sem alterar os valores originais da operacao ou a base da taxa bancaria.

Exemplo do usuario: compra R$ 700.000, financiamento R$ 500.000, FGTS R$ 50.000, sem subsidio. Base reduzida R$ 410.794,80, excedente R$ 139.205,20 e recursos proprios R$ 150.000. Imposto: R$ 2.053,97 + R$ 4.176,16 + R$ 4.500,00 = R$ 10.730,13.

## Curitiba

Fontes consultadas em 13/10/2026: [LC 148/2025, art. 1, alteracao do art. 11](https://legisladocexterno.curitiba.pr.gov.br/VisualizarHTML.aspx?id=454104) e [LC 108/2017, art. 9](https://mid.curitiba.pr.gov.br/2018/00217721.pdf).

Para imovel residencial edificado, financiado por pelo menos 10 anos e com garantia hipotecaria ou alienacao fiduciaria, a aliquota unica depende do valor venal total:

- Ate R$ 176.000: 0%.
- De R$ 176.000,01 ate R$ 205.000: 0,5%.
- De R$ 205.000,01 ate R$ 220.000: 1,6%.
- Fora dessas faixas ou condicoes: regra geral de 2,7%.

O usuario confirma o enquadramento na aba ITBI. Sem confirmacao, imovel financiado dentro das faixas reduzidas fica pendente, inclusive na faixa de isencao: nao presumimos imposto zero. Compra a vista ou valor acima de R$ 220 mil usam a regra geral. Outras isencoes especiais, como COHAB, nao sao modeladas; usar o valor manual quando aplicavel.

O valor venal pode ser informado nessa aba. Sem esse dado, o valor de compra e usado somente como referencia da estimativa, com observacao no detalhamento. A aliquota incide sobre a base inteira, sem progressividade; nao segue a separacao de parcelas de financiamento/FGTS usada no RS nem subtrai subsidio do valor venal.

## Precisao e manutencao

Valores e limites sao representados em centavos inteiros. Cada parcela de imposto e arredondada para centavos, com operacao inteira BigInt, e o total soma essas parcelas. O detalhamento mostra exatamente os valores somados; pode haver diferenca de centavos em relacao a sistemas que arredondem somente no final. Nao ha dependencia instalada nem consulta automatica externa.

Os padroes ficam em ITBI_PADROES e calcularITBI, no inicio de script.js. Atualizar limites, aliquotas e condicoes quando houver nova orientacao, mantendo a origem dos parametros. Executar `node teste-registro.cjs`, que agora verifica tanto registro quanto ITBI.
