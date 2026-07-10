import {
  APP_META,
  MECHANISM_META,
  OBJECTIVE_PRIORITIES,
  PARAMETERS,
  STATUS,
  STATUS_COPY,
  STEPS,
} from "./data.js";
import {
  buildProfileSummary,
  deriveProfile,
  evaluateDiagnostic,
  getAnswerLabel,
  getNextQuestionId,
  getPreviousQuestionId,
  getQuestion,
  getVisibleQuestions,
  pruneAnswers,
} from "./engine.js";

const defaultState = () => ({
  answers: {},
  currentQuestionId: "objetivo_principal",
  completed: false,
  updatedAt: null,
});

const elements = {
  diagnosticView: document.getElementById("diagnosticView"),
  resultView: document.getElementById("resultView"),
  questionPanel: document.getElementById("questionPanel"),
  questionIndex: document.getElementById("questionIndex"),
  sectionKicker: document.getElementById("sectionKicker"),
  questionTitle: document.getElementById("questionTitle"),
  questionHelp: document.getElementById("questionHelp"),
  choiceList: document.getElementById("choiceList"),
  continueButton: document.getElementById("continueButton"),
  backButton: document.getElementById("backButton"),
  selectionHint: document.getElementById("selectionHint"),
  stepLabel: document.getElementById("stepLabel"),
  stepName: document.getElementById("stepName"),
  progressFill: document.getElementById("progressFill"),
  progressCount: document.getElementById("progressCount"),
  stepper: document.getElementById("stepper"),
  pathways: document.getElementById("pathways"),
  pathwaysDescription: document.getElementById("pathwaysDescription"),
  timeEstimate: document.getElementById("timeEstimate"),
  sessionLabel: document.getElementById("sessionLabel"),
  saveStatus: document.getElementById("saveStatus"),
  saveButton: document.getElementById("saveButton"),
  toast: document.getElementById("toast"),
  resultTitle: document.getElementById("resultTitle"),
  resultIntro: document.getElementById("resultIntro"),
  profileSignals: document.getElementById("profileSignals"),
  profileInnovation: document.getElementById("profileInnovation"),
  primaryResult: document.getElementById("primaryResult"),
  opportunitiesSection: document.getElementById("opportunitiesSection"),
  opportunityList: document.getElementById("opportunityList"),
  preparationSection: document.getElementById("preparationSection"),
  preparationList: document.getElementById("preparationList"),
  riskPanel: document.getElementById("riskPanel"),
  riskList: document.getElementById("riskList"),
  assumptionsContent: document.getElementById("assumptionsContent"),
  exportButton: document.getElementById("exportButton"),
  printButton: document.getElementById("printButton"),
  restartButton: document.getElementById("restartButton"),
  privacyButton: document.getElementById("privacyButton"),
};

let state = loadState();

function loadState() {
  try {
    const saved = window.localStorage.getItem(APP_META.storageKey);
    if (!saved) return defaultState();

    const parsed = JSON.parse(saved);
    const answers = pruneAnswers(parsed.answers ?? {});
    return {
      ...defaultState(),
      ...parsed,
      answers,
      currentQuestionId: parsed.currentQuestionId ?? "objetivo_principal",
    };
  } catch {
    return defaultState();
  }
}

