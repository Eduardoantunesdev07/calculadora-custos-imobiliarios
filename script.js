"use strict";

const integerMoneyFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function parseMoneyInput(text) {
  const value = String(text).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (value === "") return null;
  let integer;
  let fraction;
  if (/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(value)) {
    [integer, fraction = ""] = value.split(",");
    integer = integer.replace(/\./g, "");
  } else if (/^\d+\.\d{1,2}$/.test(value)) {
    [integer, fraction] = value.split(".");
  } else {
    throw new Error("Informe um valor em reais válido, não negativo, com até duas casas decimais.");
  }
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("O valor excede o limite de cálculo.");
  return Number(cents);
}

function formatMoneyInput(cents) {
  if (cents === null) return "";
  const value = BigInt(cents);
  return `${integerMoneyFormat.format(value / 100n)},${String(value % 100n).padStart(2, "0")}`;
}

// Padrões RS fornecidos pela RTx em 13/10/2026; alíquotas em pontos-base.
const ITBI_PADROES = {
  "RS/Porto Alegre": { financiamento: 50, fgts: 50, proprios: 300, limite: 41079480 },
  "RS/Canoas": { financiamento: 50, fgts: 300, proprios: 300, limite: null },
  "RS/Novo Hamburgo": { financiamento: 100, fgts: 200, proprios: 200, limite: null },
  "RS/São Leopoldo": { financiamento: 50, fgts: 50, proprios: 200, limite: null },
  "RS/Alvorada": { financiamento: 100, fgts: 300, proprios: 300, limite: null }
};
const ITBI_CURITIBA_FONTE = "https://legisladocexterno.curitiba.pr.gov.br/VisualizarHTML.aspx?id=454104";

function impostoEmCentavos(base, aliquotaBP) {
  return Number((BigInt(base) * BigInt(aliquotaBP) + 5000n) / 10000n);
}

function calcularITBI({ uf, municipio, compra, financiado, fgts, subsidio, valorVenal = null }) {
  const key = `${uf}/${municipio}`;
  const profile = ITBI_PADROES[key];
  if (!profile && key !== "PR/Curitiba") throw new Error("Não há padrão de ITBI para este município.");
  if ([compra, financiado, fgts, subsidio].some((value) => value === null)) {
    return { total: null, linhas: [], motivo: "Preencha os valores da operação para estimar o ITBI.", profile };
  }
  if (![compra, financiado, fgts, subsidio].every((value) => Number.isSafeInteger(value) && value >= 0) || compra === 0) {
    throw new Error("Informe valores válidos da operação e um valor de compra maior que zero.");
  }
  const recursos = BigInt(compra) - BigInt(financiado) - BigInt(fgts) - BigInt(subsidio);
  if (recursos < 0n) throw new Error("A soma do financiamento, FGTS e subsídio não pode superar o valor de compra.");
  const proprios = Number(recursos);
  const linhas = [];
  const add = (descricao, base, aliquotaBP) => linhas.push({ descricao, base, aliquotaBP, imposto: impostoEmCentavos(base, aliquotaBP) });
  let excedente = 0;
  if (profile) {
    let baseFinanciada = financiado;
    let baseFGTS = fgts;
    if (profile.limite !== null) {
      baseFinanciada = Math.min(financiado, profile.limite);
      baseFGTS = Math.min(fgts, Math.max(0, profile.limite - baseFinanciada));
      excedente = financiado - baseFinanciada + fgts - baseFGTS;
    }
    add("Financiamento bancário", baseFinanciada, profile.financiamento);
    add("FGTS utilizado", baseFGTS, profile.fgts);
    if (profile.limite !== null) add("Excedente do limite de financiamento + FGTS", excedente, profile.proprios);
    add("Recursos próprios", proprios, profile.proprios);
  } else {
    if (valorVenal !== null && (!Number.isSafeInteger(valorVenal) || valorVenal <= 0)) throw new Error("O valor venal deve ser maior que zero.");
    const base = valorVenal ?? compra;
    let aliquota = 270;
    if (base <= 17600000) aliquota = 0;
    else if (base <= 20500000) aliquota = 50;
    else if (base <= 22000000) aliquota = 160;
    add("Valor venal / base de referência", base, aliquota);
  }
  const total = linhas.reduce((sum, line) => sum + line.imposto, 0);
  if (!Number.isSafeInteger(total)) throw new Error("O ITBI excede o limite de cálculo.");
  return { total, linhas, proprios, subsidio, excedente, profile,
    motivo: profile ? "Padrão de estimativa informado pela RTx. Subsídio excluído da base de recursos próprios."
      : `Padrão RTx de Curitiba: faixas aplicadas automaticamente, sem confirmação de enquadramento. Base: ${valorVenal === null ? "valor de compra como referência" : "valor venal informado"}. Estimativa, não guia municipal.` };
}

// Valores em reais transcritos das tabelas oficiais. Atualização: veja REGISTRO.md.
const REGISTRO_TABELAS = {
  RS: {
    versao: "TJRS 2026, item 1 de Registro de Imóveis",
    fonte: "https://www.tjrs.jus.br/static/2025/12/Tabela_de_Emolumentos_2026.pdf",
    revisadoEm: "2026-10-13", revisarAte: "2026-12-31", fatorGarantia: 1,
    teto: 5482.90,
    faixas: [
      [2481.80, 226.10], [4963.40, 230.80], [7445.20, 241.00],
      [9927.00, 251.10], [12408.70, 260.90], [14890.10, 271.00],
      [17371.50, 281.30], [19853.70, 291.30], [22335.10, 300.70],
      [24816.80, 310.40], [37225.20, 340.90], [49633.80, 390.80],
      [74451.00, 465.90], [99267.80, 565.50], [124085.00, 664.90],
      [148901.60, 764.70], [173718.60, 864.60], [198535.70, 964.20],
      [223352.70, 1064.20], [248169.50, 1163.90], [297803.60, 1313.30],
      [347437.30, 1512.30], [397071.00, 1712.00], [446705.00, 1911.30],
      [496338.90, 2111.70], [620424.00, 2460.80], [744508.50, 2958.90],
      [868593.30, 3458.00], [992677.90, 3956.20], [1116762.80, 4454.90],
      [1240847.60, 4953.60]
    ]
  },
  PR: {
    versao: "TJPR, Lei 21.869/2023, Tabela XIII",
    fonte: "https://extrajudicial.tjpr.jus.br/documents/d/foro-extrajudicial/lei-e-tabela-atualizada-2024-publicada-10-pdf",
    revisadoEm: "2026-10-13", revisarAte: "2026-12-31", fatorGarantia: 0.5,
    // Usar a coluna R$, não a coluna VRCext. CPC já incluída; sem somá-la novamente.
    teto: 1194.42,
    faixas: [
      [15512.00, 349.02], [18282.00, 411.34], [21052.00, 473.67],
      [23822.00, 535.99], [26592.00, 598.32], [29362.00, 660.64],
      [32132.00, 722.97], [34902.00, 785.29], [37672.00, 847.62],
      [40442.00, 909.94], [43212.00, 972.27], [45982.00, 1011.60],
      [48752.00, 1072.54], [51522.00, 1133.48], [54292.00, 1194.42]
    ]
  }
};

