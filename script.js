/* ============================================================
   HSK 1-5 · เกมเรียนภาษาจีน (Dynamic Vocabulary Engine)
============================================================ */

// สถานะการควบคุมระบบเกม
const state = {
  hsk: "hsk1", // ระดับ HSK ที่เลือก (hsk1, hsk2, hsk3, hsk4, hsk5)
  mode: "solo", // solo หรือ group
  teams: [], // ข้อมูลทีม/ผู้เล่น [{ name, score, correct }]
  currentTeamIdx: 0, // ทีมที่กำลังเล่นรอบนี้
  gameType: "quiz", // ประเภทเกมย่อย (quiz, match, guess, fill, bingo)
  questions: [], // รายการโจทย์คำถามที่ถูกสุ่มเจเนอเรตขึ้นมาในรอบนั้นๆ
  currentQIdx: 0, // ดัชนีข้อปัจจุบัน
};

/* ============================================================
   1) คอนฟิกูเรชันประเภทเกมย่อย (Subgame Configurations)
============================================================ */
const SUBGAMES_CONFIG = {
  quiz: {
    name: "🎄 Quiz Game (สี่ตัวเลือก)",
    desc: "อ่านอักษรจีนปริศนา แล้วทายความหมายภาษาไทยให้ถูกต้อง",
  },
  match: {
    name: "🎴 Vocabulary Matching",
    desc: "เกมจับคู่ท้าทายความจำ: อักษรจีนตัวนี้ แปลไทยว่าข้อใด",
  },
  guess: {
    name: "🔍 Guess The Word",
    desc: "ดูคำอ่านพินอินและคำแปลไทย แล้วทายอักษรจีนที่ถูกต้อง",
  },
  fill: {
    name: "📝 Fill In The Blank",
    desc: "ค้นหาอักษรจีนระดับเซียนไปเติมในประโยคคำใบ้ให้สมบูรณ์",
  },
  bingo: {
    name: "🎲 Chinese Bingo",
    desc: "สุ่มคำศัพท์ขึ้นมาจับคู่พยากรณ์เสียงอ่านและรูปคำพินอินที่ถูกต้อง",
  },
};

/* ============================================================
   2) ⚡ ENGINE: ฟังก์ชันสุ่มแปลงคำศัพท์ดิบมาเป็นโจทย์และชอยส์หลอก 4 ตัวเลือก
============================================================ */
function generateDynamicQuestions(hskLevel, gameType, count = 10) {
  // ดึงข้อมูลอาเรย์คำศัพท์จากไฟล์ vocabulary.js โดยตรง
  const rawVocab =
    typeof VOCABULARY !== "undefined" && VOCABULARY[hskLevel]
      ? VOCABULARY[hskLevel]
      : [];

  // กรณีระบบหาคลังศัพท์ไม่เจอ หรือศัพท์น้อยเกินไป ป้องกันไม่ให้โค้ดพัง
  if (rawVocab.length < 4) {
    return [
      {
        q: "ระบบไม่พบข้อมูลคำศัพท์ในไฟล์ หรือคำศัพท์มีจำนวนน้อยเกินไป",
        options: ["ตัวเลือก A", "ตัวเลือก B", "ตัวเลือก C", "ตัวเลือก D"],
        correct: 0,
      },
    ];
  }

  // ทำการคัดลอกและสุ่มสลับ (Shuffle) คำศัพท์ในคลังทั้งหมด
  const pool = [...rawVocab].sort(() => Math.random() - 0.5);
  const targetCount = Math.min(count, pool.length);
  const generated = [];

  for (let i = 0; i < targetCount; i++) {
    const targetWord = pool[i]; // คำศัพท์เฉลยที่ถูกต้องประจำข้อนี้

    // สุ่มดึงคำศัพท์คำอื่นในระดับเดียวกันที่ไม่ซ้ำกับข้อที่ถูกมา 3 คำ เพื่อทำเป็นชอยส์หลอก
    const wrongChoices = rawVocab
      .filter((w) => w.zh !== targetWord.zh)
      .sort(() => Math.random() - 0.5);
    const selectedWrong = wrongChoices.slice(0, 3);

    let qText = "";
    let options = [];

    // แตกแขนงลักษณะโจทย์และตัวเลือกตามประเภทเกมย่อยที่กดเล่น
    switch (gameType) {
      case "quiz":
      case "match":
        qText = `คำว่า <span class="cn" style="font-size:32px; color:var(--seal); font-weight:700;">${targetWord.zh}</span> แปลว่าอะไร?`;
        options = [
          targetWord.th,
          selectedWrong[0].th,
          selectedWrong[1].th,
          selectedWrong[2].th,
        ];
        break;

      case "guess":
        qText = `พินอิน <strong style="color:var(--gold); font-size:20px;">"${targetWord.py}"</strong> แปลว่า <strong>"${targetWord.th}"</strong> คืออักษรจีนตัวใด?`;
        options = [
          targetWord.zh,
          selectedWrong[0].zh,
          selectedWrong[1].zh,
          selectedWrong[2].zh,
        ];
        break;

      case "fill":
        qText = `จงเลือกคำศัพท์เติมในช่องว่าง: <br><span class="cn" style="font-size:24px;">我____ ${targetWord.th}。</span>`;
        options = [
          targetWord.zh,
          selectedWrong[0].zh,
          selectedWrong[1].zh,
          selectedWrong[2].zh,
        ];
        break;

      case "bingo":
        qText = `ข้อใดจับคู่คำว่า <span class="cn" style="font-size:26px;">${targetWord.zh}</span> กับเสียงอ่านพินอินได้ถูกต้อง?`;
        options = [
          `${targetWord.zh} (${targetWord.py})`,
          `${selectedWrong[0].zh} (${selectedWrong[1].py})`,
          `${selectedWrong[1].zh} (${selectedWrong[0].py})`,
          `${selectedWrong[2].zh} (${targetWord.py})`,
        ];
        break;

      default:
        qText = `คำศัพท์ <span class="cn">${targetWord.zh}</span> ตรงกับข้อใด?`;
        options = [
          targetWord.th,
          selectedWrong[0].th,
          selectedWrong[1].th,
          selectedWrong[2].th,
        ];
    }

    // ทำการสุ่มสลับตำแหน่งตัวเลือกทั้ง 4 ข้อ เพื่อป้องกันไม่ให้คำตอบที่ถูกอยู่ที่ข้อแรกตลอดเวลา
    const correctAnswerText = options[0];
    options.sort(() => Math.random() - 0.5);
    const correctIdx = options.indexOf(correctAnswerText);

    generated.push({
      q: qText,
      options: options,
      correct: correctIdx,
    });
  }

  return generated;
}

