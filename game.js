/* =========================================================
   BACKGROUND FLOATING PARTICLES (NON-BLOCKING)
========================================================= */
const bg = document.getElementById("bgParticles");
const bctx = bg.getContext("2d");

let bw, bh;
function resizeBG() {
    bw = bg.width = window.innerWidth;
    bh = bg.height = window.innerHeight;
}
window.addEventListener("resize", resizeBG);
resizeBG();

const bgParticles = Array.from({ length: 80 }, () => ({
    x: Math.random() * bw,
    y: Math.random() * bh,
    r: Math.random() * 3 + 1,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    color: `hsl(${Math.random() * 360},80%,60%)`
}));

function drawBGParticles() {
    bctx.clearRect(0, 0, bw, bh);
    for (let p of bgParticles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = bw;
        if (p.x > bw) p.x = 0;
        if (p.y < 0) p.y = bh;
        if (p.y > bh) p.y = 0;

        bctx.globalAlpha = 0.4;
        bctx.fillStyle = p.color;
        bctx.beginPath();
        bctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bctx.fill();
    }
    requestAnimationFrame(drawBGParticles);
}
drawBGParticles();

/* =========================================================
   PROCEDURAL SOUND SYSTEM (NO FILES)
========================================================= */
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case "catch":
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start();
            osc.stop(now + 0.15);
            break;

        case "bad":
            osc.type = "square";
            osc.frequency.setValueAtTime(180, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
            break;

        case "slow":
            osc.type = "triangle";
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.5);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
            break;

        case "gameover":
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            osc.start();
            osc.stop(now + 0.8);
            break;
    }
}

/* =========================================================
   GAME SETUP
========================================================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreVal");
const livesEl = document.getElementById("livesVal");
const finalScoreEl = document.getElementById("finalScore");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const statusText = document.getElementById("status-text");

let width, height;
let gameState = "START";
let score = 0;
let lives = 3;
let frames = 0;
let slowMoTimer = 0;
let speedMultiplier = 1;

let pens = [];
let collectedPens = [];

let holder = {
    x: 0,
    y: 0,
    width: 80,
    height: 90,
    targetX: 0
};

/* =========================================================
   RESIZE
========================================================= */
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    holder.x = width / 2 - holder.width / 2;
    holder.y = height - holder.height - 170;
    holder.targetX = holder.x;
}
window.addEventListener("resize", resize);
resize();

/* =========================================================
   INPUT
========================================================= */
function handleInput(clientX) {
    if (gameState !== "PLAYING") return;
    const rect = canvas.getBoundingClientRect();
    holder.targetX = Math.max(
        0,
        Math.min(width - holder.width, clientX - rect.left - holder.width / 2)
    );
}
canvas.addEventListener("mousemove", e => handleInput(e.clientX));
canvas.addEventListener("touchstart", e => handleInput(e.touches[0].clientX));
canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    handleInput(e.touches[0].clientX);
}, { passive: false });

/* =========================================================
   PEN COLORS
========================================================= */
function getPenColors(type) {
    return {
        blue: { body:"#0047AB", cap:"#002C6A", shine:null },
        red: { body:"#D32F2F", cap:"#9A0007", shine:null },
        silver: { body:"#C0C0C0", cap:"#808080", shine:"#E8E8E8" },
        gold: { body:"#DAA520", cap:"#B8860B", shine:"#FFD700" },
        green: { body:"#00C853", cap:"#00695C", shine:"#69F0AE" }
    }[type];
}

/* =========================================================
   PEN CLASS
========================================================= */
class Pen {
    constructor() {
        this.width = 12;
        this.height = 50;
        this.x = Math.random() * (width - this.width);
        this.y = -60;

        const r = Math.random();
        this.type =
            r < 0.5 ? "blue" :
            r < 0.8 ? "red" :
            r < 0.88 ? "silver" :
            r < 0.95 ? "green" : "gold";

        this.speed = 4 + Math.random() * 3;
        this.angle = 0;
        this.rotation = (Math.random() - 0.5) * 0.2;
    }

