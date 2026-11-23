# Devin Security demo: Acme Notes

A tiny Express notes API used to demo Devin Security end to end: scan, threat model, findings, validation, and a fix PR.
It is deliberately vulnerable. Never deploy it.

- `app/` is the only code the scan should look at (set the scan path to `devin-security-demo/app`).
- `ANSWER_KEY.md` lists what was planted, so the presenter can check the scan's results. It sits outside `app/` on purpose.
- `DEMO_SCRIPT.md` is the presenter script.

## Run it

```bash
cd devin-security-demo/app
npm install
npm test          # 3 smoke tests
npm start         # http://localhost:3000, users alice/bob/mallory, password <name>123
```
