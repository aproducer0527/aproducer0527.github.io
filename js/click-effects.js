(function () {
  var symbols = ['♥', '✦', '✧', '♡','†升天†'];
  var colors = ['#ff78d2', '#7ee7ff', '#ffe66d', '#c9a6ff'];
  var lastTime = 0;

  function spawnClickEffect(event) {
    var now = Date.now();
    if (now - lastTime < 80) return;
    lastTime = now;

    var target = event.target;
    if (target && target.closest && target.closest('a, button, input, textarea, select, iframe, .ap-bgm-player, .ap-game-page')) {
      return;
    }

    var count = 6;
    for (var i = 0; i < count; i += 1) {
      var el = document.createElement('span');
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
      var distance = 28 + Math.random() * 22;

      el.className = 'ap-click-effect';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = event.clientX + 'px';
      el.style.top = event.clientY + 'px';
      el.style.color = colors[i % colors.length];
      el.style.setProperty('--ap-x', Math.cos(angle) * distance + 'px');
      el.style.setProperty('--ap-y', Math.sin(angle) * distance + 'px');
      el.style.setProperty('--ap-r', (Math.random() * 120 - 60) + 'deg');

      document.body.appendChild(el);
      window.setTimeout(function (node) {
        node.remove();
      }, 820, el);
    }
  }

  document.addEventListener('click', spawnClickEffect, { passive: true });
})();
