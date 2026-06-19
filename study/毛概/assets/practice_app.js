(function () {
  const shared = window.QuestionBankAppShared;
  if (!shared) {
    throw new Error("QuestionBankAppShared is required");
  }

  const bank = shared.getBank();
  const questionMap = shared.getQuestionMap();
  const pageConfig = window.PAGE_CONFIG || { pageType: "index" };

  let state = shared.loadState();
  let currentSession = null;
  let scopedQuestions = getScopedQuestions();
  let scopedBank = shared.buildScopedBank(pageConfig.chapterKey ? { chapterKey: pageConfig.chapterKey } : null);
  let revealedShortAnswerQuestionId = "";

  document.addEventListener("DOMContentLoaded", init);

  function getScopedQuestions() {
    if (pageConfig.chapterKey) {
      return shared.getScopedQuestions({ chapterKey: pageConfig.chapterKey });
    }
    return bank.questions.slice();
  }

  function init() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row" id="nav-row"></div>
          <h1 class="hero-title" id="hero-title"></h1>
          <p class="hero-subtitle" id="hero-subtitle"></p>
          <div class="hero-meta" id="hero-meta"></div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">刷题模式</h2>
              <div class="control-stack" id="mode-controls"></div>
            </section>
            <section class="panel fade-in">
              <h2 class="section-title">学习统计</h2>
              <div id="stats-grid"></div>
            </section>
            <section class="panel fade-in" id="chapter-links-panel">
              <h2 class="section-title">章节入口</h2>
              <div class="chapter-links" id="chapter-links"></div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="question-card fade-in" id="question-panel"></section>
            <section class="panel fade-in" id="trend-panel"></section>
            <section class="panel fade-in" id="mastery-panel"></section>
          </main>
        </div>
      </div>
    `;

    renderHero();
    renderModeControls();
    restoreSession();
    renderAll();
  }

  function renderHero() {
    const title = document.getElementById("hero-title");
    const subtitle = document.getElementById("hero-subtitle");
    const meta = document.getElementById("hero-meta");
    const nav = document.getElementById("nav-row");

    shared.clearElement(nav);
    [
      { label: "总入口", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      nav.appendChild(link);
    });
    shared.clearElement(nav);
    [
      { label: "总入口", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      nav.appendChild(link);
    });

    if (pageConfig.pageType === "chapter") {
      title.textContent = `${pageConfig.chapterTitle} 独立刷题页`;
      subtitle.textContent = "当前页面固定为单章节训练入口，支持本章顺序、随机、专项、模拟、错题和收藏模式。";
      meta.appendChild(shared.createElement("span", "chip", `章节限定：${pageConfig.chapterTitle}`));
      meta.appendChild(shared.createElement("span", "chip", `本章题数：${scopedQuestions.length}`));
    } else {
      title.textContent = "毛概交互式题库";
      subtitle.textContent = "全部题目来自当前目录下的 Excel 题库，支持离线刷题、章节拆页、错题本、收藏、统计和题库元数据导航。";
      meta.appendChild(shared.createElement("span", "chip", `总题数：${bank.totalQuestions}`));
      meta.appendChild(shared.createElement("span", "chip", `章节数：${bank.chapters.length}`));
      meta.appendChild(shared.createElement("span", "chip", `题型：${bank.questionTypes.join(" / ")}`));
    }
  }

  function renderModeControls() {
    const container = document.getElementById("mode-controls");
    shared.clearElement(container);

    container.appendChild(buildSequentialGroup());
    container.appendChild(buildRandomGroup());
    container.appendChild(buildTypeGroup());
    container.appendChild(buildWrongAndFavoriteGroup());
    container.appendChild(buildExamGroup());
    if (pageConfig.pageType !== "chapter") {
      container.appendChild(buildChapterGroup());
    }
    container.appendChild(buildResetGroup());

    if (pageConfig.pageType === "chapter") {
      document.getElementById("chapter-links-panel").style.display = "none";
    } else {
      renderChapterLinks();
    }
  }

  function buildControlGroup(titleText, descriptionText) {
    const group = shared.createElement("div", "control-group");
    group.appendChild(shared.createElement("h3", "", titleText));
    group.appendChild(shared.createElement("div", "section-caption", descriptionText));
    return group;
  }

  function buildSequentialGroup() {
    const group = buildControlGroup("顺序刷题", "按当前范围内的原始顺序练习。");
    const button = shared.createElement("button", "primary-button", pageConfig.pageType === "chapter" ? "开始本章顺序刷题" : "开始全库顺序刷题");
    button.addEventListener("click", function () {
      startSession({
        mode: "sequential",
        label: pageConfig.pageType === "chapter" ? `${pageConfig.chapterTitle} · 顺序刷题` : "全库顺序刷题",
      });
    });
    group.appendChild(button);
    return group;
  }

  function buildRandomGroup() {
    const group = buildControlGroup("随机刷题", "随机抽题，适合快速查漏补缺。");
    const row = shared.createElement("div", "field-grid");
    const label = shared.createElement("label", "", "题量");
    const input = shared.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(scopedQuestions.length);
    input.value = String(Math.min(20, scopedQuestions.length));
    label.appendChild(input);
    row.appendChild(label);
    group.appendChild(row);
    const button = shared.createElement("button", "secondary-button", "开始随机刷题");
    button.addEventListener("click", function () {
      startSession({
        mode: "random",
        count: Number(input.value) || 20,
        label: `${pageTitlePrefix()}随机刷题`,
      });
    });
    group.appendChild(button);
    return group;
  }

  function buildTypeGroup() {
    const group = buildControlGroup("专项刷题", "按题型集中练习。");
    const label = shared.createElement("label", "", "题型");
    const select = shared.createElement("select");
    bank.questionTypes.forEach(function (questionType) {
      const option = shared.createElement("option", "", questionType);
      option.value = questionType;
      select.appendChild(option);
    });
    label.appendChild(select);
    group.appendChild(label);
    const button = shared.createElement("button", "ghost-button", "开始专项刷题");
    button.addEventListener("click", function () {
      startSession({
        mode: "type",
        questionType: select.value,
        label: `${pageTitlePrefix()}专项刷题 · ${select.value}`,
      });
    });
    group.appendChild(button);
    return group;
  }

  function buildChapterGroup() {
    const group = buildControlGroup("章节刷题", "在总入口里选章节，或直接打开独立章节页。");
    const label = shared.createElement("label", "", "章节");
    const select = shared.createElement("select");
    bank.chapters.forEach(function (chapter, index) {
      const option = shared.createElement("option", "", chapter.title);
      option.value = chapter.key;
      option.dataset.page = chapterPagePath(index);
      select.appendChild(option);
    });
    label.appendChild(select);
    group.appendChild(label);
    const actions = shared.createElement("div", "section-actions");
    const startButton = shared.createElement("button", "secondary-button", "在此页开始");
    startButton.addEventListener("click", function () {
      const chapter = bank.chapters.find(function (item) { return item.key === select.value; });
      startSession({
        mode: "chapter",
        chapterKey: select.value,
        label: `章节刷题 · ${chapter ? chapter.title : select.value}`,
      });
    });
    const openButton = shared.createElement("a", "ghost-button", "打开独立章节页");
    openButton.href = select.selectedOptions[0].dataset.page;
    select.addEventListener("change", function () {
      openButton.href = select.selectedOptions[0].dataset.page;
    });
    actions.appendChild(startButton);
    actions.appendChild(openButton);
    group.appendChild(actions);
    return group;
  }

  function buildWrongAndFavoriteGroup() {
    const group = buildControlGroup("错题 / 收藏", "只练当前范围内的错题或收藏题。");
    const actions = shared.createElement("div", "section-actions");
    const wrongButton = shared.createElement("button", "ghost-button", "错题重练");
    wrongButton.addEventListener("click", function () {
      startSession({
        mode: "wrongs",
        label: `${pageTitlePrefix()}错题重练`,
      });
    });
    const favoriteButton = shared.createElement("button", "ghost-button", "收藏题练习");
    favoriteButton.addEventListener("click", function () {
      startSession({
        mode: "favorites",
        label: `${pageTitlePrefix()}收藏题练习`,
      });
    });
    actions.appendChild(wrongButton);
    actions.appendChild(favoriteButton);
    group.appendChild(actions);
    return group;
  }

  function buildExamGroup() {
    const group = buildControlGroup("模拟考试", "随机组卷，不生成额外答案册。");
    const row = shared.createElement("div", "field-grid");
    const label = shared.createElement("label", "", "题量");
    const input = shared.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(scopedQuestions.length);
    input.value = String(Math.min(30, scopedQuestions.length));
    label.appendChild(input);
    row.appendChild(label);
    group.appendChild(row);
    const button = shared.createElement("button", "primary-button", "生成模拟考试");
    button.addEventListener("click", function () {
      startSession({
        mode: "exam",
        count: Number(input.value) || 30,
        label: `${pageTitlePrefix()}模拟考试`,
      });
    });
    group.appendChild(button);
    return group;
  }

  function buildResetGroup() {
    const group = buildControlGroup("重新开始", "清空浏览器本地记录并从头再刷。");
    const button = shared.createElement("button", "danger-button", "清空本地记录");
    button.addEventListener("click", function () {
      if (!window.confirm("确认清空本地做题记录、错题本、收藏和统计吗？此操作只影响当前题库页面。")) {
        return;
      }
      state = shared.resetState();
      currentSession = null;
      scopedQuestions = getScopedQuestions();
      scopedBank = shared.buildScopedBank(pageConfig.chapterKey ? { chapterKey: pageConfig.chapterKey } : null);
      renderAll();
    });
    group.appendChild(button);
    return group;
  }

  function renderChapterLinks() {
    const container = document.getElementById("chapter-links");
    shared.clearElement(container);
    bank.chapters.forEach(function (chapter, index) {
      const card = shared.createElement("div", "chapter-card");
      card.appendChild(shared.createElement("h3", "", chapter.title));
      card.appendChild(shared.createElement("div", "muted", `${chapter.questionCount} 题`));
      const actions = shared.createElement("div", "section-actions");
      const openLink = shared.createElement("a", "secondary-button", "打开独立章节页");
      openLink.href = chapterPagePath(index);
      const startButton = shared.createElement("button", "ghost-button", "直接开始");
      startButton.addEventListener("click", function () {
        startSession({
          mode: "chapter",
          chapterKey: chapter.key,
          label: `章节刷题 · ${chapter.title}`,
        });
      });
      actions.appendChild(openLink);
      actions.appendChild(startButton);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function chapterPagePath(index) {
    return `chapter-${String(index + 1).padStart(2, "0")}.html`;
  }

  function pageTitlePrefix() {
    return pageConfig.pageType === "chapter" ? `${pageConfig.chapterTitle} · ` : "";
  }

  function restoreSession() {
    const pending = shared.consumePendingSession(state);
    if (pending && sessionMatchesScope(pending)) {
      currentSession = shared.normalizeSession(pending);
      shared.persistSession(state, currentSession);
      return;
    }
    if (state.lastSession && sessionMatchesScope(state.lastSession)) {
      currentSession = shared.normalizeSession(state.lastSession);
    }
  }

  function sessionMatchesScope(session) {
    if (pageConfig.chapterKey) {
      return session.scopeChapterKey === pageConfig.chapterKey;
    }
    return !session.scopeChapterKey || bank.chapters.some(function (chapter) { return chapter.key === session.scopeChapterKey; });
  }

  function startSession(config) {
    const pool = getSessionPool(config);
    const questionIds = buildQuestionIds(pool, config);
    if (!questionIds.length) {
      window.alert("当前筛选下没有可练习的题目。");
      return;
    }
    currentSession = {
      mode: config.mode,
      label: config.label,
      questionIds: questionIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
      scopeChapterKey: pageConfig.chapterKey || config.chapterKey || "",
    };
    shared.persistSession(state, currentSession);
    renderAll();
  }

  function getSessionPool(config) {
    if (config.mode === "chapter" && config.chapterKey) {
      return bank.questions.filter(function (question) { return question.chapterKey === config.chapterKey; });
    }
    return scopedQuestions.slice();
  }

  function buildQuestionIds(pool, config) {
    if (config.mode === "wrongs") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: "wrongs",
        wrongIds: shared.getWrongIds(state),
      });
    }
    if (config.mode === "favorites") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: "favorites",
        favoriteIds: shared.getFavoriteIds(state),
      });
    }
    if (config.mode === "type") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: "type",
        questionType: config.questionType,
      });
    }
    if (config.mode === "chapter") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: "sequential",
      });
    }
    if (config.mode === "custom") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: "custom",
        questionIds: config.questionIds,
      });
    }
    if (config.mode === "random" || config.mode === "exam") {
      return shared.core.buildSessionQuestionIds(pool, {
        mode: config.mode,
        count: Math.min(config.count || pool.length, pool.length),
      });
    }
    return shared.core.buildSessionQuestionIds(pool, { mode: "sequential" });
  }

  function renderAll() {
    renderQuestionPanel();
    renderStats();
  }

  function renderSessionSummary() {
    const toolbar = document.getElementById("session-toolbar");
    const summary = document.getElementById("session-summary");
    shared.clearElement(toolbar);
    shared.clearElement(summary);

    if (!currentSession || !currentSession.questionIds.length) {
      summary.appendChild(shared.createEmptyCard("还没有开始刷题。左侧选择一个模式即可进入。"));
      return;
    }

    const answeredCount = Object.keys(currentSession.answered || {}).length;
    const questionCount = currentSession.questionIds.length;
    const currentNumber = currentSession.currentIndex + 1;
    const progress = shared.createElement("div", "control-stack");
    progress.appendChild(shared.createElement("div", "section-title", currentSession.label));
    progress.appendChild(shared.createElement("div", "muted", `当前第 ${currentNumber} / ${questionCount} 题，本轮已作答 ${answeredCount} 题。`));
    const progressShell = shared.createElement("div", "progress-shell");
    const bar = shared.createElement("div", "progress-bar");
    bar.style.width = `${Math.round((currentNumber / questionCount) * 100)}%`;
    progressShell.appendChild(bar);
    progress.appendChild(progressShell);
    summary.appendChild(progress);

    const previousButton = shared.createElement("button", "ghost-button", "上一题");
    previousButton.disabled = currentSession.currentIndex <= 0;
    previousButton.addEventListener("click", function () {
      currentSession.currentIndex = Math.max(0, currentSession.currentIndex - 1);
      shared.persistSession(state, currentSession);
      renderAll();
    });
    const nextButton = shared.createElement("button", "ghost-button", "下一题");
    nextButton.disabled = currentSession.currentIndex >= currentSession.questionIds.length - 1;
    nextButton.addEventListener("click", function () {
      currentSession.currentIndex = Math.min(currentSession.questionIds.length - 1, currentSession.currentIndex + 1);
      shared.persistSession(state, currentSession);
      renderAll();
    });
    const restartButton = shared.createElement("button", "secondary-button", "本轮重新开始");
    restartButton.addEventListener("click", function () {
      currentSession.currentIndex = 0;
      currentSession.answered = {};
      shared.persistSession(state, currentSession);
      renderAll();
    });
    toolbar.appendChild(previousButton);
    toolbar.appendChild(nextButton);
    toolbar.appendChild(restartButton);
  }

  function buildSessionSummaryCard() {
    const answeredCount = Object.keys(currentSession.answered || {}).length;
    const questionCount = currentSession.questionIds.length;
    const currentNumber = currentSession.currentIndex + 1;
    const shell = shared.createElement("div", "question-footer");
    const navRow = shared.createElement("div", "nav-progress-row");
    const progressInfo = shared.createElement("div", "nav-progress-info");
    const progressLabel = shared.createElement("div", "progress-label");
    const labelSpan = shared.createElement("span", "", `↻ ${currentSession.label}`);
    const positionSpan = shared.createElement("span", "muted", `${currentNumber} / ${questionCount}`);
    progressLabel.appendChild(labelSpan);
    progressLabel.appendChild(positionSpan);
    progressInfo.appendChild(progressLabel);
    const progressShell = shared.createElement("div", "progress-shell");
    const bar = shared.createElement("div", "progress-bar");
    bar.style.width = `${Math.round((currentNumber / questionCount) * 100)}%`;
    progressShell.appendChild(bar);
    progressInfo.appendChild(progressShell);
    navRow.appendChild(progressInfo);

    const navButtons = shared.createElement("div", "nav-button-group");
    const previousButton = shared.createElement("button", "ghost-button", "◀ 上一题");
    previousButton.disabled = currentSession.currentIndex <= 0;
    previousButton.addEventListener("click", function () {
      currentSession.currentIndex = Math.max(0, currentSession.currentIndex - 1);
      shared.persistSession(state, currentSession);
      renderAll();
    });
    navButtons.appendChild(previousButton);
    const nextButton = shared.createElement("button", "ghost-button", "▶ 下一题");
    nextButton.disabled = currentSession.currentIndex >= currentSession.questionIds.length - 1;
    nextButton.addEventListener("click", function () {
      currentSession.currentIndex = Math.min(currentSession.questionIds.length - 1, currentSession.currentIndex + 1);
      shared.persistSession(state, currentSession);
      renderAll();
    });
    navButtons.appendChild(nextButton);
    const restartButton = shared.createElement("button", "ghost-button", "↺ 重新开始");
    restartButton.addEventListener("click", function () {
      currentSession.currentIndex = 0;
      currentSession.answered = {};
      shared.persistSession(state, currentSession);
      renderAll();
    });
    navButtons.appendChild(restartButton);
    navRow.appendChild(navButtons);
    shell.appendChild(navRow);
    return shell;
  }

  function renderQuestionPanel() {
    const panel = document.getElementById("question-panel");
    shared.clearElement(panel);
    if (!currentSession || !currentSession.questionIds.length) {
      delete panel.dataset.questionId;
      panel.appendChild(shared.createEmptyCard("选择刷题模式后，这里会显示当前题目。"));
      return;
    }

    const questionId = currentSession.questionIds[currentSession.currentIndex];
    const question = questionMap[questionId];
    panel.dataset.questionId = questionId;
    const questionState = state.questionStates[question.id];
    const sessionAnswer = currentSession.answered[question.id];

    const scrollArea = shared.createElement("div", "question-content-scroll");
    scrollArea.appendChild(shared.createQuestionMeta(question));
    scrollArea.appendChild(shared.createTagChips(question.tags));
    scrollArea.appendChild(shared.createElement("div", "question-stem", question.stem));
    if (question.material) {
      scrollArea.appendChild(shared.createElement("div", "question-material", question.material));
    }

    const answerHost = shared.createElement("div", "control-stack answer-host");
    buildAnswerInputs(question, answerHost);
    scrollArea.appendChild(answerHost);

    if (question.type === "简答题" && revealedShortAnswerQuestionId === question.id) {
      scrollArea.appendChild(renderShortAnswerResult(question));
    }
    if (sessionAnswer || questionState) {
      scrollArea.appendChild(renderResultSection(question, sessionAnswer || questionState));
    }

    panel.appendChild(scrollArea);

    const bottomBar = shared.createElement("div", "question-bottom-bar");
    const actionRow = shared.createElement("div", "bottom-action-row");
    if (question.type !== "简答题") {
      const submitButton = shared.createElement("button", "primary-button", "提交答案");
      submitButton.onclick = function () {
        submitObjectiveQuestion(question, answerHost);
      };
      actionRow.appendChild(submitButton);
    } else {
      const revealButton = shared.createElement("button", "secondary-button", "显示参考答案");
      revealButton.onclick = function () {
        revealedShortAnswerQuestionId = question.id;
        renderAll();
      };
      actionRow.appendChild(revealButton);
    }

    const favoriteButton = shared.createElement(
      "button",
      shared.isFavorite(state, question.id) ? "secondary-button" : "ghost-button",
      (shared.isFavorite(state, question.id) ? "★ " : "☆ ") + (shared.isFavorite(state, question.id) ? "取消收藏" : "收藏本题")
    );
    favoriteButton.onclick = function () {
      shared.toggleFavorite(state, question.id);
      state = shared.loadState();
      renderAll();
    };
    actionRow.appendChild(favoriteButton);
    bottomBar.appendChild(actionRow);

    bottomBar.appendChild(buildSessionSummaryCard());
    panel.appendChild(bottomBar);
  }

  function buildAnswerInputs(question, host) {
    if (question.type === "判断题") {
      buildChoiceInputs(
        [
          { key: "true", text: "正确" },
          { key: "false", text: "错误" },
        ],
        "single",
        host
      );
      return;
    }
    if (question.type === "单选题") {
      buildChoiceInputs(question.options, "single", host);
      return;
    }
    if (question.type === "多选题") {
      buildChoiceInputs(question.options, "multiple", host);
      return;
    }
    if (question.type === "填空题") {
      const blanks = question.fillBlanks && question.fillBlanks.length ? question.fillBlanks : [{ acceptedAnswers: [] }];
      const list = shared.createElement("div", "fill-blank-list");
      blanks.forEach(function (_, index) {
        const label = shared.createElement("label", "", `第 ${index + 1} 空`);
        const input = shared.createElement("input");
        input.type = "text";
        input.dataset.blankIndex = String(index);
        label.appendChild(input);
        list.appendChild(label);
      });
      host.appendChild(list);
      return;
    }

    const label = shared.createElement("label", "", "你的作答");
    const textarea = shared.createElement("textarea");
    textarea.placeholder = "先自己作答，再点击“显示参考答案”。";
    label.appendChild(textarea);
    host.appendChild(label);
  }

  function buildChoiceInputs(options, mode, host) {
    const list = shared.createElement("div", "options-list");
    const name = `question-${Date.now()}-${Math.random()}`;
    options.forEach(function (option) {
      const label = shared.createElement("label", "option-item");
      const input = shared.createElement("input");
      input.type = mode === "single" ? "radio" : "checkbox";
      input.name = name;
      input.value = option.key;
      const key = shared.createElement("span", "option-key", option.key);
      const text = shared.createElement("span", "", option.text);
      label.appendChild(input);
      label.appendChild(key);
      label.appendChild(text);
      list.appendChild(label);
    });
    host.appendChild(list);
  }

  function collectUserAnswer(question, host) {
    if (question.type === "单选题" || question.type === "判断题") {
      const checked = host.querySelector("input[type='radio']:checked");
      return checked ? checked.value : "";
    }
    if (question.type === "多选题") {
      return Array.from(host.querySelectorAll("input[type='checkbox']:checked")).map(function (input) { return input.value; });
    }
    if (question.type === "填空题") {
      return Array.from(host.querySelectorAll("input[data-blank-index]")).map(function (input) { return input.value; });
    }
    const textarea = host.querySelector("textarea");
    return textarea ? textarea.value : "";
  }

  function submitObjectiveQuestion(question, host) {
    const userAnswer = collectUserAnswer(question, host);
    const result = shared.core.judgeQuestion(question, userAnswer);
    const resultName = result.isCorrect ? "correct" : "wrong";
    shared.recordQuestionResult(state, question, resultName, userAnswer, currentSession);
    currentSession.answered[question.id] = {
      result: resultName,
      userAnswer: userAnswer,
      judgedAt: new Date().toISOString(),
    };
    shared.persistSession(state, currentSession);
    state = shared.loadState();
    renderAll();
  }

  function renderShortAnswerResult(question) {
    const wrapper = shared.createElement("div", "control-stack");
    wrapper.appendChild(shared.createElement("div", "question-material", `参考答案：${question.answerRaw || "无"}`));
    const actionRow = shared.createElement("div", "answer-actions");
    const masteredButton = shared.createElement("button", "secondary-button", "标记已掌握");
    masteredButton.onclick = function () {
      const questionPanel = document.getElementById("question-panel");
      const answerHost = questionPanel.querySelector(".answer-host");
      recordShortAnswer(question, collectUserAnswer(question, answerHost), "mastered");
    };
    const wrongButton = shared.createElement("button", "danger-button", "标记未掌握");
    wrongButton.onclick = function () {
      const questionPanel = document.getElementById("question-panel");
      const answerHost = questionPanel.querySelector(".answer-host");
      recordShortAnswer(question, collectUserAnswer(question, answerHost), "wrong");
    };
    actionRow.appendChild(masteredButton);
    actionRow.appendChild(wrongButton);
    wrapper.appendChild(actionRow);
    return wrapper;
  }

  function recordShortAnswer(question, userAnswer, resultName) {
    shared.recordQuestionResult(state, question, resultName, userAnswer, currentSession);
    currentSession.answered[question.id] = {
      result: resultName,
      userAnswer: userAnswer,
      judgedAt: new Date().toISOString(),
    };
    shared.persistSession(state, currentSession);
    state = shared.loadState();
    revealedShortAnswerQuestionId = "";
    renderAll();
  }

  function renderResultSection(question, answerState) {
    const wrapper = shared.createElement("div", "control-stack");
    const resultClass = answerState.result === "correct" || answerState.result === "mastered" ? "result-good" : "result-bad";
    const resultText = answerState.result === "mastered" ? "已标记为掌握" : answerState.result === "correct" ? "回答正确" : "回答错误";
    wrapper.appendChild(shared.createElement("div", `result-banner ${resultClass}`, resultText));
    wrapper.appendChild(shared.createElement("div", "answer-detail", `标准答案：${shared.describeAnswer(question)}`));
    if (question.explanation) {
      wrapper.appendChild(shared.createElement("div", "answer-detail", `答案解析：${question.explanation}`));
    }
    const meta = shared.createElement("div", "answer-detail", `最近作答时间：${shared.formatDateTime(answerState.judgedAt || answerState.lastAnsweredAt)}`);
    wrapper.appendChild(meta);
    if (question.type !== "简答题" && state.wrongBook[question.id]) {
      const actions = shared.createElement("div", "answer-actions");
      const removeButton = shared.createElement("button", "ghost-button", "标记掌握并移出错题本");
      removeButton.onclick = function () {
        shared.markQuestionMastered(state, question.id);
        state = shared.loadState();
        renderAll();
      };
      actions.appendChild(removeButton);
      wrapper.appendChild(actions);
    }
    return wrapper;
  }

  function renderStats() {
    const stats = shared.core.computeStats(scopedBank, state, new Date().toISOString().slice(0, 10));
    shared.renderStatsGrid(document.getElementById("stats-grid"), stats);
    shared.renderTrendChart(document.getElementById("trend-panel"), stats);
    shared.renderChapterMastery(document.getElementById("mastery-panel"), stats);
  }
  document.addEventListener("DOMContentLoaded", function () {
    const nav = document.getElementById("nav-row");
    if (nav) {
      shared.clearElement(nav);
      [
        { label: "总入口", href: "index.html" },
        { label: "错题本", href: "wrong_book.html" },
      ].forEach(function (item) {
        const link = shared.createElement("a", "", item.label);
        link.href = item.href;
        nav.appendChild(link);
      });
    }

    const subtitle = document.getElementById("hero-subtitle");
    if (subtitle && pageConfig.pageType !== "chapter") {
    }
  });
  const dom = {};
  let draftAnswers = {};
  let statsRefreshTimer = 0;
  let statsRefreshFrame = 0;

  function init() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row" id="nav-row"></div>
          <h1 class="hero-title" id="hero-title"></h1>
          <p class="hero-subtitle" id="hero-subtitle"></p>
          <div class="hero-meta" id="hero-meta"></div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">刷题模式</h2>
              <div class="control-stack" id="mode-controls"></div>
            </section>
            <section class="panel fade-in">
              <h2 class="section-title">学习统计</h2>
              <div id="stats-grid"></div>
            </section>
            <section class="panel fade-in" id="chapter-links-panel">
              <h2 class="section-title">章节入口</h2>
              <div class="chapter-links" id="chapter-links"></div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="panel fade-in study-actions-shell">
              <div class="chapter-head">
                <div>
                  <h2 class="section-title">快捷操作</h2>
                  <div class="section-caption">移动端高频操作集中在这里，避免长页面滚动后找不到提交、筛选和错题入口。</div>
                </div>
              </div>
              <div class="study-actions" id="study-actions"></div>
            </section>
            <section class="question-card fade-in" id="question-panel"></section>
            <section class="panel fade-in" id="trend-panel"></section>
            <section class="panel fade-in" id="mastery-panel"></section>
          </main>
        </div>
      </div>
    `;

    cacheDom();
    renderHero();
    renderModeControls();
    restoreSession();
    attachInteractionDelegates();
    renderAll();
  }

  function cacheDom() {
    dom.nav = document.getElementById("nav-row");
    dom.heroTitle = document.getElementById("hero-title");
    dom.heroSubtitle = document.getElementById("hero-subtitle");
    dom.heroMeta = document.getElementById("hero-meta");
    dom.studyActions = document.getElementById("study-actions");
    dom.studyActionsShell = dom.studyActions ? dom.studyActions.closest(".study-actions-shell") : null;
    if (dom.studyActionsShell) {
      dom.studyActionsShell.remove();
      dom.studyActions = null;
      dom.studyActionsShell = null;
    }
    dom.questionPanel = document.getElementById("question-panel");
    dom.statsGrid = document.getElementById("stats-grid");
    dom.trendPanel = document.getElementById("trend-panel");
    dom.masteryPanel = document.getElementById("mastery-panel");
  }

  function renderHero() {
    shared.clearElement(dom.nav);
    [
      { label: "总入口", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      dom.nav.appendChild(link);
    });

    shared.clearElement(dom.heroMeta);
    if (pageConfig.pageType === "chapter") {
      dom.heroTitle.textContent = `${pageConfig.chapterTitle} · 章节练习`;
      dom.heroSubtitle.remove();
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `章节限定：${pageConfig.chapterTitle}`));
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `本章题数：${scopedQuestions.length}`));
    } else {
      dom.heroTitle.textContent = "毛概交互式题库";
      dom.heroSubtitle.remove();
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `总题数：${bank.totalQuestions}`));
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `章节数：${bank.chapters.length}`));
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `题型：${bank.questionTypes.join(" / ")}`));
    }
  }

  function renderAll() {
    renderQuestionPanel();
    renderStudyActions();
    renderStats();
  }

  function renderHero() {
    shared.clearElement(dom.nav);
    [
      { label: "总入口", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      dom.nav.appendChild(link);
    });

    shared.clearElement(dom.heroMeta);
    if (dom.heroSubtitle && dom.heroSubtitle.isConnected) {
      dom.heroSubtitle.remove();
    }

    if (pageConfig.pageType === "chapter") {
      dom.heroTitle.textContent = `${pageConfig.chapterTitle} · 章节练习`;
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `章节限定：${pageConfig.chapterTitle}`));
      dom.heroMeta.appendChild(shared.createElement("span", "chip", `本章题数：${scopedQuestions.length}`));
      return;
    }

    dom.heroTitle.textContent = "毛概交互式题库";
    dom.heroMeta.appendChild(shared.createElement("span", "chip", `总题数：${bank.totalQuestions}`));
    dom.heroMeta.appendChild(shared.createElement("span", "chip", `章节数：${bank.chapters.length}`));
    dom.heroMeta.appendChild(shared.createElement("span", "chip", `题型：${bank.questionTypes.join(" / ")}`));
  }

  function attachInteractionDelegates() {
    if (dom.questionPanel.dataset.delegatesAttached === "true") {
      return;
    }
    dom.questionPanel.dataset.delegatesAttached = "true";
    dom.questionPanel.addEventListener("change", handleQuestionChange);
    dom.questionPanel.addEventListener("input", handleQuestionInput);
    dom.questionPanel.addEventListener("click", handleQuestionActionClick);
    if (dom.studyActions) {
      dom.studyActions.addEventListener("click", handleStudyActionClick);
    }
  }

  function handleQuestionChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.type !== "radio" && target.type !== "checkbox") {
      return;
    }
    const question = getCurrentQuestion();
    const answerHost = target.closest(".answer-host");
    if (!question || !answerHost) {
      return;
    }
    syncDraftAnswer(question, answerHost);
    updateOptionSelectionState(answerHost);
  }

  function handleQuestionInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }
    const question = getCurrentQuestion();
    const answerHost = target.closest(".answer-host");
    if (!question || !answerHost) {
      return;
    }
    syncDraftAnswer(question, answerHost);
  }

  function handleQuestionActionClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      return;
    }
    const action = actionTarget.dataset.action;
    const question = getCurrentQuestion();
    const answerHost = dom.questionPanel.querySelector(".answer-host");

    if (action === "session-prev") {
      moveSessionIndex(-1);
      return;
    }
    if (action === "session-next") {
      moveSessionIndex(1);
      return;
    }
    if (action === "session-restart") {
      restartCurrentSession();
      return;
    }
    if (!question || !answerHost) {
      return;
    }
    if (action === "submit-answer") {
      submitObjectiveQuestion(question, answerHost);
      return;
    }
    if (action === "reveal-short-answer") {
      revealedShortAnswerQuestionId = question.id;
      renderQuestionPanel();
      return;
    }
    if (action === "toggle-favorite") {
      shared.toggleFavorite(state, question.id);
      state = shared.loadState();
      renderQuestionPanel();
      renderStudyActions();
      scheduleStatsRefresh();
      return;
    }
    if (action === "mark-short-mastered") {
      recordShortAnswer(question, collectUserAnswer(question, answerHost), "mastered");
      return;
    }
    if (action === "mark-short-wrong") {
      recordShortAnswer(question, collectUserAnswer(question, answerHost), "wrong");
      return;
    }
    if (action === "remove-wrong-entry") {
      shared.markQuestionMastered(state, question.id);
      state = shared.loadState();
      renderQuestionPanel();
      renderStudyActions();
      scheduleStatsRefresh();
    }
  }

  function handleStudyActionClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      return;
    }
    const action = actionTarget.dataset.action;
    const question = getCurrentQuestion();
    const answerHost = dom.questionPanel.querySelector(".answer-host");

    if (action === "study-submit") {
      if (!question || !answerHost) {
        return;
      }
      if (question.type === "简答题") {
        if (revealedShortAnswerQuestionId !== question.id) {
          revealedShortAnswerQuestionId = question.id;
          renderQuestionPanel();
        }
        return;
      }
      submitObjectiveQuestion(question, answerHost);
      return;
    }
    if (action === "study-important") {
      startImportantSession();
      return;
    }
    if (action === "study-wrongs") {
      startSession({
        mode: "wrongs",
        label: `${pageTitlePrefix()}错题重练`,
      });
      return;
    }
    if (action === "study-open-wrongbook") {
      window.location.href = "wrong_book.html";
      return;
    }
    if (action === "study-show-all") {
      startSession({
        mode: "sequential",
        label: pageConfig.pageType === "chapter" ? `${pageConfig.chapterTitle} · 顺序刷题` : "全库顺序刷题",
      });
      return;
    }
    if (action === "study-clear-wrongbook") {
      clearWrongBook();
      return;
    }
    if (action === "study-reset-page") {
      resetCurrentPageSession();
    }
  }

  function getCurrentQuestion() {
    if (!currentSession || !currentSession.questionIds.length) {
      return null;
    }
    return questionMap[currentSession.questionIds[currentSession.currentIndex]] || null;
  }

  function setDraftAnswer(questionId, value) {
    draftAnswers[questionId] = Array.isArray(value) ? value.slice() : value;
  }

  function getDraftAnswer(questionId) {
    return Object.prototype.hasOwnProperty.call(draftAnswers, questionId) ? draftAnswers[questionId] : null;
  }

  function moveSessionIndex(offset) {
    if (!currentSession) {
      return;
    }
    currentSession.currentIndex = Math.max(0, Math.min(currentSession.questionIds.length - 1, currentSession.currentIndex + offset));
    revealedShortAnswerQuestionId = "";
    shared.persistSession(state, currentSession);
    renderQuestionPanel();
    renderStudyActions();
  }

  function restartCurrentSession() {
    if (!currentSession) {
      return;
    }
    currentSession.currentIndex = 0;
    currentSession.answered = {};
    draftAnswers = {};
    revealedShortAnswerQuestionId = "";
    shared.persistSession(state, currentSession);
    renderQuestionPanel();
    renderStudyActions();
  }

  function resetCurrentPageSession() {
    if (currentSession) {
      currentSession.currentIndex = 0;
      currentSession.answered = {};
      shared.persistSession(state, currentSession);
    }
    draftAnswers = {};
    revealedShortAnswerQuestionId = "";
    renderQuestionPanel();
    renderStudyActions();
  }

  function clearWrongBook() {
    if (!window.confirm("确认清空错题本吗？这不会修改判分逻辑或题目数据，只会移除错题本条目。")) {
      return;
    }
    state.wrongBook = {};
    shared.saveState(state);
    state = shared.loadState();
    renderQuestionPanel();
    renderStudyActions();
    scheduleStatsRefresh();
  }

  function startImportantSession() {
    const questionIds = scopedQuestions
      .filter(function (question) {
        return (
          Number(question.score || 0) >= 2 ||
          Number(question.difficulty || 0) >= 3 ||
          (question.tags || []).some(function (tag) { return String(tag).includes("重点"); })
        );
      })
      .map(function (question) { return question.id; });

    if (!questionIds.length) {
      window.alert("当前范围内没有可识别的重点题。");
      return;
    }

    currentSession = {
      mode: "custom",
      label: `${pageTitlePrefix()}重点题练习`,
      questionIds: questionIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
      scopeChapterKey: pageConfig.chapterKey || "",
    };
    draftAnswers = {};
    revealedShortAnswerQuestionId = "";
    shared.persistSession(state, currentSession);
    renderQuestionPanel();
    renderStudyActions();
  }

  function scheduleStatsRefresh() {
    if (statsRefreshTimer) {
      window.clearTimeout(statsRefreshTimer);
    }
    if (statsRefreshFrame) {
      window.cancelAnimationFrame(statsRefreshFrame);
    }
    statsRefreshTimer = window.setTimeout(function () {
      statsRefreshFrame = window.requestAnimationFrame(function () {
        state = shared.loadState();
        renderStats();
        renderStudyActions();
      });
    }, 80);
  }

  function renderStudyActions() {
    if (!dom.studyActions) {
      return;
    }
    shared.clearElement(dom.studyActions);
    const currentQuestion = getCurrentQuestion();
    const wrongCount = shared.getWrongIds(state).length;

    [
      {
        label: currentQuestion && currentQuestion.type === "简答题" ? "显示答案" : "提交判分",
        className: "primary-button",
        action: "study-submit",
        disabled: !currentQuestion,
      },
      {
        label: "只看重点题",
        className: "ghost-button",
        action: "study-important",
        disabled: false,
      },
      {
        label: `只看错题${wrongCount ? `（${wrongCount}）` : ""}`,
        className: "ghost-button",
        action: "study-wrongs",
        disabled: wrongCount === 0,
      },
      {
        label: "打开错题本",
        className: "secondary-button",
        action: "study-open-wrongbook",
        disabled: false,
      },
      {
        label: "显示全部",
        className: "ghost-button",
        action: "study-show-all",
        disabled: false,
      },
      {
        label: "清空错题本",
        className: "danger-button",
        action: "study-clear-wrongbook",
        disabled: wrongCount === 0,
      },
      {
        label: "重置本页",
        className: "secondary-button",
        action: "study-reset-page",
        disabled: !currentSession,
      },
    ].forEach(function (config) {
      const button = shared.createElement("button", config.className, config.label);
      button.type = "button";
      button.dataset.action = config.action;
      button.disabled = Boolean(config.disabled);
      dom.studyActions.appendChild(button);
    });
  }

  function renderQuestionPanel() {
    const panel = dom.questionPanel;
    shared.clearElement(panel);
    if (!currentSession || !currentSession.questionIds.length) {
      delete panel.dataset.questionId;
      panel.appendChild(shared.createEmptyCard("选择刷题模式后，这里会显示当前题目。"));
      return;
    }

    const question = getCurrentQuestion();
    if (!question) {
      delete panel.dataset.questionId;
      panel.appendChild(shared.createEmptyCard("当前题目不存在，请重新开始本轮练习。"));
      return;
    }

    const questionState = state.questionStates[question.id];
    const sessionAnswer = currentSession.answered[question.id];
    const restoredAnswer = sessionAnswer ? sessionAnswer.userAnswer : getDraftAnswer(question.id);

        panel.dataset.questionId = question.id;
    const scrollArea = shared.createElement("div", "question-content-scroll");
    scrollArea.appendChild(shared.createQuestionMeta(question));
    scrollArea.appendChild(shared.createTagChips(question.tags));
    scrollArea.appendChild(shared.createElement("div", "question-stem", question.stem));
    if (question.material) {
      scrollArea.appendChild(shared.createElement("div", "question-material", question.material));
    }
    const answerHost = shared.createElement("div", "control-stack answer-host");
    answerHost.dataset.questionId = question.id;
    buildAnswerInputs(question, answerHost, restoredAnswer);
    scrollArea.appendChild(answerHost);
    if (question.type === "简答题" && revealedShortAnswerQuestionId === question.id) {
      scrollArea.appendChild(renderShortAnswerResult(question));
    }
    if (sessionAnswer || questionState) {
      scrollArea.appendChild(renderResultSection(question, sessionAnswer || questionState));
    }
    panel.appendChild(scrollArea);
    const bottomBar = shared.createElement("div", "question-bottom-bar");
    const actionRow = shared.createElement("div", "bottom-action-row");
    if (question.type !== "简答题") {
      actionRow.appendChild(createActionButton("primary-button", "提交答案", "submit-answer"));
    } else {
      actionRow.appendChild(createActionButton("secondary-button", "显示参考答案", "reveal-short-answer"));
    }
    actionRow.appendChild(
      createActionButton(
        shared.isFavorite(state, question.id) ? "secondary-button" : "ghost-button",
        (shared.isFavorite(state, question.id) ? "★ " : "☆ ") + (shared.isFavorite(state, question.id) ? "取消收藏" : "收藏本题"),
        "toggle-favorite"
      )
    );
    bottomBar.appendChild(actionRow);
    bottomBar.appendChild(buildSessionSummaryCard());
    panel.appendChild(bottomBar);
  }

  
