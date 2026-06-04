/**
 * DOGGYCO MISSION – procedural arcade BGM
 * Seamless loop, soft dynamics (no MP3 crackle / loop gaps).
 */
(function (global) {
    "use strict";

    var BPM = 124;
    var LOOKAHEAD = 0.16;
    var TICK_MS = 22;
    var LOOP_STEPS = 32;
    var MASTER_GAIN = 1.38;

    var CHORDS = [
        [57, 60, 64],
        [53, 57, 60],
        [48, 52, 55],
        [55, 59, 62]
    ];
    var BASS = [45, 41, 36, 43];

    /** Main melody – 32 sixteenth steps (-1 = rest) */
    var LEAD_DEG = [
        0, 3, 5, 3, 5, 7, 5, 3,
        0, 2, 3, 5, 7, 5, 3, 2,
        0, 3, 5, 7, 5, 3, 2, 0,
        -2, 0, 3, 5, 7, 5, 3, 0
    ];
    /** Harmony line (thirds/sixths under lead) */
    var HARM_DEG = [
        -1, -1, 2, -1, 2, -1, 0, -1,
        -1, -1, 0, 2, -1, 0, -1, -1,
        -1, -1, 2, -1, 0, -1, -1, -1,
        -1, -1, 0, 2, -1, 0, -1, -1
    ];
    /** Upper sparkle / counter */
    var HIGH_DEG = [
        7, -1, 10, -1, 7, -1, 12, -1,
        7, -1, 10, -1, 12, -1, 10, -1,
        7, -1, 10, 12, -1, 10, -1, 7,
        -1, 7, -1, 10, 12, 10, 7, -1
    ];
    /** Walking bass fill degrees (every 2 steps) */
    var BASS_WALK = [0, 2, 3, 5, 3, 2, 0, -2];

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
        g.gain.exponentialRampToValueAtTime(v, time + 0.016);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.05);
    }

    function scheduleMelody(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus || midi == null) return;
        var freq = noteFreq(midi);
        var oscA = ctx.createOscillator();
        var oscB = ctx.createOscillator();
        var g = ctx.createGain();
        oscA.type = "triangle";
        oscB.type = "sine";
        oscA.frequency.setValueAtTime(freq, time);
        oscB.frequency.setValueAtTime(freq * 1.005, time);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.018);
        g.gain.setValueAtTime(v * 0.88, time + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        oscA.connect(g);
        oscB.connect(g);
        g.connect(engine.bus);
        oscA.start(time);
        oscB.start(time);
        oscA.stop(time + dur + 0.07);
        oscB.stop(time + dur + 0.07);
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
        g.gain.exponentialRampToValueAtTime(0.34, time + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.18);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.03));
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
            if (step === 12 || step === 28) scheduleKick(t);

            if (step % 2 === 0) scheduleHat(t, 0.048);
            else scheduleHat(t, 0.03);

            if (step % 4 === 0) {
                scheduleTone(t, noteFreq(BASS[bar]), stepLen * 1.7, "triangle", 0.1);
            } else if (step % 2 === 0) {
                var walk = BASS_WALK[step % 8];
                scheduleTone(t, noteFreq(CHORDS[bar][0] + walk), stepLen * 0.9, "triangle", 0.055);
            }

            var arpDeg = [0, 3, 5, 7, 5, 3, 5, 10][step % 8];
            scheduleTone(t, melodyMidi(bar, arpDeg), stepLen * 0.55, "triangle", 0.052);

            if (step % 8 === 0) {
                schedulePad(t, chord, spb * 3.8, 0.018);
            }

            if (leadDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, leadDeg), stepLen * 1.05, 0.068);
            }

            if (harmDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, harmDeg), stepLen * 0.85, 0.04);
            }

            if (highDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, highDeg), stepLen * 0.65, 0.036);
            }

            if (step === LOOP_STEPS - 1) {
                scheduleMelody(t + stepLen * 0.5, melodyMidi(0, 0), stepLen * 2, 0.055);
                scheduleMelody(t + stepLen * 0.5, melodyMidi(0, 3), stepLen * 1.6, 0.042);
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
        engine.rateMul = Math.max(0.78, Math.min(1.38, r || 1));
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
