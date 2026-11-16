(function () {
  "use strict";
  var story = window.STORY;
  var title = document.getElementById("title-screen");
  var novel = document.getElementById("novel");
  var ending = document.getElementById("ending");
  var bg = document.getElementById("background");
  var dialogue = document.getElementById("dialogue");
  var textEl = document.getElementById("text");
  var speakerEl = document.getElementById("speaker");
  var contextEl = document.getElementById("context-label");
  var chapterEl = document.getElementById("chapter-label");
  var choiceLayer = document.getElementById("choice-layer");
  var choicesEl = document.getElementById("choices");
  var choiceTitle = document.getElementById("choice-title");
  var announcer = document.getElementById("announcer");
  var mu = document.getElementById("portrait-mu");
  var ji = document.getElementById("portrait-ji");
  var startButton = document.getElementById("start");
  var restartButton = document.getElementById("restart");
  var replayButton = document.getElementById("replay");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var state = freshState();

  function freshState() {
    return {chapter: null, beat: 0, pages: [], page: 0, typing: false,
      timer: null, sceneTimer: null, resizeTimer: null, shown: "", scene: "",
      advanceAt: 0, choiceReadyAt: 0};
  }

  function clearTimers() {
    clearInterval(state.timer);
    if (state.sceneTimer) state.scene = "";
    clearTimeout(state.sceneTimer);
    clearTimeout(state.resizeTimer);
    state.timer = null;
    state.sceneTimer = null;
    state.resizeTimer = null;
  }

  function announce(value) {
    announcer.textContent = "";
    requestAnimationFrame(function () { announcer.textContent = value; });
  }

  function setScreen(which) {
    title.hidden = which !== "title";
    novel.hidden = which !== "novel";
    ending.hidden = which !== "ending";
    if (which === "novel") dialogue.focus({preventScroll: true});
    if (which === "ending") {
      ending.classList.remove("is-visible");
      requestAnimationFrame(function () {
        ending.classList.add("is-visible");
        replayButton.focus({preventScroll: true});
      });
    }
  }

  function start() {
    state.advanceAt = performance.now() + 180;
    setScreen("novel");
    loadChapter(story.start);
  }

  function chapter() { return story.chapters[state.chapter]; }

  function loadChapter(key) {
    clearTimers();
    setChoiceModal(false);
    state.chapter = key;
    state.beat = 0;
    chapterEl.textContent = key;
    showBeat();
  }

  function splitSentences(value) {
    return value.match(/[^。！？!?…]*[。！？!?…]+[”’」』】）)]*|[^。！？!?…]+$/gu) || [value];
  }

  function fits(value) {
    textEl.textContent = value || "\u200b";
    return textEl.scrollHeight <= textEl.clientHeight + 1;
  }

  function splitToFit(value) {
    var chars = Array.from(value);
    var pieces = [];
    var offset = 0;
    while (offset < chars.length) {
      var low = 1;
      var high = chars.length - offset;
      var best = 0;
      while (low <= high) {
        var middle = Math.floor((low + high) / 2);
        if (fits(chars.slice(offset, offset + middle).join(""))) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      best = Math.max(best, 1);
      pieces.push(chars.slice(offset, offset + best).join(""));
      offset += best;
    }
    return pieces;
  }

  function paginate(value) {
    var pages = [];
    var page = "";
    splitSentences(value).forEach(function (sentence) {
      if (fits(page + sentence)) {
        page += sentence;
        return;
      }
      if (page) pages.push(page);
      if (fits(sentence)) {
        page = sentence;
        return;
      }
      var pieces = splitToFit(sentence);
      page = pieces.pop() || "";
      pages = pages.concat(pieces);
    });
    if (page || !pages.length) pages.push(page);
    textEl.textContent = "";
    return pages;
  }

  function beatRole(beat) {
    var role = String(beat.role || beat.kind || "").toLowerCase();
    if (role === "mu" || role.indexOf("穆") !== -1) return "mu";
    if (role === "ji" || role.indexOf("季") !== -1) return "ji";
    return "";
  }

  function portraitSource(beat, role) {
    var fallback = role === "mu" ? "mu-calm.webp" : "ji-calm.webp";
    var expression = String(beat.expression || fallback);
    if (!/^[a-z0-9_-]+\.webp$/i.test(expression)) expression = fallback;
    return "assets/" + expression;
  }

  function updatePortrait(beat) {
    var role = beatRole(beat);
    mu.hidden = role !== "mu";
    ji.hidden = role !== "ji";
    if (role === "mu") mu.querySelector("img").src = portraitSource(beat, role);
    if (role === "ji") ji.querySelector("img").src = portraitSource(beat, role);
  }

  function updateScene(scene) {
    if (!scene || state.scene === scene) return;
    clearTimeout(state.sceneTimer);
    state.scene = scene;
    bg.classList.add("swap");
    var delay = reducedMotion.matches ? 0 : 120;
    state.sceneTimer = setTimeout(function () {
      bg.style.backgroundImage = "url('assets/" + scene + ".webp')";
      bg.classList.remove("swap");
      state.sceneTimer = null;
    }, delay);
  }

  function showBeat() {
    var beat = chapter().beats[state.beat];
    if (!beat) { finishChapter(); return; }
    updateScene(beat.scene);
    updatePortrait(beat);
    speakerEl.hidden = !beat.speaker;
    speakerEl.textContent = beat.speaker || "";
    contextEl.hidden = !beat.note;
    contextEl.textContent = beat.note || "";
    state.pages = paginate(String(beat.text || ""));
    state.page = 0;
    typePage();
  }

  function typePage() {
    clearInterval(state.timer);
    var value = state.pages[state.page];
    var chars = Array.from(value);
    var index = 0;
    state.typing = !reducedMotion.matches && chars.length > 0;
    state.shown = state.typing ? "" : value;
    textEl.textContent = state.shown;
    announce((speakerEl.textContent ? speakerEl.textContent + "：" : "") + value);
    if (!state.typing) return;
    state.timer = setInterval(function () {
      index = Math.min(index + 2, chars.length);
      state.shown = chars.slice(0, index).join("");
      textEl.textContent = state.shown;
      if (index === chars.length) {
        clearInterval(state.timer);
        state.timer = null;
        state.typing = false;
      }
    }, 22);
  }

  function reveal() {
    clearInterval(state.timer);
    state.timer = null;
    textEl.textContent = state.pages[state.page];
    state.shown = state.pages[state.page];
    state.typing = false;
  }

  function advance() {
    var now = performance.now();
    if (novel.hidden || !choiceLayer.hidden || now < state.advanceAt) return;
    state.advanceAt = now + 120;
    if (state.typing) { reveal(); return; }
    if (state.page < state.pages.length - 1) {
      state.page += 1;
      typePage();
      return;
    }
    state.beat += 1;
    showBeat();
  }

  function finishChapter() {
    var current = chapter();
    if (current.choices) { showChoices(current); return; }
    if (current.next) { loadChapter(current.next); return; }
    clearTimers();
    setScreen("ending");
    announce("未完待续");
  }

  function setChoiceModal(active) {
    choiceLayer.hidden = !active;
    [dialogue, restartButton].forEach(function (element) {
      element.inert = active;
      element.setAttribute("aria-hidden", active ? "true" : "false");
    });
  }

  function choose(item, event) {
    event.stopPropagation();
    if (performance.now() < state.choiceReadyAt) return;
    state.advanceAt = performance.now() + 240;
    setChoiceModal(false);
    loadChapter(item.target);
    dialogue.focus({preventScroll: true});
  }

  function showChoices(current) {
    clearInterval(state.timer);
    state.typing = false;
    state.choiceReadyAt = performance.now() + 260;
    choiceTitle.textContent = current.choiceLabel;
    choicesEl.textContent = "";
    current.choices.forEach(function (item) {
      var button = document.createElement("button");
      var key = document.createElement("span");
      var label = document.createElement("span");
      button.type = "button";
      button.className = "choice";
      key.className = "choice-key";
      key.setAttribute("aria-hidden", "true");
      key.textContent = item.key;
      label.textContent = item.text;
      button.append(key, label);
      button.addEventListener("click", function (event) { choose(item, event); });
      choicesEl.appendChild(button);
    });
    setChoiceModal(true);
    choicesEl.querySelector("button").focus({preventScroll: true});
    announce(current.choiceLabel);
  }

  function reset() {
    clearTimers();
    state = freshState();
    bg.style.backgroundImage = "";
    bg.classList.remove("swap");
    ending.classList.remove("is-visible");
    setChoiceModal(false);
    setScreen("title");
    startButton.focus({preventScroll: true});
  }

  function isControl(target) {
    return Boolean(target.closest("button, a, input, select, textarea, [role='dialog']"));
  }

  function reflowCurrentPage() {
    if (!state.chapter || novel.hidden || !choiceLayer.hidden) return;
    var beat = chapter().beats[state.beat];
    if (!beat) return;
    var offset = state.pages.slice(0, state.page).join("").length;
    var newPages = paginate(String(beat.text || ""));
    var consumed = 0;
    var newIndex = 0;
    for (var index = 0; index < newPages.length; index += 1) {
      if (consumed + newPages[index].length > offset) { newIndex = index; break; }
      consumed += newPages[index].length;
      newIndex = Math.min(index + 1, newPages.length - 1);
    }
    state.pages = newPages;
    state.page = newIndex;
    reveal();
  }

  novel.addEventListener("click", function (event) {
    if (!isControl(event.target)) advance();
  });
  dialogue.addEventListener("click", advance);
  startButton.addEventListener("click", start);
  restartButton.addEventListener("click", reset);
  replayButton.addEventListener("click", reset);
  choiceLayer.addEventListener("click", function (event) { event.stopPropagation(); });
  choiceLayer.addEventListener("keydown", function (event) {
    var buttons = Array.from(choicesEl.querySelectorAll("button"));
    var current = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      buttons[(current + 1 + buttons.length) % buttons.length].focus();
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      buttons[(current - 1 + buttons.length) % buttons.length].focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
  document.addEventListener("keydown", function (event) {
    if ((event.key !== "Enter" && event.key !== " ") || event.repeat) return;
    if (event.target.closest("button, a, input, select, textarea") || !choiceLayer.hidden) return;
    event.preventDefault();
    if (!title.hidden) start();
    else if (!ending.hidden) reset();
    else advance();
  });
  window.addEventListener("resize", function () {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(reflowCurrentPage, 100);
  });
})();
