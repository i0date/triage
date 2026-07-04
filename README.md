# Triage

**Live demo → [triage-beta.vercel.app](https://triage-beta.vercel.app)**

Triage is a dispute and fraud classification tool for financial institutions. It helps frontline agents classify an incoming claim — before anything is filed — into one of three categories: true fraud, first-party fraud, or consumer dispute. Each verdict comes with a confidence level, the key signals that drove it, and a routing recommendation.

For true fraud cases, Triage hands off directly to [Dispute Desk](https://dispute-desk-tau.vercel.app) for Visa summary generation and evidence packaging.

---

## What it does

An agent receives a complaint — phone, app, email. Before opening a dispute, they open Triage and fill in what they know:

- Transaction details (merchant, amount, date, type)
- How the claim was flagged (customer-reported, system alert, proactive outreach)
- The customer's stated reason
- Cardholder risk signals (prior disputes, account age, days since transaction, card possession)
- Merchant risk signals (VFMP status, dispute rate, MCC tier)

Claude weighs the signals and returns a classification.

**TRUE FRAUD** — a third party used the card without consent. File immediately.

**FIRST-PARTY FRAUD** — the cardholder made the transaction and is disputing falsely. Flag for investigation. Do not file.

**CONSUMER DISPUTE** — the cardholder has a legitimate grievance (non-receipt, defective item, cancelled subscription). Attempt goodwill outreach before filing.

---

## Part of a three-tool dispute operations suite

| Tool | Purpose | Live |
|---|---|---|
| Triage | Classify the claim at intake | [triage-beta.vercel.app](https://triage-beta.vercel.app) |
| Dispute Desk | Generate Visa dispute summary + evidence package | [dispute-desk-tau.vercel.app](https://dispute-desk-tau.vercel.app) |
| Dispute Funding Assessor | Score a portfolio of disputes for fundability | [dispute-funding-assessor.vercel.app](https://dispute-funding-assessor.vercel.app) |

---

## Stack

- React 18 + Vite
- Tailwind CSS
- Vercel serverless function (proxies Anthropic API)
- Claude claude-sonnet-4-6

---

## Deploy your own

```bash
git clone https://github.com/i0date/triage.git
cd triage
npm install
npm run dev
```

Add an `ANTHROPIC_API_KEY` environment variable in Vercel before deploying.

---

Built by [Adeoti Fashokun](https://www.linkedin.com/in/adeotifashokun) — fraud, risk & trust operations, Toronto.