function createActionButton(className, label, action) {
    const button = shared.createElement("button", className, label);
    button.type = "button";
    button.dataset.action = action;
    return button;
  }

    function buildSessionSummaryCard() {
    const answeredCount = Object.keys(currentSession.answered || {}).length;
    const questionCount = currentSession.questionIds.length;
    const currentNumber = currentSession.currentIndex + 1;
    const shell = shared.createElement("div", "question-footer");
    const navRow = shared.createElement("div", "nav-progress-row");
    const progressInfo = shared.createElement("div", "nav-progress-info");
    const progressLabel = shared.createElement("div", "progress-label");
    const labelSpan = shared.createElement("span", "", "↻ " + currentSession.label);
    const positionSpan = shared.createElement("span", "muted", "" + currentNumber + " / " + questionCount);
    progressLabel.appendChild(labelSpan);
    progressLabel.appendChild(positionSpan);
    progressInfo.appendChild(progressLabel);
    const progressShell = shared.createElement("div", "progress-shell");
    const bar = shared.createElement("div", "progress-bar");
    bar.style.width = String(Math.round((currentNumber / questionCount) * 100)) + "%";
    progressShell.appendChild(bar);
    progressInfo.appendChild(progressShell);
    navRow.appendChild(progressInfo);
    const navButtons = shared.createElement("div", "nav-button-group");
    const previousButton = createActionButton("ghost-button", "◀ 上一题", "session-prev");
    previousButton.disabled = currentSession.currentIndex <= 0;
    const nextButton = createActionButton("ghost-button", "▶ 下一题", "session-next");
    nextButton.disabled = currentSession.currentIndex >= currentSession.questionIds.length - 1;
    const restartButton = createActionButton("ghost-button", "↺ 重新开始", "session-restart");
    navButtons.appendChild(previousButton);
    navButtons.appendChild(nextButton);
    navButtons.appendChild(restartButton);
    navRow.appendChild(navButtons);
    shell.appendChild(navRow);
    return shell;
  }

