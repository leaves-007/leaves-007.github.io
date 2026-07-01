(function () {
  const shared = window.QuestionBankAppShared;
  if (!shared) {
    throw new Error("QuestionBankAppShared is required");
  }

  let state = shared.loadState();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    state = shared.loadState();
    renderPage();
  }

  function renderPage() {
    const root = document.getElementById("app");
    const examStore = shared.getMockExamPracticeStore(state);
    const hasResume = Boolean(examStore.lastSession);
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row" id="exam-nav"></div>
          <h1 class="hero-title">毛概模拟考试</h1>
          <p class="hero-subtitle">模拟考试使用独立缓存，不会继承主界面的做题记录。</p>
          <div class="hero-meta">
            <span class="chip">单选60</span>
            <span class="chip">多选10</span>
            <span class="chip">判断20</span>
            <span class="chip">填空20</span>
          </div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">考试入口</h2>
              <div class="section-actions" id="exam-actions"></div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="panel fade-in" id="exam-status-panel">
              <h2 class="section-title">当前说明</h2>
              <div class="section-caption">固定组卷：单选60 / 多选10 / 判断20 / 填空20。分析题不出。</div>
            </section>
          </main>
        </div>
      </div>
    `;

    renderNav();
    renderActions(hasResume);
    renderStatus(hasResume);
  }

  function renderNav() {
    const nav = document.getElementById("exam-nav");
    shared.clearElement(nav);
    [
      { label: "练习区首页", href: "index.html" },
      { label: "模拟考试", href: "exam.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      nav.appendChild(link);
    });
  }

  function renderActions(hasResume) {
    const actions = document.getElementById("exam-actions");
    shared.clearElement(actions);

    const startButton = shared.createElement("button", "primary-button", "开始模拟考试");
    startButton.type = "button";
    startButton.addEventListener("click", function () {
      if (typeof shared.buildMockExamPracticeSession !== "function") {
        window.alert("模拟考试入口正在更新，请稍后刷新页面重试。");
        return;
      }
      const payload = shared.buildMockExamPracticeSession(state, {});
      if (!payload || !payload.ok || !payload.session) {
        window.alert((payload && payload.message) || "当前题库无法按模拟考试规则生成完整试卷。");
        return;
      }
      shared.setMockExamPracticePendingSession(state, payload.session);
      window.location.replace("index.html");
    });
    actions.appendChild(startButton);

    if (hasResume) {
      const resumeButton = shared.createElement("button", "secondary-button", "继续上次模拟考试");
      resumeButton.type = "button";
      resumeButton.addEventListener("click", function () {
        state = shared.loadState();
        const resumeSession = shared.getMockExamPracticeStore(state).lastSession;
        if (!resumeSession) {
          renderPage();
          return;
        }
        shared.setMockExamPracticePendingSession(state, resumeSession);
        window.location.replace("index.html");
      });
      actions.appendChild(resumeButton);

      const regenerateButton = shared.createElement("button", "ghost-button", "重新生成试卷");
      regenerateButton.type = "button";
      regenerateButton.addEventListener("click", function () {
        const payload = shared.buildMockExamPracticeSession(state, {});
        if (!payload || !payload.ok || !payload.session) {
          window.alert((payload && payload.message) || "当前题库无法按模拟考试规则生成完整试卷。");
          return;
        }
        shared.setMockExamPracticePendingSession(state, payload.session);
        window.location.replace("index.html");
      });
      actions.appendChild(regenerateButton);
    }
  }

  function renderStatus(hasResume) {
    const panel = document.getElementById("exam-status-panel");
    if (!panel) {
      return;
    }
    if (hasResume) {
      panel.innerHTML = `
        <h2 class="section-title">当前说明</h2>
        <div class="section-caption">检测到一份未完成的本地模拟考试。你可以继续上次模拟考试，也可以重新生成试卷。</div>
      `;
      return;
    }
    panel.innerHTML = `
      <h2 class="section-title">当前说明</h2>
      <div class="section-caption">当前还没有本地模拟考试记录。点击开始模拟考试后，会带着独立缓存进入统一做题界面。</div>
    `;
  }
})();