// Referencia observada no formulario publico RIB em 13/10/2026; nao substitui a Tabela XIII.
const REGISTRO_REFERENCIA_RIB = {
  ...REGISTRO_TABELAS.PR,
  versao: "Referência calculadora RIB, PR, conferida em 13/10/2026",
  fonte: "https://www.registrodeimoveis.org.br/calculadora",
  teto: 1377.24,
  faixas: [...REGISTRO_TABELAS.PR.faixas, [57062.00, 1255.36], [59832.00, 1316.30], [62602.00, 1377.24]]
};

function emolumentoPorFaixa(uf, baseCentavos) {
  const table = REGISTRO_TABELAS[uf];
  if (!table || !Number.isSafeInteger(baseCentavos) || baseCentavos <= 0) {
    throw new Error("Estado ou base de cálculo inválidos.");
  }
  const bracket = table.faixas.find(([limit]) => baseCentavos <= Math.round(limit * 100));
  return Math.round((bracket ? bracket[1] : table.teto) * 100);
}

const SELOS_RS = {
  pequenos: [[8.80, 2.20], [12.10, 3.10], [33.70, 4.40], [70.00, 5.50]],
  atos: [[1000.00, 19.90], [50000.00, 39.00], [150000.00, 59.80], [300000.00, 80.80]],
  teto: 100.20
};
const ISS_INFORMADO = { "RS/Porto Alegre": 5.26 };
const CURITIBA_REGISTRO = {
  iss: 5, fundepBP: 500, funrejusBP: 20,
  seloRegistro: 800, seloPequeno: 100, seloPrenotacao: 25,
  upfPorMes: { "2026-10": 15225 }, multiplicadorTeto: 53
};

function seloRS(baseCentavos, emolumentoOriginal) {
  const faixas = emolumentoOriginal <= 7000 ? SELOS_RS.pequenos : SELOS_RS.atos;
  const referencia = emolumentoOriginal <= 7000 ? emolumentoOriginal : baseCentavos;
  const faixa = faixas.find(([limite]) => referencia <= Math.round(limite * 100));
  return Math.round((faixa ? faixa[1] : SELOS_RS.teto) * 100);
}

