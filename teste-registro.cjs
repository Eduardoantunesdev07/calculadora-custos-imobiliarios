const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { REGISTRO_TABELAS, SELOS_RS, emolumentoPorFaixa, seloRS, calcularRegistro, calcularITBI, parseMoneyInput, formatMoneyInput } = require("./script.js");
const data = new Date(2026, 9, 13);
const operation = (extra = {}) => ({ uf: "RS", base: 20000000, divida: 16000000, issPercentual: 5.26, data, ...extra });

test("Moeda: interpreta reais, centavos, colagem e campos vazios", () => {
  for (const [input, cents] of [["200000",20000000],["200.000,00",20000000],["R$ 200.000,50",20000050],["1200,5",120050],["59.80",5980],["0,01",1],["0",0],["",null]]) {
    assert.equal(parseMoneyInput(input),cents);
    assert.equal(parseMoneyInput(formatMoneyInput(cents)),cents);
  }
  assert.equal(formatMoneyInput(20000000),"200.000,00");
  assert.equal(formatMoneyInput(0),"0,00");
  assert.equal(formatMoneyInput(null),"");
  assert.equal(parseMoneyInput(formatMoneyInput(Number.MAX_SAFE_INTEGER)),Number.MAX_SAFE_INTEGER);
});

test("Moeda: rejeita negativos, texto, casas decimais extras e excesso", () => {
  for (const input of ["-1","abc","1,234","0.001","1e6","90.071.992.547.409,92"]) {
    assert.throws(()=>parseMoneyInput(input));
  }
});

for (const uf of ["RS", "PR"]) {
  test(`${uf}: limites inclusivos, transicao de um centavo e teto`, () => {
    const table = REGISTRO_TABELAS[uf];
    for (const [index, [limit, cost]] of table.faixas.entries()) {
      const cents = Math.round(limit * 100);
      assert.equal(emolumentoPorFaixa(uf, cents), Math.round(cost * 100));
      const next = table.faixas[index + 1]?.[1] ?? table.teto;
      assert.equal(emolumentoPorFaixa(uf, cents + 1), Math.round(next * 100));
    }
    assert.equal(emolumentoPorFaixa(uf, 1000000000), Math.round(table.teto * 100));
  });
}

test("Selos RS: faixas por valor do ato e selo do processamento", () => {
  for (const [index, [limit, price]] of SELOS_RS.atos.entries()) {
    const cents = Math.round(limit * 100);
    assert.equal(seloRS(cents, 106420), Math.round(price * 100));
    const next = SELOS_RS.atos[index + 1]?.[1] ?? SELOS_RS.teto;
    assert.equal(seloRS(cents + 1, 106420), Math.round(next * 100));
  }
  assert.equal(seloRS(0, 730), 220);
  assert.equal(seloRS(20000000, 106420), 8080);
  assert.equal(seloRS(16000000, 86460), 8080);
});

test("Exemplo: emolumentos, processamento, selos 2026 e ISS informado", () => {
  const result = calcularRegistro(operation());
  assert.equal(result.compra, 106420);
  assert.equal(result.garantia, 86460);
  assert.equal(result.processamento, 1460);
  assert.equal(result.emolumentos, 194340);
  assert.equal(result.selos, 16600);
  assert.equal(result.subtotal, 210940);
  assert.equal(result.iss, 10222);
  assert.equal(result.total, 221162);
  assert.equal(result.completo, true);
  assert.equal(result.linhas.length, 3);
});

test("Ajustes dos selos reproduzem o total informado na imagem", () => {
  const result = calcularRegistro(operation({ seloCompra: 5980, seloGarantia: 5980 }));
  assert.equal(result.selos, 12400);
  assert.equal(result.total, 216962);
  assert.match(result.linhas[0].descricao, /ajustado/);
});

test("SFH reduz emolumentos e processamento e exige financiamento", () => {
  const result = calcularRegistro(operation({ sfh: true }));
  assert.equal(result.compra, 53210);
  assert.equal(result.garantia, 43230);
  assert.equal(result.processamento, 730);
  assert.equal(result.selos, 16600);
  assert.equal(result.total, 118881);
  assert.throws(() => calcularRegistro(operation({ sfh: true, divida: 0 })));
});