/* ============================================================
   3) ระบบควบคุมหน้าจอและการนำทาง (SPA Screen Switching)
============================================================ */
const screens = {
  hsk: document.getElementById("screen-hsk"),
  mode: document.getElementById("screen-mode"),
  "group-setup": document.getElementById("screen-group-setup"),
  "team-result": document.getElementById("screen-team-result"),
  subgame: document.getElementById("screen-subgame"),
  vocabulary: document.getElementById("screen-vocabulary"),
  listen: document.getElementById("screen-listen"),
  game: document.getElementById("screen-game"),
  leaderboard: document.getElementById("screen-leaderboard"),
  result: document.getElementById("screen-result"),
};

function showScreen(screenKey) {
  Object.values(screens).forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (screens[screenKey]) {
    screens[screenKey].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// มัดรวม Event Listener ปุ่มย้อนกลับทั้งหมดให้ทำงานอิงตาม Attribute
document.querySelectorAll(".back-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-back");
    const key = Object.keys(screens).find(
      (k) => screens[k] && screens[k].id === targetId,
    );
    if (key) showScreen(key);
  });
});

/* ============================================================
   4) หน้าเลือกระดับ HSK -> ลิงก์เข้าสู่หน้าเลือกโหมดเดี่ยว/กลุ่มทันที
============================================================ */
document.querySelectorAll("#hsk-grid .level-card").forEach((card) => {
  card.addEventListener("click", () => {
    state.hsk = card.getAttribute("data-hsk");
    showScreen("mode");
  });
});

/* ============================================================
   5) หน้าเลือกโหมดผู้เล่น (Solo / Group Random)
============================================================ */
document.querySelectorAll("#mode-grid .level-card").forEach((card) => {
  card.addEventListener("click", () => {
    state.mode = card.getAttribute("data-mode");
    if (state.mode === "solo") {
      state.teams = [{ name: "ผู้เล่นเดี่ยว", score: 0, correct: 0 }];
      goToSubgameScreen();
    } else {
      showScreen("group-setup");
    }
  });
});

/* ============================================================
   6) การตั้งค่าสุ่มจัดทีม (Group Team Generator)
============================================================ */
function initGroupSetup() {
  const applyBtn = document.getElementById("apply-player-count");
  if (applyBtn) applyBtn.addEventListener("click", generatePlayerInputs);

  const form = document.getElementById("group-setup-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleRandomizeGroups();
    });
  }
  generatePlayerInputs();
}

