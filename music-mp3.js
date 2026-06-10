/**
 * DOGGYCO MISSION – music.mp3 + Browser-Video (ein Modul, kein Extra-Script)
 */
(function (global) {
    "use strict";

    var MUSIC_FILE = "music.mp3";
    var BGM_VOL = 0.24;

    var state = {
        ctx: null,
        dest: null,
        media: null,
        source: null,
        routed: false,
        directVol: false,
        primed: false,
        active: false,
        rate: 1
    };

    function isWebBrowser() {
        return !global.__isNativeApp;
    }

    function track() {
        if (state.media) return state.media;
        state.media = document.getElementById("bgm-track");
        if (!state.media) {
            state.media = document.createElement("audio");
            state.media.id = "bgm-track";
            state.media.src = MUSIC_FILE;
            state.media.loop = true;
            state.media.preload = "auto";
            state.media.playsInline = true;
            state.media.setAttribute("playsinline", "");
            state.media.setAttribute("webkit-playsinline", "");
            document.body.appendChild(state.media);
        }
        if (!state.media.getAttribute("src") && !state.media.querySelector("source")) {
            state.media.src = MUSIC_FILE;
        }
        return state.media;
    }

    function resumeCtx() {
        try {
            if (state.ctx && state.ctx.state === "suspended") state.ctx.resume();
        } catch (e) {}
    }

    function routeAudio() {
        if (state.routed || !state.ctx || !state.dest) return;
        if (isWebBrowser()) {
            state.directVol = true;
            state.routed = true;
            return;
        }
        var a = track();
        try {
            state.source = state.ctx.createMediaElementSource(a);
            state.source.connect(state.dest);
            state.routed = true;
        } catch (e) {
            state.directVol = true;
            state.routed = true;
        }
    }

    function initDirect() {
        state.directVol = true;
        state.routed = true;
        try { track().load(); } catch (e) {}
    }

    function init(ctx, destNode) {
        if (isWebBrowser()) {
            initDirect();
            return;
        }
        if (!ctx || !destNode) return;
        state.ctx = ctx;
        state.dest = destNode;
        routeAudio();
        try { track().load(); } catch (e) {}
    }

    function preload() {
        try { track().load(); } catch (e) {}
        return Promise.resolve();
    }

    function prime() {
        var a = track();
        try { a.load(); } catch (e) {}
        if (state.primed) {
            resumeCtx();
            routeAudio();
            return Promise.resolve();
        }
        resumeCtx();
        routeAudio();
        var muted = a.muted;
        a.muted = true;
        return a.play().then(function () {
            try { a.pause(); a.currentTime = 0; } catch (e) {}
            a.muted = muted;
            state.primed = true;
            state.active = false;
        }).catch(function () {
            a.muted = muted;
            state.primed = true;
        });
    }

    function applyAudibleVolume() {
        var a = track();
        try {
            a.muted = false;
            a.volume = Math.max(0.1, BGM_VOL);
            a.playbackRate = state.rate;
        } catch (e) {}
    }

    function start() {
        resumeCtx();
        routeAudio();
        if (isWebBrowser()) state.directVol = true;
        var a = track();
        try { if (a.readyState < 2) a.load(); } catch (e) {}
        applyAudibleVolume();
        if (!a.paused) {
            state.active = true;
            return Promise.resolve();
        }
        return a.play().then(function () {
            state.active = true;
        }).catch(function () {
            state.active = false;
        });
    }

    function pause() {
        state.active = false;
        try { if (state.media) state.media.pause(); } catch (e) {}
    }

    function setRate(r) {
        state.rate = Math.max(0.5, Math.min(2, r || 1));
        if (state.media) {
            try { state.media.playbackRate = state.rate; } catch (e) {}
        }
    }

    function setDirectVolume(level) {
        if (state.media) {
            try { state.media.volume = Math.max(0, Math.min(1, level)); } catch (e) {}
        }
    }

    function isActive() {
        return state.active;
    }

    function isPlaying() {
        return !!(state.media && !state.media.paused && !state.media.ended);
    }

    function isReady() {
        var a = state.media || document.getElementById("bgm-track");
        return !!(state.primed || (a && a.readyState >= 2));
    }

    function usesDirectVolume() {
        return state.directVol || isWebBrowser();
    }

    function setupBrowserVideos() {
        if (!isWebBrowser()) return;
        [
            { v: "dog-video", c: "dog-video-canvas" },
            { v: "dog-video2", c: "dog-video-canvas2" }
        ].forEach(function (pair) {
            var el = document.getElementById(pair.v);
            var canvas = document.getElementById(pair.c);
            if (!el) return;
            try { el.removeAttribute("crossorigin"); } catch (e) {}
            el.setAttribute("playsinline", "");
            el.setAttribute("webkit-playsinline", "");
            el.preload = "auto";
            el.style.display = "none";
            if (canvas) {
                canvas.style.display = "";
                canvas.style.visibility = "visible";
            }
        });
    }

    function playMenuVideo(which) {
        /* Greenscreen canvas playback is handled in index*.html manageMedia() */
    }

    function bootWebMedia() {
        if (!isWebBrowser()) return;
        setupBrowserVideos();
        try { track().load(); } catch (e) {}
    }

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", bootWebMedia);
        } else {
            bootWebMedia();
        }
    }

    global.DoggyCoMp3 = {
        init: init,
        initDirect: initDirect,
        preload: preload,
        prime: prime,
        start: start,
        pause: pause,
        setRate: setRate,
        setDirectVolume: setDirectVolume,
        isActive: isActive,
        isPlaying: isPlaying,
        isReady: isReady,
        usesDirectVolume: usesDirectVolume,
        isWebBrowser: isWebBrowser,
        setupBrowserVideos: setupBrowserVideos,
        playMenuVideo: playMenuVideo
    };
})(typeof window !== "undefined" ? window : this);
