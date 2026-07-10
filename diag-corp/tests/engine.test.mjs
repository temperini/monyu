import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProfileSummary,
  deriveProfile,
  evaluateDiagnostic,
  getVisibleQuestions,
  pruneAnswers,
} from "../engine.js";
import { STATUS } from "../data.js";

function mechanismByCode(diagnostic, code) {
  return diagnostic.mechanisms.find((mechanism) => mechanism.code === code);
}

test("indústria em Lucro Real com P&D prioriza Lei do Bem", () => {
  const diagnostic = evaluateDiagnostic({
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_real",
    faturamento_faixa: "de_16m_300m",
    tempo_existencia: "mais_10",
    setor: "industria",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["produto_fisico", "melhoria_processo", "testes_prototipos"],
    lucro_ou_imposto: "sim",
    gasto_inovacao: "de_200k_1m",
    maturidade_contabil: "com_clareza",
    maturidade_documental: "bem_organizado",
    uso_leibem: "nunca_usei",
    pesquisadores_equipe: "sim_com_aumento",
    propriedade_intelectual: "patente_concedida",
    compra_equipamentos: "sim",
    projeto_ict: "nao",
    atividade_tic_brasil: "nao",
    ncm_ppb: "nao",
    uso_leitic: "nao",
    faturamento_tic: "nao_sei",
    estagio_projeto: "prototipo",
    aceita_ict_coexecucao: "talvez",
    apetite_divida: "sim",
    capacidade_credito: "sim",
    apetite_equity: "nao",
  });

  const leiBem = mechanismByCode(diagnostic, "LEIBEM");
  assert.equal(leiBem.status, STATUS.AVAILABLE);
  assert.equal(diagnostic.mainOpportunities[0].code, "LEIBEM");
  assert.ok(leiBem.estimate.max > leiBem.estimate.min);
});

test("startup no Simples Nacional encontra funding, EMBRAPII e Marco Legal", () => {
  const diagnostic = evaluateDiagnostic({
    objetivo_principal: "buscar_funding",
    regime_tributario: "simples_nacional",
    faturamento_faixa: "de_48m_16m",
    tempo_existencia: "de_2_5",
    setor: "tecnologia_software",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["software_proprio", "testes_prototipos"],
    lucro_ou_imposto: "prejuizo",
    gasto_inovacao: "de_50k_200k",
    maturidade_contabil: "mais_ou_menos",
    maturidade_documental: "algumas_evidencias",
    atividade_tic_brasil: "nao",
    ncm_ppb: "nao_sei",
    uso_leitic: "nao",
    faturamento_tic: "de_500k_5m",
    estagio_projeto: "prototipo",
    aceita_ict_coexecucao: "sim",
    apetite_divida: "talvez",
    capacidade_credito: "talvez",
    apetite_equity: "sim",
  });

  assert.equal(mechanismByCode(diagnostic, "LEIBEM").status, STATUS.PREPARE);
  assert.equal(mechanismByCode(diagnostic, "FOMENTO_NAOREEMB").status, STATUS.VALIDATE);
  assert.equal(mechanismByCode(diagnostic, "EMBRAPII").status, STATUS.VALIDATE);
  assert.equal(mechanismByCode(diagnostic, "STARTUPLC182").status, STATUS.VALIDATE);
});

test("objetivo de atrair investidor mantém a pergunta de equity na trilha", () => {
  const answers = {
    objetivo_principal: "atrair_investidor",
    regime_tributario: "simples_nacional",
    faturamento_faixa: "de_48m_16m",
    tempo_existencia: "de_2_5",
    setor: "tecnologia_software",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["software_proprio"],
  };
  const visibleQuestionIds = getVisibleQuestions(answers).map((question) => question.id);

  assert.ok(visibleQuestionIds.includes("apetite_equity"));
});

test("empresa TIC com hardware no Brasil sinaliza Lei de TICs e alerta de interação", () => {
  const diagnostic = evaluateDiagnostic({
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_real",
    faturamento_faixa: "de_16m_300m",
    tempo_existencia: "mais_10",
    setor: "eletronicos_hardware",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["produto_fisico", "testes_prototipos"],
    lucro_ou_imposto: "sim",
    gasto_inovacao: "de_1m_5m",
    maturidade_contabil: "com_clareza",
    maturidade_documental: "bem_organizado",
    uso_leibem: "nunca_usei",
    pesquisadores_equipe: "sim_sem_aumento",
    propriedade_intelectual: "nao",
    compra_equipamentos: "sim",
    projeto_ict: "nao",
    atividade_tic_brasil: "sim",
    ncm_ppb: "ncm_e_ppb",
    uso_leitic: "nao",
    faturamento_tic: "de_5m_50m",
    estagio_projeto: "mercado",
    aceita_ict_coexecucao: "nao",
    apetite_divida: "nao",
    capacidade_credito: "nao",
    apetite_equity: "nao",
  });

  const leiTics = mechanismByCode(diagnostic, "LEITIC");
  const leiBem = mechanismByCode(diagnostic, "LEIBEM");
  assert.equal(leiTics.status, STATUS.VALIDATE);
  assert.ok(leiBem.alerts.some((alert) => alert.includes("interação entre Lei do Bem e Lei de TICs")));
});

