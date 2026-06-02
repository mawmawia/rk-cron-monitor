export default async function handler(req, res) {
  // CORS for RapidAPI
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { job_name, cron_expression, last_run_timestamp, grace_minutes = 5 } = req.body;

  if (!job_name || !cron_expression || !last_run_timestamp) {
    return res.status(400).json({ 
      error: 'Missing required fields: job_name, cron_expression, last_run_timestamp' 
    });
  }

  try {
    const now = new Date();
    const lastRun = new Date(last_run_timestamp);
    const diffMinutes = (now - lastRun) / 60000;

    // F1: Missed Job Detection
    const expectedInterval = parseCronToMinutes(cron_expression);
    const is_missed = diffMinutes > (expectedInterval + grace_minutes);

    // F3: False Alert Killer - check if it ran recently despite "failure" signal
    const is_false_alert = diffMinutes < expectedInterval;

    // F4: Downtime Duration
    const downtime_minutes = is_missed ? Math.floor(diffMinutes - expectedInterval) : 0;

    // Health score
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
      grace_minutes
    });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse cron or timestamp', details: err.message });
  }
}

// Helper: Convert cron to minutes - supports */5 * * * * format
function parseCronToMinutes(cron) {
  const parts = cron.trim().split(' ');
  if (parts.length !== 5) throw new Error('Invalid cron: must have 5 parts');
  
  const [min, hour] = parts;
  
  // Handle */n format
  if (min.startsWith('*/')) return parseInt(min.slice(2));
  if (hour.startsWith('*/')) return parseInt(hour.slice(2)) * 60;
  
  // Handle "0 * * * *" = hourly = 60min
  if (min === '0' && hour === '*') return 60;
  
  // Handle "0 0 * * *" = daily = 1440min  
  if (min === '0' && hour === '0') return 1440;
  
  // Default fallback
  return 60;
}
