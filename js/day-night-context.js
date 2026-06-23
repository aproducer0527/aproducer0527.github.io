(function () {
  if (window.__apDayNightContextReady) return;
  window.__apDayNightContextReady = true;

  var root = document.documentElement;
  var menu = null;
  var transitionTimer = 0;

  try {
    window.localStorage.removeItem('ap-day-night-mode');
  } catch (error) {}

  function getMode() {
    return root.classList.contains('ap-night-mode') ? 'night' : 'day';
  }

  function applyMode(mode) {
    root.classList.toggle('ap-night-mode', mode === 'night');
    updateModeButton();
  }

  function runModeTransition(nextMode, x, y) {
    window.clearTimeout(transitionTimer);

    var wipe = document.createElement('div');
    wipe.className = 'ap-mode-transition ' + (nextMode === 'night' ? 'is-night' : 'is-day');
    wipe.style.setProperty('--ap-mode-x', x + 'px');
    wipe.style.setProperty('--ap-mode-y', y + 'px');
    wipe.innerHTML = '<span>' + (nextMode === 'night' ? '夜幕展开中...' : '白昼同步中...') + '</span>';
    document.body.appendChild(wipe);

    window.setTimeout(function () {
      wipe.classList.add('is-active');
    }, 20);

    window.setTimeout(function () {
      applyMode(nextMode);
    }, 280);

    transitionTimer = window.setTimeout(function () {
      wipe.classList.add('is-leaving');
      window.setTimeout(function () {
        wipe.remove();
      }, 420);
    }, 860);
  }

  function toggleMode(x, y) {
    var nextMode = getMode() === 'night' ? 'day' : 'night';
    runModeTransition(nextMode, x || window.innerWidth / 2, y || window.innerHeight / 2);
  }

  function createMenu() {
    var node = document.createElement('div');
    node.className = 'ap-context-menu';
    node.setAttribute('role', 'menu');
    node.innerHTML = [
      '<button type="button" role="menuitem" data-ap-action="back"><i class="fas fa-arrow-left"></i><span>返回上一级</span></button>',
      '<button type="button" role="menuitem" data-ap-action="home"><i class="fas fa-house"></i><span>回到主页</span></button>',
      '<button type="button" role="menuitem" data-ap-action="mode"><i class="fas fa-moon"></i><span data-ap-mode-label>切换昼夜模式</span></button>'
    ].join('');
    document.body.appendChild(node);
    return node;
  }

  function getMenu() {
    if (!menu || !document.body.contains(menu)) {
      menu = createMenu();
      menu.addEventListener('click', onMenuClick);
    }
    return menu;
  }

  function updateModeButton() {
    if (!menu) return;

    var icon = menu.querySelector('[data-ap-action="mode"] i');
    var label = menu.querySelector('[data-ap-mode-label]');
    var isNight = getMode() === 'night';

    icon.className = isNight ? 'fas fa-sun' : 'fas fa-moon';
    label.textContent = '切换昼夜模式';
  }

  function showMenu(event) {
    var target = event.target;
    if (target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    event.preventDefault();

    var node = getMenu();
    updateModeButton();
    node.classList.add('is-open');
    node.style.left = '0px';
    node.style.top = '0px';

    window.requestAnimationFrame(function () {
      var rect = node.getBoundingClientRect();
      var x = Math.min(event.clientX, window.innerWidth - rect.width - 10);
      var y = Math.min(event.clientY, window.innerHeight - rect.height - 10);

      node.style.left = Math.max(10, x) + 'px';
      node.style.top = Math.max(10, y) + 'px';
    });
  }

  function hideMenu() {
    if (menu) menu.classList.remove('is-open');
  }

  function goHome() {
    window.location.href = '/';
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    goHome();
  }

  function onMenuClick(event) {
    var button = event.target.closest('button[data-ap-action]');
    if (!button) return;

    var action = button.dataset.apAction;
    var rect = button.getBoundingClientRect();
    hideMenu();

    if (action === 'back') goBack();
    if (action === 'home') goHome();
    if (action === 'mode') toggleMode(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  document.addEventListener('contextmenu', showMenu);
  document.addEventListener('click', hideMenu, true);
  document.addEventListener('scroll', hideMenu, true);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') hideMenu();
  });
  window.addEventListener('blur', hideMenu);

  updateModeButton();
})();