function calcularRegistro({ uf, municipio = null, base, divida, sfh = false, issPercentual = null, referenciaPR = "rib",
  seloCompra = null, seloGarantia = null, selosPR = null, fundosPR = null, funrejusPR = null,
  emolCompraPR = null, emolGarantiaPR = null, contrato = "urbano", data = new Date() }) {
  const padraoCuritiba = uf === "PR" && municipio === "Curitiba";
  if (padraoCuritiba && !["rib", "tjpr"].includes(referenciaPR)) throw new Error("Selecione uma referência válida para os emolumentos.");
  const referenciaRIB = padraoCuritiba && referenciaPR === "rib";
  const table = referenciaRIB ? REGISTRO_REFERENCIA_RIB : REGISTRO_TABELAS[uf];
  if (!table) throw new Error("Não há tabela cadastrada para este estado.");
  const pending = (reason) => ({ total: null, completo: false, motivo: reason, pendencias: ["Registro"], tabela: table, linhas: [] });
  const today = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  if (today > table.revisarAte) return pending("Tabela pendente de revisão. Atualize a tabela ou informe o valor do cartório.");
  if (contrato !== "urbano") return pending("Cálculo local disponível para a compra de um imóvel urbano, à vista ou com alienação fiduciária. Informe o valor do cartório para outros atos.");
  if (base === null || divida === null) return pending("Base de cálculo ou dívida pendente. Informe 0 na dívida quando a compra for à vista.");
  if (!Number.isSafeInteger(base) || base <= 0 || !Number.isSafeInteger(divida) || divida < 0 || divida > base) throw new Error("A base deve ser positiva e a dívida deve estar entre zero e a base de cálculo.");
  if (sfh && divida === 0) throw new Error("1ª aquisição SFH exige financiamento. Confira o enquadramento da operação.");
  if (issPercentual !== null && (!Number.isFinite(issPercentual) || issPercentual < 0 || issPercentual > 100)) throw new Error("O percentual de ISS deve estar entre 0 e 100.");
  for (const valor of [seloCompra, seloGarantia, selosPR, fundosPR, funrejusPR, emolCompraPR, emolGarantiaPR]) {
    if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0)) throw new Error("Informe taxas válidas em reais, com até duas casas decimais.");
  }
  const desconto = sfh ? 50 : 0;
  const factor = (100 - desconto) / 100;
  const faixaRIB = table.faixas.find(([limit]) => base <= Math.round(limit * 100));
  const compraIntegral = padraoCuritiba && emolCompraPR !== null ? emolCompraPR : referenciaRIB
    ? Math.round((faixaRIB ? faixaRIB[1] : table.teto) * 100) : emolumentoPorFaixa(uf, base);
  const compra = Math.round(compraIntegral * factor);
  const garantia = divida === 0 ? 0 : Math.round((padraoCuritiba && emolGarantiaPR !== null ? emolGarantiaPR
    : referenciaRIB ? compraIntegral * 0.5 : emolumentoPorFaixa(uf, divida) * table.fatorGarantia) * factor);
  const quantidade = divida === 0 ? 1 : 2;
  const processamento = uf === "RS" ? quantidade * Math.round(730 * factor) : 0;
  const prenotacao = uf === "PR" ? Math.round(277 * factor) : 0;
  const arquivamento = padraoCuritiba ? Math.round(194 * factor) : 0;
  const emolumentos = compra + garantia + processamento + prenotacao + arquivamento;
  const selosAjustados = selosPR !== null;
  const fundosAjustados = fundosPR !== null;
  const funrejusAjustado = funrejusPR !== null;
  let tetoFunrejus = null;
  if (padraoCuritiba) {
    const upf = CURITIBA_REGISTRO.upfPorMes[today.slice(0, 7)];
    tetoFunrejus = upf === undefined ? null : upf * CURITIBA_REGISTRO.multiplicadorTeto;
    const selo = (valor) => valor > 3200 ? CURITIBA_REGISTRO.seloRegistro : CURITIBA_REGISTRO.seloPequeno;
    selosPR ??= selo(compra) + (divida > 0 ? selo(garantia) : 0) + 2 * CURITIBA_REGISTRO.seloPrenotacao;
    fundosPR ??= [compra, garantia, prenotacao, arquivamento].reduce((sum, valor) => sum + impostoEmCentavos(valor, CURITIBA_REGISTRO.fundepBP), 0);
    if (funrejusPR === null && tetoFunrejus !== null) funrejusPR = Math.min(impostoEmCentavos(base, CURITIBA_REGISTRO.funrejusBP), tetoFunrejus);
    issPercentual ??= CURITIBA_REGISTRO.iss;
  }
  const pendencias = [];
  const linhas = [];
  function add(descricao, emolumento, selo, subtotal, agrupado = false) {
    linhas.push({ descricao, emolumento, selo, subtotal, agrupado });
  }
  let selos;
  let fundos = 0;
  let taxaJudiciaria = 0;
  if (uf === "RS") {
    const seloDaCompra = seloCompra ?? seloRS(base, emolumentoPorFaixa(uf, base));
    const seloDaGarantia = divida === 0 ? 0 : (seloGarantia ?? seloRS(divida, emolumentoPorFaixa(uf, divida)));
    add("Registro da compra e venda" + (seloCompra === null ? "" : " (selo ajustado)"), compra, seloDaCompra, compra + seloDaCompra);
    if (divida > 0) add("Registro da garantia" + (seloGarantia === null ? "" : " (selo ajustado)"), garantia, seloDaGarantia, garantia + seloDaGarantia);
    add(`Processamento eletrônico de dados (${quantidade}×)`, processamento, quantidade * 220, processamento + quantidade * 220);
    selos = seloDaCompra + seloDaGarantia + quantidade * 220;
  } else if (padraoCuritiba) {
    const selo = (valor) => valor > 3200 ? CURITIBA_REGISTRO.seloRegistro : CURITIBA_REGISTRO.seloPequeno;
    const ato = (descricao, emolumento, seloValor, taxaBP = 0) => {
      const fundep = fundosAjustados ? 0 : impostoEmCentavos(emolumento, CURITIBA_REGISTRO.fundepBP);
      const seloAto = selosAjustados ? 0 : seloValor;
      const taxa = impostoEmCentavos(emolumento, taxaBP);
      taxaJudiciaria += taxa;
      linhas.push({ descricao, emolumento, fundep, selo: seloAto, taxa, subtotal: emolumento + fundep + seloAto + taxa });
    };
    ato("Registro da compra e venda" + (emolCompraPR === null ? "" : " (emolumento ajustado)"), compra, selo(compra));
    if (divida > 0) ato("Registro da garantia" + (emolGarantiaPR === null ? "" : " (emolumento ajustado)"), garantia, selo(garantia));
    ato("Prenotação", prenotacao, 25, 2500);
    ato("Arquivamento", arquivamento, 25, 2500);
    if (selosAjustados) linhas.push({ descricao: "Selos FUNARPEN (total ajustado)", emolumento: 0, fundep: 0, selo: selosPR, taxa: 0, subtotal: selosPR });
    if (fundosAjustados) linhas.push({ descricao: "FUNDEP (total ajustado)", emolumento: 0, fundep: fundosPR, selo: 0, taxa: 0, subtotal: fundosPR });
    selos = selosPR;
    fundos = fundosPR;
    if (funrejusPR === null) pendencias.push("FUNREJUS: atualizar UPF/PR do mês ou informar a guia");
  } else {
    add("Registro da compra e venda", compra, null, compra, true);
    if (divida > 0) add("Registro da garantia", garantia, null, garantia, true);
    add("Prenotação do título", prenotacao, null, prenotacao, true);
    add(padraoCuritiba ? selosAjustados ? "Selos FUNARPEN (total ajustado)" : `Selos FUNARPEN (${quantidade} registro(s) + 1 prenotação)` : "Selos de fiscalização (total informado)", 0, selosPR, selosPR);
    add(padraoCuritiba && !funrejusAjustado ? "FUNREJUS (0,2% sobre a compra, com teto)" : "FUNREJUS (valor informado)", 0, 0, funrejusPR);
    add(padraoCuritiba ? fundosAjustados ? "FUNDEP (valor ajustado)" : "FUNDEP (5% sobre emolumentos)" : "Outros fundos e taxas do cartório (sem FUNREJUS)", 0, 0, fundosPR);
    selos = selosPR;
    fundos = fundosPR;
    if (selos === null) pendencias.push("Selos de fiscalização");
    if (fundos === null) pendencias.push("Fundos e taxas do cartório");
    if (funrejusPR === null) pendencias.push(padraoCuritiba ? "FUNREJUS: atualizar UPF/PR do mês ou informar a guia" : "FUNREJUS");
  }
  const funrejus = uf === "PR" ? funrejusPR : 0;
  const subtotal = emolumentos + (selos ?? 0) + (fundos ?? 0) + taxaJudiciaria + (padraoCuritiba ? 0 : funrejus ?? 0);
  const iss = issPercentual === null ? null : Math.round(emolumentos * issPercentual / 100);
  if (iss === null) pendencias.push("ISS do registro");
  const total = subtotal + (iss ?? 0) + (padraoCuritiba ? funrejus ?? 0 : 0);
  if (!Number.isSafeInteger(total)) throw new Error("O total do registro excede o limite de cálculo.");
  return { total, compra, garantia, base, divida, desconto, processamento, prenotacao, emolumentos, selos,
    subtotal, iss, issPercentual, funrejus, fundos, arquivamento, taxaJudiciaria, padraoCuritiba, referenciaRIB, tetoFunrejus, linhas, pendencias, completo: pendencias.length === 0,
    motivo: pendencias.length ? `Registro parcial. Pendente: ${pendencias.join(", ")}.` : "Registro estimado com despesas calculadas.", tabela: table };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { REGISTRO_TABELAS, SELOS_RS, ITBI_PADROES, emolumentoPorFaixa, seloRS, calcularRegistro, calcularITBI, parseMoneyInput, formatMoneyInput };
}

