/* protocol.js — Rhythm O₂
   - Single source of truth for timing + phases
   - Optional sound + vibration cues (user-enabled)
   - Remembers sound/vibe toggles for the current session (sessionStorage)
*/
(function () {
    const page = document.querySelector("[data-protocol]");
    if (!page) return;

    // --- Elements (required) ---
    const startBtn = document.getElementById("startBtn");
    const timerEl = document.getElementById("timer");
    const pacerEl = document.getElementById("pacer");
    const progressCircle = document.querySelector(".progress");
    const phaseLabelEl = document.getElementById("phaseLabel");
    const dotsEl = document.getElementById("dots");
    const countEl = document.getElementById("count");

    // --- Elements (optional) ---
    const soundToggleBtn = document.getElementById("soundToggle"); // optional
    const vibeToggleBtn = document.getElementById("vibeToggle");   // optional
    const feedbackLink = document.querySelector(".feedback-link"); // optional (if you want auto protocol naming)

    if (!startBtn || !timerEl || !pacerEl || !progressCircle || !phaseLabelEl || !dotsEl || !countEl) {
        // Missing required elements; fail quietly.
        return;
    }

    // --- Config from data-* ---
    const total = Number(page.dataset.total || 60);

    const inhale = Number(page.dataset.inhale || 4);
    const hold1 = Number(page.dataset.hold1 || 0);
    const exhale = Number(page.dataset.exhale || 6);
    const hold2 = Number(page.dataset.hold2 || 0);

    // Optional energize-style two-stage pacing:
    // paced = seconds of breathing loop; settle = seconds of normal breathing (no pacing)
    const pacedSeconds = page.dataset.paced ? Number(page.dataset.paced) : null;
    const settleSeconds = page.dataset.settle ? Number(page.dataset.settle) : null;

    const protocolTitle = page.dataset.title || "Protocol";
    document.title = `O₂ Rhythm — ${protocolTitle}`;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = protocolTitle;

    // If you’re using feedback.html?protocol=..., this can auto-fill it (optional)
    if (feedbackLink && feedbackLink.getAttribute("href")?.includes("feedback.html")) {
        try {
            const href = new URL(feedbackLink.getAttribute("href"), window.location.href);
            if (!href.searchParams.get("protocol")) {
                href.searchParams.set("protocol", protocolTitle);
                feedbackLink.setAttribute("href", href.toString());
            }
        } catch (_) { }
    }

    // --- Ring math (r=100 => circumference ~ 628) ---
    const r = 100;
    const circumference = 2 * Math.PI * r;
    progressCircle.style.strokeDasharray = String(circumference);
    progressCircle.style.strokeDashoffset = String(circumference);

    // --- Session state ---
    let sessionInterval = null;
    let phaseInterval = null;
    let timeLeft = total;
    let running = false;

    // --- Helpers ---
    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, "0");
        return `${m}:${ss}`;
    };

    function setOverallProgress(secondsRemaining) {
        const elapsed = total - secondsRemaining;
        const ratio = Math.min(1, Math.max(0, elapsed / total));
        const offset = circumference - ratio * circumference;
        progressCircle.style.strokeDashoffset = String(offset);
    }

    function setPacerScale(scale, ms) {
        pacerEl.style.transition = `transform ${ms}ms linear`;
        pacerEl.style.transform = `scale(${scale})`;
    }

    function setPhaseLabel(text) {
        phaseLabelEl.textContent = text || "";
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
        if (sessionInterval) clearInterval(sessionInterval);
        sessionInterval = null;

        if (phaseInterval) clearInterval(phaseInterval);
        phaseInterval = null;
    }

    // --- Optional cues: sound + vibration (session remembered) ---
    const SS_SOUND = "o2_sound_enabled";
    const SS_VIBE = "o2_vibe_enabled";

    let soundEnabled = sessionStorage.getItem(SS_SOUND) === "1";
    let vibeEnabled = sessionStorage.getItem(SS_VIBE) === "1";

    // iOS Safari generally doesn’t support vibration. Android usually does.
    const vibeSupported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

    // Audio context is created only after user interaction (button tap) to satisfy browser policies.
    let audioCtx = null;

    function updateSoundToggleUI() {
        if (!soundToggleBtn) return;
        soundToggleBtn.textContent = soundEnabled ? "🔊 Sound on" : "🔊 Enable sound cues";
        soundToggleBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    }

    function updateVibeToggleUI() {
        if (!vibeToggleBtn) return;
        if (!vibeSupported) {
            vibeToggleBtn.textContent = "📳 Vibration not supported";
            vibeToggleBtn.disabled = true;
            vibeToggleBtn.setAttribute("aria-disabled", "true");
            return;
        }
        vibeToggleBtn.textContent = vibeEnabled ? "📳 Vibration on" : "📳 Enable vibration";
        vibeToggleBtn.setAttribute("aria-pressed", vibeEnabled ? "true" : "false");
    }

    function ensureAudioContext() {
        if (audioCtx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
    }

    function playTone(freq, durationSec) {
        if (!soundEnabled) return;
        ensureAudioContext();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        // Very soft envelope
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.1, durationSec));

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + Math.max(0.1, durationSec));
    }

    function vibrate(pattern) {
        if (!vibeEnabled) return;
        if (!vibeSupported) return;
        try {
            navigator.vibrate(pattern);
        } catch (_) { }
    }

    // Wire toggles (optional buttons)
    if (soundToggleBtn) {
        updateSoundToggleUI();
        soundToggleBtn.addEventListener("click", () => {
            soundEnabled = !soundEnabled;
            sessionStorage.setItem(SS_SOUND, soundEnabled ? "1" : "0");
            updateSoundToggleUI();

            // Creating audio context on the first explicit user gesture helps iOS.
            if (soundEnabled) ensureAudioContext();
        });
    }

    if (vibeToggleBtn) {
        updateVibeToggleUI();
        vibeToggleBtn.addEventListener("click", () => {
            if (!vibeSupported) return;
            vibeEnabled = !vibeEnabled;
            sessionStorage.setItem(SS_VIBE, vibeEnabled ? "1" : "0");
            updateVibeToggleUI();

            // Small confirmation buzz when turned on (Android only)
            if (vibeEnabled) vibrate([40]);
        });
    }

    // --- UI resets ---
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

        progressCircle.style.strokeDashoffset = String(circumference);
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

    // --- Core phase runner ---
    function runPhase(label, seconds, pacerMode) {
        return new Promise((resolve) => {
            if (!running) return resolve();
            if (seconds <= 0) return resolve();

            setPhaseLabel(label);
            buildDots(seconds);

            // Visual pacing
            if (pacerMode === "expand") setPacerScale(1.18, seconds * 1000);
            if (pacerMode === "contract") setPacerScale(0.92, seconds * 1000);
            if (pacerMode === "hold") setPacerScale(1.05, 150);

            // Optional cues at phase start
            // Keep this subtle + dispatch-safe.
            if (label === "INHALE") {
                playTone(440, Math.max(0.2, seconds * 0.9));
                vibrate([30]); // tiny tap
            } else if (label === "EXHALE") {
                playTone(220, Math.max(0.2, seconds * 0.9));
                vibrate([50]); // slightly longer tap
            } else if (label === "HOLD") {
                // Optional: very light cue for hold (usually not necessary)
                // playTone(330, 0.15);
                // vibrate([20]);
            }

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
        const cycleLen = inhale + hold1 + exhale + hold2;
        let remainingLoop = loopSecondsLimit ?? Infinity;

        while (running && timeLeft > 0 && remainingLoop > 0) {
            // If loop is limited, don’t start a cycle we can’t finish
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

        await new Promise((res) => setTimeout(res, seconds * 1000));
    }

    async function runSession() {
        if (pacedSeconds != null && settleSeconds != null) {
            await runBreathLoop(pacedSeconds);
            if (!running || timeLeft <= 0) return;
            await runSettle(settleSeconds);
        } else {
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
    updateSoundToggleUI();
    updateVibeToggleUI();
})();
