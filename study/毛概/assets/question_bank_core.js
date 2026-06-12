(function (globalFactory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalFactory();
    return;
  }
  if (typeof window !== "undefined") {
    window.QuestionBankCore = globalFactory();
  }
})(function () {
  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\u3000/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeCompact(value) {
    return normalizeText(value).replace(/[，,。.\s、；;（）()]/g, "").toLowerCase();
  }

  function normalizeChoiceToken(value) {
    return normalizeText(value).replace(/[^A-Za-z]/g, "").toUpperCase();
  }

  function normalizeBoolean(value) {
    const text = normalizeText(value).toLowerCase();
    if (["true", "t", "对", "正确", "是"].includes(text)) {
      return "true";
    }
    if (["false", "f", "错", "错误", "否"].includes(text)) {
      return "false";
    }
    return text;
  }

  function normalizeChoiceArray(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeChoiceToken).filter(Boolean);
    }
    return normalizeText(value)
      .split(/[;；,，\s]+/)
      .map(normalizeChoiceToken)
      .filter(Boolean);
  }

  function normalizeAnswerSet(value) {
    return Array.from(new Set(normalizeChoiceArray(value))).sort();
  }

  function judgeObjectiveAnswer(questionType, expected, actual) {
    if (questionType === "单选题") {
      const isCorrect = normalizeChoiceToken(expected) === normalizeChoiceToken(actual);
      return { isCorrect, expected: normalizeChoiceToken(expected) };
    }
    if (questionType === "多选题") {
      const expectedSet = normalizeAnswerSet(expected);
      const actualSet = normalizeAnswerSet(actual);
      const isCorrect =
        expectedSet.length === actualSet.length &&
        expectedSet.every(function (value, index) {
          return value === actualSet[index];
        });
      return { isCorrect, expected: expectedSet };
    }
    if (questionType === "判断题") {
      const isCorrect = normalizeBoolean(expected) === normalizeBoolean(actual);
      return { isCorrect, expected: normalizeBoolean(expected) };
    }
    return { isCorrect: false, expected: expected };
  }

  function judgeFillBlanks(question, answers) {
    const inputs = Array.isArray(answers) ? answers : [answers];
    const expectedGroups = Array.isArray(question.fillBlanks) ? question.fillBlanks : [];
    if (!expectedGroups.length) {
      return { isCorrect: normalizeCompact(question.answerRaw) === normalizeCompact(inputs[0]) };
    }
    if (inputs.length !== expectedGroups.length) {
      return { isCorrect: false };
    }
    for (let i = 0; i < expectedGroups.length; i += 1) {
      const actual = normalizeCompact(inputs[i]);
      const acceptedAnswers = (expectedGroups[i].acceptedAnswers || []).map(normalizeCompact);
      if (!acceptedAnswers.includes(actual)) {
        return { isCorrect: false, failedIndex: i };
      }
    }
    return { isCorrect: true };
  }

  function judgeQuestion(question, answer) {
    if (question.type === "填空题") {
      return judgeFillBlanks(question, answer);
    }
    if (question.type === "简答题") {
      const normalized = normalizeText(answer).toLowerCase();
      return { isCorrect: normalized === "mastered" || normalized === "correct" };
    }
    return judgeObjectiveAnswer(question.type, question.answerRaw, answer);
  }

  function shuffleArray(values, rng) {
    const source = values.slice();
    const random = typeof rng === "function" ? rng : Math.random;
    for (let index = source.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      const temp = source[index];
      source[index] = source[swapIndex];
      source[swapIndex] = temp;
    }
    return source;
  }

  function buildSessionQuestionIds(questions, config, rng) {
    const mode = (config && config.mode) || "sequential";
    const list = Array.isArray(questions) ? questions.slice() : [];
    if (mode === "chapter") {
      return list.filter(function (question) { return question.chapterKey === config.chapterKey; }).map(function (question) { return question.id; });
    }
    if (mode === "type") {
      return list.filter(function (question) { return question.type === config.questionType; }).map(function (question) { return question.id; });
    }
    if (mode === "custom") {
      return (config.questionIds || []).slice();
    }
    if (mode === "favorites") {
      const favoriteSet = new Set(config.favoriteIds || []);
      return list.filter(function (question) { return favoriteSet.has(question.id); }).map(function (question) { return question.id; });
    }
    if (mode === "wrongs") {
      const wrongSet = new Set(config.wrongIds || []);
      return list.filter(function (question) { return wrongSet.has(question.id); }).map(function (question) { return question.id; });
    }
    if (mode === "random" || mode === "exam") {
      const shuffled = shuffleArray(
        list.map(function (question) { return question.id; }),
        rng
      );
      const count = Math.max(1, Math.min(config.count || shuffled.length, shuffled.length));
      return shuffled.slice(0, count);
    }
    return list.map(function (question) { return question.id; });
  }

  function createDateRange(todayText, count) {
    const today = new Date(todayText + "T00:00:00");
    const dates = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
  }

  function computeStats(bank, state, todayText) {
    const questions = bank.questions || [];
    const totalQuestions = bank.totalQuestions || questions.length;
    const questionStates = (state && state.questionStates) || {};
    const practiceLog = (state && state.practiceLog) || [];
    let completedCount = 0;
    let correctCount = 0;
    let wrongCount = 0;

    const chapterMap = new Map();
    questions.forEach(function (question) {
      const chapterStats = chapterMap.get(question.chapterKey) || {
        chapterKey: question.chapterKey,
        chapterTitle: question.chapterTitle,
        totalCount: 0,
        completedCount: 0,
        masteredCount: 0,
      };
      chapterStats.totalCount += 1;
      const questionState = questionStates[question.id];
      if (questionState && questionState.lastResult) {
        completedCount += 1;
        chapterStats.completedCount += 1;
        if (questionState.lastResult === "correct" || questionState.lastResult === "mastered") {
          correctCount += 1;
          chapterStats.masteredCount += 1;
        } else if (questionState.lastResult === "wrong") {
          wrongCount += 1;
        }
      }
      chapterMap.set(question.chapterKey, chapterStats);
    });

    const chapterStats = Array.from(chapterMap.values()).map(function (chapter) {
      return Object.assign({}, chapter, {
        masteryRate: chapter.totalCount ? chapter.masteredCount / chapter.totalCount : 0,
      });
    });

    const dateRange = createDateRange(todayText || new Date().toISOString().slice(0, 10), 7);
    const dateMap = new Map();
    dateRange.forEach(function (date) {
      dateMap.set(date, { date: date, total: 0, correct: 0, wrong: 0, mastered: 0 });
    });
    practiceLog.forEach(function (item) {
      if (!item || !item.date || !dateMap.has(item.date)) {
        return;
      }
      const bucket = dateMap.get(item.date);
      bucket.total += 1;
      if (item.result === "correct") {
        bucket.correct += 1;
      } else if (item.result === "wrong") {
        bucket.wrong += 1;
      } else if (item.result === "mastered") {
        bucket.mastered += 1;
      }
    });

    return {
      totalQuestions: totalQuestions,
      completedCount: completedCount,
      correctCount: correctCount,
      wrongCount: wrongCount,
      correctRate: completedCount ? correctCount / completedCount : 0,
      wrongRate: completedCount ? wrongCount / completedCount : 0,
      chapterStats: chapterStats,
      recent7Days: dateRange.map(function (date) { return dateMap.get(date); }),
    };
  }

  function indexQuestions(questions) {
    const byId = {};
    (questions || []).forEach(function (question) {
      byId[question.id] = question;
    });
    return byId;
  }

  return {
    normalizeText: normalizeText,
    normalizeCompact: normalizeCompact,
    judgeObjectiveAnswer: judgeObjectiveAnswer,
    judgeQuestion: judgeQuestion,
    buildSessionQuestionIds: buildSessionQuestionIds,
    computeStats: computeStats,
    shuffleArray: shuffleArray,
    indexQuestions: indexQuestions,
  };
});
