/* ============================================================
   HSK 1-5 · เกมเรียนภาษาจีน (Dynamic Vocabulary Engine)
============================================================ */

// สถานะการควบคุมระบบเกม
const state = {
  hsk: "hsk1", // ระดับ HSK ที่เลือก (hsk1, hsk2, hsk3, hsk4, hsk5)
  mode: "solo", // solo หรือ group
  teams: [], // ข้อมูลทีม/ผู้เล่น [{ name, score, correct }]
  currentTeamIdx: 0, // ทีมที่กำลังเล่นรอบนี้
  gameType: "quiz", // ประเภทเกมย่อย (quiz, guess, fill, memory)
  questions: [], // รายการโจทย์คำถามที่ถูกสุ่มเจเนอเรตขึ้นมาในรอบนั้นๆ
  currentQIdx: 0, // ดัชนีข้อปัจจุบัน
};

/* ============================================================
   0) คลังประโยคตัวอย่างภาษาจีนจริงสำหรับโหมด Fill In The Blank
   จัดกลุ่มตามชนิดคำ (type ของคำศัพท์ในไฟล์ vocabulary.js) เพื่อให้
   ประโยคที่สุ่มออกมาถูกไวยากรณ์เสมอไม่ว่าจะสุ่มได้คำใดในหมวดนั้น
============================================================ */
const FILL_TEMPLATES = {
  greeting: ["她对我说：“___！”", "他笑着说：“___。”"],
  copula: ["我___学生。"],
  pronoun: ["___喜欢学中文。", "老师认识___。"],
  number: ["我有___个苹果。"],
  time: ["___我要去学校。"],
  direction: ["书在桌子的___。"],
  verb: ["我很喜欢___。", "我们一起___吧。"],
  adj: ["他很___。", "这件事很___。"],
  noun: ["这是___。", "我喜欢___。"],
};

// เลือกประโยคตัวอย่าง: ใช้ประโยคเฉพาะของคำนั้น (ถ้ามี) หรือสุ่มจากคลังตามชนิดคำ
function pickFillSentence(word) {
  if (word.sentence) return word.sentence;
  const pool = FILL_TEMPLATES[word.type] || FILL_TEMPLATES.noun;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================
   1) คอนฟิกูเรชันประเภทเกมย่อย (Subgame Configurations)
