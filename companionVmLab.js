/**
 * FA7 VM Lab — فراخوانی ایمن CLIهای محلی میزبان (مثل VBoxManage، vmrun) با آرگومان ثابت؛ سورس hypervisor شخص ثالث embed نمی‌شود.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { mountEmbeddedQemuRoutes, getEmbeddedQemuStatusForVmLab } = require('./companionVmLabEmbeddedQemu');

const execFileAsync = promisify(execFile);

const VM_LAB_ROOT = path.join(os.homedir(), '.aivon-os', 'vm-lab');
const VM_LAB_DISKS = path.join(VM_LAB_ROOT, 'disks');

const OSTYPES = new Set(['Ubuntu_64', 'Debian_64', 'Other_64', 'Windows10_64', 'Windows2019_64']);

function safeVmName(name) {
  const s = String(name || '').trim();
  if (s.length < 1 || s.length > 120) return null;
  if (/[\r\n\x00;|&`$<>]/.test(s)) return null;
  return s;
}

function safeSnapshotName(name) {
  const s = String(name || '').trim();
  if (s.length < 1 || s.length > 64) return null;
  if (/[\r\n\x00;|&`$<>]/.test(s)) return null;
  return s;
}

/** File basename for VDI: strict slug */
function safeDiskSlug(name) {
  const s = String(name || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '');
  if (s.length < 1 || s.length > 80) return null;
  return s;
}

function validateIsoPath(input) {
  if (!input || typeof input !== 'string') return null;
  let p = path.resolve(input.trim());
  if (!p.toLowerCase().endsWith('.iso')) return null;
  let real;
  try {
    real = fs.realpathSync(p);
  } catch {
    return null;
  }
  try {
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  const home = os.homedir();
  const rl = real.toLowerCase();
  const hl = home.toLowerCase();
  if (rl.startsWith(hl + path.sep) || rl === hl) return real;
  if (process.platform === 'darwin' && real.startsWith('/Volumes/')) return real;
  if (process.platform === 'linux' && (real.startsWith('/media/') || real.startsWith('/mnt/'))) return real;
  if (process.platform === 'win32') return real;
  return null;
}

function validateVmxPath(input) {
  if (!input || typeof input !== 'string') return null;
  let p = path.resolve(input.trim());
  if (!p.toLowerCase().endsWith('.vmx')) return null;
  let real;
  try {
    real = fs.realpathSync(p);
  } catch {
    return null;
  }
  try {
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  return real;
}

function resolveVmrun() {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env['ProgramFiles(x86)'] || '', 'VMware', 'VMware Workstation', 'vmrun.exe'),
      path.join(process.env.ProgramFiles || '', 'VMware', 'VMware Workstation', 'vmrun.exe'),
      'vmrun.exe'
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return 'vmrun.exe';
  }
  if (process.platform === 'darwin') {
    const fusion = '/Applications/VMware Fusion.app/Contents/Library/vmrun';
    if (fs.existsSync(fusion)) return fusion;
  }
  return 'vmrun';
}

