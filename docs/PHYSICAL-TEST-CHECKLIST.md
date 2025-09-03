# Physical Test Checklist

Run these steps on a real device in the warehouse UI.

1) Happy path (pass + print)
- Scan valid code: Open scanner, scan master/destination label; lands on workspace.
- Start inspection: Tap “Start Inspection”.
- Pass steps: Tap “PASS” through the checklist.
- Submit: On finish, status badge flips to Pass; toast shows.
- Audit: Activity timeline shows an inspection/audit line.
- Print 5 labels: Open “Prepare & Print Labels” → set quantity 5 → “Print All Labels”.
- Download: A PDF downloads named `labels-<orderNumber>.pdf`.
- Re-scan: Scan one of the freshly printed labels → validation passes.

2) Invalid scan
- Scan an invalid code → friendly error message.
- Manual lookup: Enter code manually; if correct order, validation works.

3) Fail/Hold path
- Fail one step: Tap “FAIL” or “HOLD”.
- Note required: Inline prompt requires a note before submit.
- Attach photo: Add a photo (or upload) while keeping typed note.
- Submit: Badge shows Fail/Hold; history shows note + thumbnail.

4) Double-submit guard
- Rapidly double-tap Submit: Only one inspection saved.
- Second attempt is rejected (duplicate) without breaking the UI.

5) Big print
- Request ~200 labels: Confirm the app allows the large print.
- Metrics: Print count increments; `printed_at/by` and `label_size` stored.

Notes
- Scanner/validate/status routes run on Edge for snappy feedback.
- Workspace lookups during scan are cached (60s) to avoid cold-starts on repeats.