if (typeof document !== "undefined") {
const get = (id) => document.getElementById(id);
const form = get("estimador");
const error = get("erro");
const THEME_STORAGE_KEY = "rtx-theme";
const cities = {
  RS: ["Porto Alegre", "Canoas", "São Leopoldo", "Novo Hamburgo", "Alvorada"],
  PR: ["Curitiba"]
};
const expenseNames = { itbi: "ITBI informado", registro: "Registro", taxa: "Taxa bancária", despachante: "Despachante" };
const moneyIds = ["compra", "financiado", "fgts", "subsidio", ...Object.keys(expenseNames)];
const registrationMoneyIds = ["registro-selo-compra", "registro-selo-garantia", "registro-selos-pr", "registro-fundos-pr", "registro-funrejus-pr", "registro-emol-compra-pr", "registro-emol-garantia-pr"];
const registrationIds = ["registro-modo", "registro-contrato", "registro-sfh", "registro-iss", "registro-referencia-pr", ...registrationMoneyIds];
const itbiIds = ["itbi-modo", "itbi-venal"];
const currencyFieldIds = [...moneyIds, ...registrationMoneyIds, "itbi-venal"];
const allIds = ["uf", "municipio", "banco", "modalidade", ...moneyIds, ...registrationIds, ...itbiIds];
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let adjustedFee = false;
let manualRegistrationValue = "";
let registrationEstimate = null;
let itbiEstimate = null;
let manualITBIValue = "";
const tabNames = ["resumo", "itbi", "registro", "taxas"];
const fieldTabs = {
  itbi: "itbi", registro: "registro", taxa: "taxas", despachante: "taxas",
  ...Object.fromEntries(registrationIds.map((id) => [id, "registro"])),
  ...Object.fromEntries(itbiIds.map((id) => [id, "itbi"]))
};

function storedTheme() {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

function preferredTheme() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme, persist = true) {
  const nextTheme = theme === "light" ? "light" : "dark";
  if (document.documentElement) document.documentElement.dataset.theme = nextTheme;
  const toggle = get("theme-toggle");
  const label = get("theme-toggle-label");
  if (toggle && label) {
    const light = nextTheme === "light";
    toggle.setAttribute("aria-pressed", String(light));
    label.textContent = light ? "Tema escuro" : "Tema claro";
    toggle.title = light ? "Alternar para tema escuro" : "Alternar para tema claro";
  }
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch { /* Preferencia visual opcional. */ }
  }
}

function initializeTheme() {
  const rootTheme = document.documentElement?.dataset.theme;
  applyTheme(storedTheme() || rootTheme || preferredTheme(), false);
  get("theme-toggle")?.addEventListener("click", () => {
    const currentTheme = document.documentElement?.dataset.theme || preferredTheme();
    applyTheme(currentTheme === "light" ? "dark" : "light");
  });
  if (typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
      if (!storedTheme()) applyTheme(event.matches ? "light" : "dark", false);
    });
  }
}

function setMoneyValue(id, cents) {
  get(id).value = formatMoneyInput(cents);
}

function formatMoneyField(field) {
  const raw = field.value;
  const start = field.selectionStart ?? raw.length;
  const comma = raw.indexOf(",");
  // During editing, group separators can temporarily have the wrong spacing.
  let candidate = comma >= 0 ? raw.replace(/\./g, "") : raw;
  if (/^,0{0,2}$/.test(candidate)) candidate = "";
  else if (/^,\d{1,2}$/.test(candidate)) candidate = "0" + candidate;
  let cents;
  try { cents = parseMoneyInput(candidate); } catch { return; }
  const formatted = formatMoneyInput(cents);
  if (raw === formatted) return;
  const separator = comma >= 0 ? comma : /^\d+\.\d{1,2}$/.test(raw) ? raw.indexOf(".") : -1;
  let cursor = 0;
  if (separator >= 0 && start > separator) {
    const decimals = raw.slice(separator + 1, start).replace(/\D/g, "").length;
    cursor = formatted.indexOf(",") + 1 + Math.min(decimals, 2);
  } else {
    const digits = raw.slice(0, start).replace(/\D/g, "").length;
    let seen = 0;
    while (cursor < formatted.indexOf(",") && seen < digits) {
      if (/\d/.test(formatted[cursor])) seen++;
      cursor++;
    }
  }
  field.value = formatted;
  if (typeof field.setSelectionRange === "function") field.setSelectionRange(cursor, cursor);
}

function handleMoneyBeforeInput(event) {
  const field = event.target;
  if (!currencyFieldIds.includes(field.id) || field.readOnly) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const comma = field.value.indexOf(",");
  if (event.inputType === "insertText" && [",", "."].includes(event.data)) {
    event.preventDefault();
    if (field.value === "") {
      field.value = "0,00";
      handleMoneyInput({ target: field });
    }
    const decimalStart = field.value.indexOf(",") + 1;
    if (decimalStart > 0) field.setSelectionRange(decimalStart, field.value.length);
    return;
  }
  if (comma < 0 || start !== end) return;
  if (event.inputType === "insertText" && /^\d$/.test(event.data) && start > comma) {
    if (start >= field.value.length) event.preventDefault();
    else field.setSelectionRange(start, start + 1);
  }
  if (event.inputType === "deleteContentBackward" && start === comma + 1) {
    event.preventDefault();
    field.setSelectionRange(comma, comma);
  }
  if (event.inputType === "deleteContentForward" && start === comma) {
    event.preventDefault();
    field.setSelectionRange(comma + 1, comma + 1);
  }
}

