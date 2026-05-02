(function () {
  const ADMIN_KEY = "qixia-admin-mode";
  const ESSAYS_KEY = "qixia-essays-state";
  const STUDY_KEY = "qixia-study-state";
  const ADMIN_PASSWORD = "hyzhb";
  const ADMIN_CLICK_TARGET = 5;
  const ADMIN_CLICK_RESET_MS = 2600;

  const defaultEssayState = {
    leavesEntries: [
      {
        id: "leaves-entry-1",
        title: "开站后的第一条随笔",
        content:
          "这里之后会慢慢放自己的随笔、vibecoding 记录、临时吐槽和一些阶段性的想法。",
        createdAt: "2026.05.02 22:00",
        updatedAt: "2026.05.02 22:00",
      },
    ],
    anonymousPosts: [],
    messages: [],
    pending: [],
  };

  const defaultStudyState = {
    entries: [
      {
        id: "study-entry-1",
        title: "学习区使用说明",
        category: "公告",
        summary: "这里会逐步整理课程笔记、测验题、题库和一些学习经验。",
        content:
          "管理员模式下可以直接维护公开资料；普通用户提交的内容会先进入审核区，等管理员确认后再发布。",
        createdAt: "2026.05.02 22:00",
        updatedAt: "2026.05.02 22:00",
      },
    ],
    pending: [],
  };

  let adminClicks = 0;
  let adminTimer = null;
  let toastTimer = null;
  let adminMode = false;
  let appRefs = {
    essays: null,
    study: null,
  };

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);

  function init() {
    clearLegacyAdminState();
    adminMode = false;
    bindAdminAccess();
    syncAdminState();
    appRefs.essays = initEssaysApp();
    appRefs.study = initStudyApp();
  }

  function bindAdminAccess() {
    const trigger = document.querySelector("[data-admin-trigger]");
    const exitButton = document.querySelector("[data-admin-exit]");

    if (trigger) {
      trigger.addEventListener("click", () => {
        adminClicks += 1;
        window.clearTimeout(adminTimer);

        if (adminClicks < ADMIN_CLICK_TARGET) {
          showToast("再点 " + (ADMIN_CLICK_TARGET - adminClicks) + " 次进入管理员验证");
          adminTimer = window.setTimeout(resetAdminClicks, ADMIN_CLICK_RESET_MS);
          return;
        }

        resetAdminClicks();

        const password = window.prompt("输入管理员密码");
        if (password === null) {
          return;
        }

        if (password === ADMIN_PASSWORD) {
          adminMode = true;
          clearLegacyAdminState();
          syncAdminState();
          rerenderApps();
          showToast("管理员模式已开启");
          return;
        }

        showToast("密码不正确");
      });
    }

    if (exitButton) {
      exitButton.addEventListener("click", () => {
        adminMode = false;
        clearLegacyAdminState();
        syncAdminState();
        rerenderApps();
        showToast("管理员模式已退出");
      });
    }
  }

  function resetAdminClicks() {
    adminClicks = 0;
    window.clearTimeout(adminTimer);
    adminTimer = null;
  }

  function isAdminMode() {
    return adminMode;
  }

  function handlePageHide() {
    adminMode = false;
    clearLegacyAdminState();
    syncAdminState();
  }

  function handlePageShow(event) {
    clearLegacyAdminState();
    if (event && event.persisted) {
      adminMode = false;
    }
    syncAdminState();
    rerenderApps();
  }

  function clearLegacyAdminState() {
    try {
      sessionStorage.removeItem(ADMIN_KEY);
    } catch (error) {}

    try {
      localStorage.removeItem(ADMIN_KEY);
    } catch (error) {}
  }

  function syncAdminState() {
    const adminOn = isAdminMode();
    document.body.dataset.adminMode = adminOn ? "on" : "off";
    document.querySelectorAll("[data-admin-state]").forEach((node) => {
      node.hidden = !adminOn;
    });
    document.querySelectorAll("[data-role='admin-only']").forEach((node) => {
      node.hidden = !adminOn;
    });
  }

  function rerenderApps() {
    if (appRefs.essays && typeof appRefs.essays.render === "function") {
      appRefs.essays.render();
    }
    if (appRefs.study && typeof appRefs.study.render === "function") {
      appRefs.study.render();
    }
  }

  function initEssaysApp() {
    const root = document.querySelector("[data-app='essays']");
    if (!root) {
      return null;
    }

    const lists = {
      leaves: root.querySelector("[data-list='leavesEntries']"),
      posts: root.querySelector("[data-list='anonymousPosts']"),
      messages: root.querySelector("[data-list='messages']"),
      pending: root.querySelector("[data-list='essayPending']"),
      reviewCount: root.querySelector("[data-review-count]"),
    };

    root.addEventListener("click", (event) => {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) {
        return;
      }
      const action = actionNode.dataset.action;

      if (action === "open-leaves-editor") {
        openLeavesEditor();
        return;
      }
      if (action === "open-anon-post-form") {
        openAnonymousPostForm();
        return;
      }
      if (action === "open-message-form") {
        openMessageForm();
        return;
      }
      if (action === "view-essay-entry") {
        openEssayEntry(actionNode.dataset.collection, actionNode.dataset.id);
        return;
      }
      if (action === "edit-essay-entry") {
        openLeavesEditor(actionNode.dataset.id);
        return;
      }
      if (action === "delete-essay-entry") {
        deleteEssayEntry(actionNode.dataset.collection, actionNode.dataset.id);
        return;
      }
      if (action === "approve-essay-pending") {
        approveEssayPending(actionNode.dataset.id);
        return;
      }
      if (action === "delete-essay-pending") {
        deleteEssayPending(actionNode.dataset.id);
      }
    });

    function render() {
      const state = getEssayState();
      toggleAdminSections(root);
      renderEntryCards(lists.leaves, state.leavesEntries, {
        collection: "leavesEntries",
        emptyText: "这里还没有公开的随笔。",
      });
      renderEntryCards(lists.posts, state.anonymousPosts, {
        collection: "anonymousPosts",
        emptyText: "还没有通过审核的匿名投稿。",
      });
      renderEntryCards(lists.messages, state.messages, {
        collection: "messages",
        emptyText: "留言板现在还是空的。",
      });
      renderPendingEssayCards(lists.pending, state.pending);
      if (lists.reviewCount) {
        lists.reviewCount.textContent = state.pending.length + " 条待审";
      }
    }

    function openLeavesEditor(entryId) {
      if (!isAdminMode()) {
        openLockedModal("Leaves随笔区仅在管理员模式下可编辑。");
        return;
      }

      const state = getEssayState();
      const current =
        state.leavesEntries.find((entry) => entry.id === entryId) || null;

      openFormModal({
        title: current ? "编辑随笔" : "新建随笔",
        fields: [
          {
            name: "title",
            label: "标题",
            type: "text",
            required: true,
            value: current ? current.title : "",
            placeholder: "输入随笔标题",
          },
          {
            name: "content",
            label: "正文",
            type: "textarea",
            required: true,
            value: current ? current.content : "",
            placeholder: "写下这条随笔",
          },
        ],
        submitLabel: current ? "保存修改" : "发布随笔",
        onSubmit(values) {
          const nextState = getEssayState();
          const timestamp = timeStamp();

          if (current) {
            nextState.leavesEntries = nextState.leavesEntries.map((entry) =>
              entry.id === current.id
                ? {
                    ...entry,
                    title: values.title,
                    content: values.content,
                    updatedAt: timestamp,
                  }
                : entry
            );
          } else {
            nextState.leavesEntries.unshift({
              id: createId("leaves"),
              title: values.title,
              content: values.content,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }

          setEssayState(nextState);
          render();
          showToast(current ? "随笔已更新" : "随笔已发布");
        },
      });
    }

    function openAnonymousPostForm() {
      openFormModal({
        title: "匿名投稿",
        fields: [
          {
            name: "nickname",
            label: "署名",
            type: "text",
            value: "",
            placeholder: "可留空，默认显示为匿名",
          },
          {
            name: "title",
            label: "标题",
            type: "text",
            required: true,
            value: "",
            placeholder: "给这条投稿起个名字",
          },
          {
            name: "content",
            label: "内容",
            type: "textarea",
            required: true,
            value: "",
            placeholder: "写下你的投稿内容",
          },
        ],
        submitLabel: "发送到审核区",
        onSubmit(values) {
          const nextState = getEssayState();
          nextState.pending.unshift({
            id: createId("essay-pending"),
            kind: "post",
            nickname: values.nickname || "匿名",
            title: values.title,
            content: values.content,
            createdAt: timeStamp(),
          });
          setEssayState(nextState);
          render();
          showToast("投稿已送入审核区");
        },
      });
    }

    function openMessageForm() {
      openFormModal({
        title: "匿名留言",
        fields: [
          {
            name: "nickname",
            label: "署名",
            type: "text",
            value: "",
            placeholder: "可留空，默认显示为匿名",
          },
          {
            name: "content",
            label: "留言",
            type: "textarea",
            required: true,
            value: "",
            placeholder: "写下你想留下的话",
          },
        ],
        submitLabel: "发送到审核区",
        onSubmit(values) {
          const nextState = getEssayState();
          nextState.pending.unshift({
            id: createId("essay-pending"),
            kind: "message",
            nickname: values.nickname || "匿名",
            title: "匿名留言",
            content: values.content,
            createdAt: timeStamp(),
          });
          setEssayState(nextState);
          render();
          showToast("留言已送入审核区");
        },
      });
    }

    function openEssayEntry(collection, entryId) {
      const state = getEssayState();
      const entries =
        collection === "leavesEntries"
          ? state.leavesEntries
          : collection === "anonymousPosts"
          ? state.anonymousPosts
          : state.messages;
      const entry = entries.find((item) => item.id === entryId);

      if (!entry) {
        return;
      }

      const buttons = [];
      if (collection === "leavesEntries" && isAdminMode()) {
        buttons.push({
          label: "编辑",
          variant: "secondary",
          onClick() {
            closeModal();
            openLeavesEditor(entry.id);
          },
        });
      }
      if (isAdminMode()) {
        buttons.push({
          label: "删除",
          variant: "danger",
          onClick() {
            closeModal();
            deleteEssayEntry(collection, entry.id);
          },
        });
      }

      openInfoModal({
        title: entry.title || "查看内容",
        meta: (entry.nickname ? entry.nickname + " · " : "") + entry.updatedAt,
        paragraphs: [entry.content],
        buttons,
      });
    }

    function deleteEssayEntry(collection, entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能删除内容。");
        return;
      }

      openConfirmModal({
        title: "删除内容",
        body: "确定删除这条内容吗？",
        confirmLabel: "删除",
        confirmVariant: "danger",
        onConfirm() {
          const nextState = getEssayState();
          nextState[collection] = nextState[collection].filter(
            (entry) => entry.id !== entryId
          );
          setEssayState(nextState);
          render();
          showToast("内容已删除");
        },
      });
    }

    function approveEssayPending(entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能审核内容。");
        return;
      }

      const nextState = getEssayState();
      const pendingEntry = nextState.pending.find((entry) => entry.id === entryId);
      if (!pendingEntry) {
        return;
      }

      nextState.pending = nextState.pending.filter((entry) => entry.id !== entryId);

      if (pendingEntry.kind === "post") {
        nextState.anonymousPosts.unshift({
          id: createId("anonymous-post"),
          nickname: pendingEntry.nickname,
          title: pendingEntry.title,
          content: pendingEntry.content,
          createdAt: pendingEntry.createdAt,
          updatedAt: timeStamp(),
        });
      } else {
        nextState.messages.unshift({
          id: createId("message"),
          nickname: pendingEntry.nickname,
          title: pendingEntry.title,
          content: pendingEntry.content,
          createdAt: pendingEntry.createdAt,
          updatedAt: timeStamp(),
        });
      }

      setEssayState(nextState);
      render();
      showToast("内容已通过审核");
    }

    function deleteEssayPending(entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能删除待审内容。");
        return;
      }

      openConfirmModal({
        title: "删除待审内容",
        body: "确定直接删除这条待审内容吗？",
        confirmLabel: "删除",
        confirmVariant: "danger",
        onConfirm() {
          const nextState = getEssayState();
          nextState.pending = nextState.pending.filter((entry) => entry.id !== entryId);
          setEssayState(nextState);
          render();
          showToast("待审内容已删除");
        },
      });
    }

    render();
    return { render };
  }

  function initStudyApp() {
    const root = document.querySelector("[data-app='study']");
    if (!root) {
      return null;
    }

    const lists = {
      entries: root.querySelector("[data-list='studyEntries']"),
      pending: root.querySelector("[data-list='studyPending']"),
      reviewCount: root.querySelector("[data-study-review-count]"),
    };

    root.addEventListener("click", (event) => {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) {
        return;
      }
      const action = actionNode.dataset.action;

      if (action === "open-study-editor") {
        openStudyEditor();
        return;
      }
      if (action === "open-study-submission") {
        openStudySubmission();
        return;
      }
      if (action === "view-study-entry") {
        openStudyEntry(actionNode.dataset.collection, actionNode.dataset.id);
        return;
      }
      if (action === "edit-study-entry") {
        openStudyEditor(actionNode.dataset.id);
        return;
      }
      if (action === "delete-study-entry") {
        deleteStudyEntry(actionNode.dataset.collection, actionNode.dataset.id);
        return;
      }
      if (action === "approve-study-pending") {
        approveStudyPending(actionNode.dataset.id);
        return;
      }
      if (action === "delete-study-pending") {
        deleteStudyPending(actionNode.dataset.id);
      }
    });

    function render() {
      const state = getStudyState();
      toggleAdminSections(root);
      renderEntryCards(lists.entries, state.entries, {
        collection: "entries",
        emptyText: "学习区还没有公开资料。",
      });
      renderPendingStudyCards(lists.pending, state.pending);
      if (lists.reviewCount) {
        lists.reviewCount.textContent = state.pending.length + " 条待审";
      }
    }

    function openStudyEditor(entryId) {
      if (!isAdminMode()) {
        openLockedModal("学习区公开资料只能在管理员模式下编辑。");
        return;
      }

      const state = getStudyState();
      const current = state.entries.find((entry) => entry.id === entryId) || null;

      openFormModal({
        title: current ? "编辑学习资料" : "新增学习资料",
        fields: [
          {
            name: "title",
            label: "标题",
            type: "text",
            required: true,
            value: current ? current.title : "",
            placeholder: "例如：量子力学期中复习",
          },
          {
            name: "category",
            label: "分类",
            type: "text",
            required: true,
            value: current ? current.category : "",
            placeholder: "课程笔记 / 测验题 / 题库 / 经验",
          },
          {
            name: "summary",
            label: "摘要",
            type: "textarea",
            required: true,
            value: current ? current.summary : "",
            placeholder: "给资料写一个简短说明",
          },
          {
            name: "content",
            label: "正文",
            type: "textarea",
            required: true,
            value: current ? current.content : "",
            placeholder: "需要公开展示的正文内容",
          },
        ],
        submitLabel: current ? "保存修改" : "发布资料",
        onSubmit(values) {
          const nextState = getStudyState();
          const timestamp = timeStamp();

          if (current) {
            nextState.entries = nextState.entries.map((entry) =>
              entry.id === current.id
                ? {
                    ...entry,
                    title: values.title,
                    category: values.category,
                    summary: values.summary,
                    content: values.content,
                    updatedAt: timestamp,
                  }
                : entry
            );
          } else {
            nextState.entries.unshift({
              id: createId("study-entry"),
              title: values.title,
              category: values.category,
              summary: values.summary,
              content: values.content,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }

          setStudyState(nextState);
          render();
          showToast(current ? "学习资料已更新" : "学习资料已发布");
        },
      });
    }

    function openStudySubmission() {
      openFormModal({
        title: "提交学习资料",
        fields: [
          {
            name: "author",
            label: "署名",
            type: "text",
            value: "",
            placeholder: "可留空，默认显示为匿名投稿",
          },
          {
            name: "title",
            label: "标题",
            type: "text",
            required: true,
            value: "",
            placeholder: "输入投稿标题",
          },
          {
            name: "category",
            label: "分类",
            type: "text",
            required: true,
            value: "",
            placeholder: "课程笔记 / 测验题 / 题库 / 经验",
          },
          {
            name: "summary",
            label: "摘要",
            type: "textarea",
            required: true,
            value: "",
            placeholder: "简单概括一下这份内容",
          },
          {
            name: "content",
            label: "正文",
            type: "textarea",
            required: true,
            value: "",
            placeholder: "写下你想投稿的正文",
          },
        ],
        submitLabel: "发送到审核区",
        onSubmit(values) {
          const nextState = getStudyState();
          nextState.pending.unshift({
            id: createId("study-pending"),
            author: values.author || "匿名投稿",
            title: values.title,
            category: values.category,
            summary: values.summary,
            content: values.content,
            createdAt: timeStamp(),
          });
          setStudyState(nextState);
          render();
          showToast("学习资料已送入审核区");
        },
      });
    }

    function openStudyEntry(collection, entryId) {
      const state = getStudyState();
      const entries = collection === "entries" ? state.entries : state.pending;
      const entry = entries.find((item) => item.id === entryId);

      if (!entry) {
        return;
      }

      const buttons = [];
      if (collection === "entries" && isAdminMode()) {
        buttons.push({
          label: "编辑",
          variant: "secondary",
          onClick() {
            closeModal();
            openStudyEditor(entry.id);
          },
        });
      }
      if (isAdminMode()) {
        buttons.push({
          label: "删除",
          variant: "danger",
          onClick() {
            closeModal();
            deleteStudyEntry(collection, entry.id);
          },
        });
      }

      openInfoModal({
        title: entry.title,
        meta:
          (entry.category ? entry.category + " · " : "") +
          (entry.author ? entry.author + " · " : "") +
          entry.updatedAt,
        paragraphs: [entry.summary, entry.content],
        buttons,
      });
    }

    function deleteStudyEntry(collection, entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能删除学习区内容。");
        return;
      }

      openConfirmModal({
        title: "删除内容",
        body: "确定删除这条学习区内容吗？",
        confirmLabel: "删除",
        confirmVariant: "danger",
        onConfirm() {
          const nextState = getStudyState();
          nextState[collection] = nextState[collection].filter(
            (entry) => entry.id !== entryId
          );
          setStudyState(nextState);
          render();
          showToast("学习区内容已删除");
        },
      });
    }

    function approveStudyPending(entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能审核投稿。");
        return;
      }

      const nextState = getStudyState();
      const pendingEntry = nextState.pending.find((entry) => entry.id === entryId);
      if (!pendingEntry) {
        return;
      }

      nextState.pending = nextState.pending.filter((entry) => entry.id !== entryId);
      nextState.entries.unshift({
        id: createId("study-entry"),
        title: pendingEntry.title,
        category: pendingEntry.category,
        summary: pendingEntry.summary,
        content: pendingEntry.content,
        createdAt: pendingEntry.createdAt,
        updatedAt: timeStamp(),
      });

      setStudyState(nextState);
      render();
      showToast("投稿已通过审核");
    }

    function deleteStudyPending(entryId) {
      if (!isAdminMode()) {
        openLockedModal("只有管理员模式才能删除待审投稿。");
        return;
      }

      openConfirmModal({
        title: "删除待审投稿",
        body: "确定直接删除这条待审投稿吗？",
        confirmLabel: "删除",
        confirmVariant: "danger",
        onConfirm() {
          const nextState = getStudyState();
          nextState.pending = nextState.pending.filter((entry) => entry.id !== entryId);
          setStudyState(nextState);
          render();
          showToast("待审投稿已删除");
        },
      });
    }

    render();
    return { render };
  }

  function renderEntryCards(container, entries, options) {
    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!entries.length) {
      container.appendChild(createEmptyState(options.emptyText));
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "entry-card";

      const title = document.createElement("h3");
      title.className = "entry-title";
      title.textContent = entry.title;

      const meta = document.createElement("div");
      meta.className = "entry-meta";
      meta.textContent = buildMeta(entry);

      const preview = document.createElement("p");
      preview.className = "entry-preview";
      preview.textContent = shortText(entry.content);

      const actions = document.createElement("div");
      actions.className = "entry-actions";

      actions.appendChild(
        createActionButton("展开查看", "view-essay-entry", {
          collection: options.collection,
          id: entry.id,
        })
      );

      if (isAdminMode() && options.collection === "leavesEntries") {
        actions.appendChild(
          createActionButton("编辑", "edit-essay-entry", {
            id: entry.id,
          }, "secondary")
        );
      }

      if (isAdminMode() && options.collection !== "leavesEntries") {
        actions.appendChild(
          createActionButton("删除", "delete-essay-entry", {
            collection: options.collection,
            id: entry.id,
          }, "danger")
        );
      }

      if (options.collection === "entries") {
        actions.innerHTML = "";
        actions.appendChild(
          createActionButton("展开查看", "view-study-entry", {
            collection: "entries",
            id: entry.id,
          })
        );
        if (isAdminMode()) {
          actions.appendChild(
            createActionButton("编辑", "edit-study-entry", { id: entry.id }, "secondary")
          );
          actions.appendChild(
            createActionButton(
              "删除",
              "delete-study-entry",
              { collection: "entries", id: entry.id },
              "danger"
            )
          );
        }
      }

      card.append(title, meta, preview, actions);
      container.appendChild(card);
    });
  }

  function renderPendingEssayCards(container, entries) {
    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!entries.length) {
      container.appendChild(createEmptyState("匿名投稿和留言都已处理完毕。"));
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "entry-card pending-card";

      const title = document.createElement("h3");
      title.className = "entry-title";
      title.textContent =
        (entry.kind === "post" ? "匿名投稿" : "匿名留言") + " · " + entry.title;

      const meta = document.createElement("div");
      meta.className = "entry-meta";
      meta.textContent = entry.nickname + " · " + entry.createdAt;

      const preview = document.createElement("p");
      preview.className = "entry-preview";
      preview.textContent = shortText(entry.content);

      const actions = document.createElement("div");
      actions.className = "entry-actions";
      actions.appendChild(
        createActionButton("通过", "approve-essay-pending", { id: entry.id })
      );
      actions.appendChild(
        createActionButton("删除", "delete-essay-pending", { id: entry.id }, "danger")
      );

      card.append(title, meta, preview, actions);
      container.appendChild(card);
    });
  }

  function renderPendingStudyCards(container, entries) {
    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!entries.length) {
      container.appendChild(createEmptyState("学习区投稿已经处理完毕。"));
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "entry-card pending-card";

      const title = document.createElement("h3");
      title.className = "entry-title";
      title.textContent = entry.title;

      const meta = document.createElement("div");
      meta.className = "entry-meta";
      meta.textContent =
        entry.category + " · " + entry.author + " · " + entry.createdAt;

      const preview = document.createElement("p");
      preview.className = "entry-preview";
      preview.textContent = shortText(entry.summary + " " + entry.content);

      const actions = document.createElement("div");
      actions.className = "entry-actions";
      actions.appendChild(
        createActionButton("展开查看", "view-study-entry", {
          collection: "pending",
          id: entry.id,
        }, "secondary")
      );
      actions.appendChild(
        createActionButton("通过", "approve-study-pending", { id: entry.id })
      );
      actions.appendChild(
        createActionButton("删除", "delete-study-pending", { id: entry.id }, "danger")
      );

      card.append(title, meta, preview, actions);
      container.appendChild(card);
    });
  }

  function createActionButton(label, action, data, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-action-button";
    if (variant) {
      button.dataset.variant = variant;
    }
    button.dataset.action = action;
    Object.keys(data || {}).forEach((key) => {
      button.dataset[key] = data[key];
    });
    button.textContent = label;
    return button;
  }

  function createEmptyState(text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text;
    return empty;
  }

  function buildMeta(entry) {
    const parts = [];
    if (entry.category) {
      parts.push(entry.category);
    }
    if (entry.nickname) {
      parts.push(entry.nickname);
    }
    if (entry.createdAt) {
      parts.push(entry.createdAt);
    }
    return parts.join(" · ");
  }

  function shortText(text) {
    const normalized = (text || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= 88) {
      return normalized;
    }
    return normalized.slice(0, 88) + "…";
  }

  function toggleAdminSections(root) {
    root.querySelectorAll("[data-role='admin-only']").forEach((node) => {
      node.hidden = !isAdminMode();
    });
  }

  function getEssayState() {
    return normalizeEssayState(readState(ESSAYS_KEY, defaultEssayState));
  }

  function setEssayState(state) {
    writeState(ESSAYS_KEY, normalizeEssayState(state));
  }

  function getStudyState() {
    return normalizeStudyState(readState(STUDY_KEY, defaultStudyState));
  }

  function setStudyState(state) {
    writeState(STUDY_KEY, normalizeStudyState(state));
  }

  function normalizeEssayState(state) {
    return {
      leavesEntries: Array.isArray(state.leavesEntries) ? state.leavesEntries : [],
      anonymousPosts: Array.isArray(state.anonymousPosts)
        ? state.anonymousPosts
        : [],
      messages: Array.isArray(state.messages) ? state.messages : [],
      pending: Array.isArray(state.pending) ? state.pending : [],
    };
  }

  function normalizeStudyState(state) {
    return {
      entries: Array.isArray(state.entries) ? state.entries : [],
      pending: Array.isArray(state.pending) ? state.pending : [],
    };
  }

  function readState(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return clone(fallback);
      }
      return JSON.parse(raw);
    } catch (error) {
      return clone(fallback);
    }
  }

  function writeState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function timeStamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return year + "." + month + "." + day + " " + hours + ":" + minutes;
  }

  function showToast(message) {
    let toast = document.querySelector(".app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "app-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function closeModal() {
    const modal = document.querySelector(".app-modal");
    if (modal) {
      modal.remove();
    }
    document.body.classList.remove("modal-open");
  }

  function openLockedModal(message) {
    openInfoModal({
      title: "需要管理员模式",
      paragraphs: [message],
    });
  }

  function openInfoModal(config) {
    const shell = createModalShell(config.title, config.meta);
    const body = shell.body;

    (config.paragraphs || []).forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.className = "modal-text";
      paragraph.textContent = text;
      body.appendChild(paragraph);
    });

    const footer = createModalFooter(
      (config.buttons || []).concat([
        {
          label: "关闭",
          variant: "secondary",
          onClick: closeModal,
        },
      ])
    );

    shell.panel.appendChild(footer);
    mountModal(shell.overlay);
  }

  function openConfirmModal(config) {
    const shell = createModalShell(config.title);
    const paragraph = document.createElement("p");
    paragraph.className = "modal-text";
    paragraph.textContent = config.body;
    shell.body.appendChild(paragraph);

    const footer = createModalFooter([
      {
        label: "取消",
        variant: "secondary",
        onClick: closeModal,
      },
      {
        label: config.confirmLabel || "确认",
        variant: config.confirmVariant || "primary",
        onClick() {
          config.onConfirm();
          closeModal();
        },
      },
    ]);

    shell.panel.appendChild(footer);
    mountModal(shell.overlay);
  }

  function openFormModal(config) {
    const shell = createModalShell(config.title, config.meta);
    const form = document.createElement("form");
    form.className = "modal-form";

    (config.fields || []).forEach((field) => {
      const wrapper = document.createElement("label");
      wrapper.className = "modal-field";

      const label = document.createElement("span");
      label.className = "modal-label";
      label.textContent = field.label;

      let input;
      if (field.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = field.rows || 6;
      } else {
        input = document.createElement("input");
        input.type = field.type || "text";
      }

      input.name = field.name;
      input.value = field.value || "";
      input.placeholder = field.placeholder || "";
      input.className = "modal-input";
      if (field.required) {
        input.required = true;
      }

      wrapper.append(label, input);
      form.appendChild(wrapper);
    });

    const errorBox = document.createElement("div");
    errorBox.className = "modal-error";
    form.appendChild(errorBox);

    const footer = createModalFooter([
      {
        label: "取消",
        variant: "secondary",
        onClick: closeModal,
      },
      {
        label: config.submitLabel || "提交",
        variant: "primary",
        onClick() {
          form.requestSubmit();
        },
      },
    ]);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = {};

      (config.fields || []).forEach((field) => {
        const input = form.elements.namedItem(field.name);
        values[field.name] = typeof input.value === "string" ? input.value.trim() : "";
      });

      const emptyRequired = (config.fields || []).find(
        (field) => field.required && !values[field.name]
      );

      if (emptyRequired) {
        errorBox.textContent = "请先补全必填项。";
        return;
      }

      config.onSubmit(values);
      closeModal();
    });

    shell.body.appendChild(form);
    shell.panel.appendChild(footer);
    mountModal(shell.overlay);
  }

  function createModalShell(title, meta) {
    closeModal();

    const overlay = document.createElement("div");
    overlay.className = "app-modal";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    const panel = document.createElement("div");
    panel.className = "modal-panel";

    const header = document.createElement("div");
    header.className = "modal-header";

    const textBlock = document.createElement("div");
    const titleNode = document.createElement("h3");
    titleNode.className = "modal-title";
    titleNode.textContent = title;
    textBlock.appendChild(titleNode);

    if (meta) {
      const metaNode = document.createElement("div");
      metaNode.className = "modal-meta";
      metaNode.textContent = meta;
      textBlock.appendChild(metaNode);
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "modal-close";
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", closeModal);

    const body = document.createElement("div");
    body.className = "modal-body";

    header.append(textBlock, closeButton);
    panel.append(header, body);
    overlay.appendChild(panel);

    return { overlay, panel, body };
  }

  function createModalFooter(buttons) {
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    (buttons || []).forEach((buttonConfig) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "modal-action";
      if (buttonConfig.variant) {
        button.dataset.variant = buttonConfig.variant;
      }
      button.textContent = buttonConfig.label;
      button.addEventListener("click", buttonConfig.onClick);
      footer.appendChild(button);
    });

    return footer;
  }

  function mountModal(overlay) {
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
  }
})();
