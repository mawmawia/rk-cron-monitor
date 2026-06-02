export default async function handler(req, res) {
  // CORS for RapidAPI
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Host');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST' });

  const { job_name, cron_expression, last_run_timestamp, grace_minutes = 5 } = req.body || {};

  if (!job_name || !cron_expression || !last_run_timestamp) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['job_name', 'cron_expression', 'last_run_timestamp']
    });
  }

  try {
    const now = new Date();
    const lastRun = new Date(last_run_timestamp);
    
    if (isNaN(lastRun.getTime())) {
      return res.status(400).json({ error: 'Invalid last_run_timestamp. Use ISO 8601: 2026-06-02T10:00:00Z' });
    }

    const diffMinutes = (now - lastRun) / 60000;
    const expectedInterval = parseCronToMinutes(cron_expression);

    // F1: Missed Job Detection
    const is_missed = diffMinutes > (expectedInterval + grace_minutes);

    // F3: False Alert Killer - ran recently despite "failure" signal
    const is_false_alert = diffMinutes < expectedInterval * 0.5;

    // F4: Downtime Duration  
    const downtime_minutes = is_missed ? Math.floor(diffMinutes - expectedInterval) : 0;

    // Health score 0-100
    const health_score = is_missed ? 0 : Math.max(0, 100 - Math.floor(diffMinutes / expectedInterval * 100));

    return res.status(200).json({
      job_name,
      status: is_missed ? 'missed' : 'healthy',
      is_missed,
      is_false_alert,
      downtime_minutes,
      health_score,
      last_run: lastRun.toISOString(),
      checked_at: now.toISOString(),
      expected_interval_minutes: expectedInterval,
      grace_minutes,
      next_expected_run: new Date(lastRun.getTime() + expectedInterval * 60000).toISOString()
    });

  } catch (err) {
    return res.status(500).json({ 
      error: 'Failed to process request', 
      details: err.message 
    });
  }
}

function parseCronToMinutes(cron) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Invalid cron: must have 5 parts');
  
  const [min, hour, day, month, weekday] = parts;
  
  // Handle */n format
  if (min.startsWith('*/')) return parseInt(min.slice(2));
  if (hour.startsWith('*/')) return parseInt(hour.slice(2)) * 60;
  if (day.startsWith('*/')) return parseInt(day.slice(2)) * 1440;
  
  // Common patterns
  if (min === '0' && hour === '*') return 60; // hourly
  if (min === '0' && hour === '0') return 1440; // daily
  if (min === '0' && hour === '0' && weekday === '0') return 10080; // weekly
  
  // If specific minute/hour set, assume hourly or daily
  if (min !== '*' && hour === '*') return 60;
  if (min !== '*' && hour !== '*') return 1440;
  
  return 60; // default fallback
}
