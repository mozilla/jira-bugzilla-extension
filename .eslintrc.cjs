module.exports = {
  env: {
    browser: true,
    webextensions: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['prettier'],
  rules: {
    'arrow-body-style': 'off',
  },
};
