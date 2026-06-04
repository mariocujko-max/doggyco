/**
 * DOGGYCO MISSION – Original BGM (Web Audio)
 * Dynamik: ruhig → Aufbau → Peak → Abfall (auf & ab)
 */
(function (global) {
    "use strict";

    var BPM = 112;
    var LOOKAHEAD = 0.18;
    var TICK_MS = 20;
    var LOOP_STEPS = 32;
    var MASTER_GAIN = 1.42;
    var RATE_MAX = 1.1;

    var CHORDS = [
        [50, 53, 57],
        [46, 50, 53],
        [41, 45, 48],
        [48, 52, 55]
    ];
    var BASS = [38, 34, 29, 36];

    /** Spielerische Melodie – Sprünge & Pausen */
    var LEAD_DEG = [
        -1, -1, 0, 3, -1, 5, 3, -1,
        -1, 0, 3, 5, 7, 5, -1, -1,
        0, 3, 7, 10, 7, 3, 0, -1,
        5, 3, 0, -1, -1, 2, 0, -1
    ];
    var HIGH_DEG = [
        7, 5, 7, 10, 12, 10, 7, 5,
        5, 7, 10, 12, 14, 12, 10, 7,
        7, 10, 14, 17, 14, 10, 7, 5,
        10, 7, 5, 3, 2, 0, 3, 5
    ];
    var LOW_PULSE = [0, 5, 3, 7, 5, 3, 0, 5];

    /** Energie je 8tel-Block: 0=ruhig 1=aufbau 2=peak 3=abfall */
    var SECTION_ENERGY = [0, 1, 2, 3];

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

    function getSection(step) {
        return SECTION_ENERGY[Math.floor(step / 8) % 4];
    }

    function energyMul(energy) {
        if (energy === 0) return { sub: 0.55, low: 0.5, high: 0.45, lead: 0.35, kick: 0.7, hat: 0.5 };
        if (energy === 1) return { sub: 0.8, low: 0.75, high: 0.7, lead: 0.65, kick: 0.9, hat: 0.75 };
        if (energy === 2) return { sub: 1.15, low: 1.1, high: 1.2, lead: 1.1, kick: 1.15, hat: 1.1 };
        return { sub: 0.85, low: 0.8, high: 0.95, lead: 0.75, kick: 0.85, hat: 0.8 };
    }

    function scheduleMelody(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var filt = ctx.createBiquadFilter();
        var g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(5200, time);
        filt.frequency.exponentialRampToValueAtTime(1200, time + dur * 0.85);
        filt.Q.value = 1.2;
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(filt);
        filt.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.06);
    }

    function scheduleHigh(time, midi, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var hp = ctx.createBiquadFilter();
        var g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        hp.type = "highpass";
        hp.frequency.value = 4800;
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
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(noteFreq(midi), time);
        lp.type = "lowpass";
        lp.frequency.value = 500;
        var v = Math.max(0.0001, vol);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(v, time + 0.012);
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
        g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + dur + 0.1);
    }

    function scheduleKick(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(vol, time + 0.004);
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
            d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        var hp = ctx.createBiquadFilter();
        src.buffer = buf;
        hp.type = "highpass";
        hp.frequency.value = 8500;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
        src.connect(hp);
        hp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + 0.034);
    }

    function scheduleStab(time, bar, vol) {
        var chord = CHORDS[bar];
        chord.forEach(function (n, i) {
            scheduleHigh(time, n + 24, 0.12, vol * (i === 0 ? 1 : 0.6));
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
            var phase = Math.floor(step / 8);
            var energy = getSection(step);
            var em = energyMul(energy);
            var t = engine.nextTick;
            var leadDeg = LEAD_DEG[step];
            var highDeg = HIGH_DEG[step];
            var lowDeg = LOW_PULSE[step % 8];
            var half = stepLen * 0.5;

            if (step % 8 === 0) scheduleKick(t, 0.32 * em.kick);
            if (energy >= 2 && step % 4 === 2) scheduleKick(t, 0.22 * em.kick);

            if (energy === 0) {
                if (step % 4 === 0) scheduleHat(t, 0.02 * em.hat);
            } else if (energy === 1) {
                if (step % 2 === 1) scheduleHat(t, 0.03 * em.hat);
            } else {
                if (step % 2 === 1) scheduleHat(t, 0.048 * em.hat);
                else if (step % 4 === 0) scheduleHat(t, 0.032 * em.hat);
            }

            if (step % 8 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 3.5, 0.13 * em.sub);
                if (energy >= 1) scheduleSub(t, BASS[bar] - 12, stepLen * 2.8, 0.08 * em.sub);
            }

            if (energy >= 1 && step % 4 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 1.6, 0.09 * em.sub);
            }

            if (energy >= 1 && step % 2 === 0) {
                scheduleLow(t, lowMidi(bar, lowDeg), stepLen * 0.65, 0.07 * em.low);
            }

            if (energy === 2 && step % 2 === 0) {
                var arp = [0, 3, 5, 7][step % 4];
                scheduleLow(t, lowMidi(bar, arp), stepLen * 0.45, 0.06 * em.low);
            }

            if (energy >= 1) {
                scheduleHigh(t, highMidi(bar, highDeg), stepLen * 0.6, 0.05 * em.high);
                if (energy >= 2) {
                    scheduleHigh(t + half, highMidi(bar, highDeg + 3), stepLen * 0.4, 0.038 * em.high);
                }
            }

            if (leadDeg >= 0 && energy >= 1) {
                scheduleMelody(t, toneMidi(bar, leadDeg), stepLen * 0.95, 0.055 * em.lead);
            }

            if (energy === 2 && step % 8 === 6) {
                scheduleStab(t, bar, 0.07);
            }

            if (phase === 1 && step % 8 === 7) {
                scheduleMelody(t, toneMidi(bar, 12), stepLen * 0.35, 0.04 * em.lead);
            }

            if (step === LOOP_STEPS - 1) {
                scheduleMelody(t + half, toneMidi(0, 0), stepLen * 1.4, 0.06);
                scheduleStab(t + stepLen, 0, 0.05);
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
