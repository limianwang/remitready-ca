# RemitReady Canada

A small, browser-based payroll deduction calculator for British Columbia ad hoc / lump-sum salary payments.

This project is inspired by the CRA Payroll Deductions Online Calculator (PDOC), but it is unaffiliated and intentionally narrower:

- British Columbia only
- 2026 tax year only
- Ad hoc / lump-sum salary payments
- CPP, CPP2, employee income tax withholding, employer CPP, and CRA remittance totals
- JSON import/export for lightweight payment history

It is not a full payroll system.

Important: this is a best-guess payroll withholding estimate. Revalidate final deductions against the official CRA PDOC calculator before remitting. This project provides no payroll, tax, legal, or accounting advice and accepts no responsibility for remittance errors or other losses.

## Why This Exists

CRA PDOC is accurate, but it is built around payroll-period workflows. This calculator is designed for a simpler owner-operator use case: irregular salary payments where you want to calculate the next lump-sum payment using year-to-date context.

The calculator answers:

- How much employee CPP and CPP2 should be withheld on this payment?
- How much employer CPP and CPP2 should be accrued?
- How much income tax should be withheld on this payment?
- What is the total CRA remittance for this payroll?
- Based on saved history, does year-end tax look close to zero?

## Current Scope

Supported:

- BC payroll only
- 2026 payroll constants
- Current ad hoc gross salary payment
- Prior year-to-date salary/lump-sum context
- CPP and CPP2 annual limits
- Federal and BC income tax withholding estimate with target-zero and CRA marginal modes
- Conservative income tax withholding offset
- Opening balance records for payroll that happened before using this calculator
- JSON import/export for history persistence
- Constants viewer in the UI

Not supported yet:

- Other provinces or territories
- EI
- Benefits, taxable allowances, commissions, vacation pay, or non-cash taxable benefits
- Multiple employees
- Payroll remittance frequency tracking
- Automatic fetching of future CRA constants
- Final T1 personal tax return calculation

## Important Accuracy Notes

This tool is for payroll withholding estimation, not tax filing.

Treat every result as a best guess until it has been revalidated against the official CRA PDOC calculator or another authoritative payroll source. You are responsible for validating and remitting the correct amounts.

CPP/CPP2 should be close to exact for the supported scenario because the calculation is based on the 2026 annual CPP limits, the employee/employer rates, and prior pensionable earnings already paid.

Income tax withholding defaults to target-zero mode. Before July 1, 2026, it targets the January payroll basis so it does not collect a catch-up amount that payroll tables have not started using yet. On and after July 1, 2026, it targets the final annual tax basis less actual YTD income tax already withheld. This is intended for owner-operator planning where the goal is a near-zero year-end balance once catch-up tables are active.

The app also includes a CRA marginal estimate mode for comparison. That mode uses annualized / incremental logic for the current lump-sum payment and may differ from CRA PDOC depending on PDOC inputs, pay-period assumptions, prior withholding, and future payroll activity.

When in doubt, use conservative mode to intentionally over-withhold income tax.

## 2026 BC Payroll Constants

The 2026 BC constants are date-sensitive.

The app uses two related but separate rate concepts:

- `annualTax`: the final annual tax estimate basis used by the year-end validator.
- `payrollPeriods`: payment-date withholding instructions used for the current payment calculation.

Payroll periods inherit from `annualTax` and override only the fields that differ for that payroll period. This avoids copying the full federal, CPP, and provincial data into every effective period.

The app selects the active payroll constants from the current payment date:

| Payment date | Source period | BC tax reduction max used for payroll |
| --- | --- | ---: |
| 2026-01-01 to 2026-06-30 | January 2026 CRA payroll tables | $575 |
| 2026-07-01 to 2026-12-31 | July 2026 CRA payroll formulas | $805 |

The final annual tax basis uses BC's full-year policy amount of `$690`. The July payroll `$805` amount can look wrong at first because it is a prorated payroll catch-up amount for the remaining half of the year. That distinction matters: a January payment can be under-withheld against the final annual basis, while a July payment can use a higher payroll withholding basis to catch up.

Sources:

- [CRA T4032-BC Payroll Deductions Tables, effective January 1, 2026](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032bc-jan.html)
- [CRA T4127 Payroll Deductions Formulas, effective July 1, 2026](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jul/t4127-jul-payroll-deductions-formulas.html)
- [BC basic personal income tax credits](https://www2.gov.bc.ca/gov/topic.page?id=05AC3C069516494DBF1B196BC31BA627&title=General+Tax+Credits)

## How The Calculator Works

1. Choose the payment date.
2. Enter the current lump-sum gross salary payment.
3. Enter prior YTD context, or import JSON history.
4. Calculate the current payment.
5. Review employee deductions, CRA remittance, and employer cost.
6. Add the calculation to history.
7. Export JSON when done.

The current payment result is for the current payment only. It is not a lifetime total.

The payment history and year-end position panels are based on saved/imported JSON history.

## JSON History Workflow

This app does not use local storage.

To persist history:

1. Add calculated payments to history.
2. Export JSON.
3. Save the downloaded file.
4. Import the same JSON file next time.

Importing JSON automatically loads the saved YTD values into the form.

Use an opening balance when prior payroll happened outside this JSON history. For example, if you already ran payroll before using this calculator, enter the YTD amounts and save them as an opening balance so future exports preserve that starting point.

## Field Guide

### Current lump-sum gross

The gross salary amount being paid now, before employee deductions.

### YTD regular salary/wages before this payment

Total regular salary or wages already paid earlier in the tax year. This is year-to-date, not monthly.

### YTD prior ad hoc lump-sum salary

Total earlier one-off salary payments already paid in the tax year.

### YTD CPP pensionable earnings

Prior earnings that count toward CPP/CPP2 limits. For ordinary salary payroll this is usually regular salary/wages plus prior ad hoc lump-sum salary.

If this field is `0`, the app derives it automatically from regular salary/wages plus prior ad hoc lump-sum salary.

If you enter a different value, that value overrides the derived CPP/CPP2 room calculation. It does not change the income tax bracket calculation.

### YTD employee CPP / CPP2 already withheld

Employee CPP and CPP2 already deducted earlier in the tax year.

### YTD income tax already withheld

Income tax already withheld earlier in the tax year. This is used by target-zero mode and the year-end position estimate.

In target-zero mode, the current payment income tax is estimated as the payment-date target tax after the current payment minus this YTD amount. Before July 1, 2026, the target is the January payroll basis. On and after July 1, 2026, the target is the final annual basis. In CRA marginal mode, this field does not reduce the current payment's withholding calculation.

## Local Development

Install dependencies:

```sh
npm install
```

Run the local app:

```sh
npm run dev
```

Open:

```txt
http://localhost:4173
```

Run tests:

```sh
npm test
```

Build the static production artifact:

```sh
npm run build
```

This validates all rate JSON files, runs tests, and runs `vite build`. Vite bundles Alpine, application modules, and Tailwind CSS into `dist/`.

## Vercel Deployment

This project can deploy as a static Vercel site. It does not need a backend, serverless functions, database, storage, analytics, or environment variables.

Vercel can auto-detect this as a Vite project. No `vercel.json` file is required.

Vercel setup:

1. Import the GitHub repository into Vercel.
2. Use the Vite framework preset if it is not selected automatically.
3. Confirm build command: `npm run build`.
4. Confirm output directory: `dist`.
5. Add the custom domain.

The deploy gate is:

```sh
npm run build
```

That command includes:

```sh
npm run validate:rates
npm test
vite build
```

The browser does not import directly from `node_modules`. `src/app.js` imports Alpine as a package dependency, and Vite bundles it into the production assets.

## Project Structure

```txt
CONTRIBUTING.md            Contribution guidelines
LICENSE                    MIT license
SECURITY.md                Security and data-handling policy
index.html                 App shell
vite.config.js             Vite build configuration
src/app.js                 Alpine.js UI state and orchestration
src/styles.css              Tailwind CSS entrypoint
src/lib/calculate.js       Payroll calculation entry point
src/lib/cpp.js             CPP / CPP2 calculation
src/lib/tax.js             Federal and BC income tax calculation
src/lib/history.js         Payment history and opening balances
src/lib/jsonHistory.js     JSON import/export validation
src/lib/money.js           Money parsing/rounding/formatting
src/rates/ca-bc-2026.json  2026 BC payroll constants
src/rates/ca-bc-2026.js    Rate exports and date selection helper
src/rates/validateRates.js Dependency-free rate file validator
scripts/validate-rates.js  CLI validator for new rate JSON files
tests/                     Node test suite
```

## License

MIT. The software is provided as-is, without warranty or liability. See `LICENSE`.

## Adding Provinces Or Future Tax Years

The current app is deliberately BC-only, but the code is structured so future provinces or tax years can be added without changing the calculation model too much.

### Rate File Pattern

Rates live in `src/rates/`.

The rate JSON schema has two layers:

- `annualTax`: complete final annual tax estimate basis.
- `payrollPeriods`: date-sensitive payroll withholding periods with partial `overrides`.

`annualTax` must include:

- `taxYear`
- `jurisdiction`
- `effectivePeriod`
- `effectiveFrom`
- `effectiveTo`
- `source`
- `sourceUrl`
- `cpp`
- `federal`
- Provincial tax constants, currently `bc`

Each payroll period must include:

- `effectiveFrom`
- `effectiveTo`
- `effectivePeriod`
- `source`
- `sourceUrl`
- `overrides`

The override object can contain only these sections:

- `cpp`
- `federal`
- `bc`

Objects merge recursively. Arrays replace the inherited array. That means a bracket table override must provide the full replacement bracket table for that section.

Minimal example:

```json
{
  "taxYear": 2027,
  "jurisdiction": "British Columbia",
  "annualTax": {
    "taxYear": 2027,
    "jurisdiction": "British Columbia",
    "effectivePeriod": "2027 annual final tax basis",
    "effectiveFrom": "2027-01-01",
    "effectiveTo": "2027-12-31",
    "source": "Final annual source description",
    "sourceUrl": "https://example.com/source",
    "cpp": {},
    "federal": {},
    "bc": {}
  },
  "payrollPeriods": [
    {
      "effectivePeriod": "2027-01-01 to 2027-12-31",
      "effectiveFrom": "2027-01-01",
      "effectiveTo": "2027-12-31",
      "source": "CRA payroll source description",
      "sourceUrl": "https://example.com/payroll-source",
      "overrides": {
        "bc": {
          "lowestRate": 0.056,
          "brackets": []
        }
      }
    }
  ]
}
```

In real files, `cpp`, `federal`, `bc`, and replacement `brackets` must be fully populated. The example is intentionally abbreviated.

The validator enforces:

- required annual and payroll-period metadata
- complete CPP, federal, and provincial sections after payroll overrides are resolved
- bracket rate ranges and increasing bracket limits
- non-overlapping payroll effective periods
- supported override section names only

For a new year or province, prefer creating a new source JSON file instead of mutating the 2026 BC file. Examples:

```txt
src/rates/ca-bc-2027.json
src/rates/ca-on-2027.json
src/rates/ca-ab-2027.json
```

Then add a small module beside it:

```txt
src/rates/ca-bc-2027.js
```

That module should export the JSON, validate it with `assertValidRatesPayload()`, export the annual validator basis, and expose a date-selection helper similar to the current 2026 BC helper.

Before wiring a new rate file into the app, validate it directly:

```sh
node scripts/validate-rates.js src/rates/ca-bc-2027.json
```

The default rate validation script discovers and checks every JSON rate file under `src/rates/`. This is the command to use in CI or GitHub Actions as a merge gate:

```sh
npm run validate:rates
```

Rate modules should also validate imported JSON with `assertValidRatesPayload()` before exporting it. That gives two checks: one during rate-file creation and another during tests/app startup.

Tests should prove the distinction between:

- payroll rates used for a payment date
- annual tax rates used by the year-end validator
- any mid-year catch-up difference between the two

### Adding A New Province

Recommended sequence:

1. Add a new provincial rate JSON file with source URLs, annual final tax basis, and payroll period overrides.
2. Add tests that verify bracket rates, constants, credits, annual-vs-payroll differences, and date selection.
3. Update the tax calculation layer if the province has formulas that differ from BC.
4. Add a province selector only after at least two provinces are source-backed and tested.
5. Update the constants UI so users can inspect the active province/year source data.

Risk surface:

- Provinces do not all use the same reduction/credit formulas.
- Some provinces have surtaxes or special reductions that BC does not have.
- Payroll formulas may differ from final annual tax-return formulas.
- Mid-year payroll changes can use prorated values that look inconsistent with annual policy amounts.

Do not add a province by copying BC constants and changing only brackets unless the CRA formula confirms the same calculation structure applies.

### Refreshing For 2027

When the 2027 CRA payroll constants are available:

1. Pull the official CRA payroll source pages for January 2027.
2. Create `src/rates/ca-bc-2027.json`.
3. Populate `annualTax` first from the final annual tax basis.
4. Add payroll period overrides only where the payroll source differs from `annualTax`.
5. Include all source URLs and source notes in the JSON.
6. Run `node scripts/validate-rates.js src/rates/ca-bc-2027.json`.
7. Add tests for:
   - CPP/CPP2 limits
   - Federal brackets and credits
   - BC brackets and reductions
   - Annual tax basis versus payroll withholding basis
   - Effective period selection
8. Point the app to the 2027 rate module only after validation and tests pass.

If CRA publishes a July 2027 update, add it as another payroll period inside the same 2027 JSON file instead of replacing the January period.

### Future Automation

A future version should add a maintainer script that can re-pull official CRA payroll constants for a requested tax year, generate or update rate JSON files, validate them, and produce a reviewable diff. It should not silently update production calculations.

Recommended workflow:

1. Fetch official CRA source pages.
2. Parse candidate constants into a new JSON file.
3. Run the rate JSON schema validator.
4. Show a diff against the prior committed constants.
5. Require maintainer review before the app uses the new constants.
6. Add or update tests from the same source data.

This keeps the calculator auditable, which matters more than convenience for payroll calculations.

## Contributing

Keep the project narrow and auditable.

Good contributions:

- Fixing calculation defects with tests
- Improving source traceability for payroll constants
- Improving the JSON history workflow
- Adding future tax-year constants in the same transparent format
- Improving accessibility and UI clarity

Avoid:

- Adding a backend before there is a real persistence requirement
- Adding broad payroll features without source-backed formulas
- Hiding constants in code instead of inspectable JSON
- Changing withholding logic without tests and source references

## Disclaimer

This project is not affiliated with the Canada Revenue Agency or the Government of British Columbia.

It is provided for estimation and planning only. Verify payroll deductions against official CRA tools, published payroll formulas, or a qualified payroll/accounting professional before remitting.

The maintainers and contributors accept no responsibility or liability for payroll errors, tax errors, penalties, interest, incorrect remittances, missed remittances, or any other loss arising from use of this project.
