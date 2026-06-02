export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { cron_expression } = req.method === 'GET' ? req.query : req.body;
  
  if (!cron_expression) {
    return res.status(400).json({ error: 'Missing cron_expression' });
  }

  try {
    const minutes = parseCronToMinutes(cron_expression);
    const next_run = getNextRun(cron_expression);
    
    return res.status(200).json({
      cron_expression,
      interval_minutes: minutes,
      human_readable: minutesToHuman(minutes),
      next_run_estimate: next_run,
      valid: true
    });
  } catch (err) {
    return res.status(400).json({ error: err.message, valid: false });
  }
}

function parseCronToMinutes(cron) {
  const parts = cron.trim().split(' ');
  if (parts.length !== 5) throw new Error('Invalid cron format');
  const [min, hour] = parts;
  if (min.startsWith('*/')) return parseInt(min.slice(2));
  if (hour.startsWith('*/')) return parseInt(hour.slice(2)) * 60;
  if (min === '0' && hour === '*') return 60;
  if (min === '0' && hour === '0') return 1440;
  return 60;
}

function minutesToHuman(min) {
  if (min < 60) return `Every ${min} minutes`;
  if (min === 60) return 'Every hour';
  if (min < 1440) return `Every ${min/60} hours`;
  if (min === 1440) return 'Every day';
  return `Every ${min/1440} days`;
}

function getNextRun(cron) {
  const minutes = parseCronToMinutes(cron);
  const next = new Date(Date.now() + minutes * 60000);
  return next.toISOString();
}
