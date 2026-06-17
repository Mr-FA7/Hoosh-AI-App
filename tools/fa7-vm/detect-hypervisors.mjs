#!/usr/bin/env node
/**
 * FA7 — تشخیص سریع ابزار مجازی‌سازی نصب‌شده روی همین ماشین (بدون وابستگی به سرور FA7).
 * خروجی: JSON برای استفادهٔ ایجنت یا کاربر.
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function vboxPaths() {
  const out = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    out.push(path.join(pf, 'Oracle', 'VirtualBox', 'VBoxManage.exe'));
    out.push(path.join(pfx86, 'Oracle', 'VirtualBox', 'VBoxManage.exe'));
  } else if (process.platform === 'darwin') {
    out.push('/usr/local/bin/VBoxManage', '/opt/homebrew/bin/VBoxManage', '/Applications/VirtualBox.app/Contents/MacOS/VBoxManage');
  } else {
    out.push('/usr/bin/VBoxManage', '/usr/local/bin/VBoxManage');
  }
  return out;
}

async function which(name) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('where', [name], { timeout: 6000, windowsHide: true });
      return String(stdout || '').split(/\r?\n/)[0].trim() || null;
    }
    const { stdout } = await execFileAsync('which', [name], { timeout: 6000 });
    return String(stdout || '').trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  let vbox = null;
  for (const p of vboxPaths()) {
    try {
      if (fs.existsSync(p)) {
        vbox = p;
        break;
      }
    } catch {
      /* ignore */
    }
  }
  const qemu = await which(process.platform === 'win32' ? 'qemu-system-x86_64.exe' : 'qemu-system-x86_64');
  const qemuImg = await which(process.platform === 'win32' ? 'qemu-img.exe' : 'qemu-img');
  const vmrun = await which(process.platform === 'win32' ? 'vmrun.exe' : 'vmrun');
  const utm = process.platform === 'darwin' && fs.existsSync('/Applications/UTM.app');

  const report = {
    vboxManage: vbox ? { path: vbox } : null,
    qemu: qemu || qemuImg ? { qemuSystemX64: qemu, qemuImg } : null,
    vmrun: vmrun ? { path: vmrun } : null,
    optionalMacVmUi: utm ? { detected: true } : null,
    note: 'مسیرهای کشف‌شده روی همین میزبان؛ FA7 باینری hypervisor جداگانه embed نمی‌کند.'
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
