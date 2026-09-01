(function () {
  if (window.__apClockReady) return;
  window.__apClockReady = true;

  var weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var timer = null;
  var weatherTimer = null;
  var weatherLoading = false;
  var weatherCacheKey = 'ap-weather-cache-v3';

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function createClock() {
    var clock = document.createElement('div');
    clock.className = 'card-widget ap-clock';
    clock.id = 'ap-clock';
    clock.setAttribute('aria-label', '当前时间');
    clock.innerHTML = [
      '<div class="ap-clock-top">',
      '<i class="fas fa-clock"></i>',
      '<span id="ap-clock-week">星期</span>',
      '</div>',
      '<div class="ap-clock-time" id="ap-clock-time">00:00:00</div>',
      '<div class="ap-clock-date" id="ap-clock-date">0000-00-00</div>',
      '<div class="ap-clock-weather" id="ap-clock-weather">',
      '<div class="ap-weather-main">',
      '<i class="fas fa-cloud-sun" id="ap-weather-icon"></i>',
      '<span id="ap-weather-text">天气未配置</span>',
      '</div>',
      '<div class="ap-weather-meta" id="ap-weather-meta">填写高德和和风天气 Key 后显示</div>',
      '<div class="ap-weather-details" id="ap-weather-details" hidden></div>',
      '</div>'
    ].join('');
    return clock;
  }

  function mountClock() {
    var aside = document.getElementById('aside-content');
    if (!aside) return null;

    var sticky = aside.querySelector('.sticky_layout') || aside;
    var clock = document.getElementById('ap-clock') || createClock();

    clock.classList.add('card-widget', 'ap-clock');
    if (clock.parentElement !== sticky || sticky.firstElementChild !== clock) {
      sticky.insertBefore(clock, sticky.firstElementChild);
    }

    return clock;
  }

  function updateClock() {
    var clock = mountClock();
    if (!clock) return;

    var timeEl = clock.querySelector('#ap-clock-time');
    var dateEl = clock.querySelector('#ap-clock-date');
    var weekEl = clock.querySelector('#ap-clock-week');
    var now = new Date();
    var year = now.getFullYear();
    var month = pad(now.getMonth() + 1);
    var day = pad(now.getDate());
    var hour = pad(now.getHours());
    var minute = pad(now.getMinutes());
    var second = pad(now.getSeconds());

    timeEl.textContent = hour + ':' + minute + ':' + second;
    dateEl.textContent = year + '-' + month + '-' + day;
    weekEl.textContent = weekNames[now.getDay()];
  }

  function getWeatherConfig() {
    var config = window.AP_WEATHER_CONFIG || {};
    return {
      amapKey: String(config.amapKey || '').trim(),
      qweatherKey: String(config.qweatherKey || '').trim(),
      qweatherToken: String(config.qweatherToken || '').trim(),
      qweatherHost: String(config.qweatherHost || 'https://devapi.qweather.com').replace(/\/$/, ''),
      cacheMs: Math.max(5, Number(config.cacheMinutes || 30)) * 60 * 1000
    };
  }

  function setWeatherDetails(detailsEl, details) {
    detailsEl.innerHTML = '';

    if (!Array.isArray(details) || !details.length) {
      detailsEl.hidden = true;
      return;
    }

    details.forEach(function (item) {
      if (!item || !item.label || !item.value) return;

      var row = document.createElement('div');
      row.className = 'ap-weather-line';

      var label = document.createElement('span');
      label.textContent = item.label;

      var value = document.createElement('strong');
      value.textContent = item.value;
      value.title = item.value;

      row.appendChild(label);
      row.appendChild(value);
      detailsEl.appendChild(row);
    });

    detailsEl.hidden = detailsEl.children.length === 0;
  }

  function setWeather(iconClass, text, meta, details) {
    var clock = mountClock();
    if (!clock) return;

    var iconEl = clock.querySelector('#ap-weather-icon');
    var textEl = clock.querySelector('#ap-weather-text');
    var metaEl = clock.querySelector('#ap-weather-meta');
    var detailsEl = clock.querySelector('#ap-weather-details');

    iconEl.className = iconClass;
    textEl.textContent = text;
    metaEl.textContent = meta;
    setWeatherDetails(detailsEl, details);
  }

  function readWeatherCache(cacheMs) {
    try {
      var raw = window.localStorage.getItem(weatherCacheKey);
      if (!raw) return null;

      var cache = JSON.parse(raw);
      if (!cache || Date.now() - cache.time > cacheMs) return null;
      return cache.data;
    } catch (error) {
      return null;
    }
  }

  function writeWeatherCache(data) {
    try {
      window.localStorage.setItem(weatherCacheKey, JSON.stringify({
        time: Date.now(),
        data: data
      }));
    } catch (error) {}
  }

  function fetchJson(url, options) {
    return window.fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(function (response) {
      return response.text().then(function (text) {
        var data = null;

        if (text) {
          try {
            data = JSON.parse(text);
          } catch (error) {
            data = null;
          }
        }

        if (!response.ok) {
          var message = 'HTTP ' + response.status;
          if (data && data.error && data.error.title) message = data.error.title;
          if (data && data.error && data.error.detail) message += '：' + data.error.detail;
          throw new Error(message);
        }

        return data || {};
      });
    });
  }

  function buildUrl(host, path, params) {
    var query = Object.keys(params || {}).filter(function (key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== '';
    }).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');

    return host + path + (query ? '?' + query : '');
  }

  function withQweatherKey(url, config) {
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'key=' + encodeURIComponent(config.qweatherKey);
  }

  function qweatherRequest(url, config) {
    if (config.qweatherToken) {
      return fetchJson(url, {
        headers: {
          Authorization: 'Bearer ' + config.qweatherToken
        }
      });
    }

    return fetchJson(withQweatherKey(url, config));
  }

  function requireQweather(data, label) {
    if (!data || (data.code && data.code !== '200')) {
      throw new Error(label + '失败：' + (data && data.code ? data.code : '无响应'));
    }

    return data;
  }

  function parseAmapLocation(data) {
    var city = Array.isArray(data.city) ? '' : (data.city || '');
    var province = Array.isArray(data.province) ? '' : (data.province || '');
    var rectangle = data.rectangle || '';
    var location = null;
    var longitude = null;
    var latitude = null;

    if (rectangle && rectangle.indexOf(';') > -1) {
      var points = rectangle.split(';').map(function (point) {
        return point.split(',').map(Number);
      });

      if (
        points.length === 2 &&
        points[0].length === 2 &&
        points[1].length === 2 &&
        points[0].every(isFinite) &&
        points[1].every(isFinite)
      ) {
        longitude = ((points[0][0] + points[1][0]) / 2).toFixed(2);
        latitude = ((points[0][1] + points[1][1]) / 2).toFixed(2);
        location = longitude + ',' + latitude;
      }
    }

    return {
      label: [province, city].filter(Boolean).join(' '),
      location: location,
      longitude: longitude,
      latitude: latitude,
      city: city,
      province: province
    };
  }

  function qweatherDate(date) {
    return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate());
  }

  function compactText(value, maxLength) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
  }

  function shortTime(value) {
    if (!value) return '';
    var match = String(value).match(/T(\d{2}:\d{2})/);
    return match ? match[1] : String(value).slice(0, 5);
  }

  function weatherIcon(text) {
    if (/雷/.test(text)) return 'fas fa-cloud-bolt';
    if (/雪/.test(text)) return 'fas fa-snowflake';
    if (/雨|阵雨|暴雨/.test(text)) return 'fas fa-cloud-showers-heavy';
    if (/阴/.test(text)) return 'fas fa-cloud';
    if (/云/.test(text)) return 'fas fa-cloud-sun';
    if (/晴/.test(text)) return 'fas fa-sun';
    return 'fas fa-temperature-half';
  }

  function formatForecast(data) {
    var daily = Array.isArray(data.daily) ? data.daily : [];
    var target = daily[1] || daily[0];
    if (!target) return '';

    var dayLabel = target === daily[0] ? '今天' : '明天';
    var text = target.textDay || target.textNight || '天气';
    return dayLabel + ' ' + text + ' ' + target.tempMin + '~' + target.tempMax + '°C';
  }

  function formatMinutely(data) {
    if (data.summary) return compactText(data.summary, 22);

    var minutely = Array.isArray(data.minutely) ? data.minutely : [];
    if (!minutely.length) return '暂无降水趋势';

    return '最近 ' + minutely[0].precip + 'mm';
  }

  function formatAir(data) {
    if (data.now) {
      return [
        data.now.aqi ? 'AQI ' + data.now.aqi : '',
        data.now.category || '',
        data.now.primary ? data.now.primary : ''
      ].filter(Boolean).join(' · ');
    }

    var indexes = Array.isArray(data.indexes) ? data.indexes : [];
    var index = indexes.find(function (item) {
      return item.code === 'chn-mee';
    }) || indexes[0];

    if (!index) return '';

    return [
      index.aqiDisplay || index.aqi ? 'AQI ' + (index.aqiDisplay || index.aqi) : '',
      index.category || '',
      index.primaryPollutant && index.primaryPollutant.name ? index.primaryPollutant.name : ''
    ].filter(Boolean).join(' · ');
  }

  function formatWarning(data) {
    var warnings = Array.isArray(data.warning) ? data.warning : (Array.isArray(data.alerts) ? data.alerts : []);
    if (!warnings.length) return '暂无预警';

    var first = warnings[0];
    var title = first.title || [first.typeName, first.level].filter(Boolean).join('');
    return warnings.length + '条 · ' + compactText(title, 16);
  }

  function formatIndices(data) {
    var daily = Array.isArray(data.daily) ? data.daily : [];
    var preferred = ['3', '5', '8'];
    var picked = daily.filter(function (item) {
      return preferred.indexOf(String(item.type)) > -1;
    });

    if (!picked.length) picked = daily.slice(0, 2);

    return picked.slice(0, 2).map(function (item) {
      var name = String(item.name || '').replace(/指数$/, '');
      return name + ' ' + item.category;
    }).filter(function (text) {
      return text.trim();
    }).join(' · ');
  }

  function formatSun(data) {
    var sunrise = shortTime(data.sunrise);
    var sunset = shortTime(data.sunset);
    if (!sunrise && !sunset) return '';
    return '日出 ' + (sunrise || '--:--') + ' · 日落 ' + (sunset || '--:--');
  }

  function addDetail(details, label, value) {
    if (value) details.push({ label: label, value: value });
  }

  function buildWeatherRequests(config, amapLocation) {
    var location = amapLocation.location;
    var host = config.qweatherHost;
    var today = qweatherDate(new Date());
    var requests = {
      forecast: qweatherRequest(buildUrl(host, '/v7/weather/3d', {
        location: location,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '天气预报');
      }),
      minutely: qweatherRequest(buildUrl(host, '/v7/minutely/5m', {
        location: location,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '分钟降水');
      }),
      indices: qweatherRequest(buildUrl(host, '/v7/indices/1d', {
        type: '3,5,8',
        location: location,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '天气指数');
      }),
      sun: qweatherRequest(buildUrl(host, '/v7/astronomy/sun', {
        location: location,
        date: today,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '天文');
      })
    };

    if (config.qweatherToken) {
      requests.air = qweatherRequest(buildUrl(host, '/airquality/v1/current/' + amapLocation.latitude + '/' + amapLocation.longitude, {
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '空气质量');
      });
      requests.warning = qweatherRequest(buildUrl(host, '/weatheralert/v1/current/' + amapLocation.latitude + '/' + amapLocation.longitude, {
        lang: 'zh',
        localTime: 'true'
      }), config).then(function (data) {
        return requireQweather(data, '天气预警');
      });
    } else {
      requests.air = qweatherRequest(buildUrl(host, '/v7/air/now', {
        location: location,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '空气质量');
      });
      requests.warning = qweatherRequest(buildUrl(host, '/v7/warning/now', {
        location: location,
        lang: 'zh'
      }), config).then(function (data) {
        return requireQweather(data, '天气预警');
      });
    }

    return requests;
  }

  function collectWeather(config, amapLocation) {
    if (!amapLocation.location || !amapLocation.latitude || !amapLocation.longitude) {
      throw new Error('高德定位未返回经纬度');
    }

    var requests = buildWeatherRequests(config, amapLocation);
    var keys = Object.keys(requests);

    return Promise.all(keys.map(function (key) {
      return requests[key].then(function (value) {
        return { key: key, value: value };
      }).catch(function () {
        return { key: key, value: null, error: arguments[0] };
      });
    })).then(function (results) {
      var parts = {};
      var errors = {};
      results.forEach(function (item) {
        parts[item.key] = item.value;
        errors[item.key] = item.error;
      });

      if (!parts.forecast || !Array.isArray(parts.forecast.daily) || !parts.forecast.daily.length) {
        throw (errors.forecast || new Error('天气预报不可用'));
      }

      var today = parts.forecast.daily[0];
      var windText = [
        today.windDirDay || today.windDirNight || '',
        today.windScaleDay || today.windScaleNight ? (today.windScaleDay || today.windScaleNight) + '级' : ''
      ].filter(Boolean).join('');
      var details = [];
      addDetail(details, '预报', parts.forecast ? formatForecast(parts.forecast) : '');
      addDetail(details, '降水', parts.minutely ? formatMinutely(parts.minutely) : '');
      addDetail(details, '空气', parts.air ? formatAir(parts.air) : '');
      addDetail(details, '预警', parts.warning ? formatWarning(parts.warning) : '');
      addDetail(details, '指数', parts.indices ? formatIndices(parts.indices) : '');
      addDetail(details, '天文', parts.sun ? formatSun(parts.sun) : '');

      return {
        place: amapLocation.label || amapLocation.city || '当前位置',
        weatherText: today.textDay || today.textNight || '天气预报',
        temp: today.tempMin && today.tempMax ? today.tempMin + '~' + today.tempMax : '--',
        meta: [
          amapLocation.label || amapLocation.city || '当前位置',
          windText,
          today.humidity ? '湿度 ' + today.humidity + '%' : ''
        ].filter(Boolean).join(' · '),
        details: details
      };
    });
  }

  function renderWeather(data) {
    setWeather(
      weatherIcon(data.weatherText),
      data.weatherText + ' ' + data.temp + '°C',
      data.meta || (data.place + ' · 体感 ' + data.feelsLike + '°C · ' + data.windDir + data.windScale + '级'),
      data.details
    );
  }

  function updateWeather(force) {
    var config = getWeatherConfig();
    if (!config.amapKey || (!config.qweatherKey && !config.qweatherToken)) {
      setWeather('fas fa-cloud-sun', '天气未配置', '在 _config.butterfly.yml 填写 API Key');
      return;
    }

    var cached = !force && readWeatherCache(config.cacheMs);
    if (cached) {
      renderWeather(cached);
      return;
    }

    if (weatherLoading) return;
    weatherLoading = true;
    setWeather('fas fa-spinner fa-spin', '天气加载中', '高德定位中...');

    var amapUrl = 'https://restapi.amap.com/v3/ip?key=' +
      encodeURIComponent(config.amapKey) +
      '&output=json';

    fetchJson(amapUrl)
      .then(function (amapData) {
        if (amapData.status !== '1') throw new Error(amapData.info || '高德定位失败');

        var amapLocation = parseAmapLocation(amapData);
        setWeather('fas fa-spinner fa-spin', '天气加载中', (amapLocation.label || '当前位置') + ' · 和风天气中...');

        return collectWeather(config, amapLocation);
      })
      .then(function (weatherData) {
        writeWeatherCache(weatherData);
        renderWeather(weatherData);
      })
      .catch(function () {
        var error = arguments[0];
        var message = error && error.message ? error.message : '检查高德/和风 Key 或接口授权';
        setWeather('fas fa-triangle-exclamation', '天气获取失败', compactText(message, 48));
      })
      .finally(function () {
        weatherLoading = false;
      });
  }

  function startWeather() {
    updateWeather(false);
    if (!weatherTimer) {
      weatherTimer = window.setInterval(function () {
        updateWeather(true);
      }, getWeatherConfig().cacheMs);
    }
  }

  function startClock() {
    updateClock();
    startWeather();
    if (!timer) timer = window.setInterval(updateClock, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startClock);
  } else {
    startClock();
  }

  document.addEventListener('pjax:complete', startClock);

  window.addEventListener('beforeunload', function () {
    if (timer) window.clearInterval(timer);
    if (weatherTimer) window.clearInterval(weatherTimer);
  });
})();
