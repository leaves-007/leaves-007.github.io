(function () {
  const shared = window.QuestionBankAppShared;
  if (!shared) {
    throw new Error("QuestionBankAppShared is required");
  }

  const bank = shared.getBank();
  const questionMap = shared.getQuestionMap();
  let state = shared.loadState();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row">
            <a href="index.html">返回总入口</a>
          </div>
          <h1 class="hero-title">错题本</h1>
          <p class="hero-subtitle">集中查看所有错题，支持按章节和题型筛选，并将当前筛选结果一键送回主刷题页重新练习。</p>
          <div class="hero-meta">
            <span class="chip" id="wrong-count-chip"></span>
          </div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">筛选条件</h2>
              <div class="control-stack">
                <label>章节<select id="chapter-filter"></select></label>
                <label>题型<select id="type-filter"></select></label>
              </div>
              <div class="section-actions" style="margin-top: 14px;">
                <button class="secondary-button" id="practice-filtered">练习当前筛选错题</button>
                <button class="ghost-button" id="remove-mastered">移除当前筛选下已掌握</button>
              </div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="list-card fade-in">
              <h2 class="section-title">错题列表</h2>
              <div id="wrong-list"></div>
            </section>
          </main>
        </div>
      </div>
    `;

    bindFilters();
    const nav = root.querySelector(".nav-row");
    if (nav) {
      shared.clearElement(nav);
      [
        { label: "总入口", href: "index.html" },
      ].forEach(function (item) {
        const link = shared.createElement("a", "", item.label);
        link.href = item.href;
        nav.appendChild(link);
      });
    }
    render();
  }

  function bindFilters() {
    const chapterFilter = document.getElementById("chapter-filter");
    const typeFilter = document.getElementById("type-filter");

    appendOption(chapterFilter, "", "全部章节");
    bank.chapters.forEach(function (chapter) {
      appendOption(chapterFilter, chapter.key, chapter.title);
    });

    appendOption(typeFilter, "", "全部题型");
    bank.questionTypes.forEach(function (questionType) {
      appendOption(typeFilter, questionType, questionType);
    });

    chapterFilter.addEventListener("change", render);
    typeFilter.addEventListener("change", render);

    document.getElementById("practice-filtered").addEventListener("click", function () {
      const filteredIds = getFilteredWrongQuestions().map(function (question) { return question.id; });
      if (!filteredIds.length) {
        window.alert("当前筛选下没有错题。");
        return;
      }
      state = shared.loadState();
      shared.setPendingSession(state, {
        mode: "custom",
        label: "错题本 · 当前筛选重练",
        questionIds: filteredIds,
        currentIndex: 0,
        answered: {},
        createdAt: new Date().toISOString(),
      });
      window.location.href = "index.html";
    });

    document.getElementById("remove-mastered").addEventListener("click", function () {
      const filtered = getFilteredWrongQuestions();
      filtered.forEach(function (question) {
        const questionState = state.questionStates[question.id];
        if (questionState && (questionState.lastResult === "correct" || questionState.lastResult === "mastered")) {
          shared.removeWrongBookEntry(state, question.id);
        }
      });
      state = shared.loadState();
      render();
    });
  }

  function appendOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function getFilteredWrongQuestions() {
    state = shared.loadState();
    const chapterKey = document.getElementById("chapter-filter").value;
    const questionType = document.getElementById("type-filter").value;
    return shared
      .getWrongIds(state)
      .map(function (questionId) { return questionMap[questionId]; })
      .filter(Boolean)
      .filter(function (question) {
        if (chapterKey && question.chapterKey !== chapterKey) {
          return false;
        }
        if (questionType && question.type !== questionType) {
          return false;
        }
        return true;
      })
      .sort(function (left, right) { return left.sequence - right.sequence; });
  }

  function render() {
    const list = document.getElementById("wrong-list");
    const chip = document.getElementById("wrong-count-chip");
    const questions = getFilteredWrongQuestions();
    chip.textContent = `当前错题数：${questions.length}`;
    shared.clearElement(list);

    if (!questions.length) {
      list.appendChild(shared.createEmptyCard("当前筛选下没有错题。"));
      return;
    }

    const questionList = shared.createElement("div", "question-list");
    questions.forEach(function (question) {
      const item = shared.createElement("div", "question-list-item fade-in");
      item.appendChild(shared.createElement("h3", "", shared.getQuestionSummary(question)));
      item.appendChild(shared.createElement("div", "muted", `${question.chapterTitle} · ${question.type}`));
      item.appendChild(shared.createElement("div", "muted", `标准答案：${shared.describeAnswer(question)}`));
      if (question.explanation) {
        item.appendChild(shared.createElement("div", "muted", `答案解析：${question.explanation}`));
      }
      const questionState = state.questionStates[question.id];
      if (questionState) {
        item.appendChild(shared.createElement("div", "muted", `最近结果：${questionState.lastResult || "未作答"} · ${shared.formatDateTime(questionState.lastAnsweredAt)}`));
      }
      const actions = shared.createElement("div", "section-actions");
      const practiceButton = shared.createElement("button", "secondary-button", "只练这题");
      practiceButton.addEventListener("click", function () {
        state = shared.loadState();
        shared.setPendingSession(state, {
          mode: "custom",
          label: `错题本 · 单题重练`,
          questionIds: [question.id],
          currentIndex: 0,
          answered: {},
          createdAt: new Date().toISOString(),
          scopeChapterKey: "",
        });
        window.location.href = "index.html";
      });
      const removeButton = shared.createElement("button", "ghost-button", "标记掌握并移出");
      removeButton.addEventListener("click", function () {
        shared.markQuestionMastered(state, question.id);
        state = shared.loadState();
        render();
      });
      actions.appendChild(practiceButton);
      actions.appendChild(removeButton);
      item.appendChild(actions);
      questionList.appendChild(item);
    });
    list.appendChild(questionList);
  }
  document.addEventListener("DOMContentLoaded", function () {
    const nav = document.querySelector(".nav-row");
    if (!nav) {
      return;
    }
    shared.clearElement(nav);
    [
      { label: "练习区首页", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      nav.appendChild(link);
    });
  });
  const dom = {};

  function init() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row" id="wrongbook-nav"></div>
          <h1 class="hero-title">错题本</h1>
          <p class="hero-subtitle">集中查看全部错题，按章节和题型筛选，并把当前筛选结果一键送回练习区继续判分练习。</p>
          <div class="hero-meta">
            <span class="chip" id="wrong-count-chip"></span>
          </div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">筛选条件</h2>
              <div class="control-stack">
                <label>章节<select id="chapter-filter"></select></label>
                <label>题型<select id="type-filter"></select></label>
              </div>
            </section>
            <section class="panel fade-in wrongbook-actions-shell">
              <div class="chapter-head">
                <div>
                  <h2 class="section-title">快捷操作</h2>
                  <div class="section-caption">移动端常用的练习、清空和返回操作集中在这里。</div>
                </div>
              </div>
              <div class="wrongbook-actions" id="wrongbook-actions"></div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="list-card fade-in">
              <h2 class="section-title">错题列表</h2>
              <div id="wrong-list"></div>
            </section>
          </main>
        </div>
      </div>
    `;

    cacheDom();
    renderNav();
    buildFilters();
    attachDelegates();
    renderWrongbookActions();
    render();
  }

  function cacheDom() {
    dom.nav = document.getElementById("wrongbook-nav");
    dom.chapterFilter = document.getElementById("chapter-filter");
    dom.typeFilter = document.getElementById("type-filter");
    dom.wrongCountChip = document.getElementById("wrong-count-chip");
    dom.wrongList = document.getElementById("wrong-list");
    dom.actions = document.getElementById("wrongbook-actions");
  }

  function renderNav() {
    shared.clearElement(dom.nav);
    [
      { label: "练习区首页", href: "index.html" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      dom.nav.appendChild(link);
    });
  }

  function buildFilters() {
    appendOption(dom.chapterFilter, "", "全部章节");
    bank.chapters.forEach(function (chapter) {
      appendOption(dom.chapterFilter, chapter.key, chapter.title);
    });

    appendOption(dom.typeFilter, "", "全部题型");
    bank.questionTypes.forEach(function (questionType) {
      appendOption(dom.typeFilter, questionType, questionType);
    });

    dom.chapterFilter.addEventListener("change", render);
    dom.typeFilter.addEventListener("change", render);
  }

  function attachDelegates() {
    if (dom.actions.dataset.delegatesAttached === "true") {
      return;
    }
    dom.actions.dataset.delegatesAttached = "true";
    dom.actions.addEventListener("click", handleActionClick);
    dom.wrongList.addEventListener("click", handleListClick);
  }

  function handleActionClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    if (action === "wrongbook-practice") {
      practiceFilteredWrongQuestions();
      return;
    }
    if (action === "wrongbook-back") {
      window.location.href = "index.html";
      return;
    }
    if (action === "wrongbook-clear") {
      clearWrongBook();
      return;
    }
    if (action === "wrongbook-reset") {
      dom.chapterFilter.value = "";
      dom.typeFilter.value = "";
      render();
    }
  }

  function handleListClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }
    const questionId = target.dataset.questionId;
    if (!questionId) {
      return;
    }
    if (target.dataset.action === "practice-one") {
      state = shared.loadState();
      shared.setPendingSession(state, {
        mode: "custom",
        label: "错题本 · 单题判分练习",
        questionIds: [questionId],
        currentIndex: 0,
        answered: {},
        createdAt: new Date().toISOString(),
        scopeChapterKey: "",
      });
      window.location.href = "index.html";
      return;
    }
    if (target.dataset.action === "remove-one") {
      shared.markQuestionMastered(state, questionId);
      state = shared.loadState();
      renderWrongbookActions();
      render();
    }
  }

  function practiceFilteredWrongQuestions() {
    const filteredIds = getFilteredWrongQuestions().map(function (question) { return question.id; });
    if (!filteredIds.length) {
      window.alert("当前筛选下没有可练习的错题。");
      return;
    }
    state = shared.loadState();
    shared.setPendingSession(state, {
      mode: "custom",
      label: "错题本 · 当前筛选判分练习",
      questionIds: filteredIds,
      currentIndex: 0,
      answered: {},
      createdAt: new Date().toISOString(),
    });
    window.location.href = "index.html";
  }

  function clearWrongBook() {
    if (!window.confirm("确认清空错题本吗？这不会修改判分规则和题目数据，只会移除错题本条目。")) {
      return;
    }
    state.wrongBook = {};
    shared.saveState(state);
    state = shared.loadState();
    renderWrongbookActions();
    render();
  }

  function renderWrongbookActions() {
    shared.clearElement(dom.actions);
    const wrongCount = shared.getWrongIds(state).length;
    [
      { label: "判分练习", className: "primary-button", action: "wrongbook-practice", disabled: wrongCount === 0 },
      { label: "返回总题页", className: "secondary-button", action: "wrongbook-back", disabled: false },
      { label: "清空错题本", className: "danger-button", action: "wrongbook-clear", disabled: wrongCount === 0 },
      { label: "重置本页", className: "ghost-button", action: "wrongbook-reset", disabled: false },
    ].forEach(function (config) {
      const button = shared.createElement("button", config.className, config.label);
      button.type = "button";
      button.dataset.action = config.action;
      button.disabled = Boolean(config.disabled);
      dom.actions.appendChild(button);
    });
  }

  function getFilteredWrongQuestions() {
    state = shared.loadState();
    const chapterKey = dom.chapterFilter.value;
    const questionType = dom.typeFilter.value;
    return shared
      .getWrongIds(state)
      .map(function (questionId) { return questionMap[questionId]; })
      .filter(Boolean)
      .filter(function (question) {
        if (chapterKey && question.chapterKey !== chapterKey) {
          return false;
        }
        if (questionType && question.type !== questionType) {
          return false;
        }
        return true;
      })
      .sort(function (left, right) { return left.sequence - right.sequence; });
  }

  function render() {
    const questions = getFilteredWrongQuestions();
    dom.wrongCountChip.textContent = `当前错题数：${questions.length}`;
    shared.clearElement(dom.wrongList);

    if (!questions.length) {
      dom.wrongList.appendChild(shared.createEmptyCard("当前筛选下没有错题。"));
      return;
    }

    const questionList = shared.createElement("div", "question-list");
    questions.forEach(function (question) {
      const item = shared.createElement("div", "question-list-item fade-in");
      item.appendChild(shared.createElement("h3", "", shared.getQuestionSummary(question)));
      item.appendChild(shared.createElement("div", "muted", `${question.chapterTitle} · ${question.type}`));
      item.appendChild(shared.createElement("div", "muted", `标准答案：${shared.describeAnswer(question)}`));
      if (question.explanation) {
        item.appendChild(shared.createElement("div", "muted", `答案解析：${question.explanation}`));
      }
      const questionState = state.questionStates[question.id];
      if (questionState) {
        item.appendChild(shared.createElement("div", "muted", `最近结果：${questionState.lastResult || "未作答"} · ${shared.formatDateTime(questionState.lastAnsweredAt)}`));
      }
      const actions = shared.createElement("div", "section-actions");
      const practiceButton = shared.createElement("button", "secondary-button", "只练这题");
      practiceButton.type = "button";
      practiceButton.dataset.action = "practice-one";
      practiceButton.dataset.questionId = question.id;
      const removeButton = shared.createElement("button", "ghost-button", "标记掌握并移出");
      removeButton.type = "button";
      removeButton.dataset.action = "remove-one";
      removeButton.dataset.questionId = question.id;
      actions.appendChild(practiceButton);
      actions.appendChild(removeButton);
      item.appendChild(actions);
      questionList.appendChild(item);
    });
    dom.wrongList.appendChild(questionList);
  }
})();

