/**
 * DOGGYCO MISSION – Original BGM (Web Audio, keine MP3)
 * Fokus: Tiefe (Sub/Bass) + Höhen (Sparkle), sparsame Melodie
 * Akkorde: Dm → Bb → F → C
 */
(function (global) {
    "use strict";

    var BPM = 108;
    var LOOKAHEAD = 0.16;
    var TICK_MS = 22;
    var LOOP_STEPS = 32;
    var MASTER_GAIN = 1.44;
    var RATE_MAX = 1.1;

    var CHORDS = [
        [50, 53, 57],
        [46, 50, 53],
        [41, 45, 48],
        [48, 52, 55]
    ];
    var BASS = [38, 34, 29, 36];

    /** Sparsame Melodie (-1 = Pause) */
    var LEAD_DEG = [
        0, -1, -1, 5, -1, -1, 3, -1,
        0, -1, -1, 5, -1, -1, 0, -1,
        0, -1, -1, 7, -1, -1, 5, -1,
        -1, -1, 3, -1, -1, -1, 0, -1
    ];
    /** Hohe Sparkle-Linie */
    var HIGH_DEG = [
        12, 10, 12, 15, 12, 10, 14, 12,
        12, 10, 15, 12, 14, 12, 10, 12,
        12, 15, 17, 15, 12, 15, 12, 10,
        10, 12, 10, 7, 5, 7, 10, 12
    ];
    var LOW_PULSE = [0, 5, 3, 5, 0, 3, 5, 3];

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

    function toneMidi(bar, degree) {
        return CHORDS[bar][0] + 24 + degree;
    }

    function highMidi(bar, degree) {
        return CHORDS[bar][0] + 36 + degree;
    }

    function lowMidi(bar, degree) {
        return CHORDS[bar][0] + 12 + degree;
    }

    function scheduleMelody(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var freq = noteFreq(midi);
        var oscA = ctx.createOscillator();
        var oscB = ctx.createOscillator();
        var filt = ctx.createBiquadFilter();
        var g = ctx.createGain();
        oscA.type = "triangle";
        oscB.type = "sine";
        oscA.frequency.setValueAtTime(freq, time);
        oscB.frequency.setValueAtTime(freq * 1.004, time);
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(3200, time);
        filt.frequency.exponentialRampToValueAtTime(1400, time + dur * 0.8);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        oscA.connect(filt);
        oscB.connect(filt);
        filt.connect(g);
        g.connect(engine.bus);
        oscA.start(time);
        oscB.start(time);
        oscA.stop(time + dur + 0.08);
        oscB.stop(time + dur + 0.08);
    }

    function scheduleHigh(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var hp = ctx.createBiquadFilter();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        hp.type = "highpass";
        hp.frequency.value = 5200;
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.05);
    }

    function scheduleLow(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var lp = ctx.createBiquadFilter();
        var g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        lp.type = "lowpass";
        lp.frequency.value = 420;
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(lp);
        lp.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.06);
    }

    function scheduleSub(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(vol, time + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.1);
    }

    function scheduleKick(time) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(90, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.34, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.22);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.032));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        var hp = ctx.createBiquadFilter();
        src.buffer = buf;
        hp.type = "highpass";
        hp.frequency.value = 9000;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.032);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.036);
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
            var highDeg = HIGH_DEG[step];
            var lowDeg = LOW_PULSE[step % 8];

            if (step % 8 === 0) scheduleKick(t);
            if (step % 2 === 1) scheduleHat(t, 0.042);
            else if (step % 4 === 0) scheduleHat(t, 0.028);

            if (step % 8 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 3.6, 0.14);
                scheduleSub(t, BASS[bar] - 12, stepLen * 3.2, 0.09);
            }

            if (step % 4 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 1.8, 0.1);
            }

            if (step % 2 === 0) {
                scheduleLow(t, lowMidi(bar, lowDeg), stepLen * 0.7, 0.075);
            }

            if (step % 2 === 0) {
                var arpLo = [0, 3, 5][step % 3];
                scheduleLow(t, lowMidi(bar, arpLo), stepLen * 0.5, 0.055);
            }

            scheduleHigh(t, highMidi(bar, highDeg), stepLen * 0.65, 0.058);
            if (step % 2 === 0) {
                scheduleHigh(t + stepLen * 0.5, highMidi(bar, highDeg + 2), stepLen * 0.45, 0.04);
            }

            if (leadDeg >= 0) {
                scheduleMelody(t, toneMidi(bar, leadDeg), stepLen * 1.2, 0.048);
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
        engine.comp.attack.setValueAtTime(0.003, ctx.currentTime);
        engine.comp.release.setValueAtTime(0.11, ctx.currentTime);
        engine.bus.connect(engine.comp);
        engine.comp.connect(destNode);
    }

    function start() {
        if (!engine.ctx || !engine.bus) return;
        if (engine.playing) return;
        engine.playing = true;
        engine.step = 0;
        engine.nextTick = engine.ctx.currentTime + 0.05;
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
        engine.rateMul = Math.max(0.82, Math.min(RATE_MAX, r || 1));
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
