/**
 * DOGGYCO MISSION – procedural arcade BGM
 * Seamless loop, soft dynamics (no MP3 crackle / loop gaps).
 */
(function (global) {
    "use strict";

    var BPM = 122;
    var LOOKAHEAD = 0.14;
    var TICK_MS = 24;
    var LOOP_BEATS = 16;
    var MASTER_GAIN = 1.22;

    var CHORDS = [
        [57, 60, 64],
        [53, 57, 60],
        [48, 52, 55],
        [55, 59, 62]
    ];
    var BASS = [45, 41, 36, 43];

    /** Lead hook: scale degrees per beat (-1 = rest) */
    var LEAD_DEG = [
        0, -1, 3, 5,
        5, -1, 3, 0,
        -2, -1, 0, 3,
        5, 7, 5, 3
    ];
    /** Counter-melody (8th feel, sparse) */
    var COUNTER_DEG = [
        -1, 2, -1, -1,
        -1, 2, -1, 5,
        -1, -1, 2, -1,
        -1, -1, 2, -1
    ];

    var engine = {
        ctx: null,
        bus: null,
        comp: null,
        playing: false,
        rateMul: 1,
        timer: null,
        nextTick: 0,
        beat: 0
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
        g.gain.exponentialRampToValueAtTime(v, time + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.06);
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
        oscB.frequency.setValueAtTime(freq * 1.004, time);
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.02);
        g.gain.setValueAtTime(v * 0.85, time + dur * 0.55);
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
        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(48, time + 0.09);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.32, time + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.18);
    }

    function scheduleHat(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * 0.035));
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
        hp.frequency.value = 5500;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.04);
    }

    function schedulePad(time, chord, dur, vol) {
        chord.forEach(function (n) {
            scheduleTone(time, noteFreq(n + 12), dur, "sine", vol);
        });
    }

    function schedulerTick() {
        if (!engine.playing || !engine.ctx) return;
        var ctx = engine.ctx;
        var spb = 60 / (BPM * engine.rateMul);
        var now = ctx.currentTime;

        while (engine.nextTick < now + LOOKAHEAD) {
            var beat = engine.beat % LOOP_BEATS;
            var bar = Math.floor(beat / 4) % 4;
            var t = engine.nextTick;
            var chord = CHORDS[bar];
            var leadDeg = LEAD_DEG[beat];
            var counterDeg = COUNTER_DEG[beat];

            if (beat % 4 === 0) scheduleKick(t);
            if (beat === 6 || beat === 14) scheduleKick(t);

            if (beat % 2 === 0) scheduleHat(t, 0.042);
            else scheduleHat(t, 0.026);

            scheduleTone(t, noteFreq(BASS[bar]), spb * 0.78, "triangle", 0.085);

            var arpMidi = chord[beat % 3] + (beat < 8 ? 12 : 19);
            scheduleTone(t, noteFreq(arpMidi), spb * 0.32, "triangle", 0.038);

            if (beat % 4 === 0) {
                schedulePad(t, chord, spb * 3.6, 0.015);
            }

            if (leadDeg >= 0) {
                scheduleMelody(t, melodyMidi(bar, leadDeg), spb * 0.92, 0.052);
            }

            if (counterDeg >= 0) {
                scheduleMelody(t + spb * 0.5, melodyMidi(bar, counterDeg), spb * 0.42, 0.028);
            }

            if (beat === LOOP_BEATS - 1) {
                schedulePad(t + spb * 0.5, CHORDS[0], spb * 2, 0.012);
                scheduleMelody(t + spb * 0.25, melodyMidi(0, 0), spb * 1.1, 0.04);
            }

            engine.beat++;
            engine.nextTick += spb;
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
        engine.beat = 0;
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