============================================================ */
const SUBGAMES_CONFIG = {
  quiz: {
    name: "🎄 Quiz Game (สี่ตัวเลือก)",
    desc: "อ่านอักษรจีนปริศนา แล้วทายความหมายภาษาไทยให้ถูกต้อง",
  },
  guess: {
    name: "🔍 Guess The Word",
    desc: "แตะตัวอักษรจีนที่กระจัดกระจายมาเรียงต่อกันให้ตรงกับคำอ่านพินอินและคำแปล",
  },
  fill: {
    name: "📝 Fill In The Blank",
    desc: "ค้นหาอักษรจีนระดับเซียนไปเติมในประโยคคำใบ้ให้สมบูรณ์",
  },
  memory: {
    name: "🎴 Memory Match",
    desc: "พลิกการ์ดจับคู่อักษรจีนกับคำแปลไทยให้ครบทุกคู่ ยิ่งจำแม่นยิ่งได้คะแนนเยอะ",
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
    let slotAnswer = null;
    let tiles = null;

    // แตกแขนงลักษณะโจทย์และตัวเลือกตามประเภทเกมย่อยที่กดเล่น
    switch (gameType) {
      case "quiz":
        qText = `คำว่า <span class="cn" style="font-size:32px; color:var(--seal); font-weight:700;">${targetWord.zh}</span> <span style="font-size:16px; color:var(--gold); font-weight:600;">(${targetWord.py})</span> แปลว่าอะไร?`;
        options = [
          targetWord.th,
          selectedWrong[0].th,
          selectedWrong[1].th,
          selectedWrong[2].th,
        ];
        break;

      case "guess": {
        // แตกคำเฉลยออกเป็นตัวอักษรจีนทีละตัว แล้วผสมตัวลวงจากคำอื่นๆ ในระดับเดียวกัน
        // ให้ผู้เล่นแตะเรียงตัวอักษรที่กระจัดกระจายให้กลับมาเป็นคำที่ถูกต้อง
        const chars = Array.from(targetWord.zh);
        const decoyChars = [
          ...new Set(
            rawVocab
              .filter((w) => w.zh !== targetWord.zh)
              .flatMap((w) => Array.from(w.zh))
              .filter((ch) => !chars.includes(ch)),
          ),
        ].sort(() => Math.random() - 0.5);
        const decoyCount = Math.min(decoyChars.length, Math.max(2, 6 - chars.length));

        slotAnswer = chars;
        tiles = [...chars, ...decoyChars.slice(0, decoyCount)].sort(() => Math.random() - 0.5);
        const slotsHtml = chars
          .map((_, i) => `<span class="guess-slot" data-slot-idx="${i}"></span>`)
          .join("");
        qText = `พินอิน <strong style="color:var(--gold); font-size:20px;">"${targetWord.py}"</strong> แปลว่า <strong>"${targetWord.th}"</strong> จงแตะตัวอักษรจีนที่กระจัดกระจายให้เรียงกลับมาเป็นคำที่ถูกต้อง: <div class="guess-slots" id="guess-slots">${slotsHtml}</div>`;
        break;
      }

      case "fill": {
        const sentenceHtml = pickFillSentence(targetWord).replace(
          "___",
          '<span class="fill-blank" id="fill-blank-slot">?</span>',
        );
        qText = `จงเลือกคำศัพท์ที่แปลว่า <strong style="color:var(--gold);">"${targetWord.th}"</strong> ไปเติมในประโยคให้ถูกต้อง (ลากหรือแตะเพื่อเลือก): <br><span class="fill-sentence" style="font-size:24px;">${sentenceHtml}</span>`;
        options = [
          targetWord.zh,
          selectedWrong[0].zh,
          selectedWrong[1].zh,
          selectedWrong[2].zh,
        ];
        break;
      }

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
      audioText: targetWord.zh,
      slotAnswer,
      tiles,
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
  memory: document.getElementById("screen-memory"),
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

  // Memory Match ใช้กลไกพลิกการ์ด ไม่ใช่คำถาม 4 ตัวเลือกแบบเกมอื่น จึงแยกเส้นทางไปคนละหน้าจอ
  if (gameKey === "memory") {
    startMemoryGame();
    return;
  }

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

  const audioBtn = document.getElementById("question-audio-btn");
  if (audioBtn) {
    audioBtn.onclick = () => speakChinese(currentQ.audioText);
  }

  const optionsContainer = document.getElementById("options-container");
  if (!optionsContainer) return;
  optionsContainer.innerHTML = "";

  if (state.gameType === "guess") {
    optionsContainer.classList.remove("fill-word-bank");
    renderGuessTiles(currentQ, optionsContainer);
  } else if (state.gameType === "fill") {
    optionsContainer.classList.remove("guess-tile-bank");
    optionsContainer.classList.add("fill-word-bank");
    currentQ.options.forEach((opt, idx) => {
      const chip = document.createElement("button");
      chip.className = "option fill-chip";
      chip.type = "button";
      chip.draggable = true;
      chip.innerHTML = `<span class="cn">${opt}</span>`;
      chip.addEventListener("click", () => handleSelectOption(idx, chip));
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(idx));
        e.dataTransfer.effectAllowed = "move";
      });
      optionsContainer.appendChild(chip);
    });

    const blank = document.getElementById("fill-blank-slot");
    if (blank) {
      blank.addEventListener("dragover", (e) => {
        e.preventDefault();
        blank.classList.add("drag-over");
      });
      blank.addEventListener("dragleave", () => blank.classList.remove("drag-over"));
      blank.addEventListener("drop", (e) => {
        e.preventDefault();
        blank.classList.remove("drag-over");
        const idx = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const chip = optionsContainer.children[idx];
        if (chip && !chip.disabled) handleSelectOption(idx, chip);
      });
    }
  } else {
    optionsContainer.classList.remove("fill-word-bank", "guess-tile-bank");
    currentQ.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + idx)}</span> <span class="opt-text">${opt}</span>`;
      btn.addEventListener("click", () => handleSelectOption(idx, btn));
      optionsContainer.appendChild(btn);
    });
  }

  selectedOptionIdx = null;
  answerConfirmed = false;
  guessPlacedTiles = [];

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
let guessPlacedTiles = []; // ลำดับ index ของตัวอักษรจีนใน tile bank ที่ผู้เล่นแตะวางไว้ (โหมด Guess The Word)

// เลือกคำตอบ (ยังไม่ตัดคะแนน) ผู้เล่นสามารถเปลี่ยนใจก่อนกดยืนยันได้
function handleSelectOption(idx, clickedBtn) {
  if (answerConfirmed) return;

  selectedOptionIdx = idx;
  document
    .querySelectorAll("#options-container .option")
    .forEach((b) => b.classList.remove("selected"));
  clickedBtn.classList.add("selected");

  if (state.gameType === "fill") {
    const blank = document.getElementById("fill-blank-slot");
    if (blank) {
      blank.textContent = clickedBtn.textContent.trim();
      blank.classList.add("filled");
    }
  }

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.classList.add("visible");
}

// กดยืนยันคำตอบ ค่อยตัดสินถูก/ผิดและบันทึกคะแนน
function confirmAnswer() {
  const currentQ = state.questions[state.currentQIdx];
  const buttons = document.querySelectorAll("#options-container .option");
  const clickedBtn = buttons[selectedOptionIdx];

  buttons.forEach((b) => {
    b.disabled = true;
    b.draggable = false;
  });
  clickedBtn.classList.remove("selected");
  const activeTeam = state.teams[state.currentTeamIdx];
  const isCorrect = selectedOptionIdx === currentQ.correct;

  if (isCorrect) {
    clickedBtn.classList.add("correct");
    activeTeam.score += 10;
    activeTeam.correct += 1;
  } else {
    clickedBtn.classList.add("wrong");
    if (buttons[currentQ.correct])
      buttons[currentQ.correct].classList.add("correct");
  }

  if (state.gameType === "fill") {
    const blank = document.getElementById("fill-blank-slot");
    if (blank) blank.classList.add(isCorrect ? "correct" : "wrong");
  }

  renderScoreBadge();
  answerConfirmed = true;

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.textContent = "ข้อต่อไป ▶";
}

/* ============================================================
   8.4) Guess The Word: แตะตัวอักษรจีนที่กระจัดกระจายมาเรียงเป็นคำเฉลย
============================================================ */

// วาดตัวอักษรจีน (ตัวจริง + ตัวลวง) เป็นปุ่มให้แตะ พร้อมปุ่มลบตัวล่าสุด
function renderGuessTiles(currentQ, container) {
  const tileWrap = document.createElement("div");
  tileWrap.className = "guess-tile-bank";

  currentQ.tiles.forEach((ch, tileIdx) => {
    const tileEl = document.createElement("button");
    tileEl.type = "button";
    tileEl.className = "option guess-tile";
    tileEl.innerHTML = `<span class="cn">${ch}</span>`;
    tileEl.addEventListener("click", () => handleGuessTileClick(tileIdx, tileEl));
    tileWrap.appendChild(tileEl);
  });
  container.appendChild(tileWrap);

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.id = "guess-undo-btn";
  undoBtn.className = "btn btn-ghost guess-undo-btn";
  undoBtn.textContent = "⌫ ลบตัวล่าสุด";
  undoBtn.addEventListener("click", handleGuessUndo);
  container.appendChild(undoBtn);

  renderGuessSlotsUI(currentQ);
}

// เติมตัวอักษรที่แตะวางแล้วลงในช่องว่างตามลำดับ
function renderGuessSlotsUI(currentQ) {
  const slots = document.querySelectorAll("#guess-slots .guess-slot");
  slots.forEach((slotEl, i) => {
    const tileIdx = guessPlacedTiles[i];
    if (tileIdx !== undefined) {
      slotEl.textContent = currentQ.tiles[tileIdx];
      slotEl.classList.add("filled");
    } else {
      slotEl.textContent = "";
      slotEl.classList.remove("filled");
    }
  });
}

function handleGuessTileClick(tileIdx, tileEl) {
  if (answerConfirmed) return;
  const currentQ = state.questions[state.currentQIdx];
  if (tileEl.disabled) return;
  if (guessPlacedTiles.length >= currentQ.slotAnswer.length) return;

  guessPlacedTiles.push(tileIdx);
  tileEl.disabled = true;
  tileEl.classList.add("used");
  renderGuessSlotsUI(currentQ);

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) {
    nextBtn.classList.toggle("visible", guessPlacedTiles.length === currentQ.slotAnswer.length);
  }
}

function handleGuessUndo() {
  if (answerConfirmed || guessPlacedTiles.length === 0) return;
  const currentQ = state.questions[state.currentQIdx];
  const lastTileIdx = guessPlacedTiles.pop();
  const tileButtons = document.querySelectorAll("#options-container .guess-tile");
  const tileEl = tileButtons[lastTileIdx];
  if (tileEl) {
    tileEl.disabled = false;
    tileEl.classList.remove("used");
  }
  renderGuessSlotsUI(currentQ);
  document.getElementById("next-btn")?.classList.remove("visible");
}

// กดยืนยันคำตอบของ Guess The Word เทียบลำดับตัวอักษรที่แตะวางกับคำเฉลย
function confirmGuessAnswer() {
  const currentQ = state.questions[state.currentQIdx];
  const assembled = guessPlacedTiles.map((i) => currentQ.tiles[i]);
  const isCorrect = assembled.join("") === currentQ.slotAnswer.join("");
  const activeTeam = state.teams[state.currentTeamIdx];

  document.querySelectorAll("#options-container .guess-tile").forEach((b) => (b.disabled = true));
  document.getElementById("guess-undo-btn")?.setAttribute("disabled", "true");

  const slotsContainer = document.getElementById("guess-slots");
  if (slotsContainer) slotsContainer.classList.add(isCorrect ? "correct" : "wrong");

  if (isCorrect) {
    activeTeam.score += 10;
    activeTeam.correct += 1;
  } else if (slotsContainer) {
    const revealEl = document.createElement("p");
    revealEl.className = "guess-reveal";
    revealEl.textContent = `เฉลย: ${currentQ.slotAnswer.join("")}`;
    slotsContainer.after(revealEl);
  }

  renderScoreBadge();
  answerConfirmed = true;

  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.textContent = "ข้อต่อไป ▶";
}

document.getElementById("next-btn")?.addEventListener("click", () => {
  if (!answerConfirmed) {
    if (state.gameType === "guess") {
      const currentQ = state.questions[state.currentQIdx];
      if (guessPlacedTiles.length < currentQ.slotAnswer.length) return;
      confirmGuessAnswer();
    } else {
      if (selectedOptionIdx === null) return;
      confirmAnswer();
    }
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
   8.5) Memory Match: พลิกการ์ดจับคู่อักษรจีน (zh) กับคำแปลไทย (th)
============================================================ */
const MEMORY_PAIR_COUNT = 6;

const memoryState = {
  cards: [],
  flipped: [],
  matchedPairs: 0,
  totalPairs: 0,
  lock: false,
};

function startMemoryGame() {
  const rawVocab =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  const pairCount = Math.min(MEMORY_PAIR_COUNT, rawVocab.length);
  const chosen = [...rawVocab].sort(() => Math.random() - 0.5).slice(0, pairCount);

  const cards = [];
  chosen.forEach((word, pairId) => {
    cards.push({ pairId, kind: "zh", text: word.zh, matched: false, flipped: false });
    cards.push({ pairId, kind: "th", text: word.th, matched: false, flipped: false });
  });
  cards.sort(() => Math.random() - 0.5);

  memoryState.cards = cards;
  memoryState.flipped = [];
  memoryState.matchedPairs = 0;
  memoryState.totalPairs = pairCount;
  memoryState.lock = false;

  state.currentTeamIdx = 0;
  state.teams.forEach((t) => {
    t.score = 0;
    t.correct = 0;
  });

  renderMemoryBoard();
  showScreen("memory");
}

function renderMemoryBoard() {
  const grid = document.getElementById("memory-grid");
  if (!grid) return;

  grid.innerHTML = "";
  memoryState.cards.forEach((card, idx) => {
    const cardEl = document.createElement("button");
    cardEl.type = "button";
    cardEl.className = "memory-card";
    cardEl.dataset.idx = idx;
    if (card.matched) cardEl.classList.add("matched");

    if (card.flipped || card.matched) {
      cardEl.classList.add("flipped");
      cardEl.innerHTML = `
        <span class="${card.kind === "zh" ? "cn" : ""}">${card.text}</span>
        ${card.kind === "zh" ? '<span class="memory-audio-btn" aria-label="ฟังเสียง">🔊</span>' : ""}
      `;
    } else {
      cardEl.innerHTML = `<span class="memory-back hanzi">问</span>`;
    }

    cardEl.addEventListener("click", () => handleMemoryCardClick(idx));
    grid.appendChild(cardEl);
  });

  updateMemoryProgress();
}

function updateMemoryProgress() {
  const progress = document.getElementById("memory-progress");
  if (progress)
    progress.textContent = `จับคู่แล้ว ${memoryState.matchedPairs} / ${memoryState.totalPairs} คู่`;

  const turnIndicator = document.getElementById("memory-turn-indicator");
  if (turnIndicator) {
    turnIndicator.textContent =
      state.mode === "group"
        ? `🎯 รอบของ: ${state.teams[state.currentTeamIdx].name}`
        : `🎯 ด่านประลองความสามารถเดี่ยว`;
  }

  const scoreRow = document.getElementById("memory-score-row");
  if (scoreRow) {
    scoreRow.innerHTML = state.teams
      .map(
        (t) => `
      <div class="team-score-badge">
        <span>${t.name}</span>: <strong>${t.score} แต้ม</strong>
      </div>
    `,
      )
      .join("");
  }
}

// พลิกการ์ดที่คลิก แล้วเมื่อเปิดครบ 2 ใบค่อยตัดสินว่าจับคู่ถูกไหม
function handleMemoryCardClick(idx) {
  if (memoryState.lock) return;
  const card = memoryState.cards[idx];
  if (!card || card.matched || card.flipped) return;
  if (memoryState.flipped.length >= 2) return;

  card.flipped = true;
  memoryState.flipped.push(idx);
  renderMemoryBoard();

  if (card.kind === "zh") speakChinese(card.text);

  if (memoryState.flipped.length === 2) {
    memoryState.lock = true;
    const [firstIdx, secondIdx] = memoryState.flipped;
    const first = memoryState.cards[firstIdx];
    const second = memoryState.cards[secondIdx];

    if (first.pairId === second.pairId) {
      setTimeout(() => {
        first.matched = true;
        second.matched = true;
        memoryState.matchedPairs++;
        memoryState.flipped = [];
        memoryState.lock = false;

        const activeTeam = state.teams[state.currentTeamIdx];
        activeTeam.score += 10;
        activeTeam.correct += 1;

        renderMemoryBoard();

        if (memoryState.matchedPairs === memoryState.totalPairs) {
          setTimeout(() => showLeaderboard(), 600);
        }
      }, 500);
    } else {
      setTimeout(() => {
        first.flipped = false;
        second.flipped = false;
        memoryState.flipped = [];
        memoryState.lock = false;

        if (state.mode === "group") {
          state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;
        }

        renderMemoryBoard();
      }, 900);
    }
  }
}

// แตะไอคอนลำโพงบนการ์ดที่เปิดแล้วเพื่อฟังเสียงซ้ำ โดยไม่ทำให้การ์ดถูกเลือกซ้ำ
document.getElementById("memory-grid")?.addEventListener("click", (e) => {
  const audioBtn = e.target.closest(".memory-audio-btn");
  if (!audioBtn) return;
  e.stopPropagation();
  const cardEl = audioBtn.closest(".memory-card");
  const idx = parseInt(cardEl?.dataset.idx, 10);
  const card = memoryState.cards[idx];
  if (card) speakChinese(card.text);
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
      (word, idx) => `
    <div class="vocab-card">
      <button type="button" class="audio-btn" data-vocab-idx="${idx}" aria-label="ฟังเสียงอ่าน ${word.zh}">🔊</button>
      <h3>${word.zh}</h3>
      <p class="vocab-py">${word.py}</p>
      <p class="vocab-th">${word.th}</p>
    </div>
  `,
    )
    .join("");

  box.querySelectorAll(".audio-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-vocab-idx"));
      if (words[idx]) speakChinese(words[idx].zh);
    });
  });
}

let listenIndex = 0;

function openListenGame() {
  listenIndex = 0;
  showScreen("listen");
  updateListenWord();
  resetScoreResult();
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

// ฟังก์ชันกลางสำหรับอ่านออกเสียงคำจีนด้วยเสียงเจ้าของภาษา ใช้ร่วมกันได้ทุกหน้าที่มีคำศัพท์จีน
function speakChinese(text, rate = 0.8) {
  if (!text || typeof window.speechSynthesis === "undefined") return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  const nativeVoice = getNativeChineseVoice();
  if (nativeVoice) {
    speech.voice = nativeVoice;
    speech.lang = nativeVoice.lang;
  } else {
    speech.lang = "zh-CN";
  }
  speech.rate = rate;
  window.speechSynthesis.speak(speech);
}

function playAudio() {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  if (words.length === 0 || !words[listenIndex]) return;
  speakChinese(words[listenIndex].zh, 0.75);
}

function nextListen() {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  if (words.length === 0) return;
  listenIndex = (listenIndex + 1) % words.length;
  updateListenWord();
  resetScoreResult();
}

/* ============================================================
   11) อัดเสียงผู้เรียนแล้วส่งให้ AI (OpenAI Whisper + GPT) ให้คะแนนความถูกต้อง
============================================================ */
const PRONUNCIATION_API_BASE = "http://localhost:3001";

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

function resetScoreResult() {
  const statusEl = document.getElementById("record-status");
  const resultEl = document.getElementById("score-result");
  if (statusEl) statusEl.textContent = "";
  if (resultEl) resultEl.hidden = true;
}

async function toggleRecording() {
  if (isRecording) {
    mediaRecorder?.stop();
    return;
  }

  const statusEl = document.getElementById("record-status");
  const recordBtn = document.getElementById("record-btn");
  const resultEl = document.getElementById("score-result");
  if (resultEl) resultEl.hidden = true;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (statusEl)
      statusEl.textContent = "❌ ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้งานไมค์";
    return;
  }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  });

  mediaRecorder.addEventListener("stop", () => {
    stream.getTracks().forEach((track) => track.stop());
    isRecording = false;
    if (recordBtn) {
      recordBtn.textContent = "🎙️ เริ่มอัดเสียง";
      recordBtn.classList.remove("recording");
    }
    const blob = new Blob(recordedChunks, {
      type: mediaRecorder.mimeType || "audio/webm",
    });
    submitRecordingForScoring(blob);
  });

  mediaRecorder.start();
  isRecording = true;
  if (recordBtn) {
    recordBtn.textContent = "⏹ หยุดอัดเสียง";
    recordBtn.classList.add("recording");
  }
  if (statusEl) statusEl.textContent = "🔴 กำลังอัดเสียง พูดคำศัพท์ให้ชัดเจน...";
}

async function submitRecordingForScoring(blob) {
  const words =
    typeof VOCABULARY !== "undefined" && VOCABULARY[state.hsk]
      ? VOCABULARY[state.hsk]
      : [];
  const targetWord = words[listenIndex];
  const statusEl = document.getElementById("record-status");
  if (!targetWord) return;

  if (statusEl) statusEl.textContent = "⏳ กำลังส่งเสียงให้ AI วิเคราะห์...";

  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  formData.append("zh", targetWord.zh);
  formData.append("py", targetWord.py);
  formData.append("th", targetWord.th);

  try {
    const res = await fetch(`${PRONUNCIATION_API_BASE}/api/pronunciation-score`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");

    if (statusEl) statusEl.textContent = "";
    renderScoreResult(data);
  } catch (err) {
    if (statusEl)
      statusEl.textContent = `❌ ${err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์วิเคราะห์เสียงได้"}`;
  }
}

function renderScoreResult(data) {
  const resultEl = document.getElementById("score-result");
  const numEl = document.getElementById("score-result-num");
  const heardEl = document.getElementById("score-result-heard");
  const feedbackEl = document.getElementById("score-result-feedback");
  if (!resultEl) return;

  resultEl.hidden = false;
  resultEl.classList.remove("score-good", "score-mid", "score-low");
  if (data.score >= 80) resultEl.classList.add("score-good");
  else if (data.score >= 50) resultEl.classList.add("score-mid");
  else resultEl.classList.add("score-low");

  if (numEl) numEl.textContent = `${data.score}`;
  if (heardEl) heardEl.textContent = data.heard ? `AI ได้ยินว่า: ${data.heard}` : "";
  if (feedbackEl) feedbackEl.textContent = data.feedback || "";
}

document.getElementById("record-btn")?.addEventListener("click", toggleRecording);

// รันแอปพลิเคชันระบบเริ่มต้นตอนเปิดหน้าแรก
initGroupSetup();
showScreen("hsk");
