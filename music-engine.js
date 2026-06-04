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
    var MASTER_GAIN = 1.52;
    var RATE_MAX = 1.1;

    var CHORDS = [
        [50, 53, 57],
        [46, 50, 53],
        [41, 45, 48],
        [48, 52, 55]
    ];
    var BASS = [38, 34, 29, 36];

    /** Melodie – wenig Pausen, Aufbau wird dichter */
    var LEAD_DEG = [
        0, 2, 0, 3, 2, 3, 5, 3,
        0, 2, 3, 5, 3, 5, 7, 5,
        3, 5, 7, 10, 7, 5, 7, 10,
        7, 5, 3, 2, 0, 2, 3, 0
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
        if (energy === 0) return { sub: 0.55, low: 0.5, high: 0.48, lead: 0.45, kick: 0.58, hat: 0.44, stab: 0.38 };
        if (energy === 1) return { sub: 0.88, low: 0.84, high: 0.8, lead: 0.76, kick: 0.92, hat: 0.86, stab: 0.72 };
        if (energy === 2) return { sub: 1.75, low: 1.7, high: 1.85, lead: 1.65, kick: 1.8, hat: 1.75, stab: 1.55 };
        return { sub: 0.62, low: 0.56, high: 0.54, lead: 0.52, kick: 0.65, hat: 0.5, stab: 0.48 };
    }

    function stepInPhase(step) {
        return step % 8;
    }

    /** Aufbau: kontinuierlich steigern, aber nie zu leise */
    function buildTensionMul(sip) {
        return 0.82 + (sip / 7) * 0.45;
    }

    function scaleEm(em, mul) {
        return {
            sub: em.sub * mul,
            low: em.low * mul,
            high: em.high * mul,
            lead: em.lead * mul,
            kick: em.kick * mul,
            hat: em.hat * mul,
            stab: em.stab * mul
        };
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
            scheduleHigh(time, n + 24, 0.14, vol * (i === 0 ? 1 : 0.65));
        });
        scheduleSub(time, BASS[bar], 0.2, vol * 0.9);
    }

    function scheduleImpact(time, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(55, time);
        osc.frequency.exponentialRampToValueAtTime(28, time + 0.25);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(vol, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
        osc.connect(g);
        g.connect(engine.bus);
        osc.start(time);
        osc.stop(time + 0.4);
    }

    function scheduleRiser(time, dur, vol) {
        var ctx = engine.ctx;
        if (!ctx || !engine.bus) return;
        var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * (i / len);
        }
        var src = ctx.createBufferSource();
        var bp = ctx.createBiquadFilter();
        var g = ctx.createGain();
        src.buffer = buf;
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(400, time);
        bp.frequency.exponentialRampToValueAtTime(6000, time + dur);
        bp.Q.value = 2.5;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(vol, time + dur * 0.85);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(engine.bus);
        src.start(time);
        src.stop(time + dur + 0.02);
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
            var sip = stepInPhase(step);
            if (energy === 1) {
                em = scaleEm(em, buildTensionMul(sip));
            }
            var t = engine.nextTick;
            var leadDeg = LEAD_DEG[step];
            var highDeg = HIGH_DEG[step];
            var lowDeg = LOW_PULSE[step % 8];
            var half = stepLen * 0.5;

            if (step % 8 === 0) scheduleKick(t, 0.36 * em.kick);
            if (energy >= 1 && step % 4 === 2) scheduleKick(t, 0.28 * em.kick);
            if (energy === 1 && sip >= 2 && step % 4 === 0) scheduleKick(t, 0.22 * em.kick);
            if (energy === 2 && (step % 2 === 1)) scheduleKick(t, 0.26 * em.kick);

            if (step % 2 === 1) scheduleHat(t, 0.032 * em.hat);
            if (energy >= 1 && step % 2 === 0) scheduleHat(t + half, 0.038 * em.hat);
            if (energy === 2) scheduleHat(t + half, 0.042 * em.hat);

            if (step % 8 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 3.5, 0.13 * em.sub);
                schedulePad(t, chord, spb * 3.9, 0.014 * em.sub);
                if (energy >= 1) scheduleSub(t, BASS[bar] - 12, stepLen * 2.8, 0.08 * em.sub);
            }
            if (step % 4 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 1.5, 0.075 * em.sub);
            }

            if (energy >= 1 && step % 4 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 1.6, 0.09 * em.sub);
            }
            if (energy === 1 && step % 2 === 0) {
                scheduleSub(t, BASS[bar], stepLen * 1.2, 0.07 * em.sub);
            }

            if (step % 2 === 0) {
                scheduleLow(t, lowMidi(bar, lowDeg), stepLen * 0.68, 0.062 * em.low);
            }
            if (energy >= 1 && step % 2 === 0) {
                var arp = [0, 3, 5, 7][step % 4];
                scheduleLow(t, lowMidi(bar, arp), stepLen * 0.48, 0.052 * em.low);
            }

            scheduleHigh(t, highMidi(bar, highDeg), stepLen * 0.72, 0.05 * em.high);
            scheduleHigh(t + half, highMidi(bar, highDeg + 2), stepLen * 0.52, 0.038 * em.high);
            if (energy >= 1 && sip >= 3) {
                scheduleHigh(t, highMidi(bar, highDeg + 5), stepLen * 0.48, 0.042 * em.high);
            }

            var leadVol = 0.052 * em.lead;
            if (energy === 2) leadVol = 0.072 * em.lead;
            scheduleMelody(t, toneMidi(bar, leadDeg), stepLen * 1.1, leadVol);
            scheduleMelody(t + half, toneMidi(bar, leadDeg + (energy >= 2 ? 2 : 1)), stepLen * 0.8, leadVol * 0.72);

            if (energy === 1 && sip === 2) {
                scheduleRiser(t, stepLen * 3, 0.04 * em.high);
            }
            if (energy === 1 && sip === 4) {
                scheduleRiser(t, stepLen * 8, 0.14 * em.high);
            }
            if (energy === 1 && sip === 7) {
                scheduleImpact(t, 0.16 * em.stab);
                scheduleMelody(t, toneMidi(bar, 12), stepLen * 0.55, 0.08 * em.lead);
            }

            if (energy === 2 && sip === 0) {
                scheduleImpact(t, 0.2 * em.stab);
                scheduleStab(t, bar, 0.14 * em.stab);
                scheduleKick(t, 0.4 * em.kick);
            }
            if (energy === 2 && (sip === 4 || sip === 6)) {
                scheduleStab(t, bar, 0.11 * em.stab);
            }

            if (phase === 0 && sip === 7) {
                scheduleRiser(t, stepLen * 2.5, 0.035);
            }
            if (energy === 2 && sip === 7) {
                scheduleImpact(t, 0.12 * em.stab);
            }
            if (energy === 3 && sip === 0) {
                scheduleImpact(t, 0.1 * em.stab);
            }

            if (step === LOOP_STEPS - 1) {
                scheduleImpact(t, 0.16);
                scheduleMelody(t + half, toneMidi(0, 0), stepLen * 1.6, 0.08);
                scheduleStab(t + stepLen, 0, 0.1 * em.stab);
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
