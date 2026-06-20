(function () {
  const shared = window.QuestionBankAppShared;
  if (!shared) {
    throw new Error("QuestionBankAppShared is required");
  }

  let state = shared.loadState();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    state = shared.loadState();
    rememberReturnSessionIfNeeded();

    const session = shared.buildWrongbookPracticeSession(state, {
      label: "错题本 · 直接刷题",
    });

    if (session) {
      shared.setPendingSession(state, session);
      window.location.replace("index.html");
      return;
    }

    renderEmptyState();
  }

  function rememberReturnSessionIfNeeded() {
    const currentSession = state.lastSession;
    if (!currentSession || shared.isWrongbookSession(currentSession) || shared.getWrongbookReturnSession(state)) {
      return;
    }
    shared.rememberWrongbookReturnSession(state, currentSession);
    state = shared.loadState();
  }

  function returnToPracticeHome() {
    state = shared.loadState();
    const returnSession = shared.getWrongbookReturnSession(state);
    if (returnSession) {
      shared.setPendingSession(state, returnSession);
    }
    window.location.href = "index.html";
  }

  function renderEmptyState() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <div class="page-shell">
        <section class="hero fade-in">
          <div class="nav-row" id="wrongbook-nav"></div>
          <h1 class="hero-title">错题本</h1>
          <p class="hero-subtitle">当前还没有错题。回到总入口继续刷题，答错的题会自动回到这里。</p>
          <div class="hero-meta">
            <span class="chip">当前错题数：0</span>
          </div>
        </section>
        <div class="layout-two">
          <aside class="control-stack">
            <section class="panel fade-in">
              <h2 class="section-title">接下来做什么</h2>
              <div class="section-caption">错题本现在会直接进入正常刷题流；只有当没有错题时，才会停留在这个提示页。</div>
              <div class="section-actions">
                <button class="primary-button" id="back-home">返回总入口</button>
                <a class="ghost-button" href="index.html">显示全部题目</a>
              </div>
            </section>
          </aside>
          <main class="control-stack">
            <section class="list-card fade-in">
              <h2 class="section-title">当前状态</h2>
              <div id="wrongbook-empty-state"></div>
            </section>
          </main>
        </div>
      </div>
    `;

    renderNav();

    const messageHost = document.getElementById("wrongbook-empty-state");
    messageHost.appendChild(
      shared.createEmptyCard("错题本为空，所以这里不再停留在单独的列表页。下次从“错题本”进入时，会直接开始错题刷题。")
    );

    document.getElementById("back-home").addEventListener("click", function () {
      returnToPracticeHome();
    });
  }

  function renderNav() {
    const nav = document.getElementById("wrongbook-nav");
    if (!nav) {
      return;
    }

    shared.clearElement(nav);
    [
      { label: "练习区首页", href: "index.html", action: "go-home" },
      { label: "错题本", href: "wrong_book.html" },
    ].forEach(function (item) {
      const link = shared.createElement("a", "", item.label);
      link.href = item.href;
      if (item.action) {
        link.dataset.action = item.action;
      }
      nav.appendChild(link);
    });

    nav.addEventListener("click", function (event) {
      const link = event.target.closest("a[data-action='go-home']");
      if (!link) {
        return;
      }
      event.preventDefault();
      returnToPracticeHome();
    });
  }
})();