async function runVmrun(args) {
  const bin = resolveVmrun();
  return execFileAsync(bin, args, {
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
}

function vboxCandidates() {
  const out = [];
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    out.push(path.join(pf, 'Oracle', 'VirtualBox', 'VBoxManage.exe'));
    out.push(path.join(pfx86, 'Oracle', 'VirtualBox', 'VBoxManage.exe'));
  } else if (process.platform === 'darwin') {
    out.push('/usr/local/bin/VBoxManage');
    out.push('/opt/homebrew/bin/VBoxManage');
    out.push('/Applications/VirtualBox.app/Contents/MacOS/VBoxManage');
  } else {
    out.push('/usr/bin/VBoxManage');
    out.push('/usr/local/bin/VBoxManage');
  }
  return out;
}

function resolveVBoxManage() {
  for (const p of vboxCandidates()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return 'VBoxManage';
}

async function runVBox(args) {
  const bin = resolveVBoxManage();
  return execFileAsync(bin, args, {
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
}

function parseVBoxListVms(text) {
  const rows = [];
  const re = /"([^"]*)"\s+\{([a-f0-9\-]{36})\}/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    rows.push({ name: m[1], uuid: m[2] });
  }
  return rows;
}

async function vboxVersion() {
  try {
    const { stdout } = await runVBox(['--version']);
    return String(stdout || '').split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

async function whichBin(name) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('where', [name], { timeout: 8000, windowsHide: true });
      const line = String(stdout || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find(Boolean);
      return line || null;
    }
    const { stdout } = await execFileAsync('which', [name], { timeout: 8000 });
    const line = String(stdout || '').trim();
    return line || null;
  } catch {
    return null;
  }
}

function utmAppExists() {
  if (process.platform !== 'darwin') return false;
  try {
    return fs.existsSync('/Applications/UTM.app');
  } catch {
    return false;
  }
}

async function getStatus() {
  let vboxPath = resolveVBoxManage();
  let vboxOk = false;
  try {
    await runVBox(['list', 'vms']);
    vboxOk = true;
  } catch {
    vboxOk = false;
    if (!fs.existsSync(vboxPath)) vboxPath = null;
  }

  const qemuX64 = await whichBin(process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64');
  const qemuImg = await whichBin(process.platform === 'win32' ? 'qemu-img.exe' : 'qemu-img');
  const vmrun = await whichBin(process.platform === 'win32' ? 'vmrun.exe' : 'vmrun');

  return {
    platform: process.platform,
    virtualbox: {
      available: vboxOk,
      vboxManagePath: vboxOk || (vboxPath && fs.existsSync(vboxPath)) ? vboxPath || resolveVBoxManage() : null,
      version: vboxOk ? await vboxVersion() : null
    },
    qemu: {
      systemX64: qemuX64,
      qemuImg: qemuImg
    },
    vmware: {
      vmrun: vmrun
    },
    optionalMacVmUi: {
      installed: utmAppExists()
    },
    vmLab: {
      diskStorageDir: VM_LAB_DISKS
    },
    fa7VmEngine: getEmbeddedQemuStatusForVmLab(),
    note:
      'Default: FA7 QEMU engine under ~/.aivon-os/vm-lab/qemu-runtime. Optional host bridges call local VBoxManage/vmrun if present; third-party hypervisor source is not embedded.'
  };
}

function mountVmLabRoutes(app) {
  mountEmbeddedQemuRoutes(app);

  app.get('/api/v3/vm-lab/status', async (req, res) => {
    try {
      const status = await getStatus();
      res.json({ ok: true, ...status });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'vm-lab status failed' });
    }
  });

  app.get('/api/v3/vm-lab/vbox/vms', async (req, res) => {
    try {
      const { stdout, stderr } = await runVBox(['list', 'vms']);
      const vms = parseVBoxListVms(stdout);
      res.json({ ok: true, raw: String(stdout || '').trim(), stderr: String(stderr || '').trim(), vms });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message || 'VBoxManage list vms failed',
        hint: 'Host CLI VBoxManage not working. Install the provider hypervisor or add VBoxManage to PATH.'
      });
    }
  });

  app.get('/api/v3/vm-lab/vbox/running', async (req, res) => {
    try {
      const { stdout, stderr } = await runVBox(['list', 'runningvms']);
      const vms = parseVBoxListVms(stdout);
      res.json({ ok: true, raw: String(stdout || '').trim(), stderr: String(stderr || '').trim(), vms });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'VBoxManage list runningvms failed' });
    }
  });

  app.post('/api/v3/vm-lab/vbox/action', async (req, res) => {
    try {
      const action = String(req.body?.action || '').toLowerCase();
      const name = safeVmName(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Invalid or missing vm name' });

      if (action === 'start') {
        const mode = String(req.body?.startMode || 'gui').toLowerCase() === 'headless' ? 'headless' : 'gui';
        const { stdout, stderr } = await runVBox(['startvm', name, '--type', mode]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
      }

      if (action === 'stop') {
        const kind = String(req.body?.stopKind || 'poweroff').toLowerCase();
        const allowed = new Set(['poweroff', 'acpipowerbutton', 'savestate']);
        const k = allowed.has(kind) ? kind : 'poweroff';
        const { stdout, stderr } = await runVBox(['controlvm', name, k]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
      }

      if (action === 'pause') {
        const { stdout, stderr } = await runVBox(['controlvm', name, 'pause']);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
      }

      if (action === 'resume') {
        const { stdout, stderr } = await runVBox(['controlvm', name, 'resume']);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action (use start|stop|pause|resume)' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'VBox action failed' });
    }
  });

  /** Opens host VM management GUI when the corresponding app is installed. */
  app.post('/api/v3/vm-lab/open/virtualbox-gui', async (req, res) => {
    try {
      if (process.platform === 'darwin') {
        await execFileAsync('open', ['-a', 'VirtualBox'], { timeout: 15000 });
        return res.json({ ok: true });
      }
      if (process.platform === 'win32') {
        const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
        const exe = path.join(pf, 'Oracle', 'VirtualBox', 'VirtualBox.exe');
        if (fs.existsSync(exe)) {
          await execFileAsync(exe, [], { timeout: 15000, windowsHide: false });
          return res.json({ ok: true });
        }
      }
      return res.json({
        ok: false,
        error: 'Could not launch host VM GUI on this platform. Open it from the system app list if installed.'
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'open host VM GUI failed' });
    }
  });

  app.get('/api/v3/vm-lab/vbox/info', async (req, res) => {
    try {
      const name = safeVmName(req.query?.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Query ?name= is required' });
      const { stdout, stderr } = await runVBox(['showvminfo', name, '--machinereadable']);
      const lines = String(stdout || '').split(/\r?\n/);
      const machinereadable = {};
      for (const line of lines) {
        const eq = line.indexOf('=');
        if (eq > 0) machinereadable[line.slice(0, eq)] = line.slice(eq + 1);
      }
      res.json({
        ok: true,
        name,
        machinereadable,
        raw: String(stdout || ''),
        stderr: String(stderr || '').trim()
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'showvminfo failed' });
    }
  });

  app.post('/api/v3/vm-lab/vbox/snapshot', async (req, res) => {
    try {
      const action = String(req.body?.action || '').toLowerCase();
      const name = safeVmName(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Invalid or missing vm name' });
      const snap = safeSnapshotName(req.body?.snapshotName);

      if (action === 'list') {
        const { stdout, stderr } = await runVBox(['snapshot', name, 'list']);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      if (!snap) return res.status(400).json({ ok: false, error: 'snapshotName required for take|restore|delete' });

      if (action === 'take') {
        const { stdout, stderr } = await runVBox(['snapshot', name, 'take', snap]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      if (action === 'restore') {
        const { stdout, stderr } = await runVBox(['snapshot', name, 'restore', snap]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      if (action === 'delete') {
        const { stdout, stderr } = await runVBox(['snapshot', name, 'delete', snap]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      return res.status(400).json({ ok: false, error: 'action must be list|take|restore|delete' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'snapshot failed' });
    }
  });

  /**
   * Minimal VM: registered VM + VDI under ~/.aivon-os/vm-lab/disks — optional boot ISO (path validated).
   */
  app.post('/api/v3/vm-lab/vbox/create-minimal', async (req, res) => {
    try {
      const name = safeVmName(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: 'Invalid VM name' });
      const slug = safeDiskSlug(name);
      if (!slug) return res.status(400).json({ ok: false, error: 'Use letters/numbers in the name for disk filename' });

      let memoryMb = Number(req.body?.memoryMb);
      let diskMb = Number(req.body?.diskMb);
      if (!Number.isFinite(memoryMb)) memoryMb = 2048;
      if (!Number.isFinite(diskMb)) diskMb = 20480;
      memoryMb = Math.max(256, Math.min(32768, Math.floor(memoryMb)));
      diskMb = Math.max(4096, Math.min(512000, Math.floor(diskMb)));

      let ost = String(req.body?.ostype || 'Ubuntu_64');
      if (!OSTYPES.has(ost)) ost = 'Ubuntu_64';

      let iso = null;
      if (req.body?.isoPath) {
        iso = validateIsoPath(req.body.isoPath);
        if (!iso) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid ISO path. Use an existing .iso under your home folder (or /Volumes on macOS).'
          });
        }
      }

      fs.mkdirSync(VM_LAB_DISKS, { recursive: true });
      const vdiPath = path.join(VM_LAB_DISKS, `${slug}.vdi`);

      const steps = [];
      const push = (label, args, stdout, stderr) => {
        steps.push({ label, args, stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
      };

      let r = await runVBox(['createvm', '--name', name, '--register']);
      push('createvm', ['createvm', '--name', name, '--register'], r.stdout, r.stderr);

      r = await runVBox([
        'modifyvm',
        name,
        '--memory',
        String(memoryMb),
        '--acpi',
        'on',
        '--ostype',
        ost,
        '--cpus',
        '2'
      ]);
      push('modifyvm', ['modifyvm', name, '...'], r.stdout, r.stderr);

      r = await runVBox(['createmedium', 'disk', '--filename', vdiPath, '--size', String(diskMb), '--format', 'VDI']);
      push(
        'createmedium',
        ['createmedium', 'disk', '--filename', vdiPath, '--size', String(diskMb), '--format', 'VDI'],
        r.stdout,
        r.stderr
      );

      r = await runVBox(['storagectl', name, '--name', 'SATA', '--add', 'sata', '--controller', 'IntelAhci']);
      push('storagectl', ['storagectl', name, 'SATA'], r.stdout, r.stderr);

      r = await runVBox([
        'storageattach',
        name,
        '--storagectl',
        'SATA',
        '--port',
        '0',
        '--device',
        '0',
        '--type',
        'hdd',
        '--medium',
        vdiPath
      ]);
      push('storageattach_hdd', ['storageattach', 'hdd'], r.stdout, r.stderr);

      if (iso) {
        r = await runVBox([
          'storageattach',
          name,
          '--storagectl',
          'SATA',
          '--port',
          '1',
          '--device',
          '0',
          '--type',
          'dvddrive',
          '--medium',
          iso
        ]);
        push('storageattach_iso', ['storageattach', 'dvd'], r.stdout, r.stderr);
        r = await runVBox(['modifyvm', name, '--boot1', 'dvd', '--boot2', 'disk']);
        push('boot', ['modifyvm', 'boot dvd'], r.stdout, r.stderr);
      } else {
        r = await runVBox(['modifyvm', name, '--boot1', 'disk']);
        push('boot', ['modifyvm', 'boot disk'], r.stdout, r.stderr);
      }

      return res.json({ ok: true, vmName: name, vdiPath, isoPath: iso, ostype: ost, memoryMb, diskMb, steps });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e.message || 'create-minimal failed',
        hint: 'If a partial VM remains: remove it in the host UI or VBoxManage unregistervm "Name"'
      });
    }
  });

  app.get('/api/v3/vm-lab/vmware/list', async (req, res) => {
    try {
      const { stdout, stderr } = await runVmrun(['list']);
      const text = String(stdout || '');
      const paths = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.toLowerCase().endsWith('.vmx'));
      res.json({ ok: true, paths, raw: text.trim(), stderr: String(stderr || '').trim() });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e.message || 'vmrun list failed',
        hint: 'vmrun not available. Install the host tool that provides vmrun or adjust PATH.'
      });
    }
  });

  app.post('/api/v3/vm-lab/vmware/action', async (req, res) => {
    try {
      const action = String(req.body?.action || '').toLowerCase();
      if (action === 'list') {
        const { stdout, stderr } = await runVmrun(['list']);
        const text = String(stdout || '');
        const paths = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.toLowerCase().endsWith('.vmx'));
        return res.json({ ok: true, paths, raw: text.trim(), stderr: String(stderr || '').trim() });
      }

      const vmx = validateVmxPath(req.body?.vmxPath);
      if (!vmx) return res.status(400).json({ ok: false, error: 'Invalid or missing vmxPath (absolute path to .vmx file)' });

      if (action === 'start') {
        const gui = String(req.body?.gui || 'gui').toLowerCase() === 'nogui' ? 'nogui' : 'gui';
        const { stdout, stderr } = await runVmrun(['start', vmx, gui]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      if (action === 'stop') {
        const kind = String(req.body?.stopKind || 'hard').toLowerCase() === 'soft' ? 'soft' : 'hard';
        const { stdout, stderr } = await runVmrun(['stop', vmx, kind]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      if (action === 'suspend') {
        const { stdout, stderr } = await runVmrun(['suspend', vmx]);
        return res.json({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '').trim() });
      }
      return res.status(400).json({ ok: false, error: 'action must be list|start|stop|suspend' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'vmrun action failed' });
    }
  });
}

module.exports = { mountVmLabRoutes, getStatus };
