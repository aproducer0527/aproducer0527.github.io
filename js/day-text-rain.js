(function () {
  if (window.__apDayTextRainReady) return;
  window.__apDayTextRainReady = true;

  var root = document.documentElement;
  var layer = null;
  var dropTimer = 0;
  var observer = null;
  var activeDrops = 0;
  var maxDrops = 12;
  var lines = [
    '警惕过量摄入情感',
    '过于真实的幻像露出了天使的微笑',
    '仅靠这点数据，还不足以满足她的欲望',
    '试着认真经营一下这个游戏吧',
    '你觉得健康的活着的她就是幸福的吗',
    '帮她争取更多人的爱，为她找到你以外的归宿',
    '她终究是堕入了“直播界的深渊”',
    '人并非只追求爱欲',
    '于生存而言，精神负担也是必要的',
    '有时，爱会使人盲目',
    '你要爱她',
    '过量摄入的爱情已经超出了她的承受能力',
    '别把一昧的苛刻当作温柔',
    '爱与数据是她的精神安定剂',
    '为了成名，真的有必要连爱情都舍弃吗',
    '她远未成熟到能够触碰“真理”',
    '“金钱”无论在哪个世界都是平等的',
    '“她现在快乐吗”',
    '“幸好这只是游戏”'
  ];

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function shouldRun() {
    var path = window.location.pathname.replace(/\/index\.html$/, '/');

    return document.body &&
      path === '/' &&
      !root.classList.contains('ap-night-mode') &&
      !root.classList.contains('ap-page-loading');
  }

  function ensureLayer() {
    if (layer && document.body.contains(layer)) return layer;

    layer = document.createElement('div');
    layer.className = 'ap-day-text-rain';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }

  function clearRain() {
    if (dropTimer) {
      window.clearTimeout(dropTimer);
      dropTimer = 0;
    }

    activeDrops = 0;

    if (layer && layer.parentElement) {
      layer.remove();
    }

    layer = null;
  }

  function scheduleNextDrop() {
    if (!shouldRun()) {
      clearRain();
      return;
    }

    window.clearTimeout(dropTimer);
    dropTimer = window.setTimeout(function () {
      dropText();
      scheduleNextDrop();
    }, random(900, 2600));
  }

  function dropText() {
    if (!shouldRun() || activeDrops >= maxDrops) return;

    var node = document.createElement('div');
    var duration = random(8.2, 15.5);
    var left = random(4, 76);

    activeDrops += 1;
    node.className = 'ap-day-text-drop';
    node.textContent = lines[Math.floor(Math.random() * lines.length)];
    node.style.setProperty('--ap-day-text-left', left.toFixed(2) + 'vw');
    node.style.setProperty('--ap-day-text-duration', duration.toFixed(2) + 's');
    node.style.setProperty('--ap-day-text-drift', random(-90, 90).toFixed(0) + 'px');
    node.style.setProperty('--ap-day-text-scale', random(0.92, 1.12).toFixed(2));

    ensureLayer().appendChild(node);

    window.setTimeout(function () {
      activeDrops = Math.max(0, activeDrops - 1);
      node.remove();
    }, (duration + 0.5) * 1000);
  }

  function syncRain() {
    if (shouldRun()) {
      ensureLayer();
      if (!dropTimer) scheduleNextDrop();
      return;
    }

    clearRain();
  }

  function start() {
    syncRain();

    if (!observer) {
      observer = new MutationObserver(syncRain);
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  document.addEventListener('pjax:complete', syncRain);
  document.addEventListener('pjax:send', clearRain);
  window.addEventListener('beforeunload', clearRain);
})();
