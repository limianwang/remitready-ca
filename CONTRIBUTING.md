# Contributing

This project is intentionally narrow: British Columbia, 2026, ad hoc / lump-sum salary payments.

## Ground Rules

- Keep the app static. Do not add a backend, database, account system, or telemetry.
- Do not add dependencies without a clear maintenance or correctness reason.
- Keep payroll constants source-backed and reviewable.
- Treat all calculation changes as high risk.
- Keep user-facing copy clear that this is an estimate, not payroll, tax, legal, or accounting advice.

## Local Development

```sh
npm install
npm run dev
```

Run the full verification gate:

```sh
npm run build
```

`npm run build` validates rate files, runs tests, and builds the static Vite artifact.

## Pull Request Checklist

- [ ] The change stays within the documented scope.
- [ ] Payroll constants include official source references.
- [ ] Relevant tests were added or updated.
- [ ] `npm run build` passes.
- [ ] README or in-app disclaimers were updated if user-facing behavior changed.

## Calculation Changes

For tax, CPP, CPP2, or rate changes, include:

- The official source URL.
- The effective date.
- The exact scenario tested.
- Why the change is needed.

Do not merge calculation changes based only on intuition or screenshots.
