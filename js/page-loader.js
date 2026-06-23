(function () {
  var root = document.documentElement;
  var defaultMinDuration = 2600;
  var defaultMaxDuration = 9000;
  var videoMaxDuration = 18000;
  var loaderToken = 0;
  var pendingAngelNavigation = false;
  var assets = [
    '/img/angelkawaii3.gif',
    '/img/background.gif'
  ];

  function isInternetAngelPath(pathname) {
    var path = String(pathname || '').replace(/\/index\.html$/, '/');
    return path === '/internet-angel/' || path === '/internet-angel';
  }

  function isInternetAngelPage() {
    return isInternetAngelPath(window.location.pathname) ||
      !!document.querySelector('.ap-internet-angel-page');
  }

  function waitForWindowLoad(resolve) {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }

    window.addEventListener('load', resolve, { once: true });
  }

  function waitForImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  }

  function waitForVideo(video) {
    return new Promise(function (resolve) {
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      }

      function cleanup() {
        video.removeEventListener('canplaythrough', finish);
        video.removeEventListener('canplay', finish);
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('error', finish);
      }

      if (video.readyState >= 3) {
        finish();
        return;
      }

      video.addEventListener('canplaythrough', finish);
      video.addEventListener('canplay', finish);
      video.addEventListener('loadeddata', finish);
      video.addEventListener('error', finish);

      if (video.preload === 'none') video.preload = 'auto';
      try {
        video.load();
      } catch (error) {}
    });
  }

  function waitForAssets(includePageVideos) {
    var tasks = assets.map(waitForImage);
    tasks.push(new Promise(waitForWindowLoad));

    if (includePageVideos) {
      document.querySelectorAll('[data-ap-loader-video]').forEach(function (video) {
        tasks.push(waitForVideo(video));
      });
    }

    return Promise.all(tasks);
  }

  function hideLoader(token) {
    if (token !== loaderToken || !root.classList.contains('ap-page-loading')) return;

    root.classList.add('ap-loader-leaving');

    window.setTimeout(function () {
      if (token !== loaderToken) return;
      root.classList.remove('ap-page-loading');
      root.classList.remove('ap-loader-leaving');
      root.classList.add('ap-page-loaded');
    }, 650);
  }

  function startLoader(options) {
    var settings = Object.assign({
      includePageVideos: false,
      minDuration: defaultMinDuration,
      maxDuration: defaultMaxDuration
    }, options || {});
    var token = ++loaderToken;
    var startTime = Date.now();

    root.classList.remove('ap-loader-leaving');
    root.classList.add('ap-page-loading');

    Promise.race([
      waitForAssets(settings.includePageVideos),
      new Promise(function (resolve) {
        window.setTimeout(resolve, settings.maxDuration);
      })
    ]).then(function () {
      var elapsed = Date.now() - startTime;
      window.setTimeout(function () {
        hideLoader(token);
      }, Math.max(0, settings.minDuration - elapsed));
    });
  }

  function startCurrentPageLoader() {
    startLoader({
      includePageVideos: isInternetAngelPage(),
      minDuration: defaultMinDuration,
      maxDuration: isInternetAngelPage() ? videoMaxDuration : defaultMaxDuration
    });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    try {
      var url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && isInternetAngelPath(url.pathname)) {
        pendingAngelNavigation = true;
        startLoader({
          includePageVideos: false,
          minDuration: 900,
          maxDuration: defaultMaxDuration
        });
      }
    } catch (error) {}
  }, true);

  document.addEventListener('pjax:complete', function () {
    if (!pendingAngelNavigation && !isInternetAngelPage()) return;

    pendingAngelNavigation = false;
    startLoader({
      includePageVideos: isInternetAngelPage(),
      minDuration: defaultMinDuration,
      maxDuration: videoMaxDuration
    });
  });

  startCurrentPageLoader();
})();
