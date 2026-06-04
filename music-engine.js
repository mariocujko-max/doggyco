/**
 * DOGGYCO MISSION – Arcade-Hook (Am → F → C → G)
 * Echte 8-Takt-Phrase, keine Zufallstöne. Nahtlose Schleife.
 */
(function (global) {
    "use strict";

    var BPM = 118;
    var LOOKAHEAD = 0.14;
    var TICK_MS = 24;
    var LOOP_STEPS = 32;
    var MASTER_GAIN = 1.32;
    var RATE_MAX = 1.22;

    /** Akkorde: Am, F, C, G */
    var CHORDS = [
        [57, 60, 64],
        [53, 57, 60],
        [48, 52, 55],
        [55, 59, 62]
    ];
    var BASS = [45, 41, 36, 43];

    /**
     * Hauptmelodie – durchkomponiert, nur Akkordtöne (Grad zur Tonika je Takt)
     * Takt 1–2: Am | 3–4: F | 5–6: C | 7–8: G → Auflösung
     */
    var LEAD_DEG = [
        0, 3, 5, 7, 5, 3, 0, -1,
        0, 3, 5, 3, 2, 0, -1, -1,
        0, 3, 5, 7, 5, 3, 0, -1,
        2, 0, -1, -1, 0, 3, 0, -1
    ];
    /** Leise Begleitung – Terzen zur Melodie */
    var HARM_DEG = [
        -1, -1, 3, -1, -1, 0, -1, -1,
        -1, -1, 2, -1, -1, -1, -1, -1,
        -1, -1, 3, -1, -1, 0, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1
    ];
    /** Hohe Verzierung nur an Phrasenenden */
    var HIGH_DEG = [
        -1, -1, -1, -1, -1, -1, 7, -1,
        -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, 7, -1,
        -1, -1, -1, -1, -1, -1, 10, -1
    ];

    var engine = {
        ctx: null,
        bus: null,
        comp: null,
        playing: false,
        rateMul: 1,
        timer: null,
        nextTick: 0,
        step: 0
    };

    function noteFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function melodyMidi(bar, degree) {
        return CHORDS[bar][0] + 24 + degree;
    }

    function scheduleTone(time, freq, dur, type, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type || "triangle";
        osc.frequency.setValueAtTime(freq, time);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.06);
    }

    function scheduleMelody(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var freq = noteFreq(midi);
        var oscA = ctx.createOscillator();
        var oscB = ctx.createOscillator();
        var g = ctx.createGain();
        oscA.type = "triangle";
        oscB.type = "sine";
        oscA.frequency.setValueAtTime(freq, time);
        oscB.frequency.setValueAtTime(freq * 1.003, time);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.022);
        g.gain.setValueAtTime(v * 0.82, time + dur * 0.55);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        oscA.connect(g);
        oscB.connect(g);
        g.connect(engine.bus);
        oscA.start(time);
        oscB.start(time);
        oscA.stop(time + dur + 0.08);
        oscB.stop(time + dur + 0.08);
    }

    function scheduleKick(time) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(52, time + 0.1);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.26, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.03));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.7;
        }
        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        var hp = ctx.createBiquadFilter();
        src.buffer = buf;
        hp.type = "highpass";
        hp.frequency.value = 6000;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.035);
    }

    function schedulePad(time, chord, dur, vol) {
        chord.forEach(function (n) {
            scheduleTone(time, noteFreq(n + 12), dur, "sine", vol);
        });
    }

    /** Arpeggio nur Akkord: Grund–Terz–Quinte */
    function scheduleChordArp(time, bar, stepLen) {
        var chord = CHORDS[bar];
        scheduleTone(time, noteFreq(chord[0] + 12), stepLen * 0.45, "triangle", 0.032);
        scheduleTone(time + stepLen * 0.5, noteFreq(chord[1] + 12), stepLen * 0.4, "triangle", 0.028);
        scheduleTone(time + stepLen, noteFreq(chord[2] + 12), stepLen * 0.4, "triangle", 0.026);
    }

    function schedulerTick() {
        if (!engine.playing || !engine.ctx) return;
        var spb = 60 / (BPM * engine.rateMul);
        var stepLen = spb / 2;
        var now = engine.ctx.currentTime;

        while (engine.nextTick < now + LOOKAHEAD) {
            var step = engine.step % LOOP_STEPS;
            var bar = Math.floor(step / 8) % 4;
            var t = engine.nextTick;
            var chord = CHORDS[bar];
            var leadDeg = LEAD_DEG[step];
            var harmDeg = HARM_DEG[step];
            var highDeg = HIGH_DEG[step];

            if (step % 8 === 0) scheduleKick(t);
            if (step % 4 === 0) scheduleHat(t, 0.034);

            if (step % 8 === 0) {
                scheduleTone(t, noteFreq(BASS[bar]), stepLen * 3.2, "triangle", 0.088);
                schedulePad(t, chord, spb * 3.9, 0.014);
            }

            if (step % 8 === 0) {
                scheduleChordArp(t + stepLen * 2, bar, stepLen);
            }

            if (leadDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, leadDeg), stepLen * 1.15, 0.058);
            }

            if (harmDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, harmDeg), stepLen * 0.95, 0.03);
            }

            if (highDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, highDeg), stepLen * 0.7, 0.028);
            }

            if (step === LOOP_STEPS - 1) {
                scheduleMelody(t + stepLen * 0.5, melodyMidi(0, 0), stepLen * 1.6, 0.05);
            }

            engine.step++;
            engine.nextTick += stepLen;
        }
    }

    function init(ctx, destNode) {
        if (!ctx || !destNode) return;
        engine.ctx = ctx;
        if (engine.bus) return;
        engine.bus = ctx.createGain();
        engine.bus.gain.value = MASTER_GAIN;
        engine.comp = ctx.createDynamicsCompressor();
        engine.comp.threshold.setValueAtTime(-20, ctx.currentTime);
        engine.comp.knee.setValueAtTime(12, ctx.currentTime);
        engine.comp.ratio.setValueAtTime(3.2, ctx.currentTime);
        engine.comp.attack.setValueAtTime(0.004, ctx.currentTime);
        engine.comp.release.setValueAtTime(0.12, ctx.currentTime);
        engine.bus.connect(engine.comp);
        engine.comp.connect(destNode);
    }

    function start() {
        if (!engine.ctx || !engine.bus) return;
        if (engine.playing) return;
        engine.playing = true;
        engine.step = 0;
        engine.nextTick = engine.ctx.currentTime + 0.06;
        if (engine.timer) clearInterval(engine.timer);
        engine.timer = setInterval(schedulerTick, TICK_MS);
        schedulerTick();
        try {
            if (engine.ctx.state === "suspended") engine.ctx.resume();
        } catch (e) {}
    }

    function stop() {
        engine.playing = false;
        if (engine.timer) {
            clearInterval(engine.timer);
            engine.timer = null;
        }
    }

    function setRate(r) {
        engine.rateMul = Math.max(0.88, Math.min(RATE_MAX, r || 1));
    }

    function isPlaying() {
        return engine.playing;
    }

    global.DoggyCoMusic = {
        init: init,
        start: start,
        stop: stop,
        setRate: setRate,
        isPlaying: isPlaying
    };
})(typeof window !== "undefined" ? window : this);