function generatePlayerInputs() {
  const count = parseInt(document.getElementById("player-count").value) || 4;
  const listContainer = document.getElementById("player-name-list");
  if (!listContainer) return;
  listContainer.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    listContainer.innerHTML += `
      <div class="player-list-item">
        <input type="text" class="text-input player-name-field" value="ผู้เล่น ${i}" placeholder="ระบุชื่อผู้เล่น" />
        <button type="button" class="remove-player-btn" aria-label="ลบผู้เล่นแถวนี้">✕</button>
      </div>
    `;
  }
}

document.getElementById("add-player-btn")?.addEventListener("click", () => {
  const inputContainer = document.getElementById("player-name-list");
  if (!inputContainer) return;
  const currentCount = inputContainer.children.length;
  if (currentCount >= 20) return;
  const i = currentCount + 1;
  const div = document.createElement("div");
  div.className = "player-list-item";
  div.innerHTML = `<input type="text" class="text-input player-name-field" value="ผู้เล่น ${i}" placeholder="ระบุชื่อผู้เล่น" /><button type="button" class="remove-player-btn" aria-label="ลบผู้เล่นแถวนี้">✕</button>`;
  inputContainer.appendChild(div);
  document.getElementById("player-count").value = i;
});

// ลบแถวรายชื่อผู้เล่น (ต้องเหลืออย่างน้อย 2 คนตามขั้นต่ำของช่องจำนวนผู้เล่น)
document.getElementById("player-name-list")?.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-player-btn")) return;
  const listContainer = document.getElementById("player-name-list");
  if (listContainer.children.length <= 2) return;
  e.target.closest(".player-list-item")?.remove();
  document.getElementById("player-count").value = listContainer.children.length;
});

function handleRandomizeGroups() {
  const fields = document.querySelectorAll(".player-name-field");
  const names = Array.from(fields)
    .map((f) => f.value.trim())
    .filter((v) => v !== "");
  const teamCount = parseInt(document.getElementById("team-count").value);
  const errorEl = document.getElementById("group-setup-error");

  if (names.length < teamCount) {
    if (errorEl)
      errorEl.textContent = `❌ จำนวนผู้เล่นต้องไม่ต่ำกว่าจํานวนทีม (${teamCount} ทีม)`;
    return;
  }
  if (errorEl) errorEl.textContent = "";

  names.sort(() => Math.random() - 0.5);

  const tempTeams = [];
  for (let t = 0; t < teamCount; t++) {
    tempTeams.push({
      name: `🔥 ทีมที่ ${t + 1}`,
      members: [],
      score: 0,
      correct: 0,
    });
  }
  names.forEach((name, idx) => {
    tempTeams[idx % teamCount].members.push(name);
  });

  state.teams = tempTeams;

  const grid = document.getElementById("team-result-grid");
  if (grid) {
    grid.innerHTML = state.teams
      .map(
        (team) => `
      <div class="team-card">
        <h3>🎯 ${team.name}</h3>
        <ul>${team.members.map((m) => `<li>👤 ${m}</li>`).join("")}</ul>
      </div>
    `,
      )
      .join("");
  }

  showScreen("team-result");
}

document.getElementById("confirm-teams-btn")?.addEventListener("click", () => {
  goToSubgameScreen();
});

/* ============================================================
   7) หน้าเลือกเกมย่อยที่หลากหลาย (Subgame Grid View)
============================================================ */
function goToSubgameScreen() {
  const levelName = state.hsk.toUpperCase();
  const heading = document.getElementById("subgame-heading");
  if (heading) heading.textContent = `เลือกรูปแบบเกมย่อย (${levelName})`;

  const context = document.getElementById("subgame-context");
  if (context)
    context.innerHTML = `โหมดการเล่น: <span class="highlight-hsk">${state.mode === "solo" ? "เล่นคนเดียว" : "แข่งขันเป็นกลุ่ม"}</span>`;

  const grid = document.getElementById("subgame-grid");
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(SUBGAMES_CONFIG).forEach((key) => {
    const game = SUBGAMES_CONFIG[key];
    const card = document.createElement("button");
    card.className = "level-card";
    card.type = "button";
    card.innerHTML = `
      <span class="seal-stamp hanzi">${game.name.substring(0, 2)}</span>
      <span class="info">
        <span class="title">${game.name}</span>
        <span class="desc">${game.desc}</span>
      </span>
      <span class="arrow">▶</span>
    `;
    card.addEventListener("click", () => {
      startSelectedGame(key);
    });
    grid.appendChild(card);
  });

  const backBtn = document.getElementById("subgame-back-btn");
  if (backBtn) {
    if (state.mode === "solo") {
      backBtn.setAttribute("data-back", "screen-mode");
    } else {
      backBtn.setAttribute("data-back", "screen-team-result");
    }
  }

  showScreen("subgame");
}

