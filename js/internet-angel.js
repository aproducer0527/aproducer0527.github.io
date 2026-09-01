(function () {
  if (window.__apInternetAngelReady) return;
  window.__apInternetAngelReady = true;

  var apSprites = [
    '/img/%E9%98%BFP1.png',
    '/img/%E9%98%BFP2.gif',
    '/img/%E9%98%BFP3.gif'
  ];
  var rainTimer = 0;
  var rainLayer = null;
  var navHideTimer = 0;
  var navListenersReady = false;

  function isAngelMode() {
    return document.documentElement.classList.contains('ap-angel-video-mode');
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function stopApRain() {
    if (rainTimer) {
      window.clearInterval(rainTimer);
      rainTimer = 0;
    }

    if (rainLayer && rainLayer.parentElement) {
      rainLayer.remove();
    }

    rainLayer = null;
  }

  function setAngelNavVisible(visible) {
    document.documentElement.classList.toggle('ap-angel-nav-visible', visible);
  }

  function scheduleAngelNavHide(delay) {
    window.clearTimeout(navHideTimer);
    navHideTimer = window.setTimeout(function () {
      var nav = document.querySelector('#page-header #nav');
      if (nav && (nav.matches(':hover') || nav.matches(':focus-within'))) {
        scheduleAngelNavHide(700);
        return;
      }

      setAngelNavVisible(false);
    }, delay || 900);
  }

  function showAngelNav() {
    if (!isAngelMode()) return;
    setAngelNavVisible(true);
    scheduleAngelNavHide(1200);
  }

  function onPointerNearTop(event) {
    if (!isAngelMode()) return;

    if (event.clientY <= 82) {
      showAngelNav();
      return;
    }

    if (event.clientY > 150) scheduleAngelNavHide(520);
  }

  function onTouchNearTop(event) {
    if (!isAngelMode() || !event.touches || !event.touches.length) return;
    if (event.touches[0].clientY <= 96) showAngelNav();
  }

  function bindAngelNav() {
    if (navListenersReady) return;
    navListenersReady = true;

    document.addEventListener('mousemove', onPointerNearTop, { passive: true });
    document.addEventListener('touchstart', onTouchNearTop, { passive: true });
    document.addEventListener('focusin', function (event) {
      if (isAngelMode() && event.target.closest && event.target.closest('#nav')) showAngelNav();
    });
  }

  function setAngelPageMode(enabled) {
    var root = document.documentElement;
    root.classList.toggle('ap-angel-video-mode', enabled);
    bindAngelNav();

    if (enabled) {
      showAngelNav();
      return;
    }

    window.clearTimeout(navHideTimer);
    setAngelNavVisible(false);
  }

  function cleanupAngelPage() {
    stopApRain();
    setAngelPageMode(false);
  }

  function dropApSprite() {
    if (!rainLayer || !rainLayer.parentElement) return;

    var img = document.createElement('img');
    var size = random(46, 86);
    var duration = random(5.2, 9.4);
    var delay = random(-0.8, 0);

    img.className = 'ap-falling-sprite';
    img.src = apSprites[Math.floor(Math.random() * apSprites.length)];
    img.alt = '';
    img.decoding = 'async';
    img.style.setProperty('--ap-fall-left', random(0, 100).toFixed(2) + 'vw');
    img.style.setProperty('--ap-fall-size', size.toFixed(0) + 'px');
    img.style.setProperty('--ap-fall-duration', duration.toFixed(2) + 's');
    img.style.setProperty('--ap-fall-delay', delay.toFixed(2) + 's');
    img.style.setProperty('--ap-fall-drift', random(-120, 120).toFixed(0) + 'px');

    rainLayer.appendChild(img);

    window.setTimeout(function () {
      img.remove();
    }, (duration + Math.abs(delay) + 0.4) * 1000);
  }

  function startApRain(page) {
    if (!page) {
      stopApRain();
      return;
    }

    if (rainLayer && page.contains(rainLayer)) return;
    stopApRain();

    rainLayer = document.createElement('div');
    rainLayer.className = 'ap-angel-rain';
    rainLayer.setAttribute('aria-hidden', 'true');
    page.appendChild(rainLayer);

    for (var index = 0; index < 8; index += 1) {
      window.setTimeout(dropApSprite, index * 180);
    }

    rainTimer = window.setInterval(dropApSprite, 560);
  }

  function initPlayer(player) {
    if (!player || player.dataset.apAngelReady === 'true') return;

    var video = player.querySelector('video');
    var cover = player.querySelector('.ap-angel-cover');
    var status = player.querySelector('[data-ap-angel-status]');

    if (!video || !cover) return;
    player.dataset.apAngelReady = 'true';

    function setStatus(text) {
      if (status) status.textContent = text;
    }

    function markReady() {
      player.classList.add('is-ready');
      setStatus('READY');
    }

    function attemptAutoplay() {
      if (player.dataset.apAngelAutoplayAttempted === 'true') return;

      player.dataset.apAngelAutoplayAttempted = 'true';
      video.autoplay = true;
      video.setAttribute('autoplay', '');

      var promise = video.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          video.muted = true;
          video.defaultMuted = true;
          video.setAttribute('muted', '');
          setStatus('MUTED AUTO');

          var mutedPromise = video.play();
          if (mutedPromise && mutedPromise.catch) {
            mutedPromise.catch(function () {
              player.classList.add('is-ready');
              setStatus('CLICK TO PLAY');
            });
          }
        });
      }
    }

    if (video.readyState >= 3) markReady();
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('canplaythrough', markReady);
    video.addEventListener('canplay', attemptAutoplay, { once: true });
    video.addEventListener('loadeddata', attemptAutoplay, { once: true });

    video.addEventListener('play', function () {
      player.classList.add('is-started', 'is-playing');
      player.classList.remove('is-ended');
      setStatus('PLAYING');
    });

    video.addEventListener('pause', function () {
      player.classList.remove('is-playing');
      if (!video.ended) setStatus('PAUSED');
    });

    video.addEventListener('ended', function () {
      player.classList.remove('is-playing', 'is-started');
      player.classList.add('is-ended');
      setStatus('REPLAY');
    });

    video.addEventListener('error', function () {
      player.classList.add('is-error');
      setStatus('VIDEO ERROR');
    });

    cover.addEventListener('click', function () {
      if (video.ended) video.currentTime = 0;

      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');

      var promise = video.play();
      if (promise && promise.catch) {
        promise.catch(function () {
          player.classList.add('is-error');
          setStatus('CLICK AGAIN');
        });
      }
    });

    if (video.readyState >= 2) attemptAutoplay();
  }

  function init() {
    var page = document.querySelector('.ap-internet-angel-page');

    if (!page) {
      cleanupAngelPage();
      return;
    }

    setAngelPageMode(true);
    startApRain(page);
    page.querySelectorAll('[data-ap-angel-player]').forEach(initPlayer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', cleanupAngelPage);
  window.addEventListener('beforeunload', cleanupAngelPage);
})();
