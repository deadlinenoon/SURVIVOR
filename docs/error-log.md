# Backend Error Log Integration

The admin dashboard now reads backend errors from an external log file when available.

1. Point the app at your aggregated log file by setting `SURVIVOR_ERROR_LOG_PATH` (absolute path or relative to the project root).
2. Supported formats:
   - JSON array of objects
   - Newline-delimited JSON (one object per line)
3. Each record should provide:

```json
{
  "id": "err-002",
  "timestamp": "2025-09-25T02:41:07.000Z",
  "source": "api/rooting-consensus",
  "message": "ScoresAndOdds markup changed, unable to parse consensus table",
  "status": "investigating",
  "count": 3
}
```

Fields `status` (`open` | `investigating` | `resolved`) and `count` are optional. If the log omits them the values default to `open` and no count. Updating the status from the admin UI persists the choice in `data/dashboard.json` without mutating the log file.

If `SURVIVOR_ERROR_LOG_PATH` is unset, the dashboard falls back to the stored `data/dashboard.json` errors list.