function updateITBI(strict = false) {
  const automatic = get("itbi-modo").value === "automatico";
  const curitiba = get("uf").value === "PR" && get("municipio").value === "Curitiba";
  get("itbi").readOnly = automatic;
  get("itbi-curitiba").hidden = !automatic || !curitiba;
  get("itbi-venal").disabled = !automatic || !curitiba;
  get("itbi-label").textContent = automatic ? "ITBI estimado (R$)" : "ITBI informado (R$)";
  get("metric-itbi-label").textContent = automatic ? "ITBI estimado" : "ITBI informado";
  get("metric-itbi-nota").textContent = automatic ? "Padrão do município" : "Valor informado manualmente";
  get("itbi-origem-tag").textContent = automatic ? "Padrão do município" : "Informado manualmente";
  expenseNames.itbi = automatic ? "ITBI estimado" : "ITBI informado";
  if (!automatic) {
    itbiEstimate = null;
    get("itbi-status").textContent = "Valor informado manualmente para esta operação.";
    return;
  }
  try {
    const venal = curitiba ? readCents("itbi-venal") : null;
    if (venal !== null && venal <= 0) throw { id: "itbi-venal", message: "O valor venal deve ser maior que zero." };
    const operation = Object.fromEntries(["compra", "financiado", "fgts", "subsidio"].map((id) => [id, readCents(id)]));
    if (operation.compra !== null && operation.compra <= 0) throw { id: "compra", message: "O valor de compra deve ser maior que zero." };
    if (Object.values(operation).every((value) => value !== null)
      && BigInt(operation.financiado) + BigInt(operation.fgts) + BigInt(operation.subsidio) > BigInt(operation.compra)) {
      throw { id: "financiado", message: "A soma do financiamento, FGTS e subsídio não pode superar o valor de compra." };
    }
    itbiEstimate = calcularITBI({ uf: get("uf").value, municipio: get("municipio").value,
      ...operation,
      valorVenal: venal });
    setMoneyValue("itbi", itbiEstimate.total);
    get("itbi-status").textContent = itbiEstimate.motivo;
  } catch (issue) {
    itbiEstimate = null;
    get("itbi").value = "";
    get("itbi-status").textContent = issue.message;
    if (strict) {
      if (!issue.id) issue.id = curitiba ? "itbi-venal" : "financiado";
      throw issue;
    }
  }
}

function renderITBI() {
  get("itbi-detalhes").hidden = !itbiEstimate;
  if (!itbiEstimate) return;
  get("itbi-linhas").replaceChildren(...itbiEstimate.linhas.map((line) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = line.descricao;
    row.append(label);
    [formatMoney(line.base), line.aliquotaBP === null ? "Pendente" : `${(line.aliquotaBP / 100).toLocaleString("pt-BR")}%`, formatMoney(line.imposto)].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (text === "Pendente") cell.className = "pending";
      row.append(cell);
    });
    return row;
  }));
  get("itbi-total").textContent = formatMoney(itbiEstimate.total);
  const limit = itbiEstimate.profile?.limite;
  get("itbi-observacao").textContent = `${itbiEstimate.motivo} ${limit !== undefined && limit !== null
    ? `Limite combinado: ${formatMoney(limit)}. Excedente tributado a 3%: ${formatMoney(itbiEstimate.excedente ?? null)}.` : ""} Valores arredondados por parcela para centavos e sujeitos à confirmação do município.`;
  get("itbi-fonte-wrap").hidden = get("municipio").value !== "Curitiba";
  get("itbi-fonte").href = ITBI_CURITIBA_FONTE;
}

function activateTab(name, focus = false) {
  if (!tabNames.includes(name)) return;
  tabNames.forEach((tabName) => {
    const selected = tabName === name;
    const button = get(`tab-${tabName}`);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    get(`pane-${tabName}`).hidden = !selected;
  });
  if (focus) get(`tab-${name}`).focus();
}

function renderAudits(values, partialRegistration) {
  const itbiRows = [
    ["Município", `${get("municipio").value} / ${get("uf").value}`],
    ["Valor do imóvel (referência)", formatMoney(values.compra)],
    ["Origem do valor", get("itbi-modo").value === "manual" ? "Informado manualmente" : "Padrão do município"],
    ["Alíquota aplicada pelo estimador", get("itbi-modo").value === "manual" ? "Nenhuma" : "Conforme detalhamento abaixo"],
    ["ITBI considerado no resumo", formatMoney(values.itbi)]
  ];
  if (itbiEstimate) {
    itbiRows.push(["Recursos próprios", formatMoney(itbiEstimate.proprios ?? null)]);
    itbiRows.push([itbiEstimate.profile ? "Subsídio excluído da base" : "Subsídio na operação", formatMoney(values.subsidio)]);
    if (itbiEstimate.profile) itbiRows.push(["Limite combinado de financiamento + FGTS", itbiEstimate.profile.limite === null ? "Sem limitador" : formatMoney(itbiEstimate.profile.limite)]);
    else itbiRows.push(["Critério de Curitiba", "Faixas automáticas do padrão RTx, sem confirmação"]);
  }
  renderRows("itbi-auditoria", itbiRows);
  renderITBI();
  renderRows("taxas-auditoria", [
    ["Banco", get("banco").selectedOptions[0].textContent],
    ["Modalidade", get("modalidade").selectedOptions[0].textContent],
    ["Financiamento bancário", formatMoney(values.financiado)],
    ["Critério", feeDescription()],
    ["Taxa sugerida", formatMoney(suggestedFee(get("banco").value, get("modalidade").value, values.financiado))],
    ["Taxa considerada", formatMoney(values.taxa)],
    ["Origem", adjustedFee ? "Ajustada manualmente" : "Parâmetro da estimativa"]
  ]);
  renderRows("despachante-auditoria", [
    ["Valor de referência", formatMoney(120000)],
    ["Valor considerado", formatMoney(values.despachante)],
    ["Origem", values.despachante === null ? "Pendente" : values.despachante === 120000 ? "Parâmetro da estimativa" : "Ajustado manualmente"]
  ]);
  get("analise-itbi").hidden = false;
  get("analise-taxas").hidden = false;
  ["itbi-aguardando", "registro-aguardando", "taxas-aguardando"].forEach((id) => { get(id).hidden = true; });
  get("analise-registro-manual").hidden = get("registro-modo").value !== "manual";
  if (get("registro-modo").value === "manual") {
    renderRows("registro-manual-auditoria", [
      ["Origem", "Valor informado pelo cartório"],
      ["Registro considerado no resumo", formatMoney(values.registro)],
      ["Composição por ato", "Não informada no modo manual"]
    ]);
  }
  Object.keys(expenseNames).forEach((id) => { get(`metric-${id}`).textContent = formatMoney(values[id]); });
  get("metric-registro-nota").textContent = partialRegistration ? "Estimativa parcial" : "Estimativa do cartório";
}

