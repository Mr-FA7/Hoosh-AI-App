const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/** Run a shell command safely, return stdout string or null */
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 8000, ...opts }).trim();
  } catch { return null; }
}

/** Parse "KEY=VALUE" wmic output into an object */
function parseWmic(out) {
  if (!out) return {};
  const obj = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) obj[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return obj;
}

function bytesToGB(bytes, digits = 1) {
  const n = Number(bytes);
  if (!n || isNaN(n)) return null;
  return parseFloat((n / 1e9).toFixed(digits));
}

function formatGB(gb) {
  if (!gb) return null;
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(0)} GB`;
}

// ─── GPU ──────────────────────────────────────────────────────────────────────

function detectGpuWindows() {
  // 1. Try nvidia-smi (most accurate, works on PATH or full path)
  const nvPaths = [
    'nvidia-smi',
    'C:\\Windows\\System32\\nvidia-smi.exe',
    'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe'
  ];
  for (const nvCmd of nvPaths) {
    const nvOut = run(`"${nvCmd}" --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits`);
    if (nvOut && !nvOut.includes('not recognized')) {
      const parts = nvOut.split(',').map(s => s.trim());
      const name = parts[0] || 'NVIDIA GPU';
      const totalMB = parseInt(parts[1]) || 0;
      const freeMB = parseInt(parts[2]) || 0;
      return { name, vendor: 'nvidia', compute_api: 'cuda', total_vram: totalMB, free_vram: freeMB, cores: 0 };
    }
  }
  // 2. PowerShell CIM (Windows 11 compatible, replaces wmic)
  const psOut = run('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,VideoProcessor | ConvertTo-Csv -NoTypeInformation"');
  if (psOut) {
    const lines = psOut.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('"Name"'));
    for (const line of lines) {
      const parts = line.replace(/"/g, '').split(',');
      const name = (parts[0] || '').trim();
      if (!name || name.toLowerCase().includes('basic') || name.toLowerCase().includes('remote')) continue;
      const vramBytes = Number(parts[1]) || 0;
      const vramMB = Math.floor(vramBytes / (1024 * 1024));
      const vendor = name.toLowerCase().includes('nvidia') ? 'nvidia'
        : name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon') ? 'amd'
        : name.toLowerCase().includes('intel') ? 'intel' : 'none';
      const api = vendor === 'nvidia' ? 'cuda' : vendor === 'amd' ? 'rocm' : vendor === 'intel' ? 'opencl' : 'none';
      // For NVIDIA, wmic often reports wrong VRAM - use nvidia-smi fallback value or known data
      return { name, vendor, compute_api: api, total_vram: vramMB, free_vram: 0, cores: 0 };
    }
  }
  return { name: 'Unknown GPU', vendor: 'none', compute_api: 'none', total_vram: 0, free_vram: 0, cores: 0 };
}

function detectGpuMac(cpuBrand) {
  try {
    const sp = execSync('system_profiler SPDisplaysDataType -json', { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const j = JSON.parse(sp);
    const displays = j.SPDisplaysDataType || [];
    for (const d of displays) {
      const cores = parseInt(String(d.sppci_cores || '0').trim(), 10) || 0;
      const vramStr = d.spdisplays_vram || d.spdisplays_vram_shared || '';
      const vramMB = parseInt(vramStr) * (vramStr.includes('GB') ? 1024 : 1) || 0;
      const name = d.sppci_model || d._name || 'Apple GPU';
      return { name, vendor: 'apple', compute_api: 'metal', total_vram: vramMB, free_vram: 0, cores };
    }
  } catch { /* ignore */ }
  // Fallback for Apple Silicon
  const isApple = cpuBrand.toLowerCase().includes('apple');
  const totalMB = Math.floor(os.totalmem() / (1024 * 1024));
  return {
    name: isApple ? 'Apple Silicon GPU' : 'Integrated',
    vendor: isApple ? 'apple' : 'none',
    compute_api: isApple ? 'metal' : 'none',
    total_vram: isApple ? Math.floor(totalMB * 0.4) : 0,
    free_vram: 0, cores: 0
  };
}

function detectGpuLinux() {
  // NVIDIA
  const nvOut = run('nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits');
  if (nvOut) {
    const parts = nvOut.split(',').map(s => s.trim());
    return { name: parts[0], vendor: 'nvidia', compute_api: 'cuda', total_vram: parseInt(parts[1]) || 0, free_vram: parseInt(parts[2]) || 0, cores: 0 };
  }
  // AMD ROCm
  const rocmOut = run('rocm-smi --showmeminfo vram --csv');
  if (rocmOut) {
    const lines = rocmOut.split('\n').filter(l => l.trim() && !l.startsWith('device'));
    if (lines.length) {
      const parts = lines[0].split(',');
      return { name: 'AMD GPU', vendor: 'amd', compute_api: 'rocm', total_vram: parseInt(parts[1]) || 0, free_vram: 0, cores: 0 };
    }
  }
  return { name: 'Unknown GPU', vendor: 'none', compute_api: 'none', total_vram: 0, free_vram: 0, cores: 0 };
}

// ─── Motherboard ──────────────────────────────────────────────────────────────

function detectMotherboard() {
  if (process.platform === 'win32') {
    // PowerShell CIM (Windows 11 compatible)
    const psOut = run('powershell -NoProfile -Command "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product | ConvertTo-Csv -NoTypeInformation"');
    if (psOut) {
      const lines = psOut.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('"Manufacturer"'));
      if (lines.length) {
        const parts = lines[0].replace(/"/g, '').split(',');
        const mfr = (parts[0] || '').trim();
        const prod = (parts[1] || '').trim();
        if (prod && prod !== 'Not Available' && prod !== 'Default string' && prod !== '') {
          return mfr && !prod.includes(mfr) ? `${mfr} ${prod}`.trim() : prod;
        }
      }
    }
    return 'Standard';
  }
  if (process.platform === 'darwin') {
    const out = run('system_profiler SPHardwareDataType 2>/dev/null | grep "Model Identifier"');
    return out ? out.split(':').slice(1).join(':').trim() : 'Apple';
  }
  // Linux
  const vendor = run('cat /sys/class/dmi/id/board_vendor 2>/dev/null');
  const name = run('cat /sys/class/dmi/id/board_name 2>/dev/null');
  if (name && name !== 'Not Applicable') return [vendor, name].filter(Boolean).join(' ').trim() || 'Standard';
  return 'Standard';
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function detectStorage() {
  if (process.platform === 'win32') {
    try {
      // Get C: drive free/total via PowerShell (most reliable)
      const ps = run('powershell -NoProfile -Command "(Get-PSDrive C | Select-Object -ExpandProperty Used),(Get-PSDrive C | Select-Object -ExpandProperty Free)"');
      if (ps) {
        const lines = ps.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          const usedBytes = Number(lines[0]);
          const freeBytes = Number(lines[1]);
          if (usedBytes > 0 && freeBytes > 0) {
            const totalGB = bytesToGB(usedBytes + freeBytes) || 0;
            return {
              total: formatGB(totalGB) || 'Unknown',
              used: `${bytesToGB(usedBytes, 1)} GB`,
              free: `${bytesToGB(freeBytes, 1)} GB`
            };
          }
        }
      }
      // Fallback: wmic
      const wmicOut = run('wmic logicaldisk where "DeviceID=\'C:\'" get size,freespace /value');
      const w = parseWmic(wmicOut);
      if (w.Size) {
        const total = bytesToGB(w.Size);
        const free = bytesToGB(w.FreeSpace);
        const used = total && free ? total - free : null;
        return {
          total: formatGB(total) || 'Unknown',
          used: used ? `${used.toFixed(1)} GB` : '0',
          free: free ? `${free.toFixed(1)} GB` : '0'
        };
      }
    } catch { /* ignore */ }
  }
  if (process.platform === 'darwin') {
    try {
      const totalOut = run('diskutil info / | grep "Container Total Space"');
      const freeOut = run('diskutil info / | grep "Container Free Space"');
      const totalBytes = parseInt(totalOut?.match(/\((\d+) Bytes\)/)?.[1] || '0');
      const freeBytes = parseInt(freeOut?.match(/\((\d+) Bytes\)/)?.[1] || '0');
      if (totalBytes > 0) {
        const total = bytesToGB(totalBytes);
        const free = bytesToGB(freeBytes);
        const used = total && free ? total - free : null;
        return { total: formatGB(total), used: `${used?.toFixed(1)} GB`, free: `${free?.toFixed(1)} GB` };
      }
    } catch { /* ignore */ }
  }
  // Linux
  const dfOut = run('df -B1 / 2>/dev/null');
  if (dfOut) {
    const lines = dfOut.split('\n');
    for (const line of lines) {
      if (line.startsWith('/')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const total = bytesToGB(parts[1]);
          const used = bytesToGB(parts[2]);
          const free = bytesToGB(parts[3]);
          return { total: formatGB(total), used: `${used?.toFixed(1)} GB`, free: `${free?.toFixed(1)} GB` };
        }
      }
    }
  }
  return { total: 'Unknown', used: '0', free: '0' };
}

// ─── CPU ──────────────────────────────────────────────────────────────────────

function detectCpu() {
  const cpus = os.cpus();
  let brand = cpus[0]?.model?.trim() || 'Unknown CPU';
  let logical = cpus.length;
  let physical = logical;
  let speedMhz = cpus[0]?.speed || 0;

  if (process.platform === 'darwin') {
    brand = run('sysctl -n machdep.cpu.brand_string') || brand;
    const p = parseInt(run('sysctl -n hw.physicalcpu') || '0', 10);
    const l = parseInt(run('sysctl -n hw.logicalcpu') || '0', 10);
    if (p > 0) physical = p;
    if (l > 0) logical = l;
    if (!speedMhz) {
      const hz = parseInt(run('sysctl -n hw.cpufrequency_max 2>/dev/null') || '0', 10);
      if (!isNaN(hz) && hz > 0) speedMhz = Math.round(hz / 1e6);
    }
  } else if (process.platform === 'win32') {
    // PowerShell CIM (wmic deprecated in Windows 11)
    const psOut = run('powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | ConvertTo-Csv -NoTypeInformation"');
    if (psOut) {
      const lines = psOut.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('"Name"'));
      if (lines.length) {
        const parts = lines[0].replace(/"/g, '').split(',');
        if (parts[0]) brand = parts[0].trim();
        const pc = parseInt(parts[1] || '0', 10);
        const lc = parseInt(parts[2] || '0', 10);
        const mhz = parseInt(parts[3] || '0', 10);
        if (pc > 0) physical = pc;
        if (lc > 0) logical = lc;
        if (mhz > 0) speedMhz = mhz;
      }
    }
  } else {
    // Linux
    const mhz = parseInt(run("grep 'cpu MHz' /proc/cpuinfo | head -1 | awk -F: '{print $2}'") || '0');
    if (mhz > 0) speedMhz = mhz;
    const pc = parseInt(run("grep '^cpu cores' /proc/cpuinfo | head -1 | awk -F: '{print $2}'") || '0');
    if (pc > 0) physical = pc;
  }
  return { brand, physical, logical, speedMhz };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

class ResourceManager {
  constructor() {
    this.RAM_BUFFER_PERCENT = 0.25;
    this.VRAM_BUFFER_PERCENT = 0.20;
    this.OFFLINE_NEEDED_PATH = process.env.FA7_OFFLINE_NEEDED_PATH
      || process.env.FA7_EXAMPLE_ROOT
      || path.join(os.homedir(), 'Desktop', 'example');
    this._hwCache = null;
    this._hwCacheAt = 0;
  }

  getHardwareStats() {
    // Cache for 60s so repeated calls don't re-run wmic
    const now = Date.now();
    if (this._hwCache && now - this._hwCacheAt < 60000) return this._hwCache;

    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const ramUsagePercent = ((totalRam - freeRam) / totalRam) * 100;
    const totalRamMBRaw = Math.floor(totalRam / (1024 * 1024));
    const freeRamMB = Math.floor(freeRam / (1024 * 1024));

    // Round to nearest standard RAM size (8, 12, 16, 24, 32, 48, 64, 96, 128 GB)
    // OS reports slightly less than installed due to BIOS/hardware reservation
    const standardSizes = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
    const rawGB = totalRamMBRaw / 1024;
    const totalRamMB = standardSizes.reduce((prev, cur) =>
      Math.abs(cur - rawGB) < Math.abs(prev - rawGB) ? cur : prev
    ) * 1024;

    // Detect RAM speed (MT/s) via PowerShell on Windows
    let ramSpeedMTs = 0;
    if (process.platform === 'win32') {
      // Win32_PhysicalMemory.Speed returns MT/s directly (DDR4=3200, DDR5=7200 etc.)
      const psOut = run('powershell -NoProfile -Command "Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1 Speed,ConfiguredClockSpeed | ConvertTo-Csv -NoTypeInformation"');
      if (psOut) {
        const lines = psOut.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('"Speed"'));
        if (lines.length) {
          const parts = lines[0].replace(/"/g, '').split(',');
          const speed = parseInt(parts[0] || '0', 10);
          const configured = parseInt(parts[1] || '0', 10);
          ramSpeedMTs = Math.max(speed, configured); // use whichever is higher
        }
      }
    } else if (process.platform === 'darwin') {
      const out = run('system_profiler SPMemoryDataType 2>/dev/null | grep -i "speed"');
      const m = out?.match(/(\d+)\s*MHz/i);
      if (m) ramSpeedMTs = parseInt(m[1]) * 2;
    }

    // CPU
    const cpu = detectCpu();

    // GPU
    let gpuRaw;
    if (process.platform === 'win32') gpuRaw = detectGpuWindows();
    else if (process.platform === 'darwin') gpuRaw = detectGpuMac(cpu.brand);
    else gpuRaw = detectGpuLinux();

    const gpuInfo = {
      vendor: gpuRaw.vendor,
      name: gpuRaw.name,
      total_vram: gpuRaw.total_vram,
      free_vram: gpuRaw.free_vram,
      compute_api: gpuRaw.compute_api,
      cores: gpuRaw.cores || 0
    };

    // Motherboard
    const motherboard = detectMotherboard();

    // Storage
    const storage = detectStorage();

    // NPU (basic heuristic)
    const hasNpu = cpu.brand.toLowerCase().includes('ultra') || cpu.brand.toLowerCase().includes('apple');

    const result = {
      hardware: {
        gpu: gpuInfo,
        npu: { available: hasNpu, capability: hasNpu ? 'medium' : 'none' },
        ram: {
          total: totalRamMB,
          free: freeRamMB,
          speed_mts: ramSpeedMTs,
          memory_pressure: ramUsagePercent > 75 ? 'high' : (ramUsagePercent > 50 ? 'medium' : 'low'),
          swap_usage: 0
        },
        cpu: {
          cores: cpu.physical,
          threads: cpu.logical,
          load: os.loadavg()[0],
          brand: cpu.brand,
          speed_mhz: cpu.speedMhz
        },
        storage,
        motherboard,
        cpu_brand: cpu.brand
      },
      system_load: {
        vram_usage_percent: gpuInfo.total_vram > 0
          ? ((gpuInfo.total_vram - gpuInfo.free_vram) / gpuInfo.total_vram) * 100
          : 0,
        ram_usage_percent: ramUsagePercent,
        cpu_load_percent: cpu.logical > 0 ? (os.loadavg()[0] / cpu.logical) * 100 : 0
      }
    };

    this._hwCache = result;
    this._hwCacheAt = now;
    return result;
  }

  checkLocalNeeded(name) {
    const fp = path.join(this.OFFLINE_NEEDED_PATH, name);
    return require('fs').existsSync(fp);
  }

  isOneOf(value, allowed) {
    return allowed.includes(String(value || '').toLowerCase());
  }

  isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  canRunModel(modelDef) {
    const stats = this.getHardwareStats();
    const hardware = stats.hardware;
    if (!hardware.gpu || !hardware.npu || !hardware.ram || !hardware.cpu) return false;
    if (!this.isOneOf(hardware.gpu.vendor, ['nvidia', 'amd', 'apple', 'intel', 'none'])) return false;
    if (!this.isOneOf(hardware.gpu.compute_api, ['cuda', 'metal', 'rocm', 'none'])) return false;
    if (!this.isFiniteNumber(hardware.gpu.total_vram) || !this.isFiniteNumber(hardware.gpu.free_vram)) return false;
    if (!this.isFiniteNumber(hardware.ram.total) || !this.isFiniteNumber(hardware.ram.free)) return false;

    const sysLoad = stats.system_load;
    if (!this.isFiniteNumber(sysLoad.vram_usage_percent) || !this.isFiniteNumber(sysLoad.ram_usage_percent) || !this.isFiniteNumber(sysLoad.cpu_load_percent)) return false;

    if (!modelDef) return true;
    const vramGB = hardware.gpu.total_vram / 1024;
    const ramGB = hardware.ram.total / 1024;
    return (vramGB >= (modelDef.vram_gb || 0)) && (ramGB >= (modelDef.ram_gb || 0));
  }

  getRecommendedModels() {
    const { hardware } = this.getHardwareStats();
    const vramGB = (hardware.gpu?.total_vram || 0) / 1024;
    const ramGB = (hardware.ram?.total || 0) / 1024;

    const all = [
      { name: 'qwen:0.5b', scale: '1b', ram_gb: 1.2, vram_gb: 0.8 },
      { name: 'llama3.2:latest', scale: '3b', ram_gb: 2.6, vram_gb: 1.6 },
      { name: 'mistral:latest', scale: '7b', ram_gb: 8.0, vram_gb: 5.8 },
      { name: 'codellama:13b', scale: '13b', ram_gb: 14.0, vram_gb: 10.0 },
      { name: 'qwen2.5:32b', scale: '32b', ram_gb: 32.0, vram_gb: 24.0 }
    ];

    return all.filter(m => vramGB >= m.vram_gb || ramGB >= m.ram_gb);
  }

  /**
   * Decide where/how to run a task. Used by kernel.js (agent loop) and the
   * /api/v3/system/routing routes. Must never throw — callers depend on a
   * routing_decision object; on any failure it returns a safe local default.
   */
  getRoutingDecision(rawInput) {
    try {
      const task = this._normalizeTask(rawInput);
      const { hardware, system_load } = this.getHardwareStats();
      const ram = system_load?.ram_usage_percent ?? 0;
      const vram = system_load?.vram_usage_percent ?? 0;

      const level1 = ram >= 75 || vram >= 80;       // pressure
      const level2 = ram >= 90 || vram >= 90;       // critical (RAM or VRAM)
      // Only force cloud on true GPU VRAM exhaustion. macOS reports low
      // free RAM (cached memory counts as "used") and unified-memory GPUs
      // report total_vram=0, so RAM pressure alone must NOT push a
      // local-first (Ollama) setup to the cloud.
      const vramCritical = vram >= 90;

      const safety_actions = {
        compress_history: level1,
        reduce_context: level1,
        unload_background_models: level1 || task.latency_sensitive || level2,
        switch_to_cloud: vramCritical
      };
      const allocated_context_window = level1 ? 2048 : 4096;
      const max_concurrent_agents = level2 ? 1 : (level1 ? 2 : 4);

      const fits = this.getRecommendedModels();
      const names = fits.length ? fits.map(m => m.name) : ['qwen:0.5b'];
      const smallest = names[0];
      const largest = names[names.length - 1];

      // Critical GPU VRAM exhaustion → cloud fallback.
      if (vramCritical) {
        return {
          routing_decision: {
            execution_mode: 'cloud',
            selected_model: 'gpt-oss:120b-cloud',
            quantization: 'Q4_K_M',
            allocated_context_window: 2048,
            max_concurrent_agents: 1
          },
          safety_actions,
          reasoning: 'Critical load (Level 2): forcing cloud fallback for stability.'
        };
      }

      // Lightweight background/summarization on an available NPU.
      if ((task.type === 'summarization' || task.type === 'background') &&
          hardware?.npu?.available && this.isOneOf(hardware.npu.capability, ['medium', 'high'])) {
        return {
          routing_decision: {
            execution_mode: 'local_npu',
            selected_model: smallest,
            quantization: 'Q4_K_M',
            allocated_context_window,
            max_concurrent_agents
          },
          safety_actions,
          reasoning: 'Lightweight workload routed to NPU for power-efficient local execution.'
        };
      }

      const hasGpu = (hardware?.gpu?.total_vram || 0) > 0 || hardware?.gpu?.compute_api === 'metal';
      const selected_model = task.latency_sensitive ? smallest
        : (task.type === 'reasoning' ? largest
        : (names.includes('mistral:latest') ? 'mistral:latest' : largest));

      return {
        routing_decision: {
          execution_mode: hasGpu ? 'local_gpu' : 'local_cpu',
          selected_model,
          quantization: 'Q4_K_M',
          allocated_context_window,
          max_concurrent_agents
        },
        safety_actions,
        reasoning: `Routed locally (${task.type}/${task.priority}) on ${hasGpu ? 'GPU' : 'CPU'}.`
      };
    } catch (e) {
      return {
        routing_decision: {
          execution_mode: 'local_gpu',
          selected_model: 'mistral:latest',
          quantization: 'Q4_K_M',
          allocated_context_window: 4096,
          max_concurrent_agents: 2
        },
        safety_actions: {},
        reasoning: `Routing fell back to safe default: ${e.message}`
      };
    }
  }

  _normalizeTask(rawInput) {
    const src = (rawInput && rawInput.task && typeof rawInput.task === 'object') ? rawInput.task : rawInput;
    const t = (src && typeof src === 'object') ? src : {};
    const type = this.isOneOf(t.type, ['chat', 'coding', 'reasoning', 'summarization', 'background']) ? t.type : 'chat';
    const priority = this.isOneOf(t.priority, ['low', 'medium', 'high']) ? t.priority : 'medium';
    return { type, priority, latency_sensitive: !!t.latency_sensitive };
  }

  /**
   * Optional feature dependency gate (used by kernel for negah/voice). The
   * dependency registry was removed in a refactor; return [] so the agent
   * proceeds rather than crashing. Callers use .length and .map.
   */
  getMissingDependencies(_feature) {
    return [];
  }
}

module.exports = ResourceManager;
