(function () {
    const page = document.querySelector("[data-protocol]");
    if (!page) return;

    const startBtn = document.getElementById("startBtn");
    const timerEl = document.getElementById("timer");
    const pacerEl = document.getElementById("pacer");
    const progressCircle = document.querySelector(".progress");

    const phaseLabelEl = document.getElementById("phaseLabel");
    const dotsEl = document.getElementById("dots");
    const countEl = document.getElementById("count");

    // Total session seconds
    const total = Number(page.dataset.total || 60);

    // Phase seconds
    const inhale = Number(page.dataset.inhale || 4);
    const hold1 = Number(page.dataset.hold1 || 0);
    const exhale = Number(page.dataset.exhale || 6);
    const hold2 = Number(page.dataset.hold2 || 0);

    // Optional: Energize-style two-stage pacing
    // paced = seconds of breathing loop; settle = seconds of normal breathing (no pacing)
    const pacedSeconds = page.dataset.paced ? Number(page.dataset.paced) : null;
    const settleSeconds = page.dataset.settle ? Number(page.dataset.settle) : null;

    const title = page.dataset.title || "Protocol";
    document.title = `O₂ Rhythm — ${title}`;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = title;

    // Ring math (r=100 => circumference ~ 628)
    const r = 100;
    const circumference = 2 * Math.PI * r;
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = circumference;

    let sessionInterval = null;
    let phaseInterval = null;
    let timeLeft = total;
    let running = false;

    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, "0");
        return `${m}:${ss}`;
    };

    function setOverallProgress(secondsRemaining) {
        const elapsed = total - secondsRemaining;
        const ratio = Math.min(1, Math.max(0, elapsed / total));
        const offset = circumference - ratio * circumference;
        progressCircle.style.strokeDashoffset = offset;
    }

    function setPacerScale(scale, ms) {
        pacerEl.style.transition = `transform ${ms}ms linear`;
        pacerEl.style.transform = `scale(${scale})`;
    }

    function setPhaseLabel(text) {
        phaseLabelEl.textContent = text;
    }

    function buildDots(n) {
        dotsEl.innerHTML = "";
        for (let i = 0; i < n; i++) {
            const d = document.createElement("div");
            d.className = "dot";
            dotsEl.appendChild(d);
        }
    }

    function fillDot(i) {
        const dots = dotsEl.querySelectorAll(".dot");
        if (dots[i]) dots[i].classList.add("filled");
    }

    function clearAll() {
        clearInterval(sessionInterval);
        sessionInterval = null;
        clearInterval(phaseInterval);
        phaseInterval = null;
    }

    function resetUI() {
        clearAll();
        running = false;
        timeLeft = total;

        startBtn.disabled = false;
        startBtn.textContent = "START";

        timerEl.textContent = fmt(total);
        setPhaseLabel("");
        dotsEl.innerHTML = "";
        countEl.textContent = "";

        progressCircle.style.strokeDashoffset = circumference;
        pacerEl.style.transition = "transform 250ms ease";
        pacerEl.style.transform = "scale(1)";
    }

    function endSession() {
        clearAll();
        running = false;

        startBtn.textContent = "DONE";
        setPhaseLabel("");
        dotsEl.innerHTML = "";
        countEl.textContent = "";

        pacerEl.style.transition = "transform 250ms ease";
        pacerEl.style.transform = "scale(1)";
        setTimeout(resetUI, 900);
    }

    function runPhase(label, seconds, pacerMode) {
        return new Promise((resolve) => {
            if (!running) return resolve();
            if (seconds <= 0) return resolve();

            setPhaseLabel(label);
            buildDots(seconds);

            if (pacerMode === "expand") setPacerScale(1.18, seconds * 1000);
            if (pacerMode === "contract") setPacerScale(0.92, seconds * 1000);
            if (pacerMode === "hold") setPacerScale(1.05, 150);

            let t = 0;
            countEl.textContent = "1";
            fillDot(0);

            phaseInterval = setInterval(() => {
                t += 1;
                if (t >= seconds) {
                    clearInterval(phaseInterval);
                    phaseInterval = null;
                    return resolve();
                }
                countEl.textContent = String(t + 1);
                fillDot(t);
            }, 1000);
        });
    }

    async function runBreathLoop(loopSecondsLimit) {
        // Keep running phase sequence until time is up OR loopSecondsLimit reached (energize)
        const cycleLen = inhale + hold1 + exhale + hold2;
        let remainingLoop = loopSecondsLimit ?? Infinity;

        while (running && timeLeft > 0 && remainingLoop > 0) {
            // If we’re in a limited loop, don’t start a cycle we can’t finish cleanly
            if (remainingLoop !== Infinity && cycleLen > remainingLoop) break;

            await runPhase("INHALE", inhale, "expand");
            if (!running || timeLeft <= 0) break;
            if (remainingLoop !== Infinity) remainingLoop -= inhale;

            await runPhase("HOLD", hold1, "hold");
            if (!running || timeLeft <= 0) break;
            if (remainingLoop !== Infinity) remainingLoop -= hold1;

            await runPhase("EXHALE", exhale, "contract");
            if (!running || timeLeft <= 0) break;
            if (remainingLoop !== Infinity) remainingLoop -= exhale;

            await runPhase("HOLD", hold2, "hold");
            if (!running || timeLeft <= 0) break;
            if (remainingLoop !== Infinity) remainingLoop -= hold2;
        }
    }

    async function runSettle(seconds) {
        if (!running || seconds <= 0) return;
        setPhaseLabel("BREATHE");
        buildDots(seconds);
        setPacerScale(1.0, 200);

        let t = 0;
        countEl.textContent = "1";
        fillDot(0);

        phaseInterval = setInterval(() => {
            t += 1;
            if (t >= seconds) {
                clearInterval(phaseInterval);
                phaseInterval = null;
                dotsEl.innerHTML = "";
                countEl.textContent = "";
                setPhaseLabel("");
                return;
            }
            countEl.textContent = String(t + 1);
            fillDot(t);
        }, 1000);

        // wait out settle
        await new Promise((res) => setTimeout(res, seconds * 1000));
    }

    async function runSession() {
        if (pacedSeconds != null && settleSeconds != null) {
            // Energize format: paced loop for pacedSeconds, then settle for settleSeconds
            await runBreathLoop(pacedSeconds);
            if (!running || timeLeft <= 0) return;
            await runSettle(settleSeconds);
        } else {
            // Normal: loop until session ends
            await runBreathLoop();
        }
    }

    function start() {
        if (running) return;
        running = true;

        startBtn.disabled = true;
        startBtn.textContent = "RUNNING";

        timeLeft = total;
        timerEl.textContent = fmt(timeLeft);
        setOverallProgress(timeLeft);

        sessionInterval = setInterval(() => {
            timeLeft -= 1;
            timerEl.textContent = fmt(Math.max(0, timeLeft));
            setOverallProgress(Math.max(0, timeLeft));
            if (timeLeft <= 0) endSession();
        }, 1000);

        runSession();
    }

    startBtn.addEventListener("click", start);

    // Init
    timerEl.textContent = fmt(total);
})();