/* ============================================================
   8) เปิดฉากเริ่มต้นด่านย่อยและทำการสุ่มสลับโจทย์
============================================================ */
function startSelectedGame(gameKey) {
  state.gameType = gameKey;

  // เรียกใช้งาน Engine ยิงคิวรี่สุ่มคำศัพท์จำกัดรอบละ 10 ข้อ
  state.questions = generateDynamicQuestions(state.hsk, gameKey, 10);
  state.currentQIdx = 0;
  state.currentTeamIdx = 0;

  state.teams.forEach((t) => {
    t.score = 0;
    t.correct = 0;
  });

  renderQuestion();
  showScreen("game");
}

function renderQuestion() {
  const currentQ = state.questions[state.currentQIdx];
  const totalQ = state.questions.length;

  const progressText = document.getElementById("progress-text");
  if (progressText)
    progressText.textContent = `ข้อที่ ${state.currentQIdx + 1} / ${totalQ}`;

  const badge = document.getElementById("game-name-badge");
  if (badge) badge.textContent = SUBGAMES_CONFIG[state.gameType].name;

  const turnIndicator = document.getElementById("turn-indicator");
  if (turnIndicator) {
    if (state.mode === "group") {
      turnIndicator.textContent = `🎯 รอบคำถามของ: ${state.teams[state.currentTeamIdx].name}`;
    } else {
      turnIndicator.textContent = `🎯 ด่านประลองความสามารถเดี่ยว`;
    }
  }

  const qTextEl = document.getElementById("question-text");
  if (qTextEl) qTextEl.innerHTML = currentQ.q;

  const optionsContainer = document.getElementById("options-container");
  if (!optionsContainer) return;
  optionsContainer.innerHTML = "";

  currentQ.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + idx)}</span> <span class="opt-text">${opt}</span>`;
    btn.addEventListener("click", () => handleSelectOption(idx, btn));
    optionsContainer.appendChild(btn);
  });

  selectedOptionIdx = null;
  answerConfirmed = false;

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.classList.remove("visible");
    nextBtn.textContent = "ยืนยันคำตอบ";
  }
  renderScoreBadge();
}

function renderScoreBadge() {
  const row = document.getElementById("team-score-row");
  if (!row) return;
  row.innerHTML = state.teams
    .map(
      (t) => `
    <div class="team-score-badge">
      <span>${t.name}</span>: <strong>${t.score} แต้ม</strong>
    </div>
  `,
    )
    .join("");
}

let selectedOptionIdx = null;
let answerConfirmed = false;

// เลือกคำตอบ (ยังไม่ตัดคะแนน) ผู้เล่นสามารถเปลี่ยนใจก่อนกดยืนยันได้
function handleSelectOption(idx, clickedBtn) {
  if (answerConfirmed) return;

  selectedOptionIdx = idx;
  document
    .querySelectorAll("#options-container .option")
    .forEach((b) => b.classList.remove("selected"));
  clickedBtn.classList.add("selected");

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.classList.add("visible");
}

// กดยืนยันคำตอบ ค่อยตัดสินถูก/ผิดและบันทึกคะแนน
function confirmAnswer() {
  const currentQ = state.questions[state.currentQIdx];
  const buttons = document.querySelectorAll("#options-container .option");
  const clickedBtn = buttons[selectedOptionIdx];

  buttons.forEach((b) => (b.disabled = true));
  clickedBtn.classList.remove("selected");
  const activeTeam = state.teams[state.currentTeamIdx];

  if (selectedOptionIdx === currentQ.correct) {
    clickedBtn.classList.add("correct");
    activeTeam.score += 10;
    activeTeam.correct += 1;
  } else {
    clickedBtn.classList.add("wrong");
    if (buttons[currentQ.correct])
      buttons[currentQ.correct].classList.add("correct");
  }

  renderScoreBadge();
  answerConfirmed = true;

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.textContent = "ข้อต่อไป ▶";
}

document.getElementById("next-btn")?.addEventListener("click", () => {
  if (!answerConfirmed) {
    if (selectedOptionIdx === null) return;
    confirmAnswer();
    return;
  }

  state.currentQIdx++;
  if (state.mode === "group") {
    state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
  }

  if (state.currentQIdx < state.questions.length) {
    renderQuestion();
  } else {
    showLeaderboard();
  }
});

/* ============================================================
   9) ลีดเดอร์บอร์ดสรุปตารางอันดับ
============================================================ */
function showLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;
  const sorted = [...state.teams].sort((a, b) => b.score - a.score);

  list.innerHTML = sorted
    .map(
      (t, idx) => `
    <li class="rank-${idx + 1} ${idx === 0 ? "first" : ""}">
      <div class="rank-info">
        <span class="rank">${idx + 1}</span>
        <span class="team-name">${t.name}</span>
      </div>
      <span class="team-score">${t.score} คะแนน</span>
    </li>
  `,
    )
    .join("");

  showScreen("leaderboard");
}

document
  .getElementById("leaderboard-next-btn")
  ?.addEventListener("click", () => {
    const sorted = [...state.teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    const resWinner = document.getElementById("result-winner");
    if (resWinner) resWinner.textContent = winner.name;

    const resScore = document.getElementById("result-score");
    if (resScore) resScore.textContent = winner.score;

    const stats = document.getElementById("result-stats");
    if (stats) {
      stats.innerHTML = state.teams
        .map(
          (t) => `
      <div class="result-stat-row">
        <span>${t.name}</span>
        <span class="num">${t.score} คะแนน</span>
      </div>
    `,
        )
        .join("");
    }

    showScreen("result");
  });

document.getElementById("play-again-btn")?.addEventListener("click", () => {
  showScreen("hsk");
});

/* ============================================================
   10) หน้าดูประวัติคลังคำศัพท์รวมและจำลองการรับฟังเสียงพูด
============================================================ */
function openVocabulary() {
  showScreen("vocabulary");
  const box = document.getElementById("vocabulary-list");
  if (!box) return;

  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];

  if (words.length === 0) {
    box.innerHTML =
      "<div class='no-data'>ไม่พบข้อมูลรายการคำศัพท์ในไฟล์ดาด้า</div>";
    return;
  }

  box.innerHTML = words
    .map(
      (word) => `
    <div class="vocab-card">
      <h3>${word.zh}</h3>
      <p class="vocab-py">${word.py}</p>
      <p class="vocab-th">${word.th}</p>
    </div>
  `,
    )
    .join("");
}

let listenIndex = 0;

function openListenGame() {
  listenIndex = 0;
  showScreen("listen");
  updateListenWord();
}

function updateListenWord() {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  const targetEl = document.getElementById("listen-word");
  if (!targetEl) return;

  if (words.length === 0) {
    targetEl.textContent = "ไม่มีคำศัพท์";
    return;
  }
  if (!words[listenIndex]) listenIndex = 0;
  targetEl.textContent = words[listenIndex].zh;
}

// แคชรายชื่อเสียงพูดไว้ล่วงหน้า เพราะบางเบราว์เซอร์โหลดรายการเสียงแบบ async
let cachedVoices = [];
function refreshVoiceList() {
  cachedVoices = window.speechSynthesis.getVoices();
}
if (typeof window.speechSynthesis !== "undefined") {
  refreshVoiceList();
  window.speechSynthesis.onvoiceschanged = refreshVoiceList;
}

// เลือกเสียงเจ้าของภาษาจีนที่ดีที่สุดเท่าที่เครื่องผู้ใช้มี (ไม่เอาเสียงแปลภาษาทั่วไป)
function getNativeChineseVoice() {
  const voices = cachedVoices.length
    ? cachedVoices
    : window.speechSynthesis.getVoices();
  const zhVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith("zh"));
  if (zhVoices.length === 0) return null;

  return (
    zhVoices.find((v) => v.lang.toLowerCase() === "zh-cn" && v.localService) ||
    zhVoices.find((v) => v.lang.toLowerCase() === "zh-cn") ||
    zhVoices.find((v) => v.localService) ||
    zhVoices[0]
  );
}

function playAudio() {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  if (words.length === 0 || !words[listenIndex]) return;

  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(words[listenIndex].zh);
  const nativeVoice = getNativeChineseVoice();
  if (nativeVoice) {
    speech.voice = nativeVoice;
    speech.lang = nativeVoice.lang;
  } else {
    speech.lang = "zh-CN";
  }
  speech.rate = 0.75;
  window.speechSynthesis.speak(speech);
}

function nextListen() {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  if (words.length === 0) return;
  listenIndex = (listenIndex + 1) % words.length;
  updateListenWord();
}

// รันแอปพลิเคชันระบบเริ่มต้นตอนเปิดหน้าแรก
initGroupSetup();
showScreen("hsk");
