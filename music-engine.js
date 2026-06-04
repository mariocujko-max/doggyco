/**
 * DOGGYCO MISSION – procedural arcade BGM
 * Seamless loop, soft dynamics (no MP3 crackle / loop gaps).
 */
(function (global) {
    "use strict";

    var BPM = 126;
    var LOOKAHEAD = 0.18;
    var TICK_MS = 20;
    var LOOP_STEPS = 32;
    var MASTER_GAIN = 1.38;
    var RATE_MAX = 1.55;

    var CHORDS = [
        [57, 60, 64],
        [53, 57, 60],
        [48, 52, 55],
        [55, 59, 62]
    ];
    var BASS = [45, 41, 36, 43];

    var LEAD_DEG = [
        0, 3, 5, 3, 5, 7, 5, 3,
        2, 3, 5, 7, 8, 7, 5, 3,
        0, 3, 5, 7, 8, 7, 5, 3,
        2, 0, 3, 5, 7, 8, 7, 5
    ];
    var LEAD2_DEG = [
        5, 7, 8, 7, 5, 3, 2, 0,
        3, 5, 7, 5, 3, 2, 0, 2,
        5, 7, 8, 10, 8, 7, 5, 3,
        2, 3, 5, 7, 5, 3, 2, 0
    ];
    var HARM_DEG = [
        2, 3, 5, 3, 2, 0, 2, 3,
        0, 2, 3, 5, 3, 2, 0, 2,
        2, 3, 5, 7, 5, 3, 2, 0,
        0, 2, 3, 5, 3, 2, 0, 2
    ];
    var HIGH_DEG = [
        7, 10, 12, 10, 7, 5, 7, 10,
        12, 10, 7, 10, 12, 14, 12, 10,
        7, 10, 12, 14, 12, 10, 7, 5,
        7, 10, 12, 14, 12, 10, 7, 5
    ];
    var ARP_A = [0, 3, 5, 7, 8, 7, 5, 3];
    var ARP_B = [5, 7, 8, 10, 8, 7, 5, 3];
    var BASS_WALK = [0, 2, 3, 5, 7, 5, 3, 2];

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
        g.gain.exponentialRampToValueAtTime(v, time + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.05);
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
        oscB.frequency.setValueAtTime(freq * 1.006, time);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.016);
        g.gain.setValueAtTime(v * 0.9, time + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        oscA.connect(g);
        oscB.connect(g);
        g.connect(engine.bus);
        oscA.start(time);
        oscB.start(time);
        oscA.stop(time + dur + 0.06);
        oscB.stop(time + dur + 0.06);
    }

    function scheduleKick(time) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(48, time + 0.09);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.32, time + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.17);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.028));
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
        hp.frequency.value = 5200;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.032);
    }

    function schedulePad(time, chord, dur, vol) {
        chord.forEach(function (n) {
            scheduleTone(time, noteFreq(n + 12), dur, "sine", vol);
        });
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
            var half = stepLen * 0.48;

            if (step % 8 === 0) scheduleKick(t);
            if (step === 12 || step === 28) scheduleKick(t);
            scheduleHat(t, step % 2 === 0 ? 0.044 : 0.032);

            if (step % 4 === 0) {
                scheduleTone(t, noteFreq(BASS[bar]), stepLen * 1.65, "triangle", 0.092);
            } else {
                scheduleTone(t, noteFreq(CHORDS[bar][0] + BASS_WALK[step % 8]), stepLen * 0.85, "triangle", 0.05);
            }

            var arpDeg = (step % 2 === 0 ? ARP_A : ARP_B)[step % 8];
            scheduleTone(t, melodyMidi(bar, arpDeg), stepLen * 0.5, "triangle", 0.048);
            scheduleTone(t + half, melodyMidi(bar, arpDeg + 2), stepLen * 0.42, "triangle", 0.034);

            if (step % 8 === 0) schedulePad(t, chord, spb * 3.6, 0.017);

            scheduleMelody(t, melodyMidi(bar, LEAD_DEG[step]), stepLen * 1.02, 0.062);
            scheduleMelody(t + half, melodyMidi(bar, LEAD2_DEG[step]), stepLen * 0.78, 0.048);
            scheduleMelody(t, melodyMidi(bar, HARM_DEG[step]), stepLen * 0.88, 0.038);
            scheduleMelody(t + half, melodyMidi(bar, HIGH_DEG[step]), stepLen * 0.62, 0.034);

            if (step === LOOP_STEPS - 1) {
                scheduleMelody(t + half, melodyMidi(0, 0), stepLen * 1.8, 0.058);
                scheduleMelody(t + half, melodyMidi(0, 5), stepLen * 1.4, 0.045);
                scheduleMelody(t + stepLen, melodyMidi(0, 7), stepLen * 1.2, 0.04);
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
        engine.comp.threshold.setValueAtTime(-18, ctx.currentTime);
        engine.comp.knee.setValueAtTime(10, ctx.currentTime);
        engine.comp.ratio.setValueAtTime(3, ctx.currentTime);
        engine.comp.attack.setValueAtTime(0.003, ctx.currentTime);
        engine.comp.release.setValueAtTime(0.1, ctx.currentTime);
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
