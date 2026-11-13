(() => {
  'use strict';
  const KEY = 'makerIdentity';
  const MAX_NAME = 32;
  const MAX_AVATAR_LENGTH = 2 * 1024 * 1024;
  const DEFAULTS = Object.freeze({ schemaVersion: 1, nickname: '天一一', avatar: '' });

  function validateNickname(value) {
    if (typeof value !== 'string') throw new Error('请输入昵称。');
    const nickname = value.trim();
    if (!nickname || Array.from(nickname).length > MAX_NAME) throw new Error('昵称需要 1–32 个字符。');
    if (/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(nickname)) {
      throw new Error('昵称不能包含换行或控制字符。');
    }
    return nickname;
  }

  function validAvatar(value) {
    if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
    try {
      const bytes = atob(value.slice(22));
      if (bytes.length < 33 || bytes.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || bytes.slice(12, 16) !== 'IHDR') return false;
      const dimension = offset => [0, 1, 2, 3].reduce((n, i) => n * 256 + bytes.charCodeAt(offset + i), 0);
      const width = dimension(16), height = dimension(20);
      return width > 0 && height > 0 && width <= 512 && height <= 512;
    } catch { return false; }
  }

  function normalize(value) {
    let nickname = DEFAULTS.nickname;
    try { nickname = validateNickname(value?.nickname); } catch { /* Recover malformed or older settings. */ }
    return { schemaVersion: 1, nickname, avatar: validAvatar(value?.avatar) ? value.avatar : '' };
  }

  function equal(a, b) { return a.nickname === b.nickname && a.avatar === b.avatar; }
  async function load() { return normalize((await chrome.storage.local.get(KEY))[KEY]); }
  async function save(value) {
    const nickname = validateNickname(value.nickname);
    if (value.avatar !== '' && !validAvatar(value.avatar)) throw new Error('头像数据无效，请重新选择图片。');
    const profile = { schemaVersion: 1, nickname, avatar: value.avatar };
    await chrome.storage.local.set({ [KEY]: profile });
    return profile;
  }
  globalThis.MakerProfile = Object.freeze({ KEY, MAX_NAME, MAX_AVATAR_LENGTH, DEFAULTS, validateNickname, validAvatar, normalize, equal, load, save });
})();
