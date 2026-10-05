const $ = (id) => document.getElementById(id);
const QUESTION_TIME = 20;

let username = "Misafir", category = null, quiz = [], current = 0;
let answers = {}, timer = null, timeLeft = QUESTION_TIME;

function show(name) {
  for (const s of ["home", "quiz", "result"])
    $("screen-" + s).classList.toggle("hidden", s !== name);
}

async function startQuiz() {
  username = $("username").value.trim() || "Misafir";
  category = $("category").value || null;
  const params = new URLSearchParams({ count: 10 });
  if (category) params.set("category", category);

  quiz = await fetch(`/api/game/start?${params}`).then(r => r.json());
  if (!Array.isArray(quiz) || quiz.length === 0) return alert("Soru bulunamadı!");

  current = 0; answers = {};
  show("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = quiz[current];
  const letters = ["A", "B", "C", "D"];
  $("progress").textContent = `Soru ${current + 1} / ${quiz.length}`;
  $("question").textContent = q.question;
  $("options").innerHTML = q.options.map((opt, i) =>
    `<button class="option" onclick="choose(${i})"><b>${letters[i]}</b> ${opt}</button>`
  ).join("");

  timeLeft = QUESTION_TIME;
  $("time").textContent = timeLeft;
  $("time").classList.remove("low");
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

function choose(i) {
  answers[quiz[current].id] = i;
  next();
}

function tick() {
  timeLeft--;
  $("time").textContent = Math.max(timeLeft, 0);
  if (timeLeft <= 5) $("time").classList.add("low");
  if (timeLeft <= 0) next(); // süre bitti → cevapsız geçilir
}

function next() {
  clearInterval(timer);
  if (++current < quiz.length) renderQuestion();
  else finish();
}

async function finish() {
  show("result");
  $("result-title").textContent = "Hesaplanıyor... ⏳";

  const res = await fetch("/api/game/submit", {...})
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, category, answers }),
  });
  const data = await res.json();
  const pct = Math.round((data.correct / quiz.length) * 100);

  $("result-title").textContent = `${data.score} puan — ${data.correct}/${quiz.length} doğru`;
  $("result-detail").textContent =
    pct === 100 ? "Mükemmel! 🏆" : pct >= 60 ? "Gayet iyi! 👏" : "Bir dahaki sefere 💪";

  $("review").innerHTML = data.review.map(r => `
    <div class="review-item ${r.isCorrect ? "ok" : "no"}">
      <p>${r.question}</p>
      <small>Doğru cevap: <b>${r.options[r.correctIndex]}</b>${
        r.isCorrect ? " ✅" : ` — senin cevabın: ${r.options[r.chosen]} ❌`
      }</small>
    </div>`).join("");

  loadLeaderboard();
}

async function loadLeaderboard() {
  const board = await fetch("/api/game/leaderboard").then(r => r.json());
  $("leaderboard").innerHTML = board.map((s, i) =>
    `<li><span>${["🥇", "🥈", "🥉"][i] || (i + 1) + "."}</span> <b>${s.username}</b> <span>${s.score} puan</span></li>`
  ).join("");
}

async function init() {
  const cats = await fetch("/api/game/categories").then(r => r.json());
  $("category").innerHTML =
    `<option value="">🎲 Karışık</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join("");
  loadLeaderboard();
}

init();
