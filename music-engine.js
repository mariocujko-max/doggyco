/**
 * DOGGYCO MISSION – Original BGM (Web Audio, keine MP3)
 * Stil: elektronische Level-Musik (pulsierender Bass, Synth-Hook, Neon-Atmosphäre)
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

    /** Mission-Hook – Hauptmelodie */
    var LEAD_DEG = [
        0, 2, 3, 5, 7, 5, 3, 2,
        3, 5, 7, 5, 3, 2, 0, 2,
        0, 2, 3, 5, 7, 8, 7, 5,
        5, 3, 2, 0, 2, 0, 3, 0
    ];
    /** Gegenmelodie (Offbeat) */
    var LEAD2_DEG = [
        5, 3, 2, 0, 3, 2, 0, 3,
        5, 3, 2, 0, 2, 0, 2, 3,
        5, 7, 5, 3, 2, 3, 5, 7,
        2, 0, 3, 2, 0, 3, 2, 0
    ];
    /** Harmonie */
    var HARM_DEG = [
        2, 3, 2, 3, 2, 0, 2, 3,
        2, 3, 2, 0, 2, 0, 2, 3,
        2, 3, 2, 3, 2, 0, 2, 3,
        0, 2, 0, 2, 0, 2, 0, 2
    ];
    /** Hohe Linie (Verzierung) */
    var HIGH_DEG = [
        7, 5, 7, 10, 7, 5, 7, 5,
        7, 5, 7, 10, 8, 7, 5, 7,
        7, 10, 12, 10, 7, 10, 7, 5,
        5, 7, 5, 3, 2, 3, 5, 7
    ];
    var BASS_PULSE = [0, -1, 5, -1, 3, -1, 5, -1];

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
        oscB.frequency.setValueAtTime(freq * 1.005, time);
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(4200, time);
        filt.frequency.exponentialRampToValueAtTime(1600, time + dur * 0.75);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.018);
        g.gain.setValueAtTime(v * 0.85, time + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        oscA.connect(filt);
        oscB.connect(filt);
        filt.connect(g);
        g.connect(engine.bus);
        oscA.start(time);
        oscB.start(time);
        oscA.stop(time + dur + 0.07);
        oscB.stop(time + dur + 0.07);
    }

    function schedulePluck(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var freq = noteFreq(midi);
        var osc = ctx.createOscillator();
        var filt = ctx.createBiquadFilter();
        var g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(2800, time);
        filt.frequency.exponentialRampToValueAtTime(900, time + dur * 0.7);
        filt.Q.value = 0.8;
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(filt);
        filt.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.05);
    }

    function schedulePad(time, chord, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        chord.forEach(function (n, i) {
            var osc = ctx.createOscillator();
            var g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(noteFreq(n + 12), time);
            var v = vol * (i === 0 ? 1 : 0.65);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.exponentialRampToValueAtTime(v, time + 0.08);
            g.gain.setValueAtTime(v * 0.7, time + dur * 0.6);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            osc.connect(g);
            g.connect(engine.bus);
            osc.start(time);
            osc.stop(time + dur + 0.1);
        });
    }

    function scheduleSub(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.08);
    }

    function scheduleKick(time) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(95, time);
        osc.frequency.exponentialRampToValueAtTime(48, time + 0.1);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.3, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.028));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.65;
        }
        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        var hp = ctx.createBiquadFilter();
        src.buffer = buf;
        hp.type = "highpass";
        hp.frequency.value = 7000;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.032);
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
            var lead2Deg = LEAD2_DEG[step];
            var harmDeg = HARM_DEG[step];
            var highDeg = HIGH_DEG[step];
            var bassDeg = BASS_PULSE[step % 8];
            var half = stepLen * 0.5;

            if (step % 8 === 0) scheduleKick(t);
            if (step % 8 === 4) scheduleHat(t, 0.032);

            if (step % 8 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 3.4, 0.11);
                schedulePad(t, chord, spb * 3.85, 0.015);
            }

            if (bassDeg >= 0) {
                schedulePluck(t, toneMidi(bar, bassDeg), stepLen * 0.55, 0.045);
            }

            if (step % 2 === 0) {
                var arp = [0, 3, 5, 7][Math.floor(step / 2) % 4];
                schedulePluck(t, toneMidi(bar, arp), stepLen * 0.48, 0.034);
            }

            scheduleMelody(t, toneMidi(bar, leadDeg), stepLen * 1.35, 0.072);
            scheduleMelody(t + half, toneMidi(bar, lead2Deg), stepLen * 1.1, 0.052);
            scheduleMelody(t, toneMidi(bar, harmDeg), stepLen * 1.15, 0.042);
            scheduleMelody(t + half, toneMidi(bar, highDeg), stepLen * 0.75, 0.036);

            if (step === LOOP_STEPS - 1) {
                scheduleMelody(t + half, toneMidi(0, 0), stepLen * 2, 0.065);
                scheduleMelody(t + stepLen, toneMidi(0, 5), stepLen * 1.5, 0.05);
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
