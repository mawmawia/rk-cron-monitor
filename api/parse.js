export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Host');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const params = req.method === 'GET' ? req.query : req.body || {};
  const { cron_expression } = params;
  
  if (!cron_expression) {
    return res.status(400).json({ error: 'Missing cron_expression parameter' });
  }

  try {
    const minutes = parseCronToMinutes(cron_expression);
    const next_run = new Date(Date.now() + minutes * 60000);
    
    return res.status(200).json({
      cron_expression,
      interval_minutes: minutes,
      human_readable: minutesToHuman(minutes),
      next_run_estimate: next_run.toISOString(),
      valid: true,
      description: getCronDescription(cron_expression)
    });
  } catch (err) {
    return res.status(400).json({ 
      error: err.message, 
      valid: false,
      cron_expression 
    });
  }
}

function parseCronToMinutes(cron) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Invalid cron format. Expected: "min hour day month weekday"');
  
  const [min, hour, day, month, weekday] = parts;
  
  if (min.startsWith('*/')) return parseInt(min.slice(2));
  if (hour.startsWith('*/')) return parseInt(hour.slice(2)) * 60;
  if (day.startsWith('*/')) return parseInt(day.slice(2)) * 1440;
  if (month.startsWith('*/')) return parseInt(month.slice(2)) * 43200;
  
  if (min === '0' && hour === '*') return 60;
  if (min === '0' && hour === '0') return 1440;
  if (min === '0' && hour === '0' && weekday === '0') return 10080;
  
  if (min !== '*' && hour === '*') return 60;
  if (min !== '*' && hour !== '*') return 1440;
  
  return 60;
}

function minutesToHuman(min) {
  if (min < 60) return `Every ${min} minute${min > 1 ? 's' : ''}`;
  if (min === 60) return 'Every hour';
  if (min < 1440) return `Every ${min/60} hour${min/60 > 1 ? 's' : ''}`;
  if (min === 1440) return 'Every day';
  if (min === 10080) return 'Every week';
  if (min < 43200) return `Every ${Math.floor(min/1440)} day${Math.floor(min/1440) > 1 ? 's' : ''}`;
  return `Every ${Math.floor(min/43200)} month${Math.floor(min/43200) > 1 ? 's' : ''}`;
}

function getCronDescription(cron) {
  const presets = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '0 * * * *': 'Every hour',
    '0 */2 * * *': 'Every 2 hours',
    '0 0 * * *': 'Every day at midnight',
    '0 9 * * *': 'Every day at 9:00 AM',
    '0 0 * * 0': 'Every Sunday at midnight'
  };
  return presets[cron.trim()] || 'Custom schedule';
}