test("Compra a vista gera um registro e um processamento", () => {
  const result = calcularRegistro(operation({ divida: 0, issPercentual: 0 }));
  assert.equal(result.garantia, 0);
  assert.equal(result.processamento, 730);
  assert.equal(result.iss, 0);
  assert.equal(result.total, 115450);
});

test("ISS desconhecido nao vira zero e deixa a estimativa parcial", () => {
  const result = calcularRegistro(operation({ issPercentual: null }));
  assert.equal(result.iss, null);
  assert.equal(result.total, 210940);
  assert.equal(result.completo, false);
  assert.deepEqual(result.pendencias, ["ISS do registro"]);
});

test("PR: garantia a 50%, prenotacao e taxas desconhecidas pendentes", () => {
  const result = calcularRegistro(operation({ uf: "PR", issPercentual: null }));
  assert.equal(result.compra, 119442);
  assert.equal(result.garantia, 59721);
  assert.equal(result.prenotacao, 277);
  assert.equal(result.total, 179440);
  assert.equal(result.selos, null);
  assert.equal(result.completo, false);
  assert.equal(result.pendencias.length, 3);
  const completed = calcularRegistro(operation({ uf: "PR", selosPR: 1000, fundosPR: 20000 }));
  assert.equal(completed.total, 209879);
  assert.equal(completed.completo, true);
  const sfh = calcularRegistro(operation({ uf: "PR", sfh: true, selosPR: 0, fundosPR: 0, issPercentual: 0 }));
  assert.equal(sfh.prenotacao, 139);
  assert.equal(sfh.total, 89721);
});

test("Dados ausentes, outros atos e tabelas vencidas ficam pendentes", () => {
  for (const extra of [{base:null}, {divida:null}, {contrato:"outro"}, {data:new Date(2027,0,1)}]) {
    const result = calcularRegistro(operation(extra));
    assert.equal(result.total, null);
    assert.equal(result.completo, false);
  }
  assert.equal(calcularRegistro(operation({data:new Date(2026,11,31)})).total,221162);
});

test("Rejeita valores e percentuais invalidos", () => {
  for (const extra of [{uf:"SP"}, {base:0}, {base:-1}, {base:1.5}, {divida:-1}, {divida:20000001}, {seloCompra:-1}, {fundosPR:-1}, {issPercentual:-1}, {issPercentual:101}, {issPercentual:NaN}]) {
    assert.throws(() => calcularRegistro(operation(extra)));
  }
});

function page(itbiMode = "manual") {
  class Element {
    constructor(id = "") { this.id=id; this.value=""; this.textContent=""; this.children=[]; this.hidden=false; this.checked=false; this.validity={badInput:false}; this.listeners={}; this.attributes={}; this.focused=false; }
    get valueAsNumber() { return this.value === "" ? NaN : Number(this.value); }
    get selectedOptions() { return this.children.filter(child=>child.value === this.value); }
    replaceChildren(...children) { this.children=children; if (["municipio","modalidade"].includes(this.id)) this.value=children[0]?.value || ""; }
    append(...children) { this.children.push(...children); }
    addEventListener(type,handler) { this.listeners[type]=handler; }
    setAttribute(name,value) { this.attributes[name]=String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    setSelectionRange(start,end) { this.selectionStart=start; this.selectionEnd=end; }
    focus() { this.focused=true; }
  }
  const html = fs.readFileSync("index.html","utf8");
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element(match[1])]));
  const defaults = {uf:"RS",banco:"caixa",compra:"200000",financiado:"160000",fgts:"30000",subsidio:"10000",despachante:"1200","registro-modo":"automatico","registro-contrato":"urbano","itbi-modo":itbiMode};
  for (const [id,value] of Object.entries(defaults)) elements[id].value=value;
  elements.banco.children=Object.entries({caixa:"Caixa",itau:"Itaú",santander:"Santander",bradesco:"Bradesco"}).map(([value,textContent])=>({value,textContent}));
  let prints=0;
  const windowListeners={};
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [2026,9,13,12])); } }
  const context = vm.createContext({Date:FixedDate,Intl,document:{getElementById:id=>elements[id],createElement:()=>new Element()},Option:function(text,value){this.textContent=text;this.value=value;},window:{addEventListener(type,handler){windowListeners[type]=handler;},print(){prints++;}}});
  vm.runInContext(fs.readFileSync("script.js","utf8"),context);
  return {html,elements,windowListeners,calculate() {elements.estimador.listeners.submit({preventDefault(){}});return elements.erro.hidden;},set(id,value,type="input") {elements[id].value=String(value);elements[id].setSelectionRange(String(value).length,String(value).length);elements.estimador.listeners[type]({target:elements[id]});},check(id,value) {elements[id].checked=value;elements.estimador.listeners.change({target:elements[id]});},prints:()=>prints};
}