test("setor de semicondutores abre a trilha de TICs", () => {
  const visibleQuestionIds = getVisibleQuestions({
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_real",
    faturamento_faixa: "de_16m_300m",
    tempo_existencia: "mais_10",
    setor: "semicondutores",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["melhoria_processo"],
  }).map((question) => question.id);

  assert.ok(visibleQuestionIds.includes("atividade_tic_brasil"));
  assert.ok(visibleQuestionIds.includes("atua_semicondutores"));
});

test("empresa sem inovação clara encerra antes das perguntas financeiras", () => {
  const answers = {
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_presumido",
    faturamento_faixa: "de_360k_48m",
    tempo_existencia: "de_5_10",
    setor: "servicos",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["nenhuma"],
    inovacao_informal: "nao",
    gasto_inovacao: "de_200k_1m",
  };
  const profile = deriveProfile(answers);
  const visibleQuestionIds = getVisibleQuestions(answers).map((question) => question.id);
  const pruned = pruneAnswers(answers);
  const diagnostic = evaluateDiagnostic(answers);

  assert.equal(profile.noInnovationPath, true);
  assert.ok(!visibleQuestionIds.includes("gasto_inovacao"));
  assert.equal(pruned.gasto_inovacao, undefined);
  assert.equal(diagnostic.noInnovation, true);
});

test("assinatura do perfil contextualiza respostas ainda desconhecidas", () => {
  const summary = buildProfileSummary({
    setor: "varejo",
    regime_tributario: "nao_sei",
    objetivo_principal: "nao_sei",
  });

  assert.equal(summary.signals[0].label, "Atuação principal");
  assert.equal(summary.signals[1].value, "Regime a confirmar");
  assert.equal(summary.signals[2].value, "Foco em exploração");
  assert.ok(!summary.headline.includes("Não sei"));
});

test("decisão de não avaliar fecha as perguntas operacionais da nova trilha", () => {
  const visibleQuestionIds = getVisibleQuestions({
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_real",
    faturamento_faixa: "de_16m_300m",
    tempo_existencia: "mais_10",
    setor: "varejo",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["nenhuma"],
    inovacao_informal: "nao",
    finalidade_renuncia_tecnologia: "nao_avaliar",
  }).map((question) => question.id);

  assert.ok(visibleQuestionIds.includes("finalidade_renuncia_tecnologia"));
  assert.ok(!visibleQuestionIds.includes("lucro_operacional_faixa"));
  assert.ok(!visibleQuestionIds.includes("modelo_execucao_tecnologia"));
  assert.ok(!visibleQuestionIds.includes("gasto_tecnologia_renuncia"));
});

test("empresa no Lucro Real com operação de tecnologia recebe Renúncia Fiscal em Tecnologia", () => {
  const diagnostic = evaluateDiagnostic({
    objetivo_principal: "reduzir_impostos",
    regime_tributario: "lucro_real",
    faturamento_faixa: "de_16m_300m",
    tempo_existencia: "mais_10",
    setor: "varejo",
    regularidade_fiscal: "sim",
    atividades_inovacao: ["nenhuma"],
    inovacao_informal: "nao",
    finalidade_renuncia_tecnologia: "trabalhador_comunidade",
    lucro_operacional_faixa: "de_10m_50m",
    modelo_execucao_tecnologia: ["equipe_clt", "profissionais_pj", "consultoria_desenvolvimento"],
    gasto_tecnologia_renuncia: "de_1m_5m",
  });

  const renuncia = mechanismByCode(diagnostic, "RENUCIA_TECNOLOGIA");
  assert.equal(diagnostic.noInnovation, false);
  assert.equal(renuncia.status, STATUS.VALIDATE);
  assert.equal(renuncia.estimate.kind, "financial");
  assert.ok(renuncia.alerts.some((alert) => alert.includes("PJ")));
});
