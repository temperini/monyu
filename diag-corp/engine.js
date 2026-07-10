import {
  MECHANISM_META,
  OBJECTIVE_PRIORITIES,
  PARAMETERS,
  QUESTION_BANK,
  QUESTION_INDEX,
  STATUS,
  STATUS_COPY,
} from "./data.js";

const FORMAL_INNOVATION = new Set([
  "produto_fisico",
  "software_proprio",
  "melhoria_processo",
  "testes_prototipos",
  "parceria_ict",
]);

const RENUNCIA_OBJECTIVES = new Set([
  "reduzir_impostos",
  "financiar_expansao",
  "apoiar_projetos",
  "nao_sei",
]);
const FUNDING_OBJECTIVES = new Set([
  "buscar_funding",
  "financiar_expansao",
  "atrair_investidor",
  "nao_sei",
]);

const RANGE_BY_ANSWER = Object.freeze({
  gasto_inovacao: "innovationSpend",
  valor_projeto_ict: "ictProject",
  gasto_tecnologia_renuncia: "technologyOperation",
  lucro_operacional_faixa: "operatingProfit",
  faturamento_tic: "ticRevenue",
});

const INSTANT_STATUSES = new Set([STATUS.AVAILABLE, STATUS.OPTIMIZE, STATUS.VALIDATE]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function hasAny(values, accepted) {
  return values.some((value) => accepted.includes(value));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function moneyEstimate(range, exclusionRate, label, premise) {
  if (!range) return null;

  return {
    kind: "financial",
    label,
    min: Math.round(range.min * exclusionRate * PARAMETERS.taxRate),
    max: range.max === null ? null : Math.round(range.max * exclusionRate * PARAMETERS.taxRate),
    premise,
  };
}

function minimumRange(left, right) {
  if (!left || !right) return null;

  return {
    min: Math.min(left.min, right.min),
    max:
      left.max === null
        ? right.max
        : right.max === null
          ? left.max
          : Math.min(left.max, right.max),
  };
}

function taxFromOperationalProfit(value) {
  const config = PARAMETERS.renunciaTecnologia;
  const profit = Math.max(0, value);
  const additionalBase = Math.max(0, profit - config.irpjAdditionalAnnualThreshold);

  return profit * config.irpjRate + additionalBase * config.irpjAdditionalRate + profit * config.csllRate;
}

function renunciaTechnologyEstimate(operatingProfitRange, technologyRange, limitRate, routeLabel) {
  if (!operatingProfitRange || !technologyRange || !limitRate) return null;

  const legalCap = {
    min: operatingProfitRange.min * limitRate,
    max: operatingProfitRange.max === null ? null : operatingProfitRange.max * limitRate,
  };
  const eligibleScale = minimumRange(technologyRange, legalCap);
  const savingsMin =
    taxFromOperationalProfit(operatingProfitRange.min) -
    taxFromOperationalProfit(operatingProfitRange.min - eligibleScale.min);
  const savingsMax =
    operatingProfitRange.max === null || eligibleScale.max === null
      ? null
      : taxFromOperationalProfit(operatingProfitRange.max) -
        taxFromOperationalProfit(operatingProfitRange.max - eligibleScale.max);

  return {
    kind: "financial",
    label: "Economia fiscal preliminar por ano",
    min: Math.round(savingsMin),
    max: savingsMax === null ? null : Math.round(savingsMax),
    premise: `Rota ${routeLabel}; teto de ${(limitRate * 100).toFixed(1)}% sobre o lucro operacional; escala considerada limitada à faixa de tecnologia informada; IRPJ, adicional e CSLL simulados separadamente.`,
  };
}

function qualitativeEstimate(label, detail) {
  return { kind: "qualitative", label, detail };
}

function createMechanism(code, details) {
  const meta = MECHANISM_META[code];
  return {
    code,
    name: meta.name,
    source: meta.source,
    status: STATUS.NOT_RELEVANT,
    confidence: "baixa",
    effort: "Médio",
    positives: [],
    alerts: [],
    blockers: [],
    estimate: null,
    nextStep: "",
    ...details,
  };
}

function taxConfidence(profile, answers) {
  const high =
    profile.lucroRealConfirmed &&
    answers.lucro_ou_imposto === "sim" &&
    answers.maturidade_contabil === "com_clareza" &&
    answers.maturidade_documental === "bem_organizado";

  if (high) return "alta";

  if (
    answers.regime_tributario === "nao_sei" ||
    ["nao_sei", "validar_contador"].includes(answers.lucro_ou_imposto) ||
    profile.documentRisk === "alto"
  ) {
    return "baixa";
  }

  return "media";
}

function documentRiskLabel(risk) {
  return risk === "baixo" ? "Baixo" : risk === "alto" ? "Alto" : "Médio";
}

function fitLevelFromStage(profile, answers) {
  if (!profile.innovationPositive) return "baixo";
  if (answers.estagio_projeto === "prototipo" || answers.estagio_projeto === "escalar") {
    return profile.regularityPositive ? "alto" : "medio";
  }
  if (answers.estagio_projeto === "ideia" || answers.estagio_projeto === "mercado") return "medio";
  return "baixo";
}

export function deriveProfile(answers = {}) {
  const activities = list(answers.atividades_inovacao);
  const formalInnovation = activities.some((activity) => FORMAL_INNOVATION.has(activity));
  const needsInformalCheck = activities.includes("nenhuma") || activities.includes("nao_sei");
  const informalInnovation = ["com_frequencia", "as_vezes"].includes(answers.inovacao_informal);
  const innovationPositive = formalInnovation || informalInnovation;
  const waitingForInformalCheck = needsInformalCheck && !answers.inovacao_informal;
  const noInnovationPath = needsInformalCheck && Boolean(answers.inovacao_informal) && !innovationPositive;
  const regularityPositive = ["sim", "parcelamento_em_dia"].includes(answers.regularidade_fiscal);
  const fiscalUnknown = answers.regularidade_fiscal === "nao_sei";
  const lucroRealConfirmed = answers.regime_tributario === "lucro_real";
  const lucroRealPossible = ["lucro_real", "nao_sei"].includes(answers.regime_tributario);
  const taxMonetization = answers.lucro_ou_imposto === "sim" && regularityPositive;
  const ticIndicator =
    ["tecnologia_software", "eletronicos_hardware", "semicondutores"].includes(answers.setor) ||
    activities.includes("produto_fisico") ||
    activities.includes("software_proprio");
  const ticPotential = answers.atividade_tic_brasil === "sim" || answers.uso_leitic === "usa_hoje";
  const accountingWeak = ["nao", "nao_sei"].includes(answers.maturidade_contabil);
  const documentationWeak = ["quase_nada", "nao_sei"].includes(answers.maturidade_documental);
  const accountingPartial = answers.maturidade_contabil === "mais_ou_menos";
  const documentationPartial = answers.maturidade_documental === "algumas_evidencias";
  const documentRisk =
    accountingWeak || documentationWeak
      ? "alto"
      : answers.maturidade_contabil === "com_clareza" && answers.maturidade_documental === "bem_organizado"
        ? "baixo"
        : accountingPartial || documentationPartial
          ? "medio"
          : "medio";
  const startupPotential =
    ["ate_360k", "de_360k_48m", "de_48m_16m"].includes(answers.faturamento_faixa) &&
    ["menos_2", "de_2_5", "de_5_10"].includes(answers.tempo_existencia) &&
    innovationPositive;
  const technologyExecution = list(answers.modelo_execucao_tecnologia);
  const technologyOperationPresent = technologyExecution.some((model) =>
    [
      "equipe_clt",
      "profissionais_pj",
      "consultoria_desenvolvimento",
      "servicos_gerenciados",
    ].includes(model),
  );
  const internalCltTechnology = technologyExecution.includes("equipe_clt");
  const contractedPjTechnology = technologyExecution.includes("profissionais_pj");
  const outsourcedTechnology = technologyExecution.some((model) =>
    ["consultoria_desenvolvimento", "servicos_gerenciados"].includes(model),
  );
  const renunciaCandidate =
    lucroRealPossible && RENUNCIA_OBJECTIVES.has(answers.objetivo_principal);

  return {
    activities,
    formalInnovation,
    needsInformalCheck,
    informalInnovation,
    innovationPositive,
    waitingForInformalCheck,
    noInnovationPath,
    regularityPositive,
    fiscalUnknown,
    lucroRealConfirmed,
    lucroRealPossible,
    taxMonetization,
    ticIndicator,
    ticPotential,
    documentRisk,
    startupPotential,
    technologyExecution,
    technologyOperationPresent,
    internalCltTechnology,
    contractedPjTechnology,
    outsourcedTechnology,
    renunciaCandidate,
  };
}

export function isQuestionVisible(question, answers, profile = deriveProfile(answers)) {
  if (question.order > 8 && profile.waitingForInformalCheck) return false;
  if (
    question.order > 8 &&
    profile.noInnovationPath &&
    !["renuncia_track", "renuncia_operational_track"].includes(question.condition)
  ) {
    return false;
  }

  switch (question.condition) {
    case "always":
      return true;
    case "needs_informal_check":
      return profile.needsInformalCheck;
    case "innovation_positive":
      return profile.innovationPositive;
    case "leibem_track":
      return profile.innovationPositive && profile.lucroRealPossible;
    case "ict_19a_track":
      return (
        profile.lucroRealPossible &&
        ["sim", "negociando"].includes(answers.projeto_ict)
      );
    case "tic_track":
      return profile.ticIndicator;
    case "renuncia_track":
      return profile.renunciaCandidate;
    case "renuncia_operational_track":
      return (
        profile.renunciaCandidate &&
        ["educacao_pesquisa", "trabalhador_comunidade", "nao_sei"].includes(
          answers.finalidade_renuncia_tecnologia,
        )
      );
    case "funding_track":
      return profile.innovationPositive && FUNDING_OBJECTIVES.has(answers.objetivo_principal);
    case "semiconductor_track":
      return answers.setor === "semicondutores";
    case "automotive_track":
      return answers.setor === "automotivo_mobilidade";
    default:
      return false;
  }
}

export function getVisibleQuestions(answers = {}) {
  const profile = deriveProfile(answers);
  return QUESTION_BANK.filter((question) => isQuestionVisible(question, answers, profile));
}

export function pruneAnswers(answers = {}) {
  let pruned = { ...answers };

  for (let pass = 0; pass < 4; pass += 1) {
    const visibleIds = new Set(getVisibleQuestions(pruned).map((question) => question.id));
    const next = Object.fromEntries(
      Object.entries(pruned).filter(([key]) => visibleIds.has(key)),
    );

    if (Object.keys(next).length === Object.keys(pruned).length) return next;
    pruned = next;
  }

  return pruned;
}

export function getQuestion(questionId) {
  return QUESTION_INDEX[questionId] ?? null;
}

export function getAnswerLabel(questionId, answer) {
  const question = getQuestion(questionId);
  if (!question) return "";

  if (Array.isArray(answer)) {
    return answer
      .map((value) => question.options.find((option) => option.value === value)?.label)
      .filter(Boolean)
      .join(", ");
  }

  return question.options.find((option) => option.value === answer)?.label ?? "";
}

export function getAnswerRange(answerKey, value) {
  const rangeGroup = RANGE_BY_ANSWER[answerKey];
  if (!rangeGroup || !value || value === "nao_sei") return null;
  return PARAMETERS.ranges[rangeGroup][value] ?? null;
}

export function getNextQuestionId(answers, currentQuestionId) {
  const currentOrder = getQuestion(currentQuestionId)?.order ?? 0;
  return getVisibleQuestions(answers).find((question) => question.order > currentOrder)?.id ?? null;
}

export function getPreviousQuestionId(answers, currentQuestionId) {
  const currentOrder = getQuestion(currentQuestionId)?.order ?? Number.MAX_SAFE_INTEGER;
  return getVisibleQuestions(answers)
    .filter((question) => question.order < currentOrder)
    .at(-1)?.id ?? null;
}

function evaluateLeiBem(answers, profile) {
  const spendRange = getAnswerRange("gasto_inovacao", answers.gasto_inovacao);
  const potential = profile.lucroRealPossible && profile.innovationPositive && Boolean(spendRange);
  const immediate = profile.lucroRealConfirmed && profile.innovationPositive && profile.taxMonetization && Boolean(spendRange);
  const hasResearcherIncrease = answers.pesquisadores_equipe === "sim_com_aumento";
  const hasIntellectualProperty = ["patente_concedida", "cultivar_registrado"].includes(
    answers.propriedade_intelectual,
  );
  const exclusionRate = Math.min(
    PARAMETERS.leiBem.baseExclusion +
      (hasResearcherIncrease ? PARAMETERS.leiBem.researcherIncreaseHigh : 0) +
      (hasIntellectualProperty ? PARAMETERS.leiBem.intellectualPropertyIncrease : 0),
    PARAMETERS.leiBem.maxExclusion,
  );
  const estimate = moneyEstimate(
    spendRange,
    exclusionRate,
    "Economia fiscal preliminar por ano",
    `Gastos informados em ${spendRange?.label ?? "faixa não informada"}, exclusão configurada de ${(exclusionRate * 100).toFixed(0)}% e alíquota combinada de ${(PARAMETERS.taxRate * 100).toFixed(0)}%.`,
  );
  const confidence = taxConfidence(profile, answers);
  const alerts = [];
  const blockers = [];

  if (!profile.regularityPositive) blockers.push("A regularidade fiscal precisa ser confirmada ou regularizada.");
  if (answers.lucro_ou_imposto !== "sim") alerts.push("A existência de lucro tributável ou imposto a pagar ainda precisa ser confirmada.");
  if (profile.documentRisk !== "baixo") {
    alerts.push(`Organização de gastos e evidências: risco ${documentRiskLabel(profile.documentRisk).toLowerCase()}.`);
  }
  if (profile.ticPotential) {
    alerts.push("Como a empresa atua em tecnologia, a interação entre Lei do Bem e Lei de TICs deve ser validada para evitar dupla contagem.");
  }

  let status = STATUS.NOT_RELEVANT;
  if (answers.uso_leibem === "usa_hoje") status = STATUS.OPTIMIZE;
  else if (immediate) status = STATUS.AVAILABLE;
  else if (potential) status = STATUS.VALIDATE;
  else if (profile.innovationPositive && answers.regime_tributario && !profile.lucroRealConfirmed) status = STATUS.PREPARE;

  return createMechanism("LEIBEM", {
    status,
    confidence,
    effort: profile.documentRisk === "baixo" ? "Baixo" : "Médio",
    estimate,
    positives: unique([
      profile.innovationPositive ? "Há atividades de criação, melhoria ou desenvolvimento identificadas." : "",
      profile.lucroRealConfirmed ? "A empresa informou Lucro Real." : "",
      profile.taxMonetization ? "Há indicação de imposto ou lucro tributável e regularidade mínima." : "",
      hasResearcherIncrease ? "O aumento de equipe pode ampliar a estimativa, sujeito à validação." : "",
      hasIntellectualProperty ? "Patente ou cultivar concedida pode ampliar a estimativa, sujeito à validação." : "",
    ]),
    alerts,
    blockers,
    nextStep:
      status === STATUS.AVAILABLE || status === STATUS.OPTIMIZE
        ? "Mapear projetos e gastos elegíveis por iniciativa, reunir evidências técnicas e validar a apuração com especialista."
        : "Confirmar regime tributário, lucro/imposto e gastos por projeto antes de estimar o aproveitamento final.",
  });
}

function evaluateLeiBemIct(answers, profile) {
  const projectRange = getAnswerRange("valor_projeto_ict", answers.valor_projeto_ict);
  const potential = profile.lucroRealPossible && ["sim", "negociando"].includes(answers.projeto_ict);
  const immediate =
    profile.lucroRealConfirmed &&
    profile.taxMonetization &&
    answers.projeto_ict === "sim" &&
    answers.ict_19a_aprovacao === "sim";
  const estimate = moneyEstimate(
    projectRange,
    PARAMETERS.leiBemIct19A.conservativeExclusion,
    "Economia fiscal preliminar por ano",
    `Estimativa conservadora com exclusão de 50% sobre ${projectRange?.label ?? "a faixa informada"}; a regra aplicável ao projeto deve ser validada formalmente.`,
  );
  const alerts = [];
  if (answers.ict_19a_aprovacao !== "sim") {
    alerts.push("Sem aprovação formal ou portaria confirmada, esta trilha deve ser tratada apenas como potencial.");
  }
  if (!projectRange) alerts.push("O valor do projeto não foi informado; não há estimativa financeira nesta análise.");

  return createMechanism("LEIBEM_ICT_19A", {
    status: immediate ? STATUS.AVAILABLE : potential ? STATUS.VALIDATE : STATUS.NOT_RELEVANT,
    confidence: immediate && answers.ict_19a_aprovacao === "sim" ? "media" : "baixa",
    effort: "Alto",
    estimate,
    positives: unique([
      answers.projeto_ict === "sim" ? "Há um projeto formal com universidade, instituto ou laboratório." : "",
      answers.projeto_ict === "negociando" ? "A empresa já está estruturando uma parceria técnica." : "",
      answers.ict_19a_aprovacao === "sim" ? "Aprovação formal ou portaria foi indicada." : "",
    ]),
    alerts,
    blockers: profile.lucroRealConfirmed ? [] : ["A regra exige tributação pelo Lucro Real."],
    nextStep: "Validar a formalização do projeto, o parceiro executante, a aprovação aplicável e os documentos de execução antes de considerar o benefício.",
  });
}

function evaluateLeiTics(answers, profile) {
  const revenueRange = getAnswerRange("faturamento_tic", answers.faturamento_tic);
  const mapped = answers.ncm_ppb === "ncm_e_ppb";
  let level = "baixo";
  if (["de_5m_50m", "acima_50m"].includes(answers.faturamento_tic)) level = "alto";
  else if (answers.faturamento_tic === "de_500k_5m") level = "medio";

  let status = STATUS.NOT_RELEVANT;
  if (answers.uso_leitic === "usa_hoje") status = STATUS.OPTIMIZE;
  else if (answers.atividade_tic_brasil === "sim" && mapped) status = STATUS.VALIDATE;
  else if (answers.atividade_tic_brasil === "sim") status = STATUS.PREPARE;

  return createMechanism("LEITIC", {
    status,
    confidence: mapped ? "media" : "baixa",
    effort: "Alto",
    estimate:
      status === STATUS.NOT_RELEVANT
        ? null
        : qualitativeEstimate(
            `Potencial ${level}`,
            revenueRange
              ? `A classificação considera faturamento de tecnologia na faixa ${revenueRange.label}. O crédito financeiro depende de produto, NCM, PPB e regras aplicáveis.`
              : "O cálculo do crédito financeiro depende de produto, NCM, PPB e regras aplicáveis.",
          ),
    positives: unique([
      answers.atividade_tic_brasil === "sim" ? "Há indicação de desenvolvimento ou produção de tecnologia no Brasil." : "",
      mapped ? "NCM e PPB foram informados como mapeados." : "",
      answers.uso_leitic === "usa_hoje" ? "A empresa já informou uso do regime." : "",
    ]),
    alerts: unique([
      !mapped && answers.atividade_tic_brasil === "sim" ? "NCM e processo produtivo ainda precisam ser mapeados." : "",
      answers.atividade_tic_brasil === "sim" ? "Esta análise não estima crédito financeiro exato sem validar produto, NCM, PPB e coeficientes aplicáveis." : "",
    ]),
    blockers: [],
    nextStep:
      status === STATUS.OPTIMIZE
        ? "Revisar produtos habilitados, obrigações de PD&I e documentação de uso do regime."
        : "Fazer análise técnica de enquadramento do produto, NCM, PPB e necessidade de habilitação.",
  });
}

function evaluateRenunciaTecnologia(answers, profile) {
  const purpose = answers.finalidade_renuncia_tecnologia;
  const purposeClear = ["educacao_pesquisa", "trabalhador_comunidade"].includes(purpose);
  const operatingProfitRange = getAnswerRange(
    "lucro_operacional_faixa",
    answers.lucro_operacional_faixa,
  );
  const technologyRange = getAnswerRange(
    "gasto_tecnologia_renuncia",
    answers.gasto_tecnologia_renuncia,
  );
  const route =
    purpose === "educacao_pesquisa"
      ? {
          label: "educação, capacitação ou pesquisa em tecnologia",
          limitRate: PARAMETERS.renunciaTecnologia.educationResearchOperatingProfitLimit,
        }
      : purpose === "trabalhador_comunidade"
        ? {
            label: "trabalhadores, dependentes ou comunidade",
            limitRate: PARAMETERS.renunciaTecnologia.workerCommunityOperatingProfitLimit,
          }
        : null;
  const candidate = profile.renunciaCandidate && Boolean(purpose) && purpose !== "nao_avaliar";
  const readyForValidation =
    candidate &&
    profile.lucroRealConfirmed &&
    profile.regularityPositive &&
    purposeClear &&
    profile.technologyOperationPresent &&
    operatingProfitRange &&
    technologyRange;

  let status = STATUS.NOT_RELEVANT;
  if (readyForValidation) status = STATUS.VALIDATE;
  else if (candidate) status = STATUS.PREPARE;

  return createMechanism("RENUCIA_TECNOLOGIA", {
    status,
    confidence: readyForValidation ? "media" : "baixa",
    effort: "Alto",
    estimate: route
      ? renunciaTechnologyEstimate(
          operatingProfitRange,
          technologyRange,
          route.limitRate,
          route.label,
        )
      : null,
    positives: unique([
      profile.lucroRealConfirmed ? "A empresa informou apuração pelo Lucro Real." : "",
      purposeClear ? `Finalidade selecionada: ${route.label}.` : "",
      profile.internalCltTechnology ? "Há equipe interna de tecnologia contratada pela empresa." : "",
      profile.outsourcedTechnology ? "Há fornecedores recorrentes que ajudam a executar a operação de tecnologia." : "",
      profile.regularityPositive ? "A regularidade fiscal foi informada como positiva." : "",
    ]),
    alerts: unique([
      candidate
        ? "A escala informada de tecnologia não se torna elegível automaticamente; a estrutura, a finalidade e os documentos precisam ser validados."
        : "",
      candidate
        ? "Antes de qualquer aproveitamento, valide a entidade beneficiária, o fluxo financeiro, a documentação e a finalidade da operação."
        : "",
      purpose === "trabalhador_comunidade" && profile.contractedPjTechnology
        ? "Profissionais PJ não devem ser classificados automaticamente como empregados para a rota de trabalhadores, dependentes ou comunidade."
        : "",
      purpose === "nao_sei"
        ? "A definição entre a rota de 1,5% e a rota de 2% ainda precisa ser concluída."
        : "",
    ]),
    blockers: unique([
      candidate && !profile.lucroRealConfirmed
        ? "A apuração pelo Lucro Real precisa ser confirmada antes de estruturar a operação."
        : "",
      candidate && !purposeClear ? "A finalidade legal da operação precisa ser definida." : "",
      candidate && !profile.technologyOperationPresent
        ? "A operação de tecnologia precisa ser caracterizada com equipe ou fornecedores envolvidos."
        : "",
      candidate && !operatingProfitRange
        ? "A faixa de lucro operacional é necessária para estimar o teto legal."
        : "",
      candidate && !technologyRange
        ? "A escala anual de equipe e serviços de tecnologia é necessária para a simulação."
        : "",
    ]),
    nextStep:
      status === STATUS.NOT_RELEVANT
        ? "Revisar a prioridade e o regime tributário antes de avaliar esta trilha."
        : "Validar a finalidade legal, o parceiro elegível, o fluxo financeiro e a documentação da operação antes de estruturar a execução em tecnologia.",
  });
}

function evaluateFomento(answers, profile) {
  const fit =
    profile.innovationPositive &&
    ["ideia", "prototipo", "escalar"].includes(answers.estagio_projeto);
  const level = fitLevelFromStage(profile, answers);
  const status = fit
    ? profile.regularityPositive
      ? STATUS.VALIDATE
      : STATUS.PREPARE
    : STATUS.NOT_RELEVANT;

  return createMechanism("FOMENTO_NAOREEMB", {
    status,
    confidence: answers.estagio_projeto === "nao_sei" ? "baixa" : "media",
    effort: "Médio",
    estimate:
      status === STATUS.NOT_RELEVANT
        ? null
        : qualitativeEstimate(`Fit ${level}`, "Editais e chamadas têm critérios, prazos e concorrência próprios. Não há valor garantido nesta etapa."),
    positives: unique([
      fit ? "Há projeto em fase compatível com chamadas de inovação." : "",
      profile.regularityPositive ? "A regularidade fiscal informada favorece a participação em chamadas." : "",
    ]),
    alerts: !profile.regularityPositive ? ["Regularidade fiscal pode impedir ou dificultar a participação em editais."] : [],
    blockers: [],
    nextStep: "Organizar escopo, cronograma, orçamento e documentação da empresa para monitorar chamadas compatíveis.",
  });
}

function evaluateCredit(answers, profile) {
  const fit =
    profile.regularityPositive &&
    ["sim", "talvez"].includes(answers.apetite_divida) &&
    profile.innovationPositive;
  let status = STATUS.NOT_RELEVANT;
  if (fit && ["sim", "talvez"].includes(answers.capacidade_credito)) status = STATUS.VALIDATE;
  else if (answers.apetite_divida === "sim" && !profile.regularityPositive) status = STATUS.PREPARE;

  return createMechanism("CREDITO_SUBSIDIADO", {
    status,
    confidence: answers.capacidade_credito === "sim" ? "media" : "baixa",
    effort: "Médio",
    estimate:
      status === STATUS.NOT_RELEVANT
        ? null
        : qualitativeEstimate("Linha a estruturar", "A economia depende do valor financiado, prazo, garantias, taxa e linha disponível. Não há economia de juros calculada neste diagnóstico."),
    positives: unique([
      ["sim", "talvez"].includes(answers.apetite_divida) ? "A empresa demonstrou abertura para financiamento." : "",
      answers.capacidade_credito === "sim" ? "Há indicação de capacidade de pagamento ou garantias." : "",
    ]),
    alerts: unique([
      !profile.regularityPositive && answers.apetite_divida === "sim" ? "A regularidade fiscal precisa ser tratada antes de buscar crédito subsidiado." : "",
      answers.capacidade_credito === "nao" ? "A capacidade de garantias ou pagamento precisa ser fortalecida." : "",
    ]),
    blockers: [],
    nextStep: "Validar regularidade, capacidade de pagamento, garantias e o projeto que será financiado antes de comparar linhas.",
  });
}

function evaluateEmbrapii(answers, profile) {
  const fit =
    profile.innovationPositive &&
    ["sim", "talvez"].includes(answers.aceita_ict_coexecucao) &&
    ["prototipo", "escalar", "mercado"].includes(answers.estagio_projeto);

  return createMechanism("EMBRAPII", {
    status: fit ? STATUS.VALIDATE : STATUS.NOT_RELEVANT,
    confidence: fit ? "media" : "baixa",
    effort: "Médio",
    estimate:
      fit
        ? qualitativeEstimate("Fit para cofinanciamento", "O percentual de apoio depende da unidade credenciada, do projeto e da negociação; não é benefício garantido.")
        : null,
    positives: unique([
      fit ? "O projeto está em etapa compatível com desenvolvimento colaborativo." : "",
      answers.aceita_ict_coexecucao === "sim" ? "A empresa aceita coexecutar com parceiro técnico." : "",
    ]),
    alerts: [],
    blockers: [],
    nextStep: "Selecionar uma unidade credenciada compatível e preparar uma conversa técnica sobre escopo, contrapartida e cronograma.",
  });
}

function evaluateStartup(answers, profile) {
  const recommendEquity = profile.startupPotential && ["sim", "talvez"].includes(answers.apetite_equity);
  let status = STATUS.NOT_RELEVANT;
  if (recommendEquity) status = STATUS.VALIDATE;
  else if (profile.startupPotential) status = STATUS.PREPARE;

  return createMechanism("STARTUPLC182", {
    status,
    confidence: profile.startupPotential ? "media" : "baixa",
    effort: "Médio",
    estimate:
      status === STATUS.NOT_RELEVANT
        ? null
        : qualitativeEstimate("Fit de estruturação", "Não é um benefício fiscal direto. Pode apoiar captação, investimento, ambiente regulatório e contratação pública inovadora."),
    positives: unique([
      profile.startupPotential ? "Porte, tempo de existência e inovação indicam potencial de enquadramento inicial." : "",
      ["sim", "talvez"].includes(answers.apetite_equity) ? "Há abertura para avaliar capital externo." : "",
    ]),
    alerts: [],
    blockers: [],
    nextStep: "Organizar tese de crescimento, cap table, materiais de captação e evidências de inovação para avaliar oportunidades de investimento.",
  });
}

function evaluatePadis(answers) {
  const potential = answers.setor === "semicondutores" && ["sim", "nao_sei"].includes(answers.atua_semicondutores);
  return createMechanism("PADIS", {
    status: potential ? STATUS.VALIDATE : STATUS.NOT_RELEVANT,
    confidence: "baixa",
    effort: "Alto",
    estimate: potential ? qualitativeEstimate("Oportunidade setorial", "A análise de PADIS exige avaliação específica do produto, processo e requisitos vigentes.") : null,
    positives: potential ? ["Há indicação de atuação na cadeia de semicondutores ou displays."] : [],
    alerts: [],
    blockers: [],
    nextStep: "Fazer uma análise setorial específica antes de considerar esta oportunidade.",
  });
}

function evaluateRota2030(answers) {
  const potential = answers.setor === "automotivo_mobilidade" && ["sim", "nao_sei"].includes(answers.atua_rota2030);
  return createMechanism("ROTA2030", {
    status: potential ? STATUS.VALIDATE : STATUS.NOT_RELEVANT,
    confidence: "baixa",
    effort: "Alto",
    estimate: potential ? qualitativeEstimate("Oportunidade setorial", "A análise de Rota 2030 exige avaliação específica da atividade e dos requisitos vigentes.") : null,
    positives: potential ? ["Há indicação de atuação em mobilidade com desenvolvimento tecnológico."] : [],
    alerts: [],
    blockers: [],
    nextStep: "Fazer uma análise setorial específica antes de considerar esta oportunidade.",
  });
}

function valueScore(result) {
  if (result.estimate?.kind === "financial") {
    const reference = result.estimate.max ?? result.estimate.min;
    if (reference >= 300000) return 35;
    if (reference >= 50000) return 27;
    if (reference >= 10000) return 16;
    return 8;
  }

  const label = result.estimate?.label?.toLowerCase() ?? "";
  if (label.includes("alto")) return 24;
  if (label.includes("médio") || label.includes("medio")) return 15;
  if (result.estimate) return 8;
  return 0;
}

function alignmentScore(code, objective) {
  const priorities = OBJECTIVE_PRIORITIES[objective] ?? [];
  if (priorities.length === 0) return 12;
  const index = priorities.indexOf(code);
  if (index === 0) return 25;
  if (index > 0) return Math.max(10, 19 - index * 3);
  return 4;
}

function easeScore(result, profile, answers) {
  let score = profile.documentRisk === "baixo" ? 20 : profile.documentRisk === "medio" ? 10 : 0;
  if (result.code === "CREDITO_SUBSIDIADO" && answers.capacidade_credito === "nao") score -= 8;
  if (result.code === "EMBRAPII" && answers.aceita_ict_coexecucao === "talvez") score -= 4;
  if (result.code === "RENUCIA_TECNOLOGIA" && !profile.technologyOperationPresent) score -= 8;
  if (["LEITIC", "LEIBEM_ICT_19A", "PADIS", "ROTA2030"].includes(result.code)) score -= 4;
  return Math.max(0, score);
}

function urgencyScore(status) {
  if (status === STATUS.AVAILABLE || status === STATUS.OPTIMIZE) return 10;
  if (status === STATUS.VALIDATE) return 7;
  if (status === STATUS.PREPARE) return 3;
  return 0;
}

function confidenceScore(confidence) {
  return confidence === "alta" ? 10 : confidence === "media" ? 6 : 2;
}

function riskPenalty(result, profile, answers) {
  let penalty = 0;
  if (profile.fiscalUnknown) penalty += 10;
  if (profile.documentRisk === "alto") penalty += 10;
  if (["nao", "nao_sei"].includes(answers.maturidade_contabil)) penalty += 10;
  if (
    result.code === "LEIBEM" &&
    result.alerts.some((alert) => alert.includes("interação entre Lei do Bem e Lei de TICs"))
  ) {
    penalty += 15;
  }
  if (result.code === "LEITIC" && !["ncm_e_ppb", undefined].includes(answers.ncm_ppb)) penalty += 15;
  if (result.code === "RENUCIA_TECNOLOGIA" && answers.finalidade_renuncia_tecnologia === "nao_sei") penalty += 10;
  if (result.code === "RENUCIA_TECNOLOGIA" && list(answers.modelo_execucao_tecnologia).includes("nao_sei")) penalty += 10;
  if (answers.regularidade_fiscal === "nao") penalty += 20;
  return penalty;
}

function scoreMechanism(result, profile, answers) {
  if (result.status === STATUS.NOT_RELEVANT || result.status === STATUS.BLOCKED) {
    return { total: -1, parts: {} };
  }

  const parts = {
    value: valueScore(result),
    alignment: alignmentScore(result.code, answers.objetivo_principal),
    ease: easeScore(result, profile, answers),
    urgency: urgencyScore(result.status),
    confidence: confidenceScore(result.confidence),
    risk: riskPenalty(result, profile, answers),
  };

  return {
    total: Math.max(0, parts.value + parts.alignment + parts.ease + parts.urgency + parts.confidence - parts.risk),
    parts,
  };
}

export function rankMechanisms(mechanisms, profile, answers) {
  return mechanisms
    .map((mechanism) => {
      const score = scoreMechanism(mechanism, profile, answers);
      return { ...mechanism, score: score.total, scoreParts: score.parts };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "pt-BR"));
}

function recommendationCopy(primary, profile) {
  if (!primary) {
    return {
      heading: "Não encontramos uma oportunidade imediata com os dados informados.",
      body: "O diagnóstico pode ser retomado quando houver mais informação fiscal, técnica ou de projeto.",
    };
  }

  const statusCopy = STATUS_COPY[primary.status].label.toLowerCase();
  const technicalSignal = profile.innovationPositive
    ? "Há sinais de atividades de criação, melhoria ou desenvolvimento na empresa."
    : "";

  return {
    heading: `${primary.name} é a prioridade mais promissora agora.`,
    body: `${technicalSignal} Pelas respostas, esta trilha ${statusCopy}. ${primary.nextStep}`,
  };
}

export function evaluateDiagnostic(answers = {}) {
  const profile = deriveProfile(answers);
  const renunciaTecnologia = evaluateRenunciaTecnologia(answers, profile);

  if (profile.noInnovationPath && renunciaTecnologia.status === STATUS.NOT_RELEVANT) {
    return {
      profile,
      noInnovation: true,
      mechanisms: [],
      mainOpportunities: [],
      preparations: [],
      alerts: [],
      recommendation: {
        heading: "Ainda não identificamos uma atividade clara de inovação.",
        body: "Isso não significa que a empresa não tenha oportunidade. Muitas empresas melhoram produtos, processos ou atendimento sem chamar isso de inovação. O próximo passo é revisar essas iniciativas com as áreas técnicas e operacionais.",
      },
    };
  }

  const mechanisms = [
    evaluateLeiBem(answers, profile),
    evaluateLeiBemIct(answers, profile),
    evaluateLeiTics(answers, profile),
    renunciaTecnologia,
    evaluateFomento(answers, profile),
    evaluateCredit(answers, profile),
    evaluateEmbrapii(answers, profile),
    evaluateStartup(answers, profile),
    evaluatePadis(answers),
    evaluateRota2030(answers),
  ];
  const ranked = rankMechanisms(mechanisms, profile, answers);
  const mainOpportunities = ranked.filter((mechanism) => INSTANT_STATUSES.has(mechanism.status)).slice(0, 3);
  const preparations = ranked.filter((mechanism) => mechanism.status === STATUS.PREPARE).slice(0, 4);
  const alerts = unique(
    ranked
      .filter((mechanism) => mechanism.status !== STATUS.NOT_RELEVANT)
      .flatMap((mechanism) => mechanism.alerts)
      .slice(0, 5),
  );
  const primary = mainOpportunities[0] ?? preparations[0] ?? null;

  return {
    profile,
    noInnovation: false,
    mechanisms: ranked,
    mainOpportunities,
    preparations,
    alerts,
    recommendation: recommendationCopy(primary, profile),
  };
}

export function buildProfileSummary(answers, profile = deriveProfile(answers)) {
  const sector = getAnswerLabel("setor", answers.setor) || "Atuação a confirmar";
  const regimeByAnswer = {
    lucro_real: {
      value: "Lucro Real",
      detail: "Permite avaliar incentivos fiscais específicos.",
    },
    lucro_presumido: {
      value: "Lucro Presumido",
      detail: "Algumas trilhas fiscais não se aplicam neste regime.",
    },
    simples_nacional: {
      value: "Simples Nacional",
      detail: "A leitura fiscal considera o regime simplificado.",
    },
    nao_sei: {
      value: "Regime a confirmar",
      detail: "As simulações fiscais seguem uma leitura conservadora.",
    },
  };
  const objectiveByAnswer = {
    reduzir_impostos: {
      value: "Reduzir carga tributária",
      detail: "Priorizamos caminhos de eficiência fiscal.",
    },
    buscar_funding: {
      value: "Buscar recursos",
      detail: "Priorizamos fomento e alternativas de capital.",
    },
    financiar_expansao: {
      value: "Financiar crescimento",
      detail: "Combinamos crédito e eficiência fiscal quando cabível.",
    },
    atrair_investidor: {
      value: "Avaliar capital externo",
      detail: "Priorizamos sinais de estrutura e investimento.",
    },
    apoiar_projetos: {
      value: "Gerar impacto com tecnologia",
      detail: "Avaliamos a finalidade e a estrutura da operação.",
    },
    nao_sei: {
      value: "Foco em exploração",
      detail: "Mantemos os caminhos que ainda podem fazer sentido.",
    },
  };
  const regime = regimeByAnswer[answers.regime_tributario] ?? regimeByAnswer.nao_sei;
  const objective = objectiveByAnswer[answers.objetivo_principal] ?? objectiveByAnswer.nao_sei;
  const signals = [
    {
      label: "Atuação principal",
      value: sector,
      detail: "Setor que orienta as oportunidades.",
    },
    {
      label: "Tributação atual",
      value: regime.value,
      detail: regime.detail,
    },
    {
      label: "Momento da decisão",
      value: objective.value,
      detail: objective.detail,
    },
  ];
  const innovation = profile.innovationPositive
    ? "Foram identificadas atividades de criação, melhoria ou desenvolvimento."
    : "Não foi identificada atividade de inovação de forma clara.";

  return {
    headline: signals.map((signal) => signal.value).join(" · "),
    signals,
    innovation,
  };
}
