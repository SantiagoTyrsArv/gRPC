export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': 'prettier --write',
  // `buf format` acepta un solo directorio: se formatea todo el módulo una vez.
  '*.proto': () => 'buf format -w proto',
};
