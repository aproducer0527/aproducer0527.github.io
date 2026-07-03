(function (global) {
  'use strict';

  if (global.__apDesktopPetReady) return;
  global.__apDesktopPetReady = true;

  var CDN = {
    pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
    live2dCore2: 'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js',
    cubism2: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js',
    model: 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@0.4.0/test/assets/shizuku/shizuku.model.json'
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateKey(date) {
    var safeDate = date instanceof Date ? date : new Date();
    return [
      safeDate.getFullYear(),
      pad(safeDate.getMonth() + 1),
      pad(safeDate.getDate())
    ].join('-');
  }

  function planStorageKey(date) {
    return 'ap-daily-plan:' + formatDateKey(date);
  }

  function createPlanItem(text, date) {
    var now = date instanceof Date ? date : new Date();
    return {
      id: 'plan-' + now.getTime() + '-' + Math.random().toString(36).slice(2, 8),
      text: String(text || '').trim(),
      done: false,
      createdAt: now.toISOString()
    };
  }

  function normalizePlanList(list) {
    if (!Array.isArray(list)) return [];

    return list
      .map(function (item) {
        if (!item || typeof item !== 'object') return null;

        var text = String(item.text || '').trim();
        if (!text) return null;

        return {
          id: String(item.id || createPlanItem(text).id),
          text: text,
          done: Boolean(item.done),
          createdAt: String(item.createdAt || new Date().toISOString())
        };
      })
      .filter(Boolean);
  }

  function togglePlanDone(list, id, done) {
    return normalizePlanList(list).map(function (item) {
      if (item.id !== id) return item;
      return {
        id: item.id,
        text: item.text,
        done: Boolean(done),
        createdAt: item.createdAt
      };
    });
  }

  function removePlanItem(list, id) {
    return normalizePlanList(list).filter(function (item) {
      return item.id !== id;
    });
  }

  var utils = {
    formatDateKey: formatDateKey,
    planStorageKey: planStorageKey,
    createPlanItem: createPlanItem,
    normalizePlanList: normalizePlanList,
    togglePlanDone: togglePlanDone,
    removePlanItem: removePlanItem
  };

  global.APDesktopPetUtils = utils;

  var document = global.document;
  if (!document || !document.body) return;

  var state = {
    root: null,
    stage: null,
    canvas: null,
    fallback: null,
    bubble: null,
    panel: null,
    form: null,
    input: null,
    list: null,
    empty: null,
    dateLabel: null,
    app: null,
    model: null,
    plans: [],
    rafId: 0,
    pendingPointer: null,
    outsideClickHandler: null,
    resizeHandler: null
  };

  function todayKey() {
    return planStorageKey(new Date());
  }

  function readPlans() {
    try {
      return normalizePlanList(JSON.parse(global.localStorage.getItem(todayKey()) || '[]'));
    } catch (error) {
      return [];
    }
  }

  function writePlans(plans) {
    state.plans = normalizePlanList(plans);

    try {
      global.localStorage.setItem(todayKey(), JSON.stringify(state.plans));
    } catch (error) {
      setBubble('当前浏览器限制了本地保存');
    }
  }

  function setBubble(text) {
    if (!state.bubble) return;
    state.bubble.textContent = text;
    state.bubble.classList.add('is-visible');

    global.clearTimeout(state.bubbleTimer);
    state.bubbleTimer = global.setTimeout(function () {
      if (state.bubble) state.bubble.classList.remove('is-visible');
    }, 3200);
  }

  function loadScript(src, key) {
    var existing = document.querySelector('script[data-ap-desktop-pet-script="' + key + '"]');
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
      script.dataset.apDesktopPetScript = key;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function ensureLive2DAssets() {
    return loadScript(CDN.pixi, 'pixi')
      .then(function () {
        return loadScript(CDN.live2dCore2, 'live2d-core2');
      })
      .then(function () {
        return loadScript(CDN.cubism2, 'cubism2');
      });
  }

  function createRoot() {
    var root = document.createElement('aside');
    root.className = 'ap-desktop-pet';
    root.setAttribute('data-ap-desktop-pet', 'true');
    root.setAttribute('aria-label', '桌宠助手');
    root.innerHTML = [
      '<div class="ap-desktop-pet-stage" data-ap-desktop-pet-stage>',
      '<canvas class="ap-desktop-pet-canvas" data-ap-desktop-pet-canvas></canvas>',
      '<button class="ap-desktop-pet-fallback" type="button" data-ap-desktop-pet-fallback aria-label="打开每日计划单">',
      '<span class="ap-desktop-pet-face" aria-hidden="true">AP</span>',
      '<span>今日计划</span>',
      '</button>',
      '</div>',
      '<div class="ap-desktop-pet-bubble" data-ap-desktop-pet-bubble>右键我打开每日计划</div>',
      '<section class="ap-daily-plan" data-ap-daily-plan aria-label="每日计划单">',
      '<header class="ap-daily-plan-head">',
      '<div><p>Daily Plan</p><h3>每日计划单</h3></div>',
      '<span data-ap-plan-date></span>',
      '</header>',
      '<form class="ap-daily-plan-form" data-ap-plan-form>',
      '<input data-ap-plan-input type="text" maxlength="80" placeholder="写下今天要完成的事" autocomplete="off">',
      '<button type="submit" aria-label="添加计划"><i class="fas fa-plus"></i></button>',
      '</form>',
      '<ul class="ap-daily-plan-list" data-ap-plan-list></ul>',
      '<p class="ap-daily-plan-empty" data-ap-plan-empty>今天还没有计划</p>',
      '</section>'
    ].join('');

    document.body.appendChild(root);

    state.root = root;
    state.stage = root.querySelector('[data-ap-desktop-pet-stage]');
    state.canvas = root.querySelector('[data-ap-desktop-pet-canvas]');
    state.fallback = root.querySelector('[data-ap-desktop-pet-fallback]');
    state.bubble = root.querySelector('[data-ap-desktop-pet-bubble]');
    state.panel = root.querySelector('[data-ap-daily-plan]');
    state.form = root.querySelector('[data-ap-plan-form]');
    state.input = root.querySelector('[data-ap-plan-input]');
    state.list = root.querySelector('[data-ap-plan-list]');
    state.empty = root.querySelector('[data-ap-plan-empty]');
    state.dateLabel = root.querySelector('[data-ap-plan-date]');
  }

  function renderPlans() {
    if (!state.list || !state.empty) return;

    state.list.textContent = '';
    state.empty.hidden = state.plans.length > 0;

    state.plans.forEach(function (item) {
      var row = document.createElement('li');
      row.className = item.done ? 'is-done' : '';
      row.dataset.planId = item.id;
      row.innerHTML = [
        '<label>',
        '<input type="checkbox" data-ap-plan-toggle ' + (item.done ? 'checked' : '') + '>',
        '<span></span>',
        '</label>',
        '<button type="button" data-ap-plan-delete aria-label="删除计划"><i class="fas fa-xmark"></i></button>'
      ].join('');

      row.querySelector('label span').textContent = item.text;
      state.list.appendChild(row);
    });
  }

  function openPlanPanel() {
    if (!state.panel) return;

    state.plans = readPlans();
    if (state.dateLabel) state.dateLabel.textContent = formatDateKey(new Date());
    renderPlans();

    state.root.classList.add('is-plan-open');
    if (state.input) {
      global.setTimeout(function () {
        state.input.focus();
      }, 80);
    }
  }

  function closePlanPanel() {
    if (state.root) state.root.classList.remove('is-plan-open');
  }

  function addPlan(text) {
    var item = createPlanItem(text);
    if (!item.text) return;

    writePlans(state.plans.concat(item));
    renderPlans();
    setBubble('已加入今日计划');
  }

  function bindPlanEvents() {
    state.stage.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPlanPanel();
    });

    state.fallback.addEventListener('click', function () {
      openPlanPanel();
    });

    state.panel.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      event.stopPropagation();
    });

    state.form.addEventListener('submit', function (event) {
      event.preventDefault();
      addPlan(state.input.value);
      state.input.value = '';
    });

    state.list.addEventListener('click', function (event) {
      var row = event.target.closest('li[data-plan-id]');
      if (!row) return;

      if (event.target.closest('[data-ap-plan-toggle]')) {
        writePlans(togglePlanDone(state.plans, row.dataset.planId, event.target.checked));
        renderPlans();
        return;
      }

      if (event.target.closest('[data-ap-plan-delete]')) {
        writePlans(removePlanItem(state.plans, row.dataset.planId));
        renderPlans();
        setBubble('计划已删除');
      }
    });

    state.outsideClickHandler = function (event) {
      if (!state.root.classList.contains('is-plan-open')) return;
      if (state.root.contains(event.target)) return;
      closePlanPanel();
    };

    document.addEventListener('pointerdown', state.outsideClickHandler, true);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closePlanPanel();
    });
  }

  function resizeLive2D() {
    if (!state.app || !state.model || !state.stage) return;

    var rect = state.stage.getBoundingClientRect();
    var width = Math.max(180, Math.floor(rect.width));
    var height = Math.max(220, Math.floor(rect.height));

    state.app.renderer.resize(width, height);

    var scale = Math.min(width / Math.max(1, state.model.width), height / Math.max(1, state.model.height)) * 0.96;
    if (Number.isFinite(scale) && scale > 0) {
      state.model.scale.set(scale);
    }

    if (state.model.anchor && typeof state.model.anchor.set === 'function') {
      state.model.anchor.set(0.5, 1);
    }

    state.model.x = width / 2;
    state.model.y = height * 0.98;
  }

  function focusModel(pointer) {
    if (!state.model || typeof state.model.focus !== 'function' || !state.stage) return;

    var rect = state.stage.getBoundingClientRect();
    var x = Math.max(0, Math.min(rect.width, pointer.x - rect.left));
    var y = Math.max(0, Math.min(rect.height, pointer.y - rect.top));

    state.model.focus(x, y);
  }

  function bindPointerFocus() {
    document.addEventListener('pointermove', function (event) {
      state.pendingPointer = { x: event.clientX, y: event.clientY };
      if (state.rafId) return;

      state.rafId = global.requestAnimationFrame(function () {
        state.rafId = 0;
        if (state.pendingPointer) focusModel(state.pendingPointer);
      });
    }, { passive: true });
  }

  function showFallback(reason) {
    if (state.root) state.root.classList.add('is-fallback');
    if (state.canvas) state.canvas.hidden = true;
    if (state.fallback) state.fallback.hidden = false;
    if (reason) console.warn('[desktop-pet] Live2D fallback:', reason);
    setBubble('桌宠已切换为轻量模式');
  }

  function initLive2D() {
    if (!state.canvas) return Promise.reject(new Error('Missing canvas'));

    return ensureLive2DAssets()
      .then(function () {
        if (!global.PIXI || !global.PIXI.live2d || !global.PIXI.live2d.Live2DModel) {
          throw new Error('PIXI Live2D runtime is unavailable');
        }

        state.app = new global.PIXI.Application({
          view: state.canvas,
          transparent: true,
          autoStart: true,
          antialias: true,
          width: 240,
          height: 300
        });

        return global.PIXI.live2d.Live2DModel.from(CDN.model, {
          autoInteract: false
        });
      })
      .then(function (model) {
        state.model = model;
        state.app.stage.addChild(model);
        state.root.classList.add('is-live2d-ready');
        if (state.fallback) state.fallback.hidden = true;

        resizeLive2D();
        bindPointerFocus();
        setBubble('右键我打开每日计划');

        state.resizeHandler = resizeLive2D;
        global.addEventListener('resize', state.resizeHandler);
      })
      .catch(function (error) {
        showFallback(error && error.message ? error.message : error);
      });
  }

  function destroy() {
    if (state.resizeHandler) {
      global.removeEventListener('resize', state.resizeHandler);
      state.resizeHandler = null;
    }

    if (state.outsideClickHandler) {
      document.removeEventListener('pointerdown', state.outsideClickHandler, true);
      state.outsideClickHandler = null;
    }

    if (state.rafId) {
      global.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (state.app && typeof state.app.destroy === 'function') {
      state.app.destroy(true, { children: true, texture: false, baseTexture: false });
    }

    if (state.root && state.root.parentNode) {
      state.root.parentNode.removeChild(state.root);
    }

    state.root = null;
    state.app = null;
    state.model = null;
    global.__apDesktopPetReady = false;
  }

  function init() {
    if (document.querySelector('[data-ap-desktop-pet]')) return;

    createRoot();
    state.plans = readPlans();
    bindPlanEvents();
    renderPlans();
    initLive2D();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
  global.addEventListener('beforeunload', destroy);
})(typeof window !== 'undefined' ? window : globalThis);