function buildAnswerInputs(question, host, restoredAnswer) {
    if (question.type === "判断题") {
      buildChoiceInputs(
        question,
        [
          { key: "true", text: "正确" },
          { key: "false", text: "错误" },
        ],
        "single",
        host,
        restoredAnswer
      );
      return;
    }
    if (question.type === "单选题") {
      buildChoiceInputs(question, question.options, "single", host, restoredAnswer);
      return;
    }
    if (question.type === "多选题") {
      buildChoiceInputs(question, question.options, "multiple", host, restoredAnswer);
      return;
    }
    if (question.type === "填空题") {
      const blanks = question.fillBlanks && question.fillBlanks.length ? question.fillBlanks : [{ acceptedAnswers: [] }];
      const values = Array.isArray(restoredAnswer) ? restoredAnswer : [];
      const list = shared.createElement("div", "fill-blank-list");
      blanks.forEach(function (_, index) {
        const label = shared.createElement("label", "", `第 ${index + 1} 空`);
        const input = shared.createElement("input");
        input.type = "text";
        input.dataset.blankIndex = String(index);
        input.value = values[index] || "";
        label.appendChild(input);
        list.appendChild(label);
      });
      host.appendChild(list);
      return;
    }

    const label = shared.createElement("label", "", "你的作答");
    const textarea = shared.createElement("textarea");
    textarea.placeholder = "先自己作答，再点击“显示参考答案”。";
    textarea.value = typeof restoredAnswer === "string" ? restoredAnswer : "";
    label.appendChild(textarea);
    host.appendChild(label);
  }

  function buildChoiceInputs(question, options, mode, host, restoredAnswer) {
    const list = shared.createElement("div", "options-list");
    const selected = Array.isArray(restoredAnswer) ? restoredAnswer : [restoredAnswer].filter(Boolean);
    const selectedSet = new Set(selected);
    const name = `question-${question.id}`;
    options.forEach(function (option) {
      const label = shared.createElement("label", "option-item");
      const input = shared.createElement("input");
      input.type = mode === "single" ? "radio" : "checkbox";
      input.name = name;
      input.value = option.key;
      input.checked = selectedSet.has(option.key);
      const key = shared.createElement("span", "option-key", option.key);
      const text = shared.createElement("span", "", option.text);
      label.appendChild(input);
      label.appendChild(key);
      label.appendChild(text);
      list.appendChild(label);
    });
    host.appendChild(list);
    updateOptionSelectionState(host);
  }

  function updateOptionSelectionState(answerHost) {
    Array.from(answerHost.querySelectorAll(".option-item")).forEach(function (item) {
      const input = item.querySelector("input[type='radio'], input[type='checkbox']");
      item.classList.toggle("is-selected", Boolean(input && input.checked));
    });
  }

  function syncDraftAnswer(question, host) {
    setDraftAnswer(question.id, collectUserAnswer(question, host));
  }

  function collectUserAnswer(question, host) {
    if (question.type === "单选题" || question.type === "判断题") {
      const checked = host.querySelector("input[type='radio']:checked");
      return checked ? checked.value : "";
    }
    if (question.type === "多选题") {
      return Array.from(host.querySelectorAll("input[type='checkbox']:checked")).map(function (input) { return input.value; });
    }
    if (question.type === "填空题") {
      return Array.from(host.querySelectorAll("input[data-blank-index]")).map(function (input) { return input.value; });
    }
    const textarea = host.querySelector("textarea");
    return textarea ? textarea.value : "";
  }

  function submitObjectiveQuestion(question, host) {
    const userAnswer = collectUserAnswer(question, host);
    const result = shared.core.judgeQuestion(question, userAnswer);
    const resultName = result.isCorrect ? "correct" : "wrong";
    shared.recordQuestionResult(state, question, resultName, userAnswer, currentSession);
    currentSession.answered[question.id] = {
      result: resultName,
      userAnswer: Array.isArray(userAnswer) ? userAnswer.slice() : userAnswer,
      judgedAt: new Date().toISOString(),
    };
    shared.persistSession(state, currentSession);
    state = shared.loadState();
    setDraftAnswer(question.id, userAnswer);
    renderQuestionPanel();
    scheduleStatsRefresh();
  }

  function renderShortAnswerResult(question) {
    const wrapper = shared.createElement("div", "control-stack");
    wrapper.appendChild(shared.createElement("div", "question-material", `参考答案：${question.answerRaw || "无"}`));
    const actionRow = shared.createElement("div", "answer-actions");
    actionRow.appendChild(createActionButton("secondary-button", "标记已掌握", "mark-short-mastered"));
    actionRow.appendChild(createActionButton("danger-button", "标记未掌握", "mark-short-wrong"));
    wrapper.appendChild(actionRow);
    return wrapper;
  }

  function recordShortAnswer(question, userAnswer, resultName) {
    shared.recordQuestionResult(state, question, resultName, userAnswer, currentSession);
    currentSession.answered[question.id] = {
      result: resultName,
      userAnswer: userAnswer,
      judgedAt: new Date().toISOString(),
    };
    shared.persistSession(state, currentSession);
    state = shared.loadState();
    revealedShortAnswerQuestionId = "";
    setDraftAnswer(question.id, userAnswer);
    renderQuestionPanel();
    scheduleStatsRefresh();
  }

  function renderResultSection(question, answerState) {
    const wrapper = shared.createElement("div", "control-stack");
    const resultClass = answerState.result === "correct" || answerState.result === "mastered" ? "result-good" : "result-bad";
    const resultText = answerState.result === "mastered" ? "已标记为掌握" : answerState.result === "correct" ? "回答正确" : "回答错误";
    wrapper.appendChild(shared.createElement("div", `result-banner ${resultClass}`, resultText));
    wrapper.appendChild(shared.createElement("div", "answer-detail", `标准答案：${shared.describeAnswer(question)}`));
    if (question.explanation) {
      wrapper.appendChild(shared.createElement("div", "answer-detail", `答案解析：${question.explanation}`));
    }
    wrapper.appendChild(shared.createElement("div", "answer-detail", `最近作答时间：${shared.formatDateTime(answerState.judgedAt || answerState.lastAnsweredAt)}`));
    if (question.type !== "简答题" && state.wrongBook[question.id]) {
      const actions = shared.createElement("div", "answer-actions");
      actions.appendChild(createActionButton("ghost-button", "标记掌握并移出错题本", "remove-wrong-entry"));
      wrapper.appendChild(actions);
    }
    return wrapper;
  }

  function renderStats() {
    const stats = shared.core.computeStats(scopedBank, state, new Date().toISOString().slice(0, 10));
    shared.renderStatsGrid(dom.statsGrid, stats);
    shared.renderTrendChart(dom.trendPanel, stats);
    shared.renderChapterMastery(dom.masteryPanel, stats);
  }

  function renderQuestionPanel() {
    const panel = dom.questionPanel;
    shared.clearElement(panel);
    if (!currentSession || !currentSession.questionIds.length) {
      delete panel.dataset.questionId;
      panel.appendChild(shared.createEmptyCard("选择刷题模式后，这里会显示当前题目。"));
      return;
    }

    const question = getCurrentQuestion();
    if (!question) {
      delete panel.dataset.questionId;
      panel.appendChild(shared.createEmptyCard("当前题目不存在，请重新开始本轮练习。"));
      return;
    }

    const questionState = state.questionStates[question.id];
    const sessionAnswer = currentSession.answered[question.id];
    const restoredAnswer = sessionAnswer ? sessionAnswer.userAnswer : getDraftAnswer(question.id);

        panel.dataset.questionId = question.id;
    const scrollArea = shared.createElement("div", "question-content-scroll");
    scrollArea.appendChild(shared.createQuestionMeta(question));
    scrollArea.appendChild(shared.createTagChips(question.tags));
    scrollArea.appendChild(shared.createElement("div", "question-stem", question.stem));
    if (question.material) {
      scrollArea.appendChild(shared.createElement("div", "question-material", question.material));
    }
    const answerHost = shared.createElement("div", "control-stack answer-host");
    answerHost.dataset.questionId = question.id;
    buildAnswerInputs(question, answerHost, restoredAnswer);
    scrollArea.appendChild(answerHost);
    if (question.type === "简答题" && revealedShortAnswerQuestionId === question.id) {
      scrollArea.appendChild(renderShortAnswerResult(question));
    }
    if (sessionAnswer || questionState) {
      scrollArea.appendChild(renderResultSection(question, sessionAnswer || questionState));
    }
    panel.appendChild(scrollArea);
    const bottomBar = shared.createElement("div", "question-bottom-bar");
    const actionRow = shared.createElement("div", "bottom-action-row");
    if (question.type !== "简答题") {
      actionRow.appendChild(createActionButton("primary-button", "提交答案", "submit-answer"));
    } else {
      actionRow.appendChild(createActionButton("secondary-button", "显示参考答案", "reveal-short-answer"));
    }
    actionRow.appendChild(
      createActionButton(
        shared.isFavorite(state, question.id) ? "secondary-button" : "ghost-button",
        (shared.isFavorite(state, question.id) ? "★ " : "☆ ") + (shared.isFavorite(state, question.id) ? "取消收藏" : "收藏本题"),
        "toggle-favorite"
      )
    );
    if (state.wrongBook[question.id]) {
      actionRow.appendChild(
        createActionButton(
          "secondary-button remove-wrongbook-button",
          "✓ 标记掌握并移出",
          "remove-wrong-entry"
        )
      );
    }
    bottomBar.appendChild(actionRow);
    bottomBar.appendChild(buildSessionSummaryCard());
    panel.appendChild(bottomBar);
  }

  function renderShortAnswerResultfunction renderShortAnswerResult(question) {
    const wrapper = shared.createElement("div", "control-stack");
    wrapper.appendChild(shared.createRevealableAnswerBlock("参考答案", question.answerRaw || "暂无"));
    const actionRow = shared.createElement("div", "answer-actions");
    actionRow.appendChild(createActionButton("secondary-button", "标记已掌握", "mark-short-mastered"));
    actionRow.appendChild(createActionButton("danger-button", "标记未掌握", "mark-short-wrong"));
    wrapper.appendChild(actionRow);
    return wrapper;
  }

  function renderResultSection(question, answerState) {
    const wrapper = shared.createElement("div", "control-stack");
    const resultClass = answerState.result === "correct" || answerState.result === "mastered" ? "result-good" : "result-bad";
    const resultText = answerState.result === "mastered" ? "已标记为掌握" : answerState.result === "correct" ? "回答正确" : "回答错误";
    wrapper.appendChild(shared.createElement("div", `result-banner ${resultClass}`, resultText));
    wrapper.appendChild(shared.createRevealableAnswerBlock("标准答案", shared.describeAnswer(question)));
    if (question.explanation) {
      wrapper.appendChild(shared.createElement("div", "answer-detail", `答案解析：${question.explanation}`));
    }
    wrapper.appendChild(
      shared.createElement(
        "div",
        "answer-detail",
        `最近作答时间：${shared.formatDateTime(answerState.judgedAt || answerState.lastAnsweredAt)}`
      )
    );
    return wrapper;
  }

  function startSession(config) {
    const pool = getSessionPool(config);
    const questionIds = buildQuestionIds(pool, config);
    if (!questionIds.length) {
      window.alert("当前筛选下没有可练习的题目。");
      return;
    }
    currentSession = {
      mode: config.mode,
      label: config.label,
      questionIds: questionIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
      scopeChapterKey: pageConfig.chapterKey || config.chapterKey || "",
    };
    draftAnswers = {};
    revealedShortAnswerQuestionId = "";
    shared.persistSession(state, currentSession);
    renderAll();
  }

  function pageTitlePrefix() {
    return pageConfig.pageType === "chapter" ? `${pageConfig.chapterTitle} · ` : "";
  }

  let practiceOverviewDrawerOpen = false;

  function getPracticeOverviewStorageKey() {
    return `maogai-practice-overview:${pageConfig.pageType}:${pageConfig.chapterKey || "all"}`;
  }

  function loadPracticeOverviewDrawerState() {
    try {
      return window.sessionStorage.getItem(getPracticeOverviewStorageKey()) === "open";
    } catch (error) {
      return false;
    }
  }

  function persistPracticeOverviewDrawerState() {
    try {
      window.sessionStorage.setItem(
        getPracticeOverviewStorageKey(),
        practiceOverviewDrawerOpen ? "open" : "closed"
      );
    } catch (error) {
      // Ignore storage failures and keep the current in-memory state.
    }
  }

  function cachePracticeOverviewDom() {
    dom.overviewShell = document.getElementById("question-overview-shell");
    dom.overviewToggle = document.getElementById("overview-mobile-toggle");
    dom.overviewPanel = document.getElementById("question-overview-panel");
  }

  function ensurePracticeOverviewShell() {
    const layout = document.querySelector(".page-shell .layout-two, .page-shell .layout-three");
    if (!layout) {
      return;
    }

    layout.classList.remove("layout-two");
    layout.classList.add("layout-three");

    if (!document.getElementById("question-overview-shell")) {
      const shell = shared.createElement("aside", "question-overview-shell");
      shell.id = "question-overview-shell";
      const toggle = shared.createElement("button", "overview-mobile-toggle", "题目概览");
      toggle.type = "button";
      toggle.id = "overview-mobile-toggle";
      toggle.addEventListener("click", togglePracticeOverviewDrawer);
      const panel = shared.createElement("section", "question-overview-panel");
      panel.id = "question-overview-panel";
      shell.appendChild(toggle);
      shell.appendChild(panel);
      layout.appendChild(shell);
    }

    cachePracticeOverviewDom();
    practiceOverviewDrawerOpen = loadPracticeOverviewDrawerState();
    syncPracticeOverviewShell();
  }

  function syncPracticeOverviewShell() {
    if (!dom.overviewShell) {
      return;
    }
    dom.overviewShell.classList.toggle("is-open", practiceOverviewDrawerOpen);
    if (dom.overviewToggle) {
      dom.overviewToggle.textContent = practiceOverviewDrawerOpen ? "收起题目概览" : "题目概览";
    }
  }

  function togglePracticeOverviewDrawer() {
    practiceOverviewDrawerOpen = !practiceOverviewDrawerOpen;
    persistPracticeOverviewDrawerState();
    syncPracticeOverviewShell();
  }

  function getPracticeOverviewStatus(questionId, index) {
    if (!currentSession) {
      return "unanswered";
    }
    if (index === currentSession.currentIndex) {
      return "current";
    }
    if (
      currentSession.answered[questionId] ||
      shared.hasMeaningfulOverviewAnswer(getDraftAnswer(questionId))
    ) {
      return "answered";
    }
    return "unanswered";
  }

  function jumpToOverviewQuestion(index) {
    if (!currentSession || !currentSession.questionIds.length) {
      return;
    }
    currentSession.currentIndex = Math.max(
      0,
      Math.min(currentSession.questionIds.length - 1, index)
    );
    revealedShortAnswerQuestionId = "";
    shared.persistSession(state, currentSession);
    renderQuestionPanel();
    renderStudyActions();
    if (window.innerWidth <= 820) {
      practiceOverviewDrawerOpen = false;
      persistPracticeOverviewDrawerState();
      syncPracticeOverviewShell();
      dom.questionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderOverviewPanel() {
    if (!dom.overviewPanel) {
      return;
    }

    const legend = [
      { label: "当前题目", status: "current" },
      { label: "已作答", status: "answered" },
      { label: "未作答", status: "unanswered" },
    ];

    if (!currentSession || !currentSession.questionIds.length) {
      shared.renderOverviewPanel({
        panel: dom.overviewPanel,
        title: "题目概览",
        caption: "开始任意刷题模式后，这里会按题型展示当前题集题号。",
        legend: legend,
        groups: [],
        emptyMessage: "当前还没有活跃题集。",
      });
      syncPracticeOverviewShell();
      return;
    }

    shared.renderOverviewPanel({
      panel: dom.overviewPanel,
      title: "题目概览",
      caption: `${currentSession.label} · 共 ${currentSession.questionIds.length} 题`,
      legend: legend,
      groups: shared.buildOverviewGroups(currentSession.questionIds, questionMap),
      getStatus: function (item) {
        return getPracticeOverviewStatus(item.questionId, item.index);
      },
      onJump: function (item) {
        jumpToOverviewQuestion(item.index);
      },
    });

    syncPracticeOverviewShell();
  }

  const basePracticeInit = init;
  init = function initWithOverview() {
    basePracticeInit();
    ensurePracticeOverviewShell();
    renderOverviewPanel();
  };

  const basePracticeRenderQuestionPanel = renderQuestionPanel;
  renderQuestionPanel = function renderQuestionPanelWithOverview() {
    basePracticeRenderQuestionPanel();
    renderOverviewPanel();
  };

  function activatePracticeOverviewEnhancements() {
    ensurePracticeOverviewShell();
    renderOverviewPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", activatePracticeOverviewEnhancements);
  } else {
    window.setTimeout(activatePracticeOverviewEnhancements, 0);
  }
})();
