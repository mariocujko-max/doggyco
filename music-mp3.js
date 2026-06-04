/**
 * DOGGYCO MISSION – MP3 ohne Knistern/Aussetzer
 * Dekodiert music.mp3 einmal, loop mit Crossfade über Web Audio (kein HTML-<audio>-Loop).
 */
(function (global) {
    "use strict";

    var MUSIC_URL = "music.mp3";
    var XFADE = 0.05;
    var LOOKAHEAD = 0.2;
    var TICK_MS = 25;

    var state = {
        ctx: null,
        dest: null,
        buffer: null,
        loadP: null,
        active: false,
        paused: true,
        rate: 1,
        timer: null,
        nextTime: 0,
        segId: 0,
        sources: []
    };

    function preload(url) {
        url = url || MUSIC_URL;
        if (state.buffer) return Promise.resolve(state.buffer);
        if (state.loadP) return state.loadP;
        if (!state.ctx) return Promise.reject(new Error("no audio ctx"));
        state.loadP = fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error("music fetch failed");
                return r.arrayBuffer();
            })
            .then(function (ab) {
                return state.ctx.decodeAudioData(ab);
            })
            .then(function (buf) {
                state.buffer = buf;
                return buf;
            });
        return state.loadP;
    }

    function init(ctx, destNode) {
        if (!ctx || !destNode) return;
        state.ctx = ctx;
        state.dest = destNode;
    }

    function crossfadeSec() {
        if (!state.buffer) return XFADE;
        return Math.min(XFADE, Math.max(0.02, state.buffer.duration * 0.06));
    }

    function segmentLen() {
        if (!state.buffer) return 0;
        return Math.max(0.25, state.buffer.duration - crossfadeSec());
    }

    function clearSources() {
        state.sources.slice().forEach(function (x) {
            try { x.src.stop(); } catch (e) {}
            try { x.g.disconnect(); } catch (e) {}
        });
        state.sources = [];
    }

    function spawnSegment(when) {
        var ctx = state.ctx;
        var buf = state.buffer;
        if (!ctx || !buf || !state.dest || state.paused) return;

        var fade = crossfadeSec();
        var playDur = segmentLen();
        var id = ++state.segId;
        var end = when + playDur / state.rate;

        var src = ctx.createBufferSource();
        var g = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = state.rate;
        src.connect(g);
        g.connect(state.dest);

        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(1, when + fade);
        g.gain.setValueAtTime(1, end - fade);
        g.gain.linearRampToValueAtTime(0.0001, end);

        try {
            src.start(when, 0, playDur);
            src.stop(end + 0.03);
        } catch (e) {
            return;
        }

        state.sources.push({ src: src, g: g, id: id });
        src.onended = function () {
            state.sources = state.sources.filter(function (x) { return x.id !== id; });
        };

        state.nextTime = end - fade;
    }

    function schedulerTick() {
        if (state.paused || !state.active || !state.buffer || !state.ctx) return;
        var now = state.ctx.currentTime;
        while (state.nextTime < now + LOOKAHEAD) {
            if (state.nextTime < now) state.nextTime = now + 0.02;
            spawnSegment(state.nextTime);
        }
    }

    function start() {
        if (!state.ctx || !state.dest) return;
        state.active = true;
        var go = function () {
            if (!state.buffer || !state.paused) return;
            state.paused = false;
            if (state.nextTime <= state.ctx.currentTime) {
                state.nextTime = state.ctx.currentTime + 0.05;
            }
            if (state.timer) clearInterval(state.timer);
            state.timer = setInterval(schedulerTick, TICK_MS);
            schedulerTick();
            try {
                if (state.ctx.state === "suspended") state.ctx.resume();
            } catch (e) {}
        };
        if (state.buffer) go();
        else preload().then(go).catch(function () {});
    }

    function pause() {
        state.paused = true;
        state.active = false;
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        clearSources();
        state.nextTime = 0;
    }

    function setRate(r) {
        state.rate = Math.max(0.5, Math.min(2, r || 1));
        state.sources.forEach(function (x) {
            try { x.src.playbackRate.value = state.rate; } catch (e) {}
        });
    }

    function isActive() {
        return state.active && !state.paused;
    }

    function isPlaying() {
        return isActive() && state.sources.length > 0;
    }

    global.DoggyCoMp3 = {
        init: init,
        preload: preload,
        start: start,
        pause: pause,
        setRate: setRate,
        isActive: isActive,
        isPlaying: isPlaying
    };
})(typeof window !== "undefined" ? window : this);
