/**
 * Language & runtime installation — recipes per OS (user must confirm elevated commands).
 */

import { getOSProfile } from '../core/os-detector.js';

const RUNTIMES = {
  node: {
    win32: { winget: 'winget install OpenJS.NodeJS.LTS', choco: 'choco install nodejs-lts -y' },
    darwin: { brew: 'brew install node' },
    linux: { apt: 'sudo apt-get update && sudo apt-get install -y nodejs npm' }
  },
  python: {
    win32: { winget: 'winget install Python.Python.3.12', choco: 'choco install python -y' },
    darwin: { brew: 'brew install python' },
    linux: { apt: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip' }
  },
  rust: {
    win32: { script: 'Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe; .\\rustup-init.exe -y' },
    darwin: { brew: 'brew install rustup-init && rustup-init -y' },
    linux: { apt: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y' }
  },
  go: {
    win32: { winget: 'winget install GoLang.Go' },
    darwin: { brew: 'brew install go' },
    linux: { apt: 'sudo apt-get install -y golang-go' }
  },
  java: {
    win32: { winget: 'winget install Microsoft.OpenJDK.17' },
    darwin: { brew: 'brew install openjdk@17' },
    linux: { apt: 'sudo apt-get install -y default-jdk' }
  },
  postgresql: {
    win32: { winget: 'winget install PostgreSQL.PostgreSQL' },
    darwin: { brew: 'brew install postgresql@16' },
    linux: { apt: 'sudo apt-get install -y postgresql postgresql-contrib' }
  },
  redis: {
    win32: { choco: 'choco install redis-64 -y' },
    darwin: { brew: 'brew install redis' },
    linux: { apt: 'sudo apt-get install -y redis-server' }
  }
};

/**
 * @param {string} name node|python|rust|...
 * @param {{ channel?: 'winget'|'brew'|'apt'|'choco' }} [opts]
 */
export function getInstallRecipe(name, opts = {}) {
  const profile = getOSProfile();
  const key = name.toLowerCase();
  const table = RUNTIMES[key];
  if (!table) return null;

  const plat = profile.platform;
  const recipes = table[plat];
  if (!recipes) return null;

  if (plat === 'win32') {
    return recipes[opts.channel || 'winget'] || recipes.winget || recipes.choco || recipes.script;
  }
  if (plat === 'darwin') {
    return recipes.brew;
  }
  return recipes.apt;
}

export function listSupportedRuntimes() {
  return Object.keys(RUNTIMES);
}