test("Impressao compacta: banco, modalidade, cidade e custos atualizados em qualquer aba", () => {
  const p=page("automatico");p.set("modalidade","sbpe","change");
  p.elements["tab-registro"].listeners.click();
  p.elements.imprimir.listeners.click();
  assert.equal(p.prints(),1);
  const rows=p.elements["impressao-operacao"].children;
  assert.equal(rows.length,2);
  assert.equal(rows[0].children[0].textContent,"Banco e modalidade");
  assert.equal(rows[0].children[1].textContent,"Caixa / SBPE");
  assert.equal(rows[1].children[0].textContent,"Cidade/UF");
  assert.equal(rows[1].children[1].textContent,"Porto Alegre / RS");
  assert.equal(p.elements["despesas-resumo"].children.length,4);
  assert.equal(p.elements.total.textContent,new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(5316.62));
  assert.equal(p.elements["pane-registro"].hidden,false);
  p.set("municipio","Canoas","change");p.set("banco","santander","change");
  p.windowListeners.beforeprint();
  const updated=p.elements["impressao-operacao"].children;
  assert.match(updated[0].children[1].textContent,/Santander/);
  assert.equal(updated[1].children[1].textContent,"Canoas / RS");
  assert.match(p.elements["total-label"].textContent,/Subtotal/);
  assert.match(p.elements.pendencias.textContent,/ISS/);
  assert.ok(p.elements["data-resumo"].textContent);
});

