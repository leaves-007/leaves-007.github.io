(function (factory) {
  if (typeof window !== "undefined") {
    window.QuestionBankAppShared = factory(window.QuestionBankCore, window.QUESTION_BANK_DATA);
  }
})(function (core, bank) {
  const STORAGE_KEY = "maogai-question-bank-state-v1";

  function createDefaultWrongbookPracticeState() {
    return {
      questionStates: {},
      practiceLog: [],
      sessionStore: {},
      lastSession: null,
      pendingSession: null,
    };
  }

  function createDefaultMockExamPracticeState() {
    return {
      questionStates: {},
      practiceLog: [],
      sessionStore: {},
      lastSession: null,
      pendingSession: null,
    };
  }

  function assertDependencies() {
    if (!core) {
      throw new Error("QuestionBankCore is required");
    }
    if (!bank || !Array.isArray(bank.questions)) {
      throw new Error("QUESTION_BANK_DATA is missing or invalid");
    }
  }

  function createDefaultState() {
    return {
      questionStates: {},
      favorites: {},
      wrongBook: {},
      practiceLog: [],
      sessionStore: {},
      lastSession: null,
      pendingSession: null,
      wrongbookReturnSession: null,
      wrongbookPractice: createDefaultWrongbookPracticeState(),
      mockExamPractice: createDefaultMockExamPracticeState(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultState();
      }
      const parsed = JSON.parse(raw);
      return hydrateLegacySessionStore(Object.assign(createDefaultState(), parsed));
    } catch (error) {
      console.warn("Failed to load local state", error);
      return createDefaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    return createDefaultState();
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined && textContent !== null) {
      element.textContent = textContent;
    }
    return element;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function escapeHtml(value) {
    return core.normalizeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatRate(rate) {
    return `${Math.round((rate || 0) * 100)}%`;
  }

  function formatDateTime(isoText) {
    if (!isoText) {
      return "未作答";
    }
    const date = new Date(isoText);
    if (Number.isNaN(date.getTime())) {
      return isoText;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function getBank() {
    assertDependencies();
    return bank;
  }

  function getQuestionMap() {
    assertDependencies();
    if (!getQuestionMap.cache) {
      getQuestionMap.cache = core.indexQuestions(bank.questions);
    }
    return getQuestionMap.cache;
  }

  function getChapterMap() {
    const chapterMap = {};
    bank.chapters.forEach(function (chapter) {
      chapterMap[chapter.key] = chapter;
    });
    return chapterMap;
  }

  function getScopedQuestions(options) {
    const questions = bank.questions.slice();
    if (!options) {
      return questions;
    }
    return questions.filter(function (question) {
      if (options.chapterKey && question.chapterKey !== options.chapterKey) {
        return false;
      }
      if (options.questionType && question.type !== options.questionType) {
        return false;
      }
      if (options.tag && !question.tags.includes(options.tag)) {
        return false;
      }
      return true;
    });
  }

  function ensureQuestionState(state, questionId) {
    if (!state.questionStates[questionId]) {
      state.questionStates[questionId] = {
        attempts: 0,
        correctCount: 0,
        wrongCount: 0,
        masteredCount: 0,
        lastResult: "",
        lastAnsweredAt: "",
        lastUserAnswer: null,
      };
    }
    return state.questionStates[questionId];
  }

  function getWrongbookPracticeStore(state) {
    if (!state.wrongbookPractice || typeof state.wrongbookPractice !== "object") {
      state.wrongbookPractice = createDefaultWrongbookPracticeState();
    }
    if (!state.wrongbookPractice.questionStates || typeof state.wrongbookPractice.questionStates !== "object") {
      state.wrongbookPractice.questionStates = {};
    }
    if (!Array.isArray(state.wrongbookPractice.practiceLog)) {
      state.wrongbookPractice.practiceLog = [];
    }
    if (!state.wrongbookPractice.sessionStore || typeof state.wrongbookPractice.sessionStore !== "object") {
      state.wrongbookPractice.sessionStore = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.wrongbookPractice, "lastSession")) {
      state.wrongbookPractice.lastSession = null;
    }
    if (!Object.prototype.hasOwnProperty.call(state.wrongbookPractice, "pendingSession")) {
      state.wrongbookPractice.pendingSession = null;
    }
    return state.wrongbookPractice;
  }

  function getMockExamPracticeStore(state) {
    if (!state.mockExamPractice || typeof state.mockExamPractice !== "object") {
      state.mockExamPractice = createDefaultMockExamPracticeState();
    }
    if (!state.mockExamPractice.questionStates || typeof state.mockExamPractice.questionStates !== "object") {
      state.mockExamPractice.questionStates = {};
    }
    if (!Array.isArray(state.mockExamPractice.practiceLog)) {
      state.mockExamPractice.practiceLog = [];
    }
    if (!state.mockExamPractice.sessionStore || typeof state.mockExamPractice.sessionStore !== "object") {
      state.mockExamPractice.sessionStore = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.mockExamPractice, "lastSession")) {
      state.mockExamPractice.lastSession = null;
    }
    if (!Object.prototype.hasOwnProperty.call(state.mockExamPractice, "pendingSession")) {
      state.mockExamPractice.pendingSession = null;
    }
    return state.mockExamPractice;
  }

  function resetMockExamPracticeState(state) {
    const store = getMockExamPracticeStore(state);
    store.questionStates = {};
    store.practiceLog = [];
    store.sessionStore = {};
    store.lastSession = null;
    store.pendingSession = null;
    saveState(state);
    return store;
  }

  function resetWrongbookPracticeState(state) {
    const store = getWrongbookPracticeStore(state);
    store.questionStates = {};
    store.practiceLog = [];
    store.sessionStore = {};
    store.lastSession = null;
    store.pendingSession = null;
    saveState(state);
    return store;
  }

  function ensureQuestionStateInStore(store, questionId) {
    if (!store.questionStates[questionId]) {
      store.questionStates[questionId] = {
        attempts: 0,
        correctCount: 0,
        wrongCount: 0,
        masteredCount: 0,
        lastResult: "",
        lastAnsweredAt: "",
        lastUserAnswer: null,
      };
    }
    return store.questionStates[questionId];
  }

  function trimPracticeLog(practiceLog) {
    if (practiceLog.length > 5000) {
      practiceLog.splice(0, practiceLog.length - 5000);
    }
  }

  function recordQuestionResultInStore(store, question, result, userAnswer, session) {
    const questionState = ensureQuestionStateInStore(store, question.id);
    questionState.attempts += 1;
    questionState.lastResult = result;
    questionState.lastAnsweredAt = new Date().toISOString();
    questionState.lastUserAnswer = userAnswer;
    if (result === "correct") {
      questionState.correctCount += 1;
    } else if (result === "wrong") {
      questionState.wrongCount += 1;
    } else if (result === "mastered") {
      questionState.masteredCount += 1;
    }

    store.practiceLog.push({
      date: core.getTodayDateText(),
      result: result,
      questionId: question.id,
      chapterKey: question.chapterKey,
      type: question.type,
      mode: session ? session.mode : "",
    });
    trimPracticeLog(store.practiceLog);
    return questionState;
  }

  function recordQuestionResult(state, question, result, userAnswer, session) {
    const questionState = recordQuestionResultInStore(state, question, result, userAnswer, session);
    if (result === "wrong") {
      const entry = state.wrongBook[question.id] || {
        addedAt: questionState.lastAnsweredAt,
        wrongCount: 0,
      };
      entry.wrongCount += 1;
      entry.lastWrongAt = questionState.lastAnsweredAt;
      entry.chapterKey = question.chapterKey;
      entry.type = question.type;
      state.wrongBook[question.id] = entry;
    }
    saveState(state);
    return questionState;
  }

  function recordWrongbookPracticeResult(state, question, result, userAnswer, session) {
    const store = getWrongbookPracticeStore(state);
    const questionState = recordQuestionResultInStore(store, question, result, userAnswer, session);
    saveState(state);
    return questionState;
  }

  function recordMockExamPracticeResult(state, question, result, userAnswer, session) {
    const store = getMockExamPracticeStore(state);
    const questionState = recordQuestionResultInStore(store, question, result, userAnswer, session);
    saveState(state);
    return questionState;
  }

  function toggleFavorite(state, questionId) {
    if (state.favorites[questionId]) {
      delete state.favorites[questionId];
    } else {
      state.favorites[questionId] = true;
    }
    saveState(state);
  }

  function isFavorite(state, questionId) {
    return Boolean(state.favorites[questionId]);
  }

  function getFavoriteIds(state) {
    return Object.keys(state.favorites || {});
  }

  function getWrongIds(state) {
    return Object.keys(state.wrongBook || {});
  }

  function removeWrongBookEntry(state, questionId) {
    delete state.wrongBook[questionId];
    saveState(state);
  }

  function markQuestionMastered(state, questionId) {
    const questionState = ensureQuestionState(state, questionId);
    questionState.lastResult = "mastered";
    questionState.lastAnsweredAt = new Date().toISOString();
    delete state.wrongBook[questionId];
    saveState(state);
  }

  function buildScopedBank(scopeOptions) {
    const questions = getScopedQuestions(scopeOptions);
    const allowedChapterKeys = new Set(questions.map(function (question) { return question.chapterKey; }));
    return {
      totalQuestions: questions.length,
      questions: questions,
      chapters: bank.chapters.filter(function (chapter) { return allowedChapterKeys.has(chapter.key); }),
    };
  }

  function describeAnswer(question) {
    if (question.type === "单选题") {
      const match = question.options.find(function (option) { return option.key === core.normalizeText(question.answerRaw).toUpperCase(); });
      return match ? `${match.key}. ${match.text}` : question.answerRaw;
    }
    if (question.type === "多选题") {
      const expected = question.answerRaw.split(/[;；]+/).map(function (value) { return value.trim().toUpperCase(); }).filter(Boolean);
      return expected.map(function (key) {
        const match = question.options.find(function (option) { return option.key === key; });
        return match ? `${match.key}. ${match.text}` : key;
      }).join(" / ");
    }
    if (question.type === "判断题") {
      return core.normalizeText(question.answerRaw).toLowerCase() === "true" ? "正确" : "错误";
    }
    if (question.type === "填空题") {
      return (question.fillBlanks || [])
        .map(function (blank, index) {
          return `第${index + 1}空：${blank.acceptedAnswers.join(" / ")}`;
        })
        .join("；");
    }
    return question.answerRaw || "无";
  }

  function createMetricCard(label, value, extraText) {
    const card = createElement("div", "metric-card fade-in");
    card.appendChild(createElement("div", "metric-label", label));
    card.appendChild(createElement("div", "metric-value", value));
    if (extraText) {
      card.appendChild(createElement("div", "muted", extraText));
    }
    return card;
  }

  function renderStatsGrid(container, stats) {
    clearElement(container);
    const grid = createElement("div", "stats-grid");
    grid.appendChild(createMetricCard("总题数", String(stats.totalQuestions)));
    grid.appendChild(createMetricCard("已完成题数", String(stats.completedCount)));
    grid.appendChild(createMetricCard("正确率", formatRate(stats.correctRate)));
    grid.appendChild(createMetricCard("错误率", formatRate(stats.wrongRate)));
    container.appendChild(grid);
  }

  function renderTrendChart(container, stats) {
    clearElement(container);
    const stack = createElement("div", "chart-stack");
    stack.appendChild(createElement("h3", "section-title", "最近 7 天练习情况"));
    const chart = createElement("div", "bar-chart");
    const maxTotal = Math.max(1, ...stats.recent7Days.map(function (item) { return item.total; }));
    stats.recent7Days.forEach(function (item) {
      const column = createElement("div", "bar-column");
      const hasData = item.total > 0;
      const track = createElement("div", hasData ? "bar-track" : "bar-track is-empty");
      if (hasData) {
        const fill = createElement("div", "bar-fill");
        fill.style.height = `${Math.round((item.total / maxTotal) * 100)}%`;
        track.appendChild(fill);
      }
      column.appendChild(track);
      column.appendChild(createElement("div", "bar-label", item.date.slice(5)));
      column.appendChild(createElement("div", "muted", `${item.total} 次`));
      chart.appendChild(column);
    });
    stack.appendChild(chart);
    container.appendChild(stack);
  }

  function renderTrendChartLine(container, stats) {
    clearElement(container);
    const stack = createElement("div", "chart-stack");
    stack.appendChild(createElement("h3", "section-title", "最近 7 天练习情况"));

    const chart = createElement("div", "trend-bar-chart");
    const plot = createElement("div", "trend-bar-plot");
    const maxTotal = Math.max(1, ...stats.recent7Days.map(function (item) { return item.total; }));
    const maxBarHeight = 108;
    const minBarHeight = 8;

    stats.recent7Days.forEach(function (item) {
      const column = createElement("div", "trend-bar-column");
      const bar = createElement("div", item.total > 0 ? "trend-bar-fill" : "trend-bar-fill is-zero");
      const scaledHeight = item.total > 0
        ? Math.max(minBarHeight, Math.round((item.total / maxTotal) * maxBarHeight))
        : minBarHeight;
      bar.style.height = `${scaledHeight}px`;
      column.appendChild(bar);
      plot.appendChild(column);
    });

    chart.appendChild(plot);

    const labels = createElement("div", "trend-bar-labels");
    stats.recent7Days.forEach(function (item) {
      const column = createElement("div", "trend-bar-label-group");
      column.appendChild(createElement("div", "bar-label", item.date.slice(5)));
      column.appendChild(createElement("div", "muted", `${item.total} 次`));
      labels.appendChild(column);
    });

    chart.appendChild(labels);
    stack.appendChild(chart);
    container.appendChild(stack);
  }

  function renderChapterMastery(container, stats) {
    clearElement(container);
    const shell = createElement("div", "chart-stack");
    shell.appendChild(createElement("h3", "section-title", "各章节掌握度"));
    const list = createElement("div", "mastery-list");
    stats.chapterStats.forEach(function (chapter) {
      const row = createElement("div", "mastery-row");
      const label = createElement("div", "mastery-label");
      label.appendChild(createElement("span", "", chapter.chapterTitle));
      label.appendChild(createElement("span", "muted", `${chapter.masteredCount}/${chapter.totalCount}`));
      const shellBar = createElement("div", "progress-shell");
      const bar = createElement("div", "progress-bar");
      bar.style.width = `${Math.round(chapter.masteryRate * 100)}%`;
      shellBar.appendChild(bar);
      row.appendChild(label);
      row.appendChild(shellBar);
      list.appendChild(row);
    });
    shell.appendChild(list);
    container.appendChild(shell);
  }

  function createQuestionMeta(question) {
    const meta = createElement("div", "question-meta");
    [
      {
        text: `章节：${question.chapterTitle}`,
        className: "chip chip-chapter",
      },
      {
        text: `题型：${question.type}`,
        className: "chip chip-question-type",
      },
      {
        text: `分值：${question.score || 0}`,
        className: "chip chip-score",
      },
      {
        text: `难度：${question.difficulty || "-"}`,
        className: "chip chip-difficulty",
      },
      {
        text: `序号：${question.sourceNo || question.sequence}`,
        className: "chip chip-sequence",
      },
    ].forEach(function (item) {
      meta.appendChild(createElement("span", item.className, item.text));
    });
    return meta;
  }

  function createTagChips(tags) {
    const row = createElement("div", "question-meta");
    if (!tags || !tags.length) {
      row.appendChild(createElement("span", "chip", "无标签"));
      return row;
    }
    tags.forEach(function (tag) {
      row.appendChild(createElement("span", "chip", `#${tag}`));
    });
    return row;
  }

  function getQuestionSummary(question) {
    const stem = core.normalizeText(question.stem);
    return stem.length > 72 ? `${stem.slice(0, 72)}...` : stem;
  }

  function createEmptyCard(message) {
    const card = createElement("div", "empty-card fade-in");
    card.appendChild(createElement("p", "", message));
    return card;
  }

  function setRevealableAnswerState(shell, toggle, revealed) {
    shell.classList.toggle("is-revealed", revealed);
    toggle.setAttribute("aria-pressed", revealed ? "true" : "false");
    toggle.textContent = revealed ? "收起答案" : "点击查看";
  }

  function createRevealableAnswerBlock(label, answerText) {
    const shell = createElement("div", "answer-detail answer-reveal-shell");
    shell.tabIndex = 0;

    const content = createElement("div", "answer-reveal-content");
    content.appendChild(createElement("span", "answer-reveal-label", `${label}：`));
    content.appendChild(createElement("span", "answer-reveal-body", answerText || "暂无"));
    shell.appendChild(content);

    const toggle = createElement("button", "answer-reveal-toggle", "点击查看");
    toggle.type = "button";

    const toggleReveal = function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      setRevealableAnswerState(shell, toggle, !shell.classList.contains("is-revealed"));
    };

    toggle.addEventListener("click", toggleReveal);
    shell.addEventListener("click", function (event) {
      if (event.target === toggle) {
        return;
      }
      if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) {
        return;
      }
      toggleReveal(event);
    });
    shell.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (!window.matchMedia("(hover: none), (pointer: coarse)").matches) {
        return;
      }
      toggleReveal(event);
    });

    setRevealableAnswerState(shell, toggle, false);
    shell.appendChild(toggle);
    return shell;
  }

  function setRevealableExplanationState(shell, toggle, revealed) {
    shell.classList.toggle("is-revealed", revealed);
    toggle.setAttribute("aria-pressed", revealed ? "true" : "false");
    toggle.textContent = revealed ? "收起解析" : "查看解析";
  }

  function createRevealableExplanationBlock(payload) {
    const explanationText = core.normalizeText(payload && payload.explanation);
    if (!explanationText) {
      return null;
    }

    const shell = createElement("div", "answer-detail explanation-reveal-shell");
    const title = createElement("div", "explanation-reveal-title", "答案解析");
    const sections = createElement("div", "explanation-reveal-sections");
    const explanationSection = createElement("div", "explanation-reveal-section");
    explanationSection.appendChild(createElement("div", "explanation-reveal-body", explanationText));
    sections.appendChild(explanationSection);

    const toggle = createElement("button", "explanation-reveal-toggle", "查看解析");
    toggle.type = "button";
    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setRevealableExplanationState(shell, toggle, !shell.classList.contains("is-revealed"));
    });

    shell.appendChild(title);
    shell.appendChild(sections);
    shell.appendChild(toggle);
    setRevealableExplanationState(shell, toggle, false);
    return shell;
  }

  function setPendingSession(state, session) {
    state.pendingSession = session;
    saveState(state);
  }

  function consumePendingSession(state) {
    const session = state.pendingSession;
    state.pendingSession = null;
    saveState(state);
    return session;
  }

  function normalizeSession(session) {
    if (!session) {
      return null;
    }
    return Object.assign(
      {
        answered: {},
        currentIndex: 0,
        storageKey: "",
      },
      session
    );
  }

  function cloneSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return null;
    }
    return JSON.parse(JSON.stringify(normalized));
  }

  function buildHistoricalAnsweredMap(state, questionIds) {
    if (!state || !Array.isArray(questionIds) || !questionIds.length) {
      return {};
    }
    const questionStates = state.questionStates || {};
    const answered = {};

    questionIds.forEach(function (questionId) {
      const questionState = questionStates[questionId];
      if (!questionState || !questionState.lastResult) {
        return;
      }
      answered[questionId] = {
        result: questionState.lastResult,
        userAnswer: Array.isArray(questionState.lastUserAnswer)
          ? questionState.lastUserAnswer.slice()
          : questionState.lastUserAnswer,
        judgedAt: questionState.lastAnsweredAt || "",
      };
    });

    return answered;
  }

  function hydrateSessionAnswered(state, session) {
    const normalized = cloneSession(session);
    if (!normalized) {
      return null;
    }
    normalized.answered = Object.assign(
      {},
      buildHistoricalAnsweredMap(state, normalized.questionIds || []),
      normalized.answered || {}
    );
    return normalized;
  }

  function buildHistoricalAnsweredMapFromStore(store, questionIds) {
    if (!store || !Array.isArray(questionIds) || !questionIds.length) {
      return {};
    }
    const questionStates = store.questionStates || {};
    const answered = {};

    questionIds.forEach(function (questionId) {
      const questionState = questionStates[questionId];
      if (!questionState || !questionState.lastResult) {
        return;
      }
      answered[questionId] = {
        result: questionState.lastResult,
        userAnswer: Array.isArray(questionState.lastUserAnswer)
          ? questionState.lastUserAnswer.slice()
          : questionState.lastUserAnswer,
        judgedAt: questionState.lastAnsweredAt || "",
      };
    });

    return answered;
  }

  function hydrateSessionAnsweredFromStore(store, session) {
    const normalized = cloneSession(session);
    if (!normalized) {
      return null;
    }
    normalized.answered = Object.assign(
      {},
      buildHistoricalAnsweredMapFromStore(store, normalized.questionIds || []),
      normalized.answered || {}
    );
    return normalized;
  }

  function getSessionStore(state) {
    if (!state.sessionStore || typeof state.sessionStore !== "object") {
      state.sessionStore = {};
    }
    return state.sessionStore;
  }

  function getWrongbookPracticeSessionStore(state) {
    const store = getWrongbookPracticeStore(state);
    if (!store.sessionStore || typeof store.sessionStore !== "object") {
      store.sessionStore = {};
    }
    return store.sessionStore;
  }

  function getMockExamPracticeSessionStore(state) {
    const store = getMockExamPracticeStore(state);
    if (!store.sessionStore || typeof store.sessionStore !== "object") {
      store.sessionStore = {};
    }
    return store.sessionStore;
  }

  function sanitizeSessionKeyPart(value) {
    const baseText =
      core && typeof core.normalizeText === "function"
        ? core.normalizeText(value || "")
        : String(value == null ? "" : value).trim();

    return baseText
      .replace(/\s+/g, " ")
      .replace(/[|]/g, "/");
  }

  function buildSessionStorageKey(session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return "";
    }
    if (normalized.storageKey) {
      return normalized.storageKey;
    }

    const scopeKey = normalized.scopeChapterKey || "all";
    const labelKey = sanitizeSessionKeyPart(normalized.label || normalized.mode || "session");

    if (isWrongbookSession(normalized)) {
      return `wrongbook|${scopeKey}`;
    }
    if (isMockExamSession(normalized)) {
      return `mock-exam|${scopeKey}|${labelKey}|${(normalized.questionIds || []).length}`;
    }
    if (normalized.mode === "sequential" || normalized.mode === "chapter") {
      return `sequential|${scopeKey}`;
    }
    if (normalized.mode === "wrongs") {
      return `wrongs|${scopeKey}`;
    }
    if (normalized.mode === "favorites") {
      return `favorites|${scopeKey}`;
    }
    if (normalized.mode === "type") {
      return `type|${scopeKey}|${labelKey}`;
    }
    if (normalized.mode === "random" || normalized.mode === "exam") {
      return `${normalized.mode}|${scopeKey}|${labelKey}|${(normalized.questionIds || []).length}`;
    }
    return `${normalized.mode || "custom"}|${scopeKey}|${labelKey}`;
  }

  function hydrateLegacySessionStore(state) {
    const sessionStore = getSessionStore(state);
    [state.lastSession, state.wrongbookReturnSession].forEach(function (session) {
      const normalized = normalizeSession(session);
      if (!normalized) {
        return;
      }
      normalized.storageKey = buildSessionStorageKey(normalized);
      if (!normalized.storageKey || sessionStore[normalized.storageKey]) {
        return;
      }
      sessionStore[normalized.storageKey] = cloneSession(normalized);
    });
    return state;
  }

  function sessionQuestionIdsMatch(session, questionIds) {
    if (!session || !Array.isArray(questionIds)) {
      return false;
    }
    const sessionQuestionIds = Array.isArray(session.questionIds) ? session.questionIds : [];
    if (sessionQuestionIds.length !== questionIds.length) {
      return false;
    }
    for (let index = 0; index < questionIds.length; index += 1) {
      if (sessionQuestionIds[index] !== questionIds[index]) {
        return false;
      }
    }
    return true;
  }

  function getRestorableSessionPool(session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return [];
    }
    if (normalized.scopeChapterKey) {
      return bank.questions.filter(function (question) {
        return question.chapterKey === normalized.scopeChapterKey;
      });
    }
    return bank.questions.slice();
  }

  function buildWrongbookUnionQuestionIds(state, scopeChapterKey) {
    const wrongIdSet = new Set(getWrongIds(state));
    const favoriteIdSet = new Set(getFavoriteIds(state));
    return bank.questions
      .filter(function (question) {
        if (scopeChapterKey && question.chapterKey !== scopeChapterKey) {
          return false;
        }
        return wrongIdSet.has(question.id) || favoriteIdSet.has(question.id);
      })
      .map(function (question) {
        return question.id;
      });
  }

  function getCanonicalQuestionIdsForSession(state, session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return null;
    }

    if (isWrongbookSession(normalized)) {
      return buildWrongbookUnionQuestionIds(state, normalized.scopeChapterKey || "");
    }

    const pool = getRestorableSessionPool(normalized);
    if (normalized.mode === "sequential" || normalized.mode === "chapter") {
      return pool.map(function (question) {
        return question.id;
      });
    }
    if (normalized.mode === "wrongs") {
      const wrongIdSet = new Set(getWrongIds(state));
      return pool
        .filter(function (question) {
          return wrongIdSet.has(question.id);
        })
        .map(function (question) {
          return question.id;
        });
    }
    if (normalized.mode === "favorites") {
      const favoriteIdSet = new Set(getFavoriteIds(state));
      return pool
        .filter(function (question) {
          return favoriteIdSet.has(question.id);
        })
        .map(function (question) {
          return question.id;
        });
    }
    return null;
  }

  function reconcileRestorableSession(state, session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return null;
    }

    const canonicalQuestionIds = getCanonicalQuestionIdsForSession(state, normalized);
    if (canonicalQuestionIds === null) {
      return hydrateSessionAnswered(state, normalized);
    }
    if (!canonicalQuestionIds.length) {
      return null;
    }
    if (sessionQuestionIdsMatch(normalized, canonicalQuestionIds)) {
      return hydrateSessionAnswered(state, normalized);
    }

    const sessionQuestionIds = Array.isArray(normalized.questionIds) ? normalized.questionIds : [];
    const currentQuestionId = sessionQuestionIds[normalized.currentIndex] || "";
    const currentIndex = currentQuestionId ? canonicalQuestionIds.indexOf(currentQuestionId) : -1;

    return hydrateSessionAnswered(
      state,
      Object.assign({}, normalized, {
        questionIds: canonicalQuestionIds,
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        storageKey: "",
      })
    );
  }

  function findReusableSession(state, options) {
    const expectedQuestionIds = options && Array.isArray(options.questionIds) ? options.questionIds : [];
    if (!expectedQuestionIds.length) {
      return null;
    }
    const expectedScopeChapterKey = (options && options.scopeChapterKey) || "";
    const candidates = [];
    const seenStorageKeys = new Set();

    function addCandidate(session) {
      const normalized = normalizeSession(session);
      if (!normalized) {
        return;
      }
      const storageKey = buildSessionStorageKey(normalized);
      if (storageKey && seenStorageKeys.has(storageKey)) {
        return;
      }
      if (storageKey) {
        seenStorageKeys.add(storageKey);
      }
      candidates.push(normalized);
    }

    if (options && options.currentSession) {
      addCandidate(options.currentSession);
    }
    if (state && state.lastSession) {
      addCandidate(state.lastSession);
    }
    const sessionStore = state ? getSessionStore(state) : {};
    Object.keys(sessionStore).forEach(function (storageKey) {
      if (seenStorageKeys.has(storageKey)) {
        return;
      }
      addCandidate(sessionStore[storageKey]);
    });

    for (const candidate of candidates) {
      if ((candidate.scopeChapterKey || "") !== expectedScopeChapterKey) {
        continue;
      }
      if (!sessionQuestionIdsMatch(candidate, expectedQuestionIds)) {
        continue;
      }
      return hydrateSessionAnswered(state, candidate);
    }

    return null;
  }

  function buildWrongbookPracticeSession(state, options) {
    const orderedQuestionIds = buildWrongbookUnionQuestionIds(state, options && options.scopeChapterKey);

    if (!orderedQuestionIds.length) {
      return null;
    }

    return hydrateSessionAnsweredFromStore(getWrongbookPracticeStore(state), {
      mode: "custom",
      source: "wrongbook",
      label: (options && options.label) || "错题本 · 直接刷题",
      questionIds: orderedQuestionIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
      scopeChapterKey: (options && options.scopeChapterKey) || "",
    });
  }

  function buildMockExamPracticeSession(state, options) {
    const paper = core.buildMockExamPaper(bank.questions.slice());
    if (!paper || !paper.ok) {
      return {
        ok: false,
        message: (paper && paper.message) || "当前题库无法按模拟考试规则生成完整试卷。",
        session: null,
      };
    }

    return {
      ok: true,
      message: "",
      session: cloneSession({
        mode: "exam",
        source: "mockExam",
        label: (options && options.label) || "模拟考试（单选60/多选10/判断20/填空20）",
        questionIds: paper.questionIds.slice(),
        currentIndex: 0,
        answered: {},
        createdAt: new Date().toISOString(),
        scopeChapterKey: "",
      }),
    };
  }

  function isWrongbookSession(session) {
    return Boolean(
      session &&
        (
          session.source === "wrongbook" ||
          (typeof session.label === "string" && session.label.indexOf("错题本 ·") === 0)
        )
    );
  }

  function isMockExamSession(session) {
    return Boolean(session && (session.source === "mockExam" || session.mode === "exam"));
  }

  function persistSession(state, session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      state.lastSession = null;
      saveState(state);
      return;
    }
    normalized.storageKey = buildSessionStorageKey(normalized);
    state.lastSession = cloneSession(normalized);
    getSessionStore(state)[normalized.storageKey] = cloneSession(normalized);
    saveState(state);
  }

  function persistWrongbookPracticeSession(state, session) {
    const store = getWrongbookPracticeStore(state);
    const normalized = normalizeSession(session);
    if (!normalized) {
      store.lastSession = null;
      saveState(state);
      return;
    }
    normalized.storageKey = buildSessionStorageKey(normalized);
    store.lastSession = cloneSession(normalized);
    getWrongbookPracticeSessionStore(state)[normalized.storageKey] = cloneSession(normalized);
    saveState(state);
  }

  function persistMockExamPracticeSession(state, session) {
    const store = getMockExamPracticeStore(state);
    const normalized = normalizeSession(session);
    if (!normalized) {
      store.lastSession = null;
      saveState(state);
      return;
    }
    normalized.storageKey = buildSessionStorageKey(normalized);
    store.lastSession = cloneSession(normalized);
    getMockExamPracticeSessionStore(state)[normalized.storageKey] = cloneSession(normalized);
    saveState(state);
  }

  function setWrongbookPracticePendingSession(state, session) {
    const store = getWrongbookPracticeStore(state);
    store.pendingSession = cloneSession(session);
    saveState(state);
  }

  function setMockExamPracticePendingSession(state, session) {
    const store = getMockExamPracticeStore(state);
    store.pendingSession = cloneSession(session);
    saveState(state);
  }

  function consumeWrongbookPracticePendingSession(state) {
    const store = getWrongbookPracticeStore(state);
    const session = cloneSession(store.pendingSession);
    store.pendingSession = null;
    saveState(state);
    return session;
  }

  function consumeMockExamPracticePendingSession(state) {
    const store = getMockExamPracticeStore(state);
    const session = cloneSession(store.pendingSession);
    store.pendingSession = null;
    saveState(state);
    return session;
  }

  function reconcileWrongbookPracticeSession(state, session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return null;
    }

    const canonicalQuestionIds = buildWrongbookUnionQuestionIds(state, normalized.scopeChapterKey || "");
    if (!canonicalQuestionIds.length) {
      return null;
    }
    if (sessionQuestionIdsMatch(normalized, canonicalQuestionIds)) {
      return hydrateSessionAnsweredFromStore(getWrongbookPracticeStore(state), normalized);
    }

    const sessionQuestionIds = Array.isArray(normalized.questionIds) ? normalized.questionIds : [];
    const currentQuestionId = sessionQuestionIds[normalized.currentIndex] || "";
    const currentIndex = currentQuestionId ? canonicalQuestionIds.indexOf(currentQuestionId) : -1;
    const fallbackIndex = Math.max(
      0,
      Math.min(
        canonicalQuestionIds.length - 1,
        Number.isFinite(normalized.currentIndex) ? normalized.currentIndex : 0
      )
    );

    return hydrateSessionAnsweredFromStore(
      getWrongbookPracticeStore(state),
      Object.assign({}, normalized, {
        questionIds: canonicalQuestionIds,
        currentIndex: currentIndex >= 0 ? currentIndex : fallbackIndex,
        storageKey: "",
      })
    );
  }

  function reconcileMockExamPracticeSession(state, session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      return null;
    }
    return cloneSession(normalized);
  }

  function rememberWrongbookReturnSession(state, session) {
    const snapshot = cloneSession(session);
    if (!snapshot) {
      return;
    }
    state.wrongbookReturnSession = snapshot;
    saveState(state);
  }

  function getWrongbookReturnSession(state) {
    return cloneSession(state.wrongbookReturnSession);
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    bank: bank,
    core: core,
    getBank: getBank,
    getQuestionMap: getQuestionMap,
    getChapterMap: getChapterMap,
    getScopedQuestions: getScopedQuestions,
    buildScopedBank: buildScopedBank,
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    ensureQuestionState: ensureQuestionState,
    getWrongbookPracticeStore: getWrongbookPracticeStore,
    getMockExamPracticeStore: getMockExamPracticeStore,
    resetWrongbookPracticeState: resetWrongbookPracticeState,
    resetMockExamPracticeState: resetMockExamPracticeState,
    recordQuestionResult: recordQuestionResult,
    recordWrongbookPracticeResult: recordWrongbookPracticeResult,
    recordMockExamPracticeResult: recordMockExamPracticeResult,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    getFavoriteIds: getFavoriteIds,
    getWrongIds: getWrongIds,
    buildWrongbookUnionQuestionIds: buildWrongbookUnionQuestionIds,
    removeWrongBookEntry: removeWrongBookEntry,
    markQuestionMastered: markQuestionMastered,
    createElement: createElement,
    clearElement: clearElement,
    escapeHtml: escapeHtml,
    formatRate: formatRate,
    formatDateTime: formatDateTime,
    describeAnswer: describeAnswer,
    renderStatsGrid: renderStatsGrid,
    renderTrendChart: renderTrendChartLine,
    renderChapterMastery: renderChapterMastery,
    createMetricCard: createMetricCard,
    createQuestionMeta: createQuestionMeta,
    createTagChips: createTagChips,
    getQuestionSummary: getQuestionSummary,
    createEmptyCard: createEmptyCard,
    createRevealableAnswerBlock: createRevealableAnswerBlock,
    createRevealableExplanationBlock: createRevealableExplanationBlock,
    setPendingSession: setPendingSession,
    consumePendingSession: consumePendingSession,
    persistSession: persistSession,
    persistWrongbookPracticeSession: persistWrongbookPracticeSession,
    persistMockExamPracticeSession: persistMockExamPracticeSession,
    setWrongbookPracticePendingSession: setWrongbookPracticePendingSession,
    setMockExamPracticePendingSession: setMockExamPracticePendingSession,
    consumeWrongbookPracticePendingSession: consumeWrongbookPracticePendingSession,
    consumeMockExamPracticePendingSession: consumeMockExamPracticePendingSession,
    normalizeSession: normalizeSession,
    hydrateSessionAnswered: hydrateSessionAnswered,
    hydrateSessionAnsweredFromStore: hydrateSessionAnsweredFromStore,
    findReusableSession: findReusableSession,
    reconcileRestorableSession: reconcileRestorableSession,
    reconcileWrongbookPracticeSession: reconcileWrongbookPracticeSession,
    reconcileMockExamPracticeSession: reconcileMockExamPracticeSession,
    buildWrongbookPracticeSession: buildWrongbookPracticeSession,
    buildMockExamPracticeSession: buildMockExamPracticeSession,
    isWrongbookSession: isWrongbookSession,
    isMockExamSession: isMockExamSession,
    rememberWrongbookReturnSession: rememberWrongbookReturnSession,
    getWrongbookReturnSession: getWrongbookReturnSession,
  };
});