function registrationData() {
  if (get("registro-modo").value === "manual") return null;
  const base = readCents("compra");
  const divida = readCents("financiado");
  const issPercentual = readCents("registro-iss");
  if (base !== null && base <= 0) throw { id: "compra", message: "O valor de compra deve ser maior que zero." };
  if (base !== null && divida !== null && divida > base) throw { id: "financiado", message: "O financiamento não pode superar o valor do imóvel." };
  if (issPercentual !== null && issPercentual > 10000) throw { id: "registro-iss", message: "O percentual de ISS deve estar entre 0 e 100." };
  if (get("registro-sfh").checked && divida === 0) throw { id: "registro-sfh", message: "1ª aquisição SFH exige financiamento. Confira o enquadramento da operação." };
  return calcularRegistro({ uf: get("uf").value, municipio: get("municipio").value, base, divida,
    referenciaPR: get("registro-referencia-pr").value || "rib",
    sfh: get("registro-sfh").checked,
    issPercentual: issPercentual === null ? null : issPercentual / 100,
    seloCompra: get("uf").value === "RS" ? readCents("registro-selo-compra") : null,
    seloGarantia: get("uf").value === "RS" && divida > 0 ? readCents("registro-selo-garantia") : null,
    selosPR: get("uf").value === "PR" ? readCents("registro-selos-pr") : null,
    fundosPR: get("uf").value === "PR" ? readCents("registro-fundos-pr") : null,
    funrejusPR: get("uf").value === "PR" ? readCents("registro-funrejus-pr") : null,
    emolCompraPR: get("uf").value === "PR" ? readCents("registro-emol-compra-pr") : null,
    emolGarantiaPR: get("uf").value === "PR" && divida > 0 ? readCents("registro-emol-garantia-pr") : null,
    contrato: get("registro-contrato").value });
}

function resetMunicipalRegistration() {
  const key = `${get("uf").value}/${get("municipio").value}`;
  const percentage = key === "PR/Curitiba" ? CURITIBA_REGISTRO.iss : ISS_INFORMADO[key];
  get("registro-iss").value = percentage === undefined ? "" : String(percentage);
  registrationMoneyIds.forEach((id) => { get(id).value = ""; });
  get("registro-referencia-pr").value = "rib";
}

function updateRegistration(strict = false) {
  const automatic = get("registro-modo").value === "automatico";
  get("registro").readOnly = automatic;
  get("registro-label").textContent = automatic ? "Registro estimado (R$)" : "Registro informado (R$)";
  get("registro-parametros").hidden = !automatic;
  get("registro-contrato").disabled = !automatic;
  get("registro-sfh").disabled = !automatic;
  get("registro-ajustes-rs").hidden = get("uf").value !== "RS";
  get("registro-ajustes-pr").hidden = get("uf").value !== "PR";
  get("registro-fontes-pr").hidden = get("uf").value !== "PR" || get("municipio").value !== "Curitiba";
  [...registrationMoneyIds, "registro-iss"].forEach((id) => { get(id).disabled = !automatic; });
  get("registro-referencia-pr").disabled = !automatic;
  const rate = get("registro-iss").valueAsNumber;
  const curitiba = get("uf").value === "PR" && get("municipio").value === "Curitiba";
  get("registro-iss-nota").textContent = curitiba
    ? `Curitiba: ISS estimado de 5% conforme a referência da calculadora enviada pela RTx, não alíquota municipal certificada. ${get("registro-iss").value.trim() === "" ? "Campo vazio usa o padrão." : "Percentual considerado: " + rate.toLocaleString("pt-BR") + "%."} Confirme o repasse com o cartório.`
    : get("registro-iss").value.trim() === ""
    ? "ISS pendente de confirmação para este município. Informe o percentual efetivamente repassado pelo cartório; 0 somente se não houver cobrança."
    : `${get("municipio").value}: percentual efetivo de repasse de ${Number.isFinite(rate) ? rate.toLocaleString("pt-BR") : "valor inválido"}% informado para esta simulação. Confirme com o cartório; não é uma alíquota municipal cadastrada.`;
  const table = REGISTRO_TABELAS[get("uf").value];
  get("registro-fonte").href = get("uf").value === "PR" && get("registro-referencia-pr").value === "rib" ? REGISTRO_REFERENCIA_RIB.fonte : table.fonte;
  if (!automatic) {
    registrationEstimate = null;
    get("registro-status").textContent = "Valor do registro informado manualmente pelo cartório.";
    return;
  }
  try {
    registrationEstimate = registrationData();
    setMoneyValue("registro", registrationEstimate.total);
    get("registro-status").textContent = registrationEstimate.motivo;
  } catch (issue) {
    registrationEstimate = null;
    get("registro").value = "";
    get("registro-status").textContent = issue.message;
    if (strict) { if (!issue.id) issue.id = "registro-referencia-pr"; throw issue; }
  }
}

function renderRegistration() {
  get("registro-detalhes").hidden = !registrationEstimate;
  if (!registrationEstimate) return;
  const estimate = registrationEstimate;
  const detailedPR = Boolean(estimate.padraoCuritiba);
  ["registro-fundep-col", "registro-taxa-col", "registro-fundep-total", "registro-taxa-total", "registro-funrejus-row"].forEach((id) => { get(id).hidden = !detailedPR; });
  get("registro-tabela").className = detailedPR ? "registration-table detailed-pr" : "registration-table";
  ["registro-iss-label", "registro-total-label"].forEach((id) => { get(id).setAttribute("colspan", detailedPR ? "5" : "3"); });
  get("registro-bases").textContent = `Valor do imóvel: ${formatMoney(readCents("compra"))}. Valor financiado: ${formatMoney(readCents("financiado"))}.`;
  get("registro-linhas").replaceChildren(...estimate.linhas.map((line) => {
    const row = document.createElement("tr");
    const description = document.createElement("th");
    description.scope = "row";
    description.textContent = line.descricao;
    row.append(description);
    const columns = detailedPR ? [line.emolumento, line.fundep, line.selo, line.taxa, line.subtotal] : [line.emolumento, line.selo, line.subtotal];
    columns.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = line.agrupado && index === 1 ? "Total abaixo" : formatMoney(value);
      if (value === null && !line.agrupado) cell.className = "pending";
      row.append(cell);
    });
    return row;
  }));
  get("registro-emol-total").textContent = formatMoney(estimate.emolumentos ?? null);
  get("registro-selo-total").textContent = formatMoney(estimate.selos ?? null);
  get("registro-subtotal").textContent = formatMoney(estimate.subtotal ?? null);
  get("registro-fundep-total").textContent = formatMoney(estimate.fundos ?? null);
  get("registro-taxa-total").textContent = formatMoney(estimate.taxaJudiciaria ?? null);
  get("registro-funrejus-label").textContent = `FUNREJUS (0,2% sobre ${formatMoney(estimate.base ?? null)}, com teto; ou valor ajustado)`;
  get("registro-funrejus-total").textContent = formatMoney(estimate.funrejus ?? null);
  get("registro-iss-label").textContent = estimate.issPercentual === undefined || estimate.issPercentual === null
    ? "ISS (pendente)" : `ISS estimado (${estimate.issPercentual.toLocaleString("pt-BR")}% sobre ${formatMoney(estimate.emolumentos)})`;
  get("registro-iss-total").textContent = formatMoney(estimate.iss ?? null);
  get("registro-total-label").textContent = estimate.completo ? "Total estimado do registro" : "Subtotal conhecido do registro";
  get("registro-total").textContent = formatMoney(estimate.total);
  const benefit = estimate.desconto ? "1ª aquisição SFH: redução de 50% nos emolumentos, condicionada à confirmação do enquadramento. Selos não foram reduzidos automaticamente."
    : "Sem benefício selecionado.";
  const curitibaNote = estimate.padraoCuritiba ? ` ${estimate.referenciaRIB ? "Referência RIB: emolumento da garantia = 50% do emolumento da compra; não é a Tabela XIII cadastrada." : "Tabela XIII TJPR: garantia calculada pela faixa da dívida."} Uma prenotação e um arquivamento; selos por ato; FUNDEP 5% por ato; taxa judiciária 25% nos dois atos menores. FUNREJUS 0,2% sobre a compra, sem presumir isenção. Teto de 53 UPF/PR no mês: ${formatMoney(estimate.tetoFunrejus)}. O site RIB informa UPF de abril/2024; o projeto usa o mês cadastrado atual. Ajustes substituem o padrão; atos adicionais não incluídos.` : "";
  get("registro-observacao").textContent = `${estimate.motivo} ${benefit} ${get("registro-iss-nota").textContent} Base estimada pelo valor de compra; a avaliação fiscal ou o contrato podem exigir outro valor. ${estimate.tabela.versao}. Revisada em ${estimate.tabela.revisadoEm}; revisar até ${estimate.tabela.revisarAte}.${curitibaNote}`;
  get("registro-selo-fonte-wrap").hidden = get("uf").value !== "RS";
  get("registro-fonte-resumo").href = estimate.tabela.fonte;
  get("registro-fonte-resumo").textContent = `Fonte: ${estimate.tabela.versao}`;
}

