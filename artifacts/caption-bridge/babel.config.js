// ============================================================
// babel.config.js
// Expo SDK 54 / React Native 0.81 向け標準設定
// ============================================================
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
