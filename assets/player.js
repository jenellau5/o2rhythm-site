(function () {
    const page = document.querySelector("[data-protocol]");
    if (!page) return; // index.html won't have protocol UI

    const startBtn = document.getElementById("startBtn");
    const timerEl = document.getElementById("timer");
    const audio = document.getElementById("audio");
    const ring = document.querySelector(".ring-progress");

    const duration = Number(page.dataset.duration || 60); // seconds
    const audioFile = page.dataset.audio || "";
    const title = page.dataset.title || "Protocol";

    // Apply title + audio
    document.title = `O₂ Rhythm — ${title}`;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = title;

    if (!audioFile) {
        startBtn.disabled = true;
        timerEl.textContent = "Audio not set";
        return;
    }
    audio.src = audioFile;

    // Ring math (r=100 => circumference ~ 628)
    const r = 100;
    const circumference = 2 * Math.PI * r;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;

    let interval = null;
    let timeLeft = duration;

    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, "0");
        return `${m}:${ss}`;
    };

    function setProgress(secondsRemaining) {
        const elapsed = duration - secondsRemaining;
        const ratio = Math.min(1, Math.max(0, elapsed / duration));
        const offset = circumference - ratio * circumference;
        ring.style.strokeDashoffset = offset;
    }

    function resetUI() {
        clearInterval(interval);
        interval = null;
        timeLeft = duration;
        ring.style.strokeDashoffset = circumference;
        timerEl.textContent = fmt(duration);
        startBtn.disabled = false;
        startBtn.textContent = "START";
    }

    async function start() {
        startBtn.disabled = true;

        // iOS/Android require a user gesture. This click counts.
        try {
            audio.currentTime = 0;
            await audio.play();
        } catch (e) {
            // If audio fails (muted switch, permissions, etc.), re-enable button.
            startBtn.disabled = false;
            startBtn.textContent = "START";
            timerEl.textContent = "Tap again";
            return;
        }

        startBtn.textContent = "RUNNING";
        timeLeft = duration;
        timerEl.textContent = fmt(timeLeft);
        setProgress(timeLeft);

        interval = setInterval(() => {
            timeLeft -= 1;
            timerEl.textContent = fmt(Math.max(0, timeLeft));
            setProgress(timeLeft);

            if (timeLeft <= 0) {
                clearInterval(interval);
                interval = null;
                startBtn.textContent = "DONE";
                // Give a beat then reset
                setTimeout(resetUI, 900);
            }
        }, 1000);
    }

    // If audio ends early, reset
    audio.addEventListener("ended", resetUI);

    startBtn.addEventListener("click", start);

    // Init timer display
    timerEl.textContent = fmt(duration);
})();