function formatMoney(cents) {
  return cents === null ? "Pendente" : currency.format(cents / 100);
}

function fillOptions(id, options) {
  get(id).replaceChildren(...options.map(([value, label]) => new Option(label, value)));
}

function updateCities() {
  fillOptions("municipio", (cities[get("uf").value] || []).map((city) => [city, city]));
}

function updateModalities() {
  const bank = get("banco").value;
  const options = bank === "caixa"
    ? [["mcmv", "MCMV"], ["sbpe", "SBPE"]]
    : bank ? [["imobiliario", "Financiamento imobiliário"]] : [["", "Selecione o banco"]];
  fillOptions("modalidade", options);
  get("modalidade").disabled = !bank;
}

function readCents(id) {
  const field = get(id);
  if (field.validity.badInput) throw { id, message: "Informe um número válido." };
  if (field.value.trim() === "") return null;
  if (currencyFieldIds.includes(id)) {
    try { return parseMoneyInput(field.value); } catch (issue) { throw { id, message: issue.message }; }
  }
  const value = field.valueAsNumber;
  if (!Number.isFinite(value) || value < 0) throw { id, message: "Informe um valor válido, maior ou igual a zero." };
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.000001) {
    throw { id, message: "Informe um valor dentro do limite de cálculo, com até duas casas decimais." };
  }
  return cents;
}

function suggestedFee(bank, modality, financed) {
  if (bank === "caixa" && modality === "mcmv") return financed === null ? null : Math.round(financed * 0.015);
  if (bank === "caixa" && modality === "sbpe") return 95500;
  return { itau: 195000, santander: 185000, bradesco: 211400 }[bank] ?? null;
}

function feeDescription() {
  const bank = get("banco").value;
  let text;
  if (bank === "caixa") {
    text = get("modalidade").value === "mcmv"
      ? "Caixa MCMV: 1,5% somente do valor financiado pelo banco, sem FGTS ou subsídio."
      : "Caixa SBPE: taxa sugerida de R$ 955,00.";
  } else {
    text = {
      itau: "Itaú: taxa sugerida de R$ 1.950,00.",
      santander: "Santander: taxa sugerida de R$ 1.850,00.",
      bradesco: "Bradesco: R$ 2.114,00 é um teto estimado; o valor efetivo depende de confirmação."
    }[bank] || "Taxa bancária pendente de seleção do banco.";
  }
  return text + (adjustedFee ? " Taxa ajustada manualmente para esta operação." : "");
}

function updateFee(reset = false) {
  if (reset) adjustedFee = false;
  if (!adjustedFee) {
    let financed = null;
    try { financed = readCents("financiado"); } catch { /* A validação completa ocorre ao calcular. */ }
    const fee = suggestedFee(get("banco").value, get("modalidade").value, financed);
    setMoneyValue("taxa", fee);
  }
  get("criterio-taxa").textContent = feeDescription();
}

function invalidate() {
  error.hidden = true;
  allIds.forEach((id) => get(id).removeAttribute("aria-invalid"));
  get("resultado").hidden = true;
  get("registro-detalhes").hidden = true;
  get("itbi-detalhes").hidden = true;
  get("estado").hidden = false;
  get("estado").textContent = "Aguardando cálculo.";
  get("imprimir").disabled = true;
  ["analise-itbi", "analise-taxas", "analise-registro-manual"].forEach((id) => { get(id).hidden = true; });
  ["itbi-aguardando", "registro-aguardando", "taxas-aguardando"].forEach((id) => { get(id).hidden = false; });
  [...Object.keys(expenseNames), "total"].forEach((id) => { get(`metric-${id}`).textContent = "Pendente"; });
  get("metric-total-label").textContent = "Total estimado";
  get("metric-situacao").textContent = "Aguardando cálculo";
  get("metric-registro-nota").textContent = "Estimativa do cartório";
}

function renderRows(id, rows) {
  get(id).replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    if (value === "Pendente") detail.className = "pending";
    row.append(term, detail);
    return row;
  }));
}