(function (shared) {
  if (!shared) {
    return;
  }

  function hasMeaningfulOverviewAnswer(value) {
    if (Array.isArray(value)) {
      return value.some(function (item) {
        return hasMeaningfulOverviewAnswer(item);
      });
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined && value !== false;
  }

  function buildOverviewGroups(questionIds, questionMap) {
    const groups = [];
    const groupMap = new Map();
    (questionIds || []).forEach(function (questionId, index) {
      const question = questionMap[questionId];
      if (!question) {
        return;
      }
      const groupKey = String(question.type || "未分类");
      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey,
          title: groupKey,
          items: [],
        };
        groupMap.set(groupKey, group);
        groups.push(group);
      }
      const group = groupMap.get(groupKey);
      group.items.push({
        questionId: questionId,
        question: question,
        index: index,
        number: group.items.length + 1,
      });
    });
    return groups;
  }

  function resolveOverviewStatusClass(status) {
    if (
      typeof window !== "undefined" &&
      window.StudyOverviewStatus &&
      typeof window.StudyOverviewStatus.resolveOverviewStatusClass === "function"
    ) {
      return window.StudyOverviewStatus.resolveOverviewStatusClass(status);
    }
    switch (status) {
      case "current-wrong":
        return "is-current-wrong";
      case "wrong":
        return "is-wrong";
      case "current":
        return "is-current";
      case "answered":
        return "is-answered";
      case "viewed":
        return "is-viewed";
      case "unanswered":
      case "unviewed":
      default:
        return "is-unanswered";
    }
  }

  function renderOverviewPanel(config) {
    const panel = config && config.panel;
    if (!panel) {
      return;
    }

    shared.clearElement(panel);
    panel.classList.add("question-overview-panel");

    const header = shared.createElement("div", "overview-header");
    header.appendChild(shared.createElement("h2", "section-title", config.title || "题目概览"));
    if (config.caption) {
      header.appendChild(shared.createElement("div", "section-caption", config.caption));
    }
    panel.appendChild(header);

    const legend = shared.createElement("div", "overview-legend");
    (config.legend || []).forEach(function (item) {
      const entry = shared.createElement("div", "overview-legend-item");
      const swatch = shared.createElement(
        "span",
        `overview-swatch ${resolveOverviewStatusClass(item.status)}`
      );
      entry.appendChild(swatch);
      entry.appendChild(shared.createElement("span", "", item.label));
      legend.appendChild(entry);
    });
    panel.appendChild(legend);

    const groups = config.groups || [];
    if (!groups.length) {
      panel.appendChild(
        shared.createElement(
          "div",
          "question-overview-empty",
          config.emptyMessage || "当前没有可展示的题目概览。"
        )
      );
      return;
    }

    const sections = shared.createElement("div", "overview-sections");
    groups.forEach(function (group) {
      const section = shared.createElement("section", "overview-section");
      section.appendChild(shared.createElement("div", "overview-section-title", group.title));
      const grid = shared.createElement("div", "overview-grid");

      group.items.forEach(function (item) {
        const status = typeof config.getStatus === "function" ? config.getStatus(item) : "unanswered";
        const label =
          typeof config.getItemLabel === "function" ? config.getItemLabel(item) : String(item.number);
        const button = shared.createElement(
          "button",
          `overview-button ${resolveOverviewStatusClass(status)}`,
          label
        );
        button.type = "button";
        button.dataset.questionId = item.questionId || "";
        button.dataset.overviewIndex = String(item.index);
        button.dataset.overviewStatus = status;
        if (typeof config.onJump === "function") {
          button.addEventListener("click", function () {
            config.onJump(item);
          });
        }
        grid.appendChild(button);
      });

      section.appendChild(grid);
      sections.appendChild(section);
    });

    panel.appendChild(sections);
  }

  shared.hasMeaningfulOverviewAnswer = hasMeaningfulOverviewAnswer;
  shared.buildOverviewGroups = buildOverviewGroups;
  shared.renderOverviewPanel = renderOverviewPanel;
})(window.QuestionBankAppShared);
