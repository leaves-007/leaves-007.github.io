(function (factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  if (typeof window !== "undefined") {
    window.StudyOverviewStatus = factory();
  }
})(function () {
  function resolveOverviewStatusClass(status) {
    switch (status) {
      case "current-wrong":
        return "is-current-wrong";
      case "wrong":
        return "is-wrong";
      case "current":
        return "is-current";
      case "answered":
      case "viewed":
        return "is-answered";
      case "unanswered":
      case "unviewed":
      default:
        return "is-unanswered";
    }
  }

  function resolveOverviewQuestionStatus(options) {
    const config = options || {};
    if (config.isCurrent && config.isWrong) {
      return "current-wrong";
    }
    if (config.isCurrent) {
      return "current";
    }
    if (config.isWrong) {
      return "wrong";
    }
    if (config.isAnswered) {
      return "answered";
    }
    return "unanswered";
  }

  return {
    resolveOverviewStatusClass: resolveOverviewStatusClass,
    resolveOverviewQuestionStatus: resolveOverviewQuestionStatus,
  };
});