function calculate() {
  invalidate();
  try {
    updateITBI(true);
    updateRegistration(true);
    if (!cities[get("uf").value]?.includes(get("municipio").value)) {
      throw { id: "municipio", message: "Selecione um município válido para o estado." };
    }
    const bank = get("banco").value;
    if (!["caixa", "itau", "santander", "bradesco"].includes(bank)) {
      throw { id: "banco", message: "Selecione o banco." };
    }
    const modality = get("modalidade").value;
    if (!(bank === "caixa" ? ["mcmv", "sbpe"] : ["imobiliario"]).includes(modality)) {
      throw { id: "modalidade", message: "Selecione uma modalidade válida para o banco." };
    }
    const values = Object.fromEntries(moneyIds.map((id) => [id, readCents(id)]));
    for (const id of ["compra", "financiado", "fgts", "subsidio"]) {
      if (values[id] === null) throw { id, message: "Preencha os dados da operação. Informe 0 quando não houver financiamento, FGTS ou subsídio." };
    }
    if (values.compra <= 0) throw { id: "compra", message: "O valor de compra deve ser maior que zero." };
    if (values.financiado + values.fgts + values.subsidio > values.compra) {
      throw { id: "financiado", message: "A soma do financiamento, FGTS e subsídio não pode superar o valor de compra." };
    }
    const pending = Object.keys(expenseNames).filter((id) => values[id] === null);
    const partialRegistration = Boolean(registrationEstimate && registrationEstimate.total !== null && !registrationEstimate.completo);
    const pendingLabels = pending.map((id) => expenseNames[id]);
    if (partialRegistration) pendingLabels.push(...registrationEstimate.pendencias);
    const known = Object.keys(expenseNames).filter((id) => values[id] !== null);
    const total = known.reduce((sum, id) => sum + values[id], 0);
    if (!Number.isSafeInteger(total)) throw { id: "compra", message: "A soma das despesas excede o limite de cálculo." };

    get("local-resumo").textContent = `${get("municipio").value} / ${get("uf").value}`;
    const now = new Date();
    get("data-resumo").textContent = now.toLocaleString("pt-BR");
    get("data-resumo").dateTime = now.toISOString();
    renderRows("impressao-operacao", [
      ["Banco e modalidade", `${get("banco").selectedOptions[0].textContent} / ${get("modalidade").selectedOptions[0].textContent}`],
      ["Cidade/UF", get("local-resumo").textContent]
    ]);
    renderRows("operacao-resumo", [
      ["Valor de compra", formatMoney(values.compra)],
      ["Financiado pelo banco", formatMoney(values.financiado)],
      ["FGTS utilizado", formatMoney(values.fgts)],
      ["Subsídio", formatMoney(values.subsidio)],
      ["Banco", get("banco").selectedOptions[0].textContent],
      ["Modalidade", get("modalidade").selectedOptions[0].textContent]
    ]);
    renderRows("despesas-resumo", Object.entries(expenseNames).map(([id, label]) => [label,
      formatMoney(values[id]) + (id === "registro" && partialRegistration ? " (parcial)" : "")]));
    renderRegistration();
    renderAudits(values, partialRegistration);
    get("situacao").textContent = pendingLabels.length ? "Estimativa incompleta" : "Despesas preenchidas";
    get("situacao").className = pendingLabels.length ? "badge incomplete" : "badge";
    get("total-label").textContent = pendingLabels.length ? "Subtotal das despesas informadas" : "Total estimado";
    get("total").textContent = formatMoney(known.length ? total : null);
    get("metric-total").textContent = get("total").textContent;
    get("metric-total-label").textContent = pendingLabels.length ? "Subtotal conhecido" : "Total estimado";
    get("metric-situacao").textContent = get("situacao").textContent;
    get("pendencias").textContent = pendingLabels.length ? `Pendente: ${pendingLabels.join(", ")}.` : "";
    get("taxa-resumo").textContent = feeDescription();
    get("estado").hidden = true;
    get("resultado").hidden = false;
    get("imprimir").disabled = false;
    return true;
  } catch (issue) {
    error.textContent = issue.message;
    error.hidden = false;
    if (issue.id) {
      if (fieldTabs[issue.id]) activateTab(fieldTabs[issue.id]);
      if ([...registrationMoneyIds, "registro-iss", "registro-modo"].includes(issue.id)) get("registro-ajustes").open = true;
      get(issue.id).setAttribute("aria-invalid", "true");
      get(issue.id).focus();
    }
    return false;
  }
}

form.addEventListener("beforeinput", handleMoneyBeforeInput);
function handleMoneyInput(event) {
  if (currencyFieldIds.includes(event.target.id)) formatMoneyField(event.target);
  invalidate();
  if (event.target.id === "taxa") adjustedFee = true;
  if (["financiado", "taxa"].includes(event.target.id)) updateFee();
  if (event.target.id === "registro" && get("registro-modo").value === "manual") manualRegistrationValue = get("registro").value;
  if (event.target.id === "itbi" && get("itbi-modo").value === "manual") manualITBIValue = get("itbi").value;
  updateITBI();
  updateRegistration();
}
form.addEventListener("input", handleMoneyInput);
form.addEventListener("change", (event) => {
  invalidate();
  if (event.target.id === "uf") updateCities();
  if (["uf", "municipio"].includes(event.target.id)) {
    resetMunicipalRegistration();
    manualITBIValue = "";
    get("itbi").value = "";
    get("itbi-venal").value = "";
  }
  if (event.target.id === "banco") updateModalities();
  if (["banco", "modalidade"].includes(event.target.id)) updateFee(true);
  if (event.target.id === "registro-modo") get("registro").value = get("registro-modo").value === "manual" ? manualRegistrationValue : "";
  if (event.target.id === "itbi-modo") get("itbi").value = get("itbi-modo").value === "manual" ? manualITBIValue : "";
  updateITBI();
  updateRegistration();
});
get("restaurar-taxa").addEventListener("click", () => { invalidate(); updateFee(true); });
form.addEventListener("submit", (event) => { event.preventDefault(); calculate(); });
get("imprimir").addEventListener("click", () => { if (calculate()) window.print(); });
window.addEventListener("beforeprint", calculate);
tabNames.forEach((name, index) => {
  get(`tab-${name}`).addEventListener("click", () => activateTab(name));
  get(`tab-${name}`).addEventListener("keydown", (event) => {
    let target;
    if (event.key === "ArrowRight") target = (index + 1) % tabNames.length;
    if (event.key === "ArrowLeft") target = (index + tabNames.length - 1) % tabNames.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = tabNames.length - 1;
    if (target !== undefined) { event.preventDefault(); activateTab(tabNames[target], true); }
  });
});

currencyFieldIds.forEach((id) => {
  const field = get(id);
  field.type = "text";
  field.inputMode = "decimal";
  field.removeAttribute("min");
  field.removeAttribute("step");
  formatMoneyField(field);
});
initializeTheme();
activateTab("resumo");
updateCities();
resetMunicipalRegistration();
updateModalities();
updateFee();
updateITBI();
updateRegistration();
}