function persist(showMessage = false) {
  state.updatedAt = new Date().toISOString();

  try {
    window.localStorage.setItem(APP_META.storageKey, JSON.stringify({
      version: APP_META.rulesVersion,
      answers: state.answers,
      currentQuestionId: state.currentQuestionId,
      completed: state.completed,
      updatedAt: state.updatedAt,
    }));
    elements.saveStatus.textContent = "Salvo neste dispositivo";
    if (showMessage) showToast("Progresso salvo neste dispositivo.");
  } catch {
    elements.saveStatus.textContent = "Salvamento indisponível";
    if (showMessage) showToast("Não foi possível salvar neste navegador.");
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 3200);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFinancialEstimate(estimate) {
  if (!estimate || estimate.kind !== "financial") return "";
  if (estimate.max === null) return `A partir de ${formatMoney(estimate.min)} por ano`;
  return `Entre ${formatMoney(estimate.min)} e ${formatMoney(estimate.max)} por ano`;
}

function currentQuestion() {
  return getQuestion(state.currentQuestionId);
}

function answerIsPresent(question) {
  const answer = state.answers[question.id];
  return question.type === "multiple" ? Array.isArray(answer) && answer.length > 0 : Boolean(answer);
}

function ensureCurrentQuestion() {
  const visibleQuestions = getVisibleQuestions(state.answers);
  const current = currentQuestion();
  const stillVisible = visibleQuestions.some((question) => question.id === state.currentQuestionId);

  if (stillVisible) return visibleQuestions;

  const currentOrder = current?.order ?? 0;
  state.currentQuestionId =
    visibleQuestions.find((question) => question.order >= currentOrder)?.id ??
    visibleQuestions.at(-1)?.id ??
    "objetivo_principal";
  return visibleQuestions;
}

function getStage(question) {
  return STEPS.find((step) => step.id === question.stage) ?? STEPS[0];
}

function renderProgress(visibleQuestions, question) {
  const currentIndex = Math.max(0, visibleQuestions.findIndex((item) => item.id === question.id));
  const stage = getStage(question);
  const stageProgress = (stage.id / STEPS.length) * 100;

  elements.stepLabel.textContent = `Etapa ${stage.id} de ${STEPS.length}`;
  elements.stepName.textContent = stage.name;
  elements.progressCount.textContent = `Questão ${currentIndex + 1} de ${visibleQuestions.length}`;
  elements.progressFill.style.width = `${stageProgress}%`;
  elements.stepper.innerHTML = STEPS.map((item) => {
    const status = item.id === stage.id ? "active" : item.id < stage.id ? "complete" : "";
    return `<li class="${status}" aria-label="Etapa ${item.id}: ${escapeHtml(item.name)}"></li>`;
  }).join("");
}

function renderChoices(question) {
  const selected = state.answers[question.id] ?? (question.type === "multiple" ? [] : null);
  const isMultiple = question.type === "multiple";
  elements.choiceList.setAttribute("role", isMultiple ? "group" : "radiogroup");
  elements.choiceList.setAttribute("aria-label", question.title);
  elements.choiceList.classList.toggle("is-multiple", isMultiple);

  elements.choiceList.innerHTML = question.options
    .map((option) => {
      const isSelected = isMultiple ? selected.includes(option.value) : selected === option.value;
      const role = isMultiple ? "checkbox" : "radio";
      return `
        <button
          class="choice-card"
          data-value="${escapeHtml(option.value)}"
          data-tone="${escapeHtml(option.tone)}"
          type="button"
          role="${role}"
          aria-checked="${isSelected}"
        >
          <span class="choice-symbol" aria-hidden="true">${escapeHtml(option.symbol)}</span>
          <span class="choice-copy">
            <span class="choice-title">${escapeHtml(option.label)}</span>
            <span class="choice-detail">${escapeHtml(option.detail)}</span>
          </span>
          <span class="choice-indicator" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");
}

function candidateCodes() {
  const profile = deriveProfile(state.answers);
  const objectiveCodes = OBJECTIVE_PRIORITIES[state.answers.objetivo_principal] ?? [];
  const codes = objectiveCodes.length
    ? [...objectiveCodes]
    : ["LEIBEM", "FOMENTO_NAOREEMB", "CREDITO_SUBSIDIADO", "LEITIC"];

  if (profile.innovationPositive) codes.push("LEIBEM", "FOMENTO_NAOREEMB", "EMBRAPII");
  if (profile.ticIndicator) codes.push("LEITIC");
  if (profile.startupPotential) codes.push("STARTUPLC182");
  if (profile.renunciaCandidate) codes.push("RENUCIA_TECNOLOGIA");

  return [...new Set(codes)].slice(0, 5);
}

function renderPathways(visibleQuestions) {
  const diagnostic = evaluateDiagnostic(state.answers);
  const resultsByCode = Object.fromEntries(
    diagnostic.mechanisms.map((mechanism) => [mechanism.code, mechanism]),
  );
  const candidates = candidateCodes();
  const question = currentQuestion();
  const remainingQuestions = Math.max(0, visibleQuestions.length - visibleQuestions.findIndex((item) => item.id === question.id) - 1);
  const minutes = remainingQuestions <= 5 ? "2 a 4 minutos" : remainingQuestions <= 11 ? "4 a 6 minutos" : "6 a 8 minutos";

  elements.pathways.innerHTML = candidates
    .map((code, index) => {
      const result = resultsByCode[code];
      const copy = result && result.status !== STATUS.NOT_RELEVANT ? STATUS_COPY[result.status] : null;
      const label = copy ? copy.label : "Em análise";
      const className = copy ? `is-${copy.tone}` : index === 0 ? "is-priority" : "";
      return `
        <div class="pathway ${className}">
          <span class="pathway-label">${escapeHtml(MECHANISM_META[code].name)}</span>
          <span class="pathway-badge">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  elements.pathwaysDescription.textContent = state.answers.objetivo_principal
    ? "Conforme avançamos, removemos os caminhos que não fazem sentido para a empresa."
    : "Sua primeira resposta organiza o diagnóstico pelas oportunidades mais relevantes.";
  elements.timeEstimate.textContent = minutes;
}

function renderQuestion(animate = false) {
  const visibleQuestions = ensureCurrentQuestion();
  const question = currentQuestion();
  if (!question) return;

  state.completed = false;
  elements.diagnosticView.hidden = false;
  elements.resultView.hidden = true;
  elements.questionIndex.textContent = String(question.order).padStart(2, "0");
  elements.sectionKicker.textContent = question.section;
  elements.questionTitle.textContent = question.title;
  elements.questionHelp.textContent = question.help;
  elements.sessionLabel.textContent = "Diagnóstico em andamento";

  renderProgress(visibleQuestions, question);
  renderChoices(question);
  renderPathways(visibleQuestions);

  const hasAnswer = answerIsPresent(question);
  const previousQuestionId = getPreviousQuestionId(state.answers, question.id);
  elements.continueButton.disabled = !hasAnswer;
  elements.backButton.disabled = !previousQuestionId;
  elements.selectionHint.textContent = hasAnswer
    ? question.type === "multiple"
      ? "Seleções registradas"
      : "Seleção registrada"
    : question.type === "multiple"
      ? "Selecione uma ou mais opções para continuar"
      : "Selecione uma opção para continuar";
  elements.selectionHint.classList.toggle("is-ready", hasAnswer);

  if (animate) {
    elements.questionPanel.classList.remove("is-changing");
    window.requestAnimationFrame(() => elements.questionPanel.classList.add("is-changing"));
  }
}

function selectAnswer(value) {
  const question = currentQuestion();
  if (!question) return;

  if (question.type === "multiple") {
    const selected = Array.isArray(state.answers[question.id]) ? [...state.answers[question.id]] : [];
    const exclusiveValues = question.exclusiveValues ?? [];
    const isExclusive = exclusiveValues.includes(value);
    let next;

    if (isExclusive) {
      next = selected.includes(value) ? [] : [value];
    } else if (selected.includes(value)) {
      next = selected.filter((item) => item !== value);
    } else {
      next = [...selected.filter((item) => !exclusiveValues.includes(item)), value];
    }

    state.answers[question.id] = next;
  } else {
    state.answers[question.id] = value;
  }

  state.answers = pruneAnswers(state.answers);
  persist();
  renderQuestion();
  window.requestAnimationFrame(() => {
    const selectedChoice = [...elements.choiceList.querySelectorAll(".choice-card")]
      .find((card) => card.dataset.value === value);
    selectedChoice?.focus();
  });
}

function continueDiagnostic() {
  const question = currentQuestion();
  if (!question || !answerIsPresent(question)) {
    showToast("Selecione uma resposta para continuar.");
    return;
  }

  state.answers = pruneAnswers(state.answers);
  const nextQuestionId = getNextQuestionId(state.answers, question.id);

  if (!nextQuestionId) {
    state.completed = true;
    persist();
    renderResult();
    window.requestAnimationFrame(() => elements.resultTitle.focus());
    return;
  }

  state.currentQuestionId = nextQuestionId;
  persist();
  renderQuestion(true);
  window.requestAnimationFrame(() => elements.questionTitle.focus());
}

function goBack() {
  const previousQuestionId = getPreviousQuestionId(state.answers, state.currentQuestionId);
  if (!previousQuestionId) return;

  state.currentQuestionId = previousQuestionId;
  persist();
  renderQuestion(true);
  window.requestAnimationFrame(() => elements.questionTitle.focus());
}

function priorityLabel(score) {
  if (score >= 70) return "Prioridade alta";
  if (score >= 40) return "Prioridade relevante";
  return "Oportunidade em evolução";
}

function renderEstimate(estimate) {
  if (!estimate) return "";

  if (estimate.kind === "financial") {
    return `
      <div class="estimate-block">
        <span class="estimate-label">${escapeHtml(estimate.label)}</span>
        <strong>${escapeHtml(formatFinancialEstimate(estimate))}</strong>
      </div>
    `;
  }

  return `
    <div class="estimate-block qualitative">
      <span class="estimate-label">${escapeHtml(estimate.label)}</span>
      <strong>${escapeHtml(estimate.detail)}</strong>
    </div>
  `;
}

function renderBullets(items, className) {
  if (!items?.length) return "";
  return `<ul class="${className}">${items.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderMechanismCard(mechanism) {
  const status = STATUS_COPY[mechanism.status];
  const source = mechanism.source
    ? `<a class="source-link" href="${escapeHtml(mechanism.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(mechanism.source.label)}</a>`
    : "";
  const nextStep = mechanism.nextStep
    ? `<p class="next-step"><span>Próximo passo</span>${escapeHtml(mechanism.nextStep)}</p>`
    : "";

  return `
    <article class="opportunity-card">
      <div class="opportunity-topline">
        <span class="status-badge ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
        <span class="priority-chip">${escapeHtml(priorityLabel(mechanism.score))}</span>
      </div>
      <h3>${escapeHtml(mechanism.name)}</h3>
      ${renderEstimate(mechanism.estimate)}
      ${renderBullets(mechanism.positives, "evidence-list")}
      ${renderBullets(mechanism.alerts, "alert-list")}
      ${nextStep}
      ${source ? `<div class="source-row">${source}</div>` : ""}
    </article>
  `;
}

function renderPrimaryResult(diagnostic) {
  if (diagnostic.noInnovation) {
    elements.primaryResult.innerHTML = `
      <div class="primary-result-copy alternate-result">
        <p class="section-kicker">LEITURA INICIAL</p>
        <h2>${escapeHtml(diagnostic.recommendation.heading)}</h2>
        <p>${escapeHtml(diagnostic.recommendation.body)}</p>
        <p class="primary-next"><span>Próximo passo</span>Reunir as áreas de operação, produto e tecnologia para mapear melhorias, testes e iniciativas que ainda não estão nomeadas ou documentadas.</p>
      </div>
    `;
    return;
  }

  const primary = diagnostic.mainOpportunities[0] ?? diagnostic.preparations[0];
  const status = primary ? STATUS_COPY[primary.status] : null;
  const metric = primary?.estimate ? renderEstimate(primary.estimate) : "";
  const source = primary?.source
    ? `<a class="source-link" href="${escapeHtml(primary.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(primary.source.label)}</a>`
    : "";

  elements.primaryResult.innerHTML = `
    <div class="primary-result-copy">
      <p class="section-kicker">MELHOR CAMINHO AGORA</p>
      <h2>${escapeHtml(diagnostic.recommendation.heading)}</h2>
      <p>${escapeHtml(diagnostic.recommendation.body)}</p>
      ${primary ? `<span class="status-badge ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>` : ""}
      ${source ? `<div class="source-row">${source}</div>` : ""}
    </div>
    <div class="primary-result-metric">
      ${metric || `<div class="estimate-block qualitative"><span class="estimate-label">Leitura atual</span><strong>Há pontos a estruturar antes de estimar valor financeiro.</strong></div>`}
      ${primary ? `<p class="confidence-note">Confiança da leitura: <strong>${escapeHtml(primary.confidence)}</strong></p>` : ""}
    </div>
  `;
}

function renderOpportunities(diagnostic) {
  if (diagnostic.noInnovation) {
    elements.opportunitiesSection.hidden = true;
    return;
  }

  elements.opportunitiesSection.hidden = false;
  if (!diagnostic.mainOpportunities.length) {
    elements.opportunityList.innerHTML = `
      <div class="empty-result">
        <strong>Não há uma oportunidade pronta para avançar ainda.</strong>
        <span>Veja abaixo os caminhos que podem ser preparados com os dados atuais.</span>
      </div>
    `;
    return;
  }

  elements.opportunityList.innerHTML = diagnostic.mainOpportunities
    .map(renderMechanismCard)
    .join("");
}

function renderPreparations(diagnostic) {
  if (diagnostic.noInnovation || !diagnostic.preparations.length) {
    elements.preparationSection.hidden = true;
    return;
  }

  elements.preparationSection.hidden = false;
  elements.preparationList.innerHTML = diagnostic.preparations
    .map((mechanism) => `
      <article class="preparation-item">
        <div>
          <h3>${escapeHtml(mechanism.name)}</h3>
          <p>${escapeHtml(mechanism.nextStep)}</p>
        </div>
        <span class="compact-status">Preparar</span>
      </article>
    `)
    .join("");
}

function renderRisks(diagnostic) {
  const profile = diagnostic.profile;
  const risks = [...diagnostic.alerts];

  if (!diagnostic.noInnovation && profile.documentRisk !== "baixo") {
    risks.unshift(`A organização de evidências e gastos está com risco ${profile.documentRisk}; isso reduz a confiança de benefícios fiscais.`);
  }
  if (state.answers.regularidade_fiscal === "nao") {
    risks.unshift("Há indicação de pendência fiscal. Isso pode bloquear incentivos e dificultar editais ou crédito.");
  }
  if (!risks.length) {
    risks.push("As informações indicam boa base inicial. Ainda assim, a documentação técnica, fiscal e contábil deve ser validada antes de qualquer aproveitamento.");
  }

  elements.riskPanel.hidden = false;
  elements.riskList.innerHTML = [...new Set(risks)].slice(0, 5)
    .map((risk) => `<p class="risk-item"><span aria-hidden="true">!</span>${escapeHtml(risk)}</p>`)
    .join("");
}

function renderAssumptions(diagnostic) {
  const financialMechanisms = diagnostic.mechanisms.filter(
    (mechanism) => mechanism.estimate?.kind === "financial",
  );
  const premiseList = financialMechanisms.length
    ? financialMechanisms
        .map((mechanism) => `<li><strong>${escapeHtml(mechanism.name)}:</strong> ${escapeHtml(mechanism.estimate.premise)}</li>`)
        .join("")
    : "<li>Nenhuma estimativa financeira foi exibida porque faltam dados, não há imposto a monetizar agora ou a oportunidade é qualitativa.</li>";

  elements.assumptionsContent.innerHTML = `
    <p>Este resultado é uma estimativa preliminar baseada nas respostas informadas e na versão ${escapeHtml(APP_META.rulesVersion)} das regras.</p>
    <ul>${premiseList}</ul>
    <p>Na Lei do Bem, o cálculo usa alíquota combinada de ${(PARAMETERS.taxRate * 100).toFixed(0)}% e percentuais configuráveis de exclusão. Na Renúncia Fiscal em Tecnologia, a estimativa usa o menor valor entre a escala de tecnologia e o teto de 1,5% ou 2% do lucro operacional, simulando IRPJ, adicional e CSLL. A finalidade, a entidade, o fluxo financeiro e os documentos precisam ser validados antes de qualquer aproveitamento.</p>
    <p>Antes de usar qualquer incentivo, valide as informações com especialistas fiscal, contábil e jurídico e com a documentação da empresa.</p>
  `;
}

function renderResult() {
  const diagnostic = evaluateDiagnostic(state.answers);
  const profileSummary = buildProfileSummary(state.answers, diagnostic.profile);

  elements.diagnosticView.hidden = true;
  elements.resultView.hidden = false;
  elements.sessionLabel.textContent = "Resultado disponível";
  elements.resultIntro.textContent = diagnostic.noInnovation
    ? "O diagnóstico encontrou uma oportunidade de investigação antes de recomendar incentivos específicos."
    : "Organizamos as oportunidades por relevância, potencial financeiro, esforço e confiança das informações.";
  elements.profileSignals.innerHTML = profileSummary.signals
    .map(
      (signal) => `
        <div class="profile-signal">
          <span class="profile-signal-label">${escapeHtml(signal.label)}</span>
          <strong class="profile-signal-value">${escapeHtml(signal.value)}</strong>
          <span class="profile-signal-detail">${escapeHtml(signal.detail)}</span>
        </div>
      `,
    )
    .join("");
  elements.profileInnovation.textContent = profileSummary.innovation;

  renderPrimaryResult(diagnostic);
  renderOpportunities(diagnostic);
  renderPreparations(diagnostic);
  renderRisks(diagnostic);
  renderAssumptions(diagnostic);
}

function buildExportText() {
  const diagnostic = evaluateDiagnostic(state.answers);
  const profileSummary = buildProfileSummary(state.answers, diagnostic.profile);
  const lines = [
    "MONYU | DIAGNÓSTICO DE INCENTIVOS E FUNDING",
    `Data: ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`,
    `Versão das regras: ${APP_META.rulesVersion}`,
    "",
    "PERFIL IDENTIFICADO",
    ...profileSummary.signals.map((signal) => `${signal.label}: ${signal.value}`),
    profileSummary.innovation,
    "",
    "RECOMENDAÇÃO PRINCIPAL",
    diagnostic.recommendation.heading,
    diagnostic.recommendation.body,
    "",
  ];

  if (diagnostic.noInnovation) {
    lines.push("PRÓXIMO PASSO", "Mapear melhorias, testes e iniciativas de criação com as áreas técnicas e operacionais.");
  } else {
    lines.push("OPORTUNIDADES PRIORITÁRIAS");
    diagnostic.mainOpportunities.forEach((mechanism) => {
      lines.push(`- ${mechanism.name}: ${STATUS_COPY[mechanism.status].label}`);
      if (mechanism.estimate?.kind === "financial") lines.push(`  ${formatFinancialEstimate(mechanism.estimate)}`);
      if (mechanism.estimate?.kind === "qualitative") lines.push(`  ${mechanism.estimate.label}: ${mechanism.estimate.detail}`);
      lines.push(`  Próximo passo: ${mechanism.nextStep}`);
    });

    if (diagnostic.preparations.length) {
      lines.push("", "CAMINHOS A PREPARAR");
      diagnostic.preparations.forEach((mechanism) => lines.push(`- ${mechanism.name}: ${mechanism.nextStep}`));
    }
  }

  lines.push(
    "",
    "AVISO",
    "Este resultado é uma estimativa preliminar e não substitui análise fiscal, contábil ou jurídica.",
  );
  return lines.join("\n");
}

function exportResult() {
  const blob = new Blob([buildExportText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "diagnostico-monyu-incentivos.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("Resumo exportado.");
}

function restartDiagnostic() {
  const shouldRestart = window.confirm("Começar uma nova análise? As respostas salvas neste dispositivo serão substituídas.");
  if (!shouldRestart) return;

  state = defaultState();
  try {
    window.localStorage.removeItem(APP_META.storageKey);
  } catch {
    // The new in-memory session remains usable even when storage is unavailable.
  }
  renderQuestion(true);
  window.requestAnimationFrame(() => elements.questionTitle.focus());
  showToast("Nova análise iniciada.");
}

elements.choiceList.addEventListener("click", (event) => {
  const card = event.target.closest(".choice-card");
  if (!card) return;
  selectAnswer(card.dataset.value);
});

elements.continueButton.addEventListener("click", continueDiagnostic);
elements.backButton.addEventListener("click", goBack);
elements.saveButton.addEventListener("click", () => persist(true));
elements.exportButton.addEventListener("click", exportResult);
elements.printButton.addEventListener("click", () => window.print());
elements.restartButton.addEventListener("click", restartDiagnostic);
elements.privacyButton.addEventListener("click", () => {
  showToast("As respostas ficam apenas neste navegador. Esta versão não envia dados para um servidor.");
});

if (state.completed) renderResult();
else renderQuestion();
