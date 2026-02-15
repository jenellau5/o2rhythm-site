/* protocol.js — Rhythm O₂ (TACTICAL)
   - Timing + phases from data-*
   - Sound cues: ON/OFF (sessionStorage)
   - GA4 events: start/complete/toggle/abandon (optional if gtag exists)
*/
(function () {
    const page = document.querySelector("[data-protocol]");
    if (!page) return;

    // --- Required elements ---
    const startBtn = document.getElementById("startBtn");
    const timerEl = document.getElementById("timer");
    const pacerEl = document.getElementById("pacer");
    const progressCircle = document.querySelector(".progress");
    const phaseLabelEl = document.getElementById("phaseLabel");
    const dotsEl = document.getElementById("dots");
    const countEl = document.getElementById("count");

    // --- Optional element (sound toggle) ---
    const soundToggleBtn = document.getElementById("soundToggle");

    if (!startBtn || !timerEl || !pacerEl || !progressCircle || !phaseLabelEl || !dotsEl || !countEl) return;

    // --- Config from data-* ---
    const total = Number(page.dataset.total || 60);

    const inhale = Number(page.dataset.inhale || 4);
    const hold1 = Number(page.dataset.hold1 || 0);
    const exhale = Number(page.dataset.exhale || 6);
    const hold2 = Number(page.dataset.hold2 || 0);

    // Optional two-stage pacing
    const pacedSeconds = page.dataset.paced ? Number(page.dataset.paced) : null;
    const settleSeconds = page.dataset.settle ? Number(page.dataset.settle) : null;

    const protocolTitle = page.dataset.title || "Protocol";
    document.title = `O₂ Rhythm — ${protocolTitle}`;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = protocolTitle;

    // --- Identity for analytics (optional but recommended) ---
    const agency = page.dataset.agency || "unknown";
    const environment = page.dataset.environment || "unknown";
    const protocolId = page.dataset.protocolId || "unknown";

    function ga(eventName, params = {}) {
        if (typeof window.gtag !== "function") return;
        window.gtag("event", eventName, {
            agency,
            environment,
            protocol: protocolId,
            protocol_title: protocolTitle,
            page_path: location.pathname,
            ...params
        });
    }

    // --- Ring math (r=100 => circumference ~ 628) ---
    const r = 100;
    const circumference = 2 * Math.PI * r;
    progressCircle.style.strokeDasharray = String(circumference);
    progressCircle.style.strokeDashoffset = String(circumference);

    // --- State ---
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

    // --- SOUND: ON/OFF (session remembered) ---
    const SS_SOUND = "o2_sound_enabled";
    let soundEnabled = sessionStorage.getItem(SS_SOUND) === "1";

    let audioCtx = null;
    function ensureAudioContext() {
        if (audioCtx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
    }

    function setSoundUI() {
        if (!soundToggleBtn) return;
        soundToggleBtn.textContent = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
        soundToggleBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
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

        // Soft envelope (dispatch-safe)
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.12, durationSec));

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + Math.max(0.12, durationSec));
    }

    if (soundToggleBtn) {
        setSoundUI();
        soundToggleBtn.addEventListener("click", () => {
            soundEnabled = !soundEnabled;
            sessionStorage.setItem(SS_SOUND, soundEnabled ? "1" : "0");
            if (soundEnabled) ensureAudioContext();
            setSoundUI();
            ga("protocol_toggle", { toggle: "sound", enabled: soundEnabled ? 1 : 0 });
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
        pacerEl.style.transition = "transform 200ms ease";
        pacerEl.style.transform = "scale(1)";
    }

    function endSession() {
        ga("protocol_complete", { total_seconds: total });

        clearAll();
        running = false;

        startBtn.textContent = "DONE";
        setPhaseLabel("");
        dotsEl.innerHTML = "";
        countEl.textContent = "";

        pacerEl.style.transition = "transform 200ms ease";
        pacerEl.style.transform = "scale(1)";

        setTimeout(resetUI, 900);
    }

    // Track bail-outs (close tab / navigate away mid-run)
    window.addEventListener("visibilitychange", () => {
        if (!running) return;
        if (document.visibilityState === "hidden") {
            ga("protocol_abandon", { seconds_remaining: timeLeft });
        }
    });

    // --- Phase runner ---
    function runPhase(label, seconds, pacerMode) {
        return new Promise((resolve) => {
            if (!running) return resolve();
            if (seconds <= 0) return resolve();

            setPhaseLabel(label);
            buildDots(seconds);

            if (pacerMode === "expand") setPacerScale(1.18, seconds * 1000);
            if (pacerMode === "contract") setPacerScale(0.92, seconds * 1000);
            if (pacerMode === "hold") setPacerScale(1.05, 120);

            // Sound cues (simple)
            if (label === "INHALE") playTone(440, Math.max(0.18, seconds * 0.85));
            if (label === "EXHALE") playTone(220, Math.max(0.18, seconds * 0.85));

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

        setPhaseLabel("STEADY"); // more operational than BREATHE
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

        ga("protocol_start", { total_seconds: total });

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
    setSoundUI();
})();