    update(scale) {
        this.y += this.speed * speedMultiplier * scale;
        this.angle += this.rotation * scale;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);
        const c = getPenColors(this.type);
        ctx.fillStyle = c.body;
        ctx.fillRect(-6, -25, 12, 50);
        if (c.shine) {
            ctx.fillStyle = c.shine;
            ctx.fillRect(-3, -25, 4, 50);
        }
        ctx.fillStyle = c.cap;
        ctx.fillRect(-6, -25, 12, 18);
        ctx.restore();
    }
}

/* =========================================================
   HOLDER (ORIGINAL STYLE)
========================================================= */
function drawHolder() {
    holder.x += (holder.targetX - holder.x) * 0.25;
    const {x,y,width:w,height:h} = holder;

    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x+w/2, y+h+40, w/2, 10, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = "rgba(40,40,40,0.6)";
    ctx.beginPath();
    ctx.ellipse(x+w/2, y+h, w/2-5, 12, 0, 0, Math.PI*2);
    ctx.fill();

    collectedPens.slice(-30).forEach(p => {
        const c = getPenColors(p.type);
        ctx.fillStyle = c.body;
        ctx.fillRect(x+p.offsetX, y+h-55, 10, 45);
        ctx.fillStyle = c.cap;
        ctx.fillRect(x+p.offsetX, y+h-55, 10, 15);
    });

    const grad = ctx.createLinearGradient(x, y, x+w, y);
    grad.addColorStop(0,"rgba(100,100,100,0.8)");
    grad.addColorStop(0.5,"rgba(150,150,150,0.5)");
    grad.addColorStop(1,"rgba(100,100,100,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "rgba(50,50,50,0.7)";
    ctx.lineWidth = 2;
    for (let i=5;i<w;i+=12) {
        ctx.beginPath();
        ctx.moveTo(x+i,y);
        ctx.lineTo(x+i,y+h);
        ctx.stroke();
    }

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#222";
    ctx.beginPath();
    ctx.ellipse(x+w/2,y,w/2,12,0,0,Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x+w/2,y+h,w/2,12,0,0,Math.PI*2);
    ctx.stroke();

    ctx.restore();
}

/* =========================================================
   GAME CONTROL
========================================================= */
function startGame() {
    initAudio(); // 🔊 unlock audio

    score = 0;
    lives = 3;
    frames = 0;
    slowMoTimer = 0;
    pens = [];
    collectedPens = [];

    scoreEl.textContent = score;
    livesEl.textContent = lives;

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    gameState = "PLAYING";
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = "GAMEOVER";
    playSound("gameover");
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove("hidden");
}

/* =========================================================
   GAME LOOP
========================================================= */
function gameLoop() {
    if (gameState !== "PLAYING") return;

    ctx.clearRect(0,0,width,height);

    let scale = slowMoTimer > 0 ? 0.4 : 1;
    if (slowMoTimer-- > 0) {
        canvas.classList.add("slow-mo-bg");
        statusText.style.opacity = 1;
    } else {
        canvas.classList.remove("slow-mo-bg");
        statusText.style.opacity = 0;
    }

    frames++;
    speedMultiplier = 1 + score / 80;

    if (frames % Math.max(15, 55 - Math.floor(score/2)) === 0) {
        pens.push(new Pen());
    }

    drawHolder();

    for (let i = pens.length - 1; i >= 0; i--) {
        const p = pens[i];
        p.update(scale);
        p.draw();

        if (
            p.x + p.width > holder.x + 5 &&
            p.x < holder.x + holder.width - 5 &&
            p.y + p.height > holder.y &&
            p.y < holder.y + holder.height
        ) {
            if (p.type === "red") {
                playSound("bad");
                lives--;
                livesEl.textContent = lives;
                if (lives <= 0) gameOver();
            } else {
                playSound("catch");

                if (p.type === "silver") score += 5;
                else if (p.type === "green") {
                    score += 2;
                    slowMoTimer = 300;
                    playSound("slow");
                } else score++;

                if (p.type === "gold") lives++;

                scoreEl.textContent = score;
                livesEl.textContent = lives;

                collectedPens.push({
                    type: p.type,
                    offsetX: Math.min(holder.width-15, Math.max(5, p.x-holder.x))
                });
            }
            pens.splice(i,1);
        } else if (p.y > height) {
            pens.splice(i,1);
        }
    }

    requestAnimationFrame(gameLoop);
}
function resetGame() {
    startGame();
}