test("Impressao compacta: CSS mostra somente Resumo e oculta os dados completos", () => {
  const css=fs.readFileSync("style.css","utf8");
  const print=css.slice(css.indexOf("@media print"));
  assert.match(print,/\.tab-panel, \.tab-panel\[hidden\] \{ display: none !important;/);
  assert.match(print,/#pane-resumo, #pane-resumo\[hidden\] \{ display: block !important;/);
  assert.match(print,/\.operation-summary, #taxa-resumo/);
  assert.match(print,/\.summary-columns \{ display: block;/);
  assert.match(css,/\.print-only \{ display: none;/);
  assert.match(print,/\.print-only \{ display: block;/);
});

// Simula a edicao nativa entre beforeinput e input, incluindo a selecao do cursor.
function editMoney(p,id,inputType,data=null) {
  const field=p.elements[id];
  let prevented=false;
  p.elements.estimador.listeners.beforeinput({target:field,inputType,data,preventDefault(){prevented=true;}});
  if (prevented) return;
  let start=field.selectionStart ?? field.value.length;
  let end=field.selectionEnd ?? start;
  let replacement=data ?? "";
  if (inputType.startsWith("delete")) {
    replacement="";
    if (start===end && inputType==="deleteContentBackward") start=Math.max(0,start-1);
    else if (start===end && inputType==="deleteContentForward") end=Math.min(field.value.length,end+1);
  }
  field.value=field.value.slice(0,start)+replacement+field.value.slice(end);
  field.setSelectionRange(start+replacement.length,start+replacement.length);
  p.elements.estimador.listeners.input({target:field});
}

test("Moeda na pagina: digita duzentos mil reais e edita centavos sem deslocar o cursor", () => {
  const p=page();p.set("compra","");
  for (const digit of "200000") editMoney(p,"compra","insertText",digit);
  assert.equal(p.elements.compra.value,"200.000,00");
  assert.equal(p.elements.compra.selectionStart,7);
  editMoney(p,"compra","insertText",",");
  for (const digit of "50") editMoney(p,"compra","insertText",digit);
  assert.equal(p.elements.compra.value,"200.000,50");
  editMoney(p,"compra","insertText","9");
  assert.equal(p.elements.compra.value,"200.000,50");
  p.elements.compra.setSelectionRange(0,1);
  editMoney(p,"compra","insertText","3");
  assert.equal(p.elements.compra.value,"300.000,50");
  assert.equal(p.elements.compra.selectionStart,1);
});

test("Moeda na pagina: colagem, limpeza, zero e percentual sem mascara", () => {
  const p=page();p.elements.compra.setSelectionRange(0,p.elements.compra.value.length);
  editMoney(p,"compra","insertFromPaste","R$ 250.000,75");
  assert.equal(p.elements.compra.value,"250.000,75");
  p.set("itbi",6000);assert.equal(p.calculate(),true);
  p.elements.itbi.setSelectionRange(0,p.elements.itbi.value.length);
  editMoney(p,"itbi","deleteContentBackward");
  assert.equal(p.elements.itbi.value,"");
  assert.equal(p.calculate(),true);
  assert.match(p.elements.pendencias.textContent,/ITBI/);
  editMoney(p,"itbi","insertText",",");
  assert.equal(p.elements.itbi.value,"0,00");
  assert.equal(p.elements.resultado.hidden,true);
  assert.equal(p.calculate(),true);
  assert.doesNotMatch(p.elements.pendencias.textContent,/ITBI/);
  p.set("registro-iss",5.26);
  assert.equal(p.elements["registro-iss"].value,"5.26");
});

test("Moeda na pagina: todos os valores usam virgula, sem mudar o calculo", () => {
  const p=page("automatico");
  for (const id of ["compra","financiado","fgts","subsidio","itbi","registro","taxa","despachante","registro-selo-compra","registro-selo-garantia","registro-selos-pr","registro-fundos-pr","itbi-venal"]) {
    assert.equal(p.elements[id].type,"text");
    assert.equal(p.elements[id].inputMode,"decimal");
  }
  p.set("compra","700.000,00");p.set("financiado","500.000,00");p.set("fgts","50.000,00");p.set("subsidio","0,00");
  assert.equal(p.elements.itbi.value,"10.730,13");
  assert.equal(p.elements.taxa.value,"7.500,00");
  assert.equal(p.calculate(),true);
  p.set("taxa","-1");assert.equal(p.calculate(),false);
});

test("Pagina simplificada: nao pede bases ou complementos, usa valores da operacao", () => {
  const p=page();
  assert.equal(p.elements["registro-base"],undefined);
  assert.equal(p.elements["registro-divida"],undefined);
  assert.equal(p.elements["registro-extras"],undefined);
  assert.match(p.html,/<details id="registro-ajustes"/);
  assert.equal(p.elements.registro.value,"2.211,62");
  p.set("compra",300000);p.set("financiado",200000);
  assert.equal(p.elements.registro.value,"2.893,39");
  p.set("fgts",40000);p.set("subsidio",20000);
  assert.equal(p.elements.registro.value,"2.893,39");
});

test("Pagina: tabela, resumo e impressao usam o mesmo total", () => {
  const p=page();p.set("itbi",6000);
  assert.equal(p.calculate(),true);
  assert.equal(p.elements["total-label"].textContent,"Total estimado");
  assert.equal(p.elements.total.textContent,new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(11811.62));
  assert.equal(p.elements["registro-linhas"].children.length,3);
  assert.equal(p.elements["registro-detalhes"].hidden,false);
  p.elements.imprimir.listeners.click();assert.equal(p.prints(),1);
});

test("Pagina: municipio muda ISS e limpa ajustes para nao reaproveitar outra cidade", () => {
  const p=page();p.set("registro-selo-compra",59.80);
  p.set("municipio","Canoas","change");
  assert.equal(p.elements["registro-iss"].value,"");
  assert.equal(p.elements["registro-selo-compra"].value,"");
  assert.equal(p.elements.registro.value,"2.109,40");
  p.set("itbi",6000);assert.equal(p.calculate(),true);
  assert.match(p.elements.pendencias.textContent,/ISS/);
  assert.equal(p.elements["total-label"].textContent,"Subtotal das despesas informadas");
  p.set("registro-iss",0);assert.equal(p.calculate(),true);
  p.set("itbi",6000);assert.equal(p.calculate(),true);
  assert.equal(p.elements["total-label"].textContent,"Total estimado");
});

test("Pagina: desconto SFH pode ser marcado e desmarcado em RS e PR", () => {
  const p=page();p.check("registro-sfh",true);
  assert.equal(p.elements.registro.value,"1.188,81");
  p.check("registro-sfh",false);
  assert.equal(p.elements.registro.value,"2.211,62");
  p.set("uf","PR","change");
  assert.equal(p.elements.municipio.value,"Curitiba");
  p.check("registro-sfh",true);
  assert.equal(p.elements.registro.value,"897,21");
  p.check("registro-sfh",false);
  assert.equal(p.elements.registro.value,"1.794,40");
});

test("Pagina: taxa bancaria, despachante e modo manual continuam funcionando", () => {
  const p=page();
  assert.equal(p.elements.taxa.value,"2.400,00");
  p.set("modalidade","sbpe","change");assert.equal(p.elements.taxa.value,"955,00");
  for (const [bank,fee] of [["itau","1.950,00"],["santander","1.850,00"],["bradesco","2.114,00"]]) {p.set("banco",bank,"change");assert.equal(p.elements.taxa.value,fee);}
  p.set("taxa",1700);p.set("despachante",850);p.set("compra",250000);
  assert.equal(p.elements.taxa.value,"1.700,00");assert.equal(p.elements.despachante.value,"850,00");
  p.set("registro-modo","manual","change");assert.equal(p.elements.registro.value,"");
  p.set("registro",4200);p.set("itbi",6000);assert.equal(p.calculate(),true);
  assert.equal(p.elements["registro-detalhes"].hidden,true);
  p.set("registro-modo","automatico","change");assert.equal(p.elements.registro.readOnly,true);
  p.set("registro-modo","manual","change");assert.equal(p.elements.registro.value,"4.200,00");
});

test("Pagina: validacoes, limpeza e notas de ajustes", () => {
  const p=page();
  p.set("registro-iss",101);assert.equal(p.calculate(),false);
  p.set("registro-iss",7);p.set("registro-selo-compra",-1);assert.equal(p.calculate(),false);
  p.set("registro-selo-compra","");p.set("itbi",6000);assert.equal(p.calculate(),true);
  assert.match(p.elements["registro-observacao"].textContent,/7% informado/);
  p.set("compra",0);assert.equal(p.calculate(),false);
  assert.equal(p.elements["registro-detalhes"].hidden,true);
  assert.equal(p.elements.imprimir.disabled,true);
});

test("Abas: alterna a conferencia sem perder os campos ou o resultado", () => {
  const p=page();p.set("itbi",6000);assert.equal(p.calculate(),true);
  const total=p.elements.total.textContent;
  for (const name of ["itbi","registro","taxas","resumo"]) {
    p.elements[`tab-${name}`].listeners.click();
    assert.equal(p.elements[`pane-${name}`].hidden,false);
    assert.equal(p.elements[`tab-${name}`].attributes["aria-selected"],"true");
    assert.equal(p.elements[`tab-${name}`].tabIndex,0);
    assert.equal(p.elements.itbi.value,"6.000,00");
    assert.equal(p.elements.total.textContent,total);
    assert.equal(p.elements.resultado.hidden,false);
  }
  assert.equal(p.elements["pane-registro"].hidden,true);
  assert.equal(p.elements["tab-registro"].attributes["aria-selected"],"false");
});

test("Abas: navegacao por setas, Home e End com foco", () => {
  const p=page();
  const press=(tab,key)=>p.elements[`tab-${tab}`].listeners.keydown({key,preventDefault(){}});
  press("resumo","ArrowRight");assert.equal(p.elements["pane-itbi"].hidden,false);
  assert.equal(p.elements["tab-itbi"].focused,true);
  press("itbi","End");assert.equal(p.elements["pane-taxas"].hidden,false);
  press("taxas","ArrowRight");assert.equal(p.elements["pane-resumo"].hidden,false);
  press("resumo","ArrowLeft");assert.equal(p.elements["pane-taxas"].hidden,false);
  press("taxas","Home");assert.equal(p.elements["pane-resumo"].hidden,false);
});

test("Auditorias: ITBI manual, taxa sugerida, ajustes e indicadores consistentes", () => {
  const p=page();p.set("taxa",1500);p.set("despachante",850);assert.equal(p.calculate(),true);
  const formatted=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
  assert.equal(p.elements["itbi-auditoria"].children[4].children[1].textContent,"Pendente");
  assert.equal(p.elements["taxas-auditoria"].children[4].children[1].textContent,formatted(2400));
  assert.equal(p.elements["taxas-auditoria"].children[5].children[1].textContent,formatted(1500));
  assert.equal(p.elements["despachante-auditoria"].children[1].children[1].textContent,formatted(850));
  assert.equal(p.elements["metric-total"].textContent,p.elements.total.textContent);
  assert.equal(p.elements["metric-total-label"].textContent,"Subtotal conhecido");
  p.set("compra",250000);
  assert.equal(p.elements["analise-itbi"].hidden,true);
  assert.equal(p.elements["analise-taxas"].hidden,true);
  assert.equal(p.elements["metric-total"].textContent,"Pendente");
});

test("Validacao revela a aba e o ajuste que precisam ser corrigidos", () => {
  const p=page();p.set("registro-iss",101);assert.equal(p.calculate(),false);
  assert.equal(p.elements["pane-registro"].hidden,false);
  assert.equal(p.elements["registro-ajustes"].open,true);
  assert.equal(p.elements["registro-iss"].focused,true);
  p.set("registro-iss",5.26);p.set("taxa",-1);assert.equal(p.calculate(),false);
  assert.equal(p.elements["pane-taxas"].hidden,false);
  assert.equal(p.elements.taxa.focused,true);
});

const itbiOperation = (extra = {}) => ({uf:"RS",municipio:"Porto Alegre",compra:30000000,financiado:20000000,fgts:3000000,subsidio:2000000,...extra});
for (const [municipio,expected] of [["Porto Alegre",265000],["Canoas",340000],["Novo Hamburgo",360000],["São Leopoldo",215000],["Alvorada",440000]]) {
  test(`ITBI ${municipio}: bases fornecidas e subsidio excluido`, () => {
    const result=calcularITBI(itbiOperation({municipio}));
    assert.equal(result.proprios,5000000);
    assert.equal(result.total,expected);
    assert.equal(result.linhas.reduce((sum,line)=>sum+line.imposto,0),result.total);
  });
}

test("ITBI Porto Alegre: exemplo de R$ 700 mil com limite combinado", () => {
  const result=calcularITBI(itbiOperation({compra:70000000,financiado:50000000,fgts:5000000,subsidio:0}));
  assert.equal(result.proprios,15000000);
  assert.equal(result.excedente,13920520);
  assert.equal(result.linhas[0].base+result.linhas[1].base,41079480);
  assert.equal(result.linhas[0].imposto+result.linhas[1].imposto,205397);
  assert.equal(result.linhas[2].imposto,417616);
  assert.equal(result.linhas[3].imposto,450000);
  assert.equal(result.total,1073013);
});

test("ITBI Porto Alegre: no limite, um centavo acima e FGTS ocupando o saldo", () => {
  const exact=calcularITBI(itbiOperation({compra:50000000,financiado:40000000,fgts:1079480,subsidio:0}));
  assert.equal(exact.excedente,0);
  assert.equal(exact.linhas[1].base,1079480);
  const above=calcularITBI(itbiOperation({compra:50000000,financiado:40000000,fgts:1079481,subsidio:0}));
  assert.equal(above.excedente,1);
  assert.equal(above.linhas[1].base,1079480);
});

test("ITBI municipios sem teto nao usam o limite de Porto Alegre", () => {
  const result=calcularITBI(itbiOperation({municipio:"Canoas",compra:100000000,financiado:80000000,fgts:10000000,subsidio:5000000}));
  assert.equal(result.excedente,0);
  assert.equal(result.total,850000);
});

test("ITBI Curitiba: fronteiras das faixas, sem progressividade", () => {
  for (const [compra,expected] of [[17600000,0],[17600001,88000],[20500000,102500],[20500001,328000],[22000000,352000],[22000001,594000]]) {
    const result=calcularITBI(itbiOperation({uf:"PR",municipio:"Curitiba",compra,financiado:10000000,fgts:0,subsidio:0,enquadramento:true}));
    assert.equal(result.total,expected,String(compra));
    assert.equal(result.linhas[0].base,compra);
  }
});

test("ITBI Curitiba: condicoes pendentes, nao atendidas, compra a vista e valor venal", () => {
  const curitiba=itbiOperation({uf:"PR",municipio:"Curitiba",compra:20000000,financiado:16000000,fgts:0,subsidio:0});
  assert.equal(calcularITBI(curitiba).total,null);
  assert.equal(calcularITBI({...curitiba,enquadramento:false}).total,540000);
  assert.equal(calcularITBI({...curitiba,financiado:0}).total,540000);
  assert.equal(calcularITBI({...curitiba,enquadramento:true}).total,100000);
  assert.equal(calcularITBI({...curitiba,enquadramento:true,valorVenal:21000000}).total,336000);
  assert.equal(calcularITBI({...curitiba,compra:30000000}).total,810000);
  assert.throws(()=>calcularITBI({...curitiba,financiado:0,enquadramento:true}));
});

test("ITBI: ausencia e valores invalidos nao geram zero", () => {
  assert.equal(calcularITBI(itbiOperation({compra:null})).total,null);
  for(const extra of [{compra:0},{fgts:-1},{financiado:1.5},{subsidio:20000000},{municipio:"Outro"}]) assert.throws(()=>calcularITBI(itbiOperation(extra)));
});

test("ITBI automatico: altera a operacao e mantém resumo e tabela consistentes", () => {
  const p=page("automatico");
  assert.equal(p.elements.itbi.readOnly,true);
  assert.equal(p.elements.itbi.value,"950,00");
  p.set("fgts",0);p.set("subsidio",0);
  assert.equal(p.elements.itbi.value,"2.000,00");
  assert.equal(p.calculate(),true);
  assert.equal(p.elements["itbi-detalhes"].hidden,false);
  assert.equal(p.elements["itbi-total"].textContent,p.elements["metric-itbi"].textContent);
  assert.equal(p.elements["total-label"].textContent,"Total estimado");
  p.set("municipio","Canoas","change");
  assert.equal(p.elements.itbi.value,"2.000,00");
  assert.equal(p.elements["itbi-detalhes"].hidden,true);
});

test("ITBI manual: guarda ajuste da operacao e limpa valor ao trocar municipio", () => {
  const p=page("automatico");p.set("itbi-modo","manual","change");
  assert.equal(p.elements.itbi.readOnly,false);
  assert.equal(p.elements.itbi.value,"");
  p.set("itbi",1234);p.set("itbi-modo","automatico","change");assert.equal(p.elements.itbi.value,"950,00");
  p.set("itbi-modo","manual","change");assert.equal(p.elements.itbi.value,"1.234,00");
  assert.equal(p.calculate(),true);assert.equal(p.elements["itbi-detalhes"].hidden,true);
  p.set("municipio","Canoas","change");assert.equal(p.elements.itbi.value,"");
});

test("ITBI Curitiba: isencao confirmada e pendencia aparecem corretamente", () => {
  const p=page("automatico");p.set("uf","PR","change");
  assert.equal(p.elements["itbi-curitiba"].hidden,false);
  assert.equal(p.elements.itbi.value,"");
  assert.equal(p.calculate(),true);
  assert.match(p.elements.pendencias.textContent,/ITBI/);
  p.set("itbi-enquadramento","sim","change");assert.equal(p.elements.itbi.value,"1.000,00");
  p.set("compra",176000);p.set("financiado",140000);p.set("fgts",0);p.set("subsidio",0);
  assert.equal(p.elements.itbi.value,"0,00");assert.equal(p.calculate(),true);
  assert.doesNotMatch(p.elements.pendencias.textContent,/ITBI/);
  p.set("itbi-venal",0);assert.equal(p.calculate(),false);
  assert.equal(p.elements["pane-itbi"].hidden,false);
  assert.equal(p.elements["itbi-venal"].focused,true);
});
