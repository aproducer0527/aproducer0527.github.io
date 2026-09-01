(function () {
  var activeGame = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function makeGame(root) {
    var canvas = root.querySelector('[data-cat-canvas]');
    if (!canvas || canvas.dataset.ready === 'true') return null;
    canvas.dataset.ready = 'true';

    var ctx = canvas.getContext('2d');
    var scoreEl = root.querySelector('[data-cat-score]');
    var bestEl = root.querySelector('[data-cat-best]');
    var overlay = root.querySelector('[data-cat-overlay]');
    var stateEl = root.querySelector('[data-cat-state]');
    var startButton = root.querySelector('[data-cat-start]');
    var jumpButton = root.querySelector('[data-cat-jump]');
    var restartButton = root.querySelector('[data-cat-restart]');
    var bestKey = 'ap-cat-runner-best';
    var bestScore = Number.parseInt(window.localStorage.getItem(bestKey) || '0', 10) || 0;
    var rafId = 0;
    var lastTime = 0;
    var running = false;
    var ended = false;
    var score = 0;
    var scoreProgress = 0;
    var speed = 330;
    var spawnTimer = 0;
    var groundY = 292;
    var cat = {
      x: 112,
      y: groundY - 56,
      width: 58,
      height: 50,
      vy: 0,
      grounded: true,
      blink: 0
    };
    var catImage = new Image();
    var catImageReady = false;
    var catImageFailed = false;
    var bins = [];
    var clouds = [
      { x: 120, y: 62, s: 1 },
      { x: 430, y: 88, s: 0.8 },
      { x: 760, y: 58, s: 1.1 }
    ];

    catImage.onload = function () {
      catImageReady = true;
      if (!running) draw();
    };
    catImage.onerror = function () {
      catImageFailed = true;
    };
    catImage.src = '/img/cat.png';

    bestEl.textContent = bestScore;

    function reset() {
      running = false;
      ended = false;
      score = 0;
      scoreProgress = 0;
      speed = 330;
      spawnTimer = 0;
      bins = [];
      cat.y = groundY - 56;
      cat.vy = 0;
      cat.grounded = true;
      updateScore();
      showOverlay('准备');
      draw();
    }

    function start() {
      if (running) return;
      if (ended) reset();
      running = true;
      ended = false;
      overlay.classList.add('is-hidden');
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(loop);
    }

    function gameOver() {
      running = false;
      ended = true;
      if (score > bestScore) {
        bestScore = score;
        window.localStorage.setItem(bestKey, String(bestScore));
        bestEl.textContent = bestScore;
      }
      showOverlay('结束');
      draw();
    }

    function showOverlay(text) {
      stateEl.textContent = text;
      startButton.textContent = ended ? '再来' : '开始';
      overlay.classList.remove('is-hidden');
    }

    function updateScore() {
      scoreEl.textContent = String(score);
    }

    function jump() {
      if (!running) {
        start();
        return;
      }

      if (!cat.grounded) return;
      cat.vy = -690;
      cat.grounded = false;
    }

    function spawnBin() {
      var tall = Math.random() > 0.62;
      bins.push({
        x: canvas.width + 30,
        y: groundY - (tall ? 62 : 48),
        width: tall ? 44 : 40,
        height: tall ? 62 : 48,
        wobble: Math.random() * Math.PI
      });
    }

    function loop(now) {
      var dt = clamp((now - lastTime) / 1000, 0, 0.033);
      lastTime = now;
      update(dt);
      draw();
      if (running) rafId = window.requestAnimationFrame(loop);
    }

    function update(dt) {
      var gravity = 1780;
      speed += dt * 9;
      scoreProgress += dt * 12;
      if (Math.trunc(scoreProgress) !== score) {
        score = Math.trunc(scoreProgress);
        updateScore();
      }

      cat.vy += gravity * dt;
      cat.y += cat.vy * dt;
      if (cat.y >= groundY - cat.height) {
        cat.y = groundY - cat.height;
        cat.vy = 0;
        cat.grounded = true;
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnBin();
        spawnTimer = Math.max(0.68, 1.26 - score / 420) + Math.random() * 0.42;
      }

      bins.forEach(function (bin) {
        bin.x -= speed * dt;
        bin.wobble += dt * 5;
      });
      bins = bins.filter(function (bin) {
        return bin.x + bin.width > -20;
      });

      clouds.forEach(function (cloud) {
        cloud.x -= dt * 24 * cloud.s;
        if (cloud.x < -120) cloud.x = canvas.width + 100;
      });

      if (bins.some(hitTest)) gameOver();
    }

    function hitTest(bin) {
      var catBox = {
        x: cat.x + 10,
        y: cat.y + 10,
        width: cat.width - 18,
        height: cat.height - 12
      };
      var binBox = {
        x: bin.x + 6,
        y: bin.y + 8,
        width: bin.width - 12,
        height: bin.height - 8
      };

      return catBox.x < binBox.x + binBox.width &&
        catBox.x + catBox.width > binBox.x &&
        catBox.y < binBox.y + binBox.height &&
        catBox.y + catBox.height > binBox.y;
    }

    function clear() {
      var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#ffeaf8');
      gradient.addColorStop(0.58, '#f7fbff');
      gradient.addColorStop(1, '#fff3d7');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawCloud(cloud) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 22 * cloud.s, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24 * cloud.s, cloud.y - 8 * cloud.s, 28 * cloud.s, 0, Math.PI * 2);
      ctx.arc(cloud.x + 56 * cloud.s, cloud.y, 22 * cloud.s, 0, Math.PI * 2);
      ctx.rect(cloud.x, cloud.y, 58 * cloud.s, 22 * cloud.s);
      ctx.fill();
      ctx.restore();
    }

    function drawGround() {
      ctx.fillStyle = '#f3d9b8';
      ctx.fillRect(0, groundY, canvas.width, 68);
      ctx.fillStyle = '#d1f4e8';
      ctx.fillRect(0, groundY - 8, canvas.width, 10);
      ctx.strokeStyle = 'rgba(190, 132, 92, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = -20; x < canvas.width + 30; x += 36) {
        ctx.moveTo(x, groundY + 24);
        ctx.lineTo(x + 18, groundY + 20);
      }
      ctx.stroke();
    }

    function drawCat() {
      var x = cat.x;
      var y = cat.y;
      var bob = cat.grounded && running ? Math.sin(score * 0.9) * 2 : 0;

      ctx.save();
      ctx.translate(x, y + bob);

      if (catImageReady && !catImageFailed) {
        var ratio = catImage.naturalWidth / catImage.naturalHeight || 1;
        var drawHeight = 64;
        var drawWidth = drawHeight * ratio;
        if (drawWidth > 82) {
          drawWidth = 82;
          drawHeight = drawWidth / ratio;
        }

        ctx.shadowColor = 'rgba(122, 74, 98, 0.24)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        ctx.drawImage(
          catImage,
          (cat.width - drawWidth) / 2,
          cat.height - drawHeight + 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();
        return;
      }

      ctx.fillStyle = '#ffb4d7';
      ctx.strokeStyle = '#7a4a62';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(12, 18);
      ctx.lineTo(21, 2);
      ctx.lineTo(31, 17);
      ctx.lineTo(44, 2);
      ctx.lineTo(52, 20);
      ctx.quadraticCurveTo(58, 42, 38, 48);
      ctx.lineTo(20, 48);
      ctx.quadraticCurveTo(1, 42, 6, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff2fb';
      ctx.beginPath();
      ctx.ellipse(29, 35, 17, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#5a3548';
      ctx.beginPath();
      ctx.arc(22, 25, 3.5, 0, Math.PI * 2);
      ctx.arc(40, 25, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#5a3548';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(31, 29);
      ctx.lineTo(31, 33);
      ctx.moveTo(31, 33);
      ctx.quadraticCurveTo(25, 36, 20, 34);
      ctx.moveTo(31, 33);
      ctx.quadraticCurveTo(37, 36, 42, 34);
      ctx.stroke();

      ctx.strokeStyle = '#7a4a62';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 41);
      ctx.quadraticCurveTo(-12, 35, -2, 22);
      ctx.stroke();

      ctx.restore();
    }

    function drawBin(bin) {
      var tilt = Math.sin(bin.wobble) * 0.03;
      ctx.save();
      ctx.translate(bin.x + bin.width / 2, bin.y + bin.height / 2);
      ctx.rotate(tilt);
      ctx.translate(-bin.width / 2, -bin.height / 2);

      ctx.fillStyle = '#7ac9b7';
      ctx.strokeStyle = '#3f766c';
      ctx.lineWidth = 3;
      roundedRect(4, 9, bin.width - 8, bin.height - 10, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5ba99b';
      ctx.fillRect(0, 5, bin.width, 9);
      ctx.fillStyle = '#eafbf6';
      ctx.fillRect(16, 0, bin.width - 32, 6);

      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, 20);
      ctx.lineTo(15, bin.height - 8);
      ctx.moveTo(bin.width - 15, 20);
      ctx.lineTo(bin.width - 15, bin.height - 8);
      ctx.stroke();

      ctx.restore();
    }

    function draw() {
      clear();
      clouds.forEach(drawCloud);

      ctx.fillStyle = 'rgba(255, 105, 190, 0.12)';
      ctx.beginPath();
      ctx.arc(810, 78, 42, 0, Math.PI * 2);
      ctx.fill();

      drawGround();
      bins.forEach(drawBin);
      drawCat();

    }

    function roundedRect(x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    function onKeyDown(event) {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        jump();
      }
    }

    startButton.addEventListener('click', start);
    restartButton.addEventListener('click', function () {
      reset();
      start();
    });
    jumpButton.addEventListener('click', jump);
    canvas.addEventListener('pointerdown', jump);
    document.addEventListener('keydown', onKeyDown);

    reset();

    return {
      destroy: function () {
        window.cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKeyDown);
        canvas.dataset.ready = 'false';
      }
    };
  }

  function init() {
    var root = document.querySelector('[data-cat-runner]');
    if (!root) return;
    if (activeGame) activeGame.destroy();
    activeGame = makeGame(root);
  }

  function destroy() {
    if (!activeGame) return;
    activeGame.destroy();
    activeGame = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', destroy);
})();
