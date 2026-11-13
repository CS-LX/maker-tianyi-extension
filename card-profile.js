(() => {
  'use strict';
  const KEY = 'makerCardArt';
  const DEFAULTS = Object.freeze({ preset: 'tara', image: '' });
  const SELECTOR = 'article[data-tier="ultra"]:not([data-audience="student"]) > [data-decoration="tara"]';
  const MESSAGE = 'maker-card-native-art';
  const TARA = chrome.runtime.getURL('assets/cards/tara.webp');
  const FROG = chrome.runtime.getURL('assets/cards/frog.png');
  const GUYUEXUAN = chrome.runtime.getURL('assets/cards/gu-yuexuan.png');
  const PRESETS = Object.freeze(['tara', 'frog', 'guyuexuan', 'custom']);
  function imageFor(profile, nativeTara = TARA) {
    return { tara: nativeTara, frog: FROG, guyuexuan: GUYUEXUAN, custom: profile.image }[profile.preset] || nativeTara;
  }
  function normalize(value) {
    const image = MakerProfile.validAvatar(value?.image) ? value.image : '';
    const preset = PRESETS.includes(value?.preset) ? value.preset : 'tara';
    return { preset: preset === 'custom' && !image ? 'tara' : preset, image };
  }
  function equal(a, b) { return a.preset === b.preset && a.image === b.image; }
  // Only the site's public image directories can be used as the dynamic preset.
  function siteImage(value) {
    if (typeof value !== 'string' || value.length > 2048) return '';
    try {
      const url = new URL(value, 'https://maker.taptap.cn');
      return url.origin === 'https://maker.taptap.cn' && !url.username && !url.password &&
        /^\/(?:membership|assets)\/.+\.(?:webp|png|jpe?g|avif|gif|svg)$/i.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  }
  function cssImage(value) {
    const match = /^url\(["']?([^"'()]+?)["']?\)$/.exec(value || '');
    return match ? siteImage(match[1]) : '';
  }
  async function load() { return normalize((await chrome.storage.local.get(KEY))[KEY]); }
  async function save(value) {
    if (!PRESETS.includes(value?.preset) ||
        (value.image !== '' && !MakerProfile.validAvatar(value.image)) ||
        (value.preset === 'custom' && !value.image)) throw new Error('请先选择有效的卡面图片。');
    const next = normalize(value);
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  }
  globalThis.MakerCard = Object.freeze({ KEY, DEFAULTS, SELECTOR, MESSAGE, TARA, FROG, GUYUEXUAN, PRESETS, imageFor, normalize, equal, siteImage, cssImage, load, save });
})();
