# RK Cron Monitor

Free API to monitor cron jobs and detect missed runs, false alerts, and downtime.

**Live on RapidAPI:** https://rapidapi.com/mawm/api/rk-cron-monitor

## Endpoints

### POST `/api/check`
Detects missed jobs using F1, F3, F4 logic.

**Body:**
```json
{
  "job_name": "backup-db",
  "cron_expression": "0 * * * *",
  "last_run_timestamp": "2026-06-02T10:00:00Z",
  "grace_minutes": 5
}
