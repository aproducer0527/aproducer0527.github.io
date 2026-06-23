(function () {
  var tracks = [
    {
      title: '日陰と帽子と風鈴と',
      artist: 'Foxtail-Grass Studio',
      id: '730806'
    },
    {
      title: 'God knows...',
      artist: '平野綾',
      id: '22826401'
    },
    {
      title: 'INTERNET ANGEL',
      artist: 'Aiobahn +81 / 超てんちゃん',
      id: '3360515719'
    },
    {
      title: '月虹蝶',
      artist: 'NEEDY GIRL OVERDOSE / KOTOKO / Aiobahn +81',
      id: '2117884990'
    },
    {
      title: 'INTERNET YAMERO',
      artist: 'NEEDY GIRL OVERDOSE / KOTOKO / Aiobahn +81',
      id: '2029212574'
    },
    {
      title: 'INTERNET OVERDOSE',
      artist: 'NEEDY GIRL OVERDOSE / Aiobahn / KOTOKO',
      id: '1915700974'
    },
    {
      title: 'Approval desire',
      artist: 'NEEDY GIRL OVERDOSE / Aiobahn +81',
      id: '1915699226'
    },
    {
      title:'你的泪 我的雨季',
      artist:'Seto',
      id:'3374424995'
    },
    {
      title: '過ぎ去りし夏',
      artist: 'Aleile / 麻枝准',
      id: '689636'
    },
    {
      title: '暮春',
      artist: 'Vuxa',
      id: '2089844456'
    },
    {
      title: '秋鳴りシンフォニー',
      artist: 'Foxtail-Grass Studio',
      id: '730856'
    }
  ];

  var player = document.getElementById('ap-bgm-player');
  if (!player || player.dataset.ready === 'true') return;
  player.dataset.ready = 'true';

  var audio = document.getElementById('ap-bgm-audio');
  var title = document.getElementById('ap-bgm-title');
  var subtitle = document.getElementById('ap-bgm-subtitle');
  var list = document.getElementById('ap-bgm-list');
  var toggle = player.querySelector('.ap-bgm-toggle');
  var close = player.querySelector('.ap-bgm-close');
  var prev = player.querySelector('.ap-bgm-prev');
  var next = player.querySelector('.ap-bgm-next');
  var current = 0;

  function makeSrc(track) {
    return 'https://music.163.com/song/media/outer/url?id=' + encodeURIComponent(track.id) + '.mp3';
  }

  function setOpen(open) {
    player.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setTrack(index, autoplay) {
    if (!tracks.length || !audio) return;
    current = (index + tracks.length) % tracks.length;

    var track = tracks[current];
    title.textContent = track.title;
    subtitle.textContent = track.artist || ('网易云音乐 ID: ' + track.id);
    audio.pause();
    audio.src = makeSrc(track);
    audio.load();

    if (autoplay) {
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {});
      }
    }

    Array.prototype.forEach.call(list.querySelectorAll('.ap-bgm-track'), function (item, itemIndex) {
      item.classList.toggle('is-active', itemIndex === current);
      item.setAttribute('aria-current', itemIndex === current ? 'true' : 'false');
    });
  }

  function createTrackButton(track, index) {
    var button = document.createElement('button');
    var number = document.createElement('span');
    var text = document.createElement('span');
    var name = document.createElement('span');
    var meta = document.createElement('span');

    button.className = 'ap-bgm-track';
    button.type = 'button';
    number.className = 'ap-bgm-track-index';
    text.className = 'ap-bgm-track-text';
    name.className = 'ap-bgm-track-name';
    meta.className = 'ap-bgm-track-meta';

    number.textContent = String(index + 1).padStart(2, '0');
    name.textContent = track.title;
    meta.textContent = track.artist || ('网易云音乐 ID: ' + track.id);

    text.appendChild(name);
    text.appendChild(meta);
    button.appendChild(number);
    button.appendChild(text);

    button.addEventListener('click', function () {
      setOpen(true);
      setTrack(index, true);
    });

    return button;
  }

  function renderList() {
    list.textContent = '';
    tracks.forEach(function (track, index) {
      list.appendChild(createTrackButton(track, index));
    });

    prev.disabled = tracks.length < 2;
    next.disabled = tracks.length < 2;
  }

  toggle.addEventListener('click', function () {
    setOpen(!player.classList.contains('is-open'));
  });

  close.addEventListener('click', function () {
    setOpen(false);
  });

  prev.addEventListener('click', function () {
    setOpen(true);
    setTrack(current - 1, true);
  });

  next.addEventListener('click', function () {
    setOpen(true);
    setTrack(current + 1, true);
  });

  if (audio) {
    audio.addEventListener('ended', function () {
      setTrack(current + 1, true);
    });
  }

  renderList();
  setTrack(0, false);
  setOpen(false);
})();
