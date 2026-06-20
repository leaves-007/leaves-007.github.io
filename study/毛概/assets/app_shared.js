(function (factory) {
  if (typeof window !== "undefined") {
    window.QuestionBankAppShared = factory(window.QuestionBankCore, window.QUESTION_BANK_DATA);
  }
})(function (core, bank) {
  const STORAGE_KEY = "maogai-question-bank-state-v1";

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
      lastSession: null,
      pendingSession: null,
      wrongbookReturnSession: null,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultState();
      }
      const parsed = JSON.parse(raw);
      return Object.assign(createDefaultState(), parsed);
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

  function trimPracticeLog(practiceLog) {
    if (practiceLog.length > 5000) {
      practiceLog.splice(0, practiceLog.length - 5000);
    }
  }

  function recordQuestionResult(state, question, result, userAnswer, session) {
    const questionState = ensureQuestionState(state, question.id);
    questionState.attempts += 1;
    questionState.lastResult = result;
    questionState.lastAnsweredAt = new Date().toISOString();
    questionState.lastUserAnswer = userAnswer;
    if (result === "correct") {
      questionState.correctCount += 1;
    } else if (result === "wrong") {
      questionState.wrongCount += 1;
      const entry = state.wrongBook[question.id] || {
        addedAt: questionState.lastAnsweredAt,
        wrongCount: 0,
      };
      entry.wrongCount += 1;
      entry.lastWrongAt = questionState.lastAnsweredAt;
      entry.chapterKey = question.chapterKey;
      entry.type = question.type;
      state.wrongBook[question.id] = entry;
    } else if (result === "mastered") {
      questionState.masteredCount += 1;
    }

    state.practiceLog.push({
      date: questionState.lastAnsweredAt.slice(0, 10),
      result: result,
      questionId: question.id,
      chapterKey: question.chapterKey,
      type: question.type,
      mode: session ? session.mode : "",
    });
    trimPracticeLog(state.practiceLog);
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
      const track = createElement("div", "bar-track");
      const fill = createElement("div", "bar-fill");
      fill.style.height = `${Math.round((item.total / maxTotal) * 100)}%`;
      track.appendChild(fill);
      column.appendChild(track);
      column.appendChild(createElement("div", "bar-label", item.date.slice(5)));
      column.appendChild(createElement("div", "muted", `${item.total} 次`));
      chart.appendChild(column);
    });
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

  function buildWrongbookPracticeSession(state, options) {
    const wrongIds = getWrongIds(state);
    if (!wrongIds.length) {
      return null;
    }

    const wrongIdSet = new Set(wrongIds);
    const orderedQuestionIds = bank.questions
      .filter(function (question) {
        return wrongIdSet.has(question.id);
      })
      .map(function (question) {
        return question.id;
      });

    if (!orderedQuestionIds.length) {
      return null;
    }

    return {
      mode: "custom",
      source: "wrongbook",
      label: (options && options.label) || "错题本 · 直接刷题",
      questionIds: orderedQuestionIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
      scopeChapterKey: (options && options.scopeChapterKey) || "",
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

  function persistSession(state, session) {
    state.lastSession = normalizeSession(session);
    saveState(state);
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
    recordQuestionResult: recordQuestionResult,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    getFavoriteIds: getFavoriteIds,
    getWrongIds: getWrongIds,
    removeWrongBookEntry: removeWrongBookEntry,
    markQuestionMastered: markQuestionMastered,
    createElement: createElement,
    clearElement: clearElement,
    escapeHtml: escapeHtml,
    formatRate: formatRate,
    formatDateTime: formatDateTime,
    describeAnswer: describeAnswer,
    renderStatsGrid: renderStatsGrid,
    renderTrendChart: renderTrendChart,
    renderChapterMastery: renderChapterMastery,
    createMetricCard: createMetricCard,
    createQuestionMeta: createQuestionMeta,
    createTagChips: createTagChips,
    getQuestionSummary: getQuestionSummary,
    createEmptyCard: createEmptyCard,
    createRevealableAnswerBlock: createRevealableAnswerBlock,
    setPendingSession: setPendingSession,
    consumePendingSession: consumePendingSession,
    persistSession: persistSession,
    normalizeSession: normalizeSession,
    buildWrongbookPracticeSession: buildWrongbookPracticeSession,
    isWrongbookSession: isWrongbookSession,
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
      groupMap.get(groupKey).items.push({
        questionId: questionId,
        question: question,
        index: index,
        number: index + 1,
      });
    });
    return groups;
  }

  function resolveOverviewStatusClass(status) {
    switch (status) {
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
