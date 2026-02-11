import { exec } from 'child_process';

const PORT = 3000;

console.log(`Checking for processes on port ${PORT}...`);

const cmd = process.platform === 'win32' 
  ? `netstat -ano | findstr :${PORT}`
  : `lsof -i :${PORT} -t`; // Mac/Linux support just in case

exec(cmd, (err, stdout) => {
  if (err || !stdout) {
    console.log('No process found on port 3000. Clean start.');
    return; 
  }

  if (process.platform === 'win32') {
      const lines = stdout.split('\n').filter(l => l.includes('LISTENING'));
      if (lines.length === 0) return;

      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') {
            pids.add(pid);
        }
      });

      pids.forEach(pid => {
           console.log(`Killing zombie process ${pid} on port ${PORT}...`);
           exec(`taskkill /PID ${pid} /F`, (killErr) => {
              // Ignore specific errors if needed, but logging is fine
              if (killErr) console.error(`Failed to kill ${pid}: ${killErr.message}`);
              else console.log(`Successfully killed process ${pid}.`);
           });
      });

  } else {
      // Mac/Linux
      const pids = new Set(stdout.trim().split('\n').filter(p => p));
      pids.forEach(pid => {
          exec(`kill -9 ${pid}`, () => console.log(`Killed ${pid}`));
      });
  }
});
