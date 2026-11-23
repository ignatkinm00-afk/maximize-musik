const { contextBridge } = require('electron');

const prefix = '--mm-api-url=';
const argument = process.argv.find((value) => value.startsWith(prefix)) ?? '';
const apiUrl = argument.slice(prefix.length);

contextBridge.exposeInMainWorld('mmDesktop', {
  apiUrl,
  version: process.versions.electron,
  platform: process.platform,
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('is-electron');
});
