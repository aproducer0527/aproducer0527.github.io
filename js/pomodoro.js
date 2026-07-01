(function () {
  var activeTimer = null;
  var playerAssetsPromise = null;
  var playlistId = '14068521641';
  var assets = {
    css: 'https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css',
    aplayer: 'https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js',
    meting: 'https://cdn.jsdelivr.net/npm/meting/dist/Meting.min.js'
  };
  var backgroundDefaults = {
    prefixes: ['/img/%E7%95%AA%E8%8C%84%E9%92%9F', '/video/%E7%95%AA%E8%8C%84%E9%92%9F'],
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'],
    videoExts: ['.mp4', '.webm'],
    max: 24,
    missLimit: 3,
    intervalMin: 30 * 60 * 1000,
    intervalMax: 60 * 60 * 1000,
    fade: 900
  };
  var modes = {
    focus: { label: '专注', seconds: 25 * 60, next: 'short' },
    short: { label: '短休', seconds: 5 * 60, next: 'focus' },
    long: { label: '长休', seconds: 15 * 60, next: 'focus' }
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatTime(seconds) {
    var safeSeconds = Math.max(0, Math.ceil(seconds));
    return pad(Math.floor(safeSeconds / 60)) + ':' + pad(safeSeconds % 60);
  }

  function toPositiveInt(value, fallback, max) {
    var parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      parsed = fallback;
    }

    return max ? Math.min(parsed, max) : parsed;
  }

  function cssImageUrl(url) {
    return 'url("' + String(url).replace(/["\\]/g, '\\$&') + '")';
  }

  function splitList(value, fallback) {
    if (!value) return fallback.slice();

    var list = String(value)
      .split(',')
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);

    return list.length ? list : fallback.slice();
  }

  function isVideoExtension(ext) {
    return backgroundDefaults.videoExts.indexOf(String(ext).toLowerCase()) !== -1;
  }

  function nextBackgroundInterval(root) {
    var min = toPositiveInt(root.dataset.bgIntervalMin || root.dataset.bgInterval, backgroundDefaults.intervalMin, 24 * 60 * 60 * 1000);
    var max = toPositiveInt(root.dataset.bgIntervalMax, backgroundDefaults.intervalMax, 24 * 60 * 60 * 1000);

    min = Math.max(3000, min);
    max = Math.max(min, max);

    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function probeImage(url) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = function () {
        resolve({ type: 'image', url: url });
      };
      image.onerror = function () {
        resolve(null);
      };
      image.src = url;
    });
  }

  function probeVideo(url) {
    return new Promise(function (resolve) {
      var settled = false;
      var video = document.createElement('video');
      var timer = window.setTimeout(function () {
        finish(null);
      }, 5000);

      function finish(asset) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        video.removeAttribute('src');
        video.load();
        resolve(asset);
      }

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = function () {
        finish({ type: 'video', url: url });
      };
      video.onerror = function () {
        finish(null);
      };
      video.src = url;
      video.load();
    });
  }

  function probeTypedAsset(candidate) {
    return candidate.type === 'video' ? probeVideo(candidate.url) : probeImage(candidate.url);
  }

  function probeAsset(candidate) {
    if (typeof window.fetch !== 'function') {
      return probeTypedAsset(candidate);
    }

    return window.fetch(candidate.url, { method: 'HEAD', cache: 'force-cache' })
      .then(function (response) {
        if (response.ok) return candidate;
        if (response.status === 405 || response.status === 501) return probeTypedAsset(candidate);
        return null;
      })
      .catch(function () {
        return probeTypedAsset(candidate);
      });
  }

  function probeBackgroundIndex(prefixes, exts, index) {
    var candidates = [];

    prefixes.forEach(function (prefix) {
      exts.forEach(function (ext) {
        candidates.push({
          type: isVideoExtension(ext) ? 'video' : 'image',
          url: prefix + index + ext
        });
      });
    });

    return new Promise(function (resolve) {
      function next(candidateIndex) {
        if (candidateIndex >= candidates.length) {
          resolve(null);
          return;
        }

        probeAsset(candidates[candidateIndex]).then(function (asset) {
          if (asset) {
            resolve(asset);
            return;
          }

          next(candidateIndex + 1);
        });
      }

      next(0);
    });
  }

  function discoverBackgrounds(root) {
    var prefixes = splitList(root.dataset.bgPrefixes || root.dataset.bgPrefix, backgroundDefaults.prefixes);
    var exts = splitList(root.dataset.bgExts || root.dataset.bgExt, backgroundDefaults.exts);
    var max = toPositiveInt(root.dataset.bgMax, backgroundDefaults.max, 60);
    var missLimit = toPositiveInt(root.dataset.bgMissLimit, backgroundDefaults.missLimit, 8);
    var assets = [];
    var misses = 0;
    var index = 1;

    return new Promise(function (resolve) {
      function next() {
        if (index > max || misses >= missLimit) {
          resolve(assets);
          return;
        }

        probeBackgroundIndex(prefixes, exts, index).then(function (asset) {
          if (asset) {
            assets.push(asset);
            misses = 0;
          } else {
            misses += 1;
          }

          index += 1;
          next();
        });
      }

      next();
    });
  }

  function getBackgroundHost() {
    return document.body || document.documentElement;
  }

  function clearBackgroundLayer(layer) {
    var video = layer.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    layer.textContent = '';
    layer.style.removeProperty('background-image');
    delete layer.dataset.bgType;
  }

  function playBackgroundVideo(layer) {
    var video = layer.querySelector('video');
    if (!video) return;

    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {});
    }
  }

  function renderBackgroundLayer(layer, asset) {
    clearBackgroundLayer(layer);
    layer.dataset.bgType = asset.type;

    if (asset.type === 'video') {
      var video = document.createElement('video');
      video.src = asset.url;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      layer.appendChild(video);
      playBackgroundVideo(layer);
      return;
    }

    layer.style.backgroundImage = cssImageUrl(asset.url);
  }

  function ensureBackgroundLayers(root, state) {
    if (state.backgroundLayers.length) return state.backgroundLayers;

    var host = getBackgroundHost();
    var existing = document.querySelector('.ap-pomodoro-page-bg');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var container = document.createElement('div');
    var first = document.createElement('div');
    var second = document.createElement('div');
    container.className = 'ap-pomodoro-page-bg';
    first.className = 'ap-pomodoro-bg-layer';
    second.className = 'ap-pomodoro-bg-layer';
    container.setAttribute('aria-hidden', 'true');
    first.setAttribute('aria-hidden', 'true');
    second.setAttribute('aria-hidden', 'true');
    container.appendChild(first);
    container.appendChild(second);
    host.insertBefore(container, host.firstChild);
    state.backgroundContainer = container;
    state.backgroundLayers = [first, second];
    return state.backgroundLayers;
  }

  function setupBackgroundRotation(root, state) {
    discoverBackgrounds(root).then(function (assets) {
      if (root.dataset.ready !== 'true' || !assets.length) return;

      var current = 0;
      var fadeMs = Math.max(120, toPositiveInt(root.dataset.bgFade, backgroundDefaults.fade, 3000));
      var layers = ensureBackgroundLayers(root, state);

      function commitBackground(index) {
        current = index % assets.length;
        root.classList.remove('is-bg-fading');
        root.dataset.bgReady = 'true';
      }

      function clearFadeTimer() {
        if (state.backgroundFadeTimeoutId) {
          window.clearTimeout(state.backgroundFadeTimeoutId);
          state.backgroundFadeTimeoutId = 0;
        }
      }

      function show(index, animated) {
        var next = index % assets.length;

        if (!animated || next === current || root.dataset.bgReady !== 'true') {
          clearFadeTimer();
          state.backgroundVisibleLayer = 0;
          renderBackgroundLayer(layers[0], assets[next]);
          layers[0].classList.add('is-active');
          layers[1].classList.remove('is-active');
          clearBackgroundLayer(layers[1]);
          commitBackground(next);
          return;
        }

        if (root.classList.contains('is-bg-fading')) return;

        var nextLayerIndex = state.backgroundVisibleLayer === 0 ? 1 : 0;
        var currentLayer = layers[state.backgroundVisibleLayer];
        var nextLayer = layers[nextLayerIndex];
        renderBackgroundLayer(nextLayer, assets[next]);
        nextLayer.classList.remove('is-active');
        nextLayer.offsetHeight;
        root.classList.add('is-bg-fading');
        nextLayer.classList.add('is-active');
        currentLayer.classList.remove('is-active');
        clearFadeTimer();
        state.backgroundFadeTimeoutId = window.setTimeout(function () {
          state.backgroundFadeTimeoutId = 0;
          clearBackgroundLayer(currentLayer);
          state.backgroundVisibleLayer = nextLayerIndex;
          commitBackground(next);
        }, fadeMs);
      }

      function scheduleBackgroundSwitch() {
        if (state.backgroundIntervalId || root.dataset.ready !== 'true') return;

        state.backgroundIntervalId = window.setTimeout(function () {
          state.backgroundIntervalId = 0;
          if (root.dataset.ready !== 'true') return;
          show(current + 1, true);
          scheduleBackgroundSwitch();
        }, nextBackgroundInterval(root));
      }

      show(0, false);

      if (assets.length > 1) {
        scheduleBackgroundSwitch();
      }
    });
  }

  function loadStyle(href) {
    if (document.querySelector('link[data-ap-pomodoro-aplayer]')) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.apPomodoroAplayer = 'true';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  function loadScript(src, key, ready) {
    if (ready && ready()) {
      return Promise.resolve();
    }

    var existing = document.querySelector('script[data-ap-pomodoro-script="' + key + '"]');
    if (existing) {
      return new Promise(function (resolve, reject) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.apPomodoroScript = key;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function ensurePlayerAssets() {
    if (!playerAssetsPromise) {
      playerAssetsPromise = loadStyle(assets.css)
        .then(function () {
          return loadScript(assets.aplayer, 'aplayer', function () {
            return typeof window.APlayer === 'function';
          });
        })
        .then(function () {
          return loadScript(assets.meting, 'meting', function () {
            return typeof window.loadMeting === 'function';
          });
        });
    }

    return playerAssetsPromise;
  }

  function mountPlaylist(root) {
    var holder = root.querySelector('[data-ap-pomodoro-meting]');
    var status = root.querySelector('[data-ap-pomodoro-player-status]');
    if (!holder) return Promise.resolve();

    if (!holder.querySelector('meting-js')) {
      var meting = document.createElement('meting-js');
      meting.setAttribute('server', 'netease');
      meting.setAttribute('type', 'playlist');
      meting.setAttribute('id', root.dataset.playlistId || playlistId);
      meting.setAttribute('loop', 'all');
      meting.setAttribute('order', 'list');
      meting.setAttribute('autoplay', 'true');
      meting.setAttribute('fixed', 'false');
      meting.setAttribute('mini', 'false');
      meting.setAttribute('mutex', 'true');
      meting.setAttribute('preload', 'metadata');
      meting.setAttribute('volume', '0.7');
      meting.setAttribute('list-folded', 'false');
      meting.setAttribute('lrc-type', '0');
      holder.appendChild(meting);
    }

    return ensurePlayerAssets()
      .then(function () {
        if (typeof window.loadMeting === 'function') {
          window.loadMeting();
        }

        if (status) {
          status.textContent = '歌单已加载，开始番茄钟后将尝试播放';
        }
      })
      .catch(function () {
        if (status) {
          status.textContent = '歌单加载失败，请检查网络后刷新页面';
        }
      });
  }

  function setPlayerStatus(root, text) {
    var status = root.querySelector('[data-ap-pomodoro-player-status]');
    if (status) status.textContent = text;
  }

  function getPlaylistAudio(root) {
    return root.querySelector('.ap-pomodoro-player .aplayer audio');
  }

  function clickPlaylistControl(root, selector) {
    var button = root.querySelector('.ap-pomodoro-player ' + selector);
    if (!button) return false;
    button.click();
    return true;
  }

  function waitForPlaylistPlayer(root, timeoutMs) {
    return new Promise(function (resolve) {
      var audio = getPlaylistAudio(root);
      if (audio) {
        resolve(audio);
        return;
      }

      var holder = root.querySelector('[data-ap-pomodoro-player]') || root;
      var timer = 0;
      var observer = null;

      function done(value) {
        if (timer) window.clearTimeout(timer);
        if (observer) observer.disconnect();
        resolve(value || getPlaylistAudio(root));
      }

      if (typeof window.MutationObserver !== 'function') {
        timer = window.setTimeout(function () {
          done();
        }, timeoutMs);
        return;
      }

      observer = new MutationObserver(function () {
        var nextAudio = getPlaylistAudio(root);
        if (nextAudio) done(nextAudio);
      });
      observer.observe(holder, { childList: true, subtree: true });
      timer = window.setTimeout(function () {
        done();
      }, timeoutMs);
    });
  }

  function clearAutoplayGestureFallback(root) {
    if (!root._apPomodoroResumeAutoplay) return;
    document.removeEventListener('pointerdown', root._apPomodoroResumeAutoplay, true);
    document.removeEventListener('touchstart', root._apPomodoroResumeAutoplay, true);
    document.removeEventListener('keydown', root._apPomodoroResumeAutoplay, true);
    root._apPomodoroResumeAutoplay = null;
    delete root.dataset.playerGestureFallbackBound;
  }

  function bindAutoplayGestureFallback(root) {
    if (root.dataset.playerGestureFallbackBound === 'true') return;
    root.dataset.playerGestureFallbackBound = 'true';
    root._apPomodoroResumeAutoplay = function () {
      clearAutoplayGestureFallback(root);
      startPlaylistAutoplay(root, { fromGesture: true });
    };
    document.addEventListener('pointerdown', root._apPomodoroResumeAutoplay, true);
    document.addEventListener('touchstart', root._apPomodoroResumeAutoplay, true);
    document.addEventListener('keydown', root._apPomodoroResumeAutoplay, true);
  }

  function playlistTrackLimit(root) {
    return Math.max(8, root.querySelectorAll('.ap-pomodoro-player .aplayer-list li').length || 0);
  }

  function skipUnavailableTrack(root) {
    var tries = (parseInt(root.dataset.playerSkipTries || '0', 10) || 0) + 1;
    var limit = playlistTrackLimit(root);
    if (tries > limit) {
      setPlayerStatus(root, '歌单暂时没有可播放歌曲，已停止自动跳过');
      return;
    }

    root.dataset.playerSkipTries = String(tries);
    setPlayerStatus(root, '当前歌曲不可播放，正在自动跳过');
    if (!clickPlaylistControl(root, '.aplayer-icon-forward')) {
      setPlayerStatus(root, '当前歌曲不可播放，请手动切换下一首');
      return;
    }

    window.setTimeout(function () {
      startPlaylistAutoplay(root, { fromSkip: true });
    }, 420);
  }

  function bindPlaylistAutoSkip(root) {
    waitForPlaylistPlayer(root, 8000).then(function (audio) {
      if (!audio || audio.dataset.apPomodoroAutoSkipBound === 'true') return;
      audio.dataset.apPomodoroAutoSkipBound = 'true';
      audio.addEventListener('error', function () {
        skipUnavailableTrack(root);
      });
      audio.addEventListener('playing', function () {
        delete root.dataset.playerSkipTries;
        setPlayerStatus(root, '歌单自动播放中');
      });
    });
  }

  function restoreAutoplaySound(audio, muted) {
    window.setTimeout(function () {
      audio.muted = muted;
      if (!muted && audio.volume === 0) {
        audio.volume = 0.7;
      }
    }, 220);
  }

  function handleAutoplayRejection(root, audio, error) {
    var name = error && error.name;
    audio.muted = false;

    if (audio.error || name === 'NotSupportedError' || name === 'NotFoundError') {
      skipUnavailableTrack(root);
      return;
    }

    setPlayerStatus(root, '浏览器限制了自动播放，点击页面任意位置后继续播放');
    bindAutoplayGestureFallback(root);
  }

  function startPlaylistAutoplay(root, options) {
    options = options || {};

    return mountPlaylist(root)
      .then(function () {
        return waitForPlaylistPlayer(root, 8000);
      })
      .then(function (audio) {
        bindPlaylistAutoSkip(root);
        if (!audio) {
          setPlayerStatus(root, '播放器加载中，稍后将自动播放');
          return;
        }

        if (!audio.paused) {
          delete root.dataset.playerSkipTries;
          setPlayerStatus(root, '歌单自动播放中');
          return;
        }

        var muted = audio.muted;
        if (options.initial) {
          audio.muted = true;
        }

        clickPlaylistControl(root, '.aplayer-icon-play');

        var playPromise = null;
        if (audio.paused && typeof audio.play === 'function') {
          try {
            playPromise = audio.play();
          } catch (error) {
            handleAutoplayRejection(root, audio, error);
            return;
          }
        }

        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(function () {
              restoreAutoplaySound(audio, muted);
              delete root.dataset.playerSkipTries;
              setPlayerStatus(root, '歌单自动播放中');
            })
            .catch(function (error) {
              handleAutoplayRejection(root, audio, error);
            });
          return;
        }

        window.setTimeout(function () {
          if (audio.paused) {
            handleAutoplayRejection(root, audio, new Error('Autoplay blocked'));
            return;
          }

          restoreAutoplaySound(audio, muted);
          delete root.dataset.playerSkipTries;
          setPlayerStatus(root, '歌单自动播放中');
        }, 360);
      });
  }

  function playFocusPlaylist(root) {
    startPlaylistAutoplay(root, { fromTimer: true });
  }

  function disableSiteBgmPlayer() {
    document.documentElement.classList.add('ap-pomodoro-mode');

    var siteAudio = document.getElementById('ap-bgm-audio');
    if (siteAudio && typeof siteAudio.pause === 'function') {
      siteAudio.pause();
    }
  }

  function restoreSiteBgmPlayer() {
    document.documentElement.classList.remove('ap-pomodoro-mode');
  }

  function createTimer(root) {
    if (root.dataset.ready === 'true') return null;
    root.dataset.ready = 'true';
    disableSiteBgmPlayer();

    var timeEl = root.querySelector('[data-ap-pomodoro-time]');
    var statusEl = root.querySelector('[data-ap-pomodoro-status]');
    var roundEl = root.querySelector('[data-ap-pomodoro-round]');
    var progressEl = root.querySelector('[data-ap-pomodoro-progress]');
    var startButton = root.querySelector('[data-ap-pomodoro-start]');
    var resetButton = root.querySelector('[data-ap-pomodoro-reset]');
    var skipButton = root.querySelector('[data-ap-pomodoro-skip]');
    var modeButtons = root.querySelectorAll('[data-ap-pomodoro-mode]');
    var progressLength = 603.19;
    var state = {
      mode: 'focus',
      remaining: modes.focus.seconds,
      running: false,
      endAt: 0,
      intervalId: 0,
      backgroundIntervalId: 0,
      backgroundFadeTimeoutId: 0,
      backgroundContainer: null,
      backgroundLayers: [],
      backgroundVisibleLayer: 0,
      miniButton: null,
      miniTimeEl: null,
      miniLabelEl: null,
      minimizeButton: null,
      panelMode: 'normal',
      round: 1
    };

    function duration() {
      return modes[state.mode].seconds;
    }

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function ensureMiniTimer() {
      if (!state.miniButton) {
        state.miniButton = document.createElement('button');
        state.miniButton.type = 'button';
        state.miniButton.className = 'ap-pomodoro-mini';
        state.miniButton.setAttribute('aria-label', '打开番茄钟');
        state.miniButton.innerHTML = [
          '<span class="ap-pomodoro-mini-tomato" aria-hidden="true"></span>',
          '<span class="ap-pomodoro-mini-copy">',
          '<strong data-ap-pomodoro-mini-time>25:00</strong>',
          '<span data-ap-pomodoro-mini-label>专注中</span>',
          '</span>'
        ].join('');
        state.miniTimeEl = state.miniButton.querySelector('[data-ap-pomodoro-mini-time]');
        state.miniLabelEl = state.miniButton.querySelector('[data-ap-pomodoro-mini-label]');
        state.miniButton.addEventListener('click', function () {
          setPanelMode('popover');
        });
        root.appendChild(state.miniButton);
      }

      if (!state.minimizeButton) {
        state.minimizeButton = document.createElement('button');
        state.minimizeButton.type = 'button';
        state.minimizeButton.className = 'ap-pomodoro-minimize';
        state.minimizeButton.setAttribute('data-ap-pomodoro-minimize', 'true');
        state.minimizeButton.innerHTML = '<i class="fas fa-compress-alt" aria-hidden="true"></i><span>收起</span>';
        state.minimizeButton.addEventListener('click', function () {
          setPanelMode(state.running ? 'minimized' : 'normal');
        });

        var hero = root.querySelector('.ap-pomodoro-hero');
        if (hero) {
          hero.appendChild(state.minimizeButton);
        } else {
          root.appendChild(state.minimizeButton);
        }
      }
    }

    function updateMiniTimer() {
      ensureMiniTimer();
      if (state.miniTimeEl) state.miniTimeEl.textContent = formatTime(state.remaining);
      if (state.miniLabelEl) state.miniLabelEl.textContent = modes[state.mode].label + (state.running ? '中' : '暂停');
    }

    function setPanelMode(mode) {
      ensureMiniTimer();

      if (mode === 'minimized' && !state.running) {
        mode = 'normal';
      }

      root.classList.toggle('is-minimized', mode === 'minimized');
      root.classList.toggle('is-popover-open', mode === 'popover');
      document.documentElement.classList.toggle('ap-pomodoro-popover-open', mode === 'popover');
      state.panelMode = mode;
    }

    function updateStartButton() {
      if (!startButton) return;
      var icon = startButton.querySelector('i');
      var label = startButton.querySelector('span');
      startButton.classList.toggle('is-running', state.running);
      if (icon) icon.className = state.running ? 'fas fa-pause' : 'fas fa-play';
      if (label) label.textContent = state.running ? '暂停' : '开始' + modes[state.mode].label;
    }

    function render() {
      if (timeEl) timeEl.textContent = formatTime(state.remaining);
      if (roundEl) roundEl.textContent = String(state.round);
      if (progressEl) {
        var ratio = duration() > 0 ? state.remaining / duration() : 0;
        progressEl.style.strokeDasharray = progressLength;
        progressEl.style.strokeDashoffset = String(progressLength * (1 - ratio));
      }

      Array.prototype.forEach.call(modeButtons, function (button) {
        button.classList.toggle('is-active', button.dataset.apPomodoroMode === state.mode);
      });

      updateStartButton();
      root.classList.toggle('is-timer-running', state.running);
      updateMiniTimer();
    }

    function stopTicking() {
      if (state.intervalId) {
        window.clearInterval(state.intervalId);
        state.intervalId = 0;
      }
    }

    function pause() {
      if (!state.running) return;
      state.remaining = Math.max(0, (state.endAt - Date.now()) / 1000);
      state.running = false;
      stopTicking();
      setPanelMode('normal');
      setStatus(modes[state.mode].label + '已暂停');
      render();
    }

    function complete() {
      var completedMode = state.mode;
      state.running = false;
      stopTicking();
      setPanelMode('normal');

      if (completedMode === 'focus' && state.round % 4 === 0) {
        setMode('long', false);
      } else {
        setMode(modes[completedMode].next, false);
      }

      if (completedMode === 'focus') {
        state.round += 1;
      }

      setStatus(modes[completedMode].label + '完成，准备开始' + modes[state.mode].label);
      render();
    }

    function tick() {
      state.remaining = Math.max(0, (state.endAt - Date.now()) / 1000);
      if (state.remaining <= 0) {
        complete();
        return;
      }

      render();
    }

    function start() {
      if (state.running) {
        pause();
        return;
      }

      state.running = true;
      state.endAt = Date.now() + state.remaining * 1000;
      setStatus(modes[state.mode].label + '进行中');
      stopTicking();
      state.intervalId = window.setInterval(tick, 250);
      playFocusPlaylist(root);
      tick();
      setPanelMode('minimized');
    }

    function reset() {
      state.running = false;
      stopTicking();
      setPanelMode('normal');
      state.remaining = duration();
      setStatus('准备开始' + modes[state.mode].label);
      render();
    }

    function setMode(mode, resetRound) {
      if (!modes[mode]) return;
      state.running = false;
      stopTicking();
      setPanelMode('normal');
      state.mode = mode;
      state.remaining = duration();
      if (resetRound) state.round = 1;
      setStatus('准备开始' + modes[state.mode].label);
      render();
    }

    function skip() {
      state.running = false;
      stopTicking();
      complete();
    }

    if (startButton) startButton.addEventListener('click', start);
    if (resetButton) resetButton.addEventListener('click', reset);
    if (skipButton) skipButton.addEventListener('click', skip);

    Array.prototype.forEach.call(modeButtons, function (button) {
      button.addEventListener('click', function () {
        setMode(button.dataset.apPomodoroMode, true);
      });
    });

    startPlaylistAutoplay(root, { initial: true });
    setupBackgroundRotation(root, state);
    render();

    return {
      destroy: function () {
        stopTicking();
        if (state.backgroundIntervalId) {
          window.clearTimeout(state.backgroundIntervalId);
          state.backgroundIntervalId = 0;
        }

        if (state.backgroundFadeTimeoutId) {
          window.clearTimeout(state.backgroundFadeTimeoutId);
          state.backgroundFadeTimeoutId = 0;
        }

        state.backgroundLayers.forEach(function (layer) {
          clearBackgroundLayer(layer);
        });
        state.backgroundLayers = [];
        if (state.backgroundContainer && state.backgroundContainer.parentNode) {
          state.backgroundContainer.parentNode.removeChild(state.backgroundContainer);
        }
      state.backgroundContainer = null;
      clearAutoplayGestureFallback(root);
        if (state.miniButton && state.miniButton.parentNode) {
          state.miniButton.parentNode.removeChild(state.miniButton);
        }
        if (state.minimizeButton && state.minimizeButton.parentNode) {
          state.minimizeButton.parentNode.removeChild(state.minimizeButton);
        }
        state.miniButton = null;
        state.miniTimeEl = null;
        state.miniLabelEl = null;
        state.minimizeButton = null;
        document.documentElement.classList.remove('ap-pomodoro-popover-open');
        root.classList.remove('is-minimized', 'is-popover-open', 'is-timer-running');
        root.classList.remove('is-bg-fading');
        delete root.dataset.bgReady;
        root.dataset.ready = 'false';
        restoreSiteBgmPlayer();
      }
    };
  }

  function init() {
    var root = document.querySelector('[data-ap-pomodoro]');
    if (!root) return;
    activeTimer = createTimer(root);
  }

  function destroy() {
    if (activeTimer && typeof activeTimer.destroy === 'function') {
      activeTimer.destroy();
    }

    activeTimer = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', destroy);
  window.addEventListener('beforeunload', destroy);
})();
