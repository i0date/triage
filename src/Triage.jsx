import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, MessageSquare, Loader2, ArrowRight, ExternalLink, AlertCircle, Send, Lock } from 'lucide-react'

export default function Triage() {

  // ── 01 Transaction details ──────────────────────────────────────────────────
  const [accountType, setAccountType]         = useState('')
  const [merchant, setMerchant]               = useState('')
  const [amount, setAmount]                   = useState('')
  const [currency, setCurrency]               = useState('CAD')
  const [transactionDate, setTransactionDate] = useState('')
  const [transactionType, setTransactionType] = useState('')

  // ── 02 Claim & context ──────────────────────────────────────────────────────
  const [flaggedBy, setFlaggedBy]             = useState('')
  const [customerReason, setCustomerReason]   = useState('')

  // ── 03 Risk signals — cardholder ────────────────────────────────────────────
  const [priorDisputes, setPriorDisputes]     = useState('')
  const [accountAge, setAccountAge]           = useState('')
  const [daysSince, setDaysSince]             = useState('')
  const [cardPossession, setCardPossession]   = useState('')

  // ── 03 Risk signals — account integrity (ATO) ───────────────────────────────
  const [accountChanges, setAccountChanges]   = useState('')
  const [deviceRecognized, setDeviceRecognized] = useState('')

  // ── 03 Risk signals — merchant ──────────────────────────────────────────────
  const [vfmp, setVfmp]                           = useState('')
  const [merchantDisputeRate, setMerchantDisputeRate] = useState('')
  const [mccRisk, setMccRisk]                     = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  // ── 05 Outcome tracking ─────────────────────────────────────────────────────
  const [outcomes, setOutcomes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('triage_outcomes') || '[]') } catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('triage_outcomes', JSON.stringify(outcomes))
  }, [outcomes])

  // ── Computed: Reg framework from account type ────────────────────────────────
  const regFramework =
    accountType === 'debit' || accountType === 'ach_eft' ? 'REG_E' :
    accountType === 'credit'                             ? 'REG_Z' :
    accountType === 'p2p'                                ? 'PROVIDER' :
    accountType === 'bnpl'                               ? 'REG_Z_PROVIDER' : null

  const regLabel =
    regFramework === 'REG_E'          ? 'REG E'             :
    regFramework === 'REG_Z'          ? 'REG Z'             :
    regFramework === 'PROVIDER'       ? 'PROVIDER-HANDLED'  :
    regFramework === 'REG_Z_PROVIDER' ? 'REG Z / PROVIDER'  : null

  const regSubtext =
    regFramework === 'REG_E'          ? 'Debit / EFT — Electronic Fund Transfer Act applies' :
    regFramework === 'REG_Z'          ? 'Credit — Truth in Lending Act / network chargeback rules apply' :
    regFramework === 'PROVIDER'       ? 'No network chargeback path — contact recipient FI or network' :
    regFramework === 'REG_Z_PROVIDER' ? 'BNPL — dispute through provider, not card network' : null

  const regColor =
    regFramework === 'REG_E'    ? { bg: '#1E3A8A', text: '#BFDBFE' } :
    regFramework === 'REG_Z'    ? { bg: '#4C1D95', text: '#DDD6FE' } :
                                  { bg: '#374151', text: '#D1D5DB' }

  // ── Provisional credit flag (Reg E only, fraud verdicts) ────────────────────
  const provisionalCreditApplies = regFramework === 'REG_E' && result &&
    (result.classification === 'TRUE_FRAUD' || result.classification === 'AUTHORIZED_PUSH_PAYMENT')

  // ── Weight badge style helper ────────────────────────────────────────────────
  const weightStyle = (weight) =>
    weight === 'HIGH'   ? { bg: '#1A1814', text: '#F5F1EA' } :
    weight === 'MEDIUM' ? { bg: '#6B5F4D', text: '#FAF7F1' } :
                          { bg: '#D4CCBC', text: '#1A1814' }

  // ── Classification appearance config ────────────────────────────────────────
  const classConfig = {
    TRUE_FRAUD: {
      bg: '#064E3B', text: '#D1FAE5', badge: '#065F46', badgeText: '#6EE7B7',
      borderColor: '#065F46', label: 'TRUE FRAUD', Icon: Shield,
    },
    FIRST_PARTY_FRAUD: {
      bg: '#7F1D1D', text: '#FEE2E2', badge: '#991B1B', badgeText: '#FCA5A5',
      borderColor: '#991B1B', label: 'FIRST-PARTY FRAUD', Icon: AlertTriangle,
    },
    CONSUMER_DISPUTE: {
      bg: '#78350F', text: '#FEF3C7', badge: '#92400E', badgeText: '#FCD34D',
      borderColor: '#92400E', label: 'CONSUMER DISPUTE', Icon: MessageSquare,
    },
    AUTHORIZED_PUSH_PAYMENT: {
      bg: '#1E3A5F', text: '#BFDBFE', badge: '#1D4ED8', badgeText: '#93C5FD',
      borderColor: '#1D4ED8', label: 'AUTH. PUSH PAYMENT', Icon: Send,
    },
  }

  const cfg = result ? classConfig[result.classification] : null

  // ── Outcome stats ────────────────────────────────────────────────────────────
  const resolved       = outcomes.filter(o => o.outcome !== 'pending')
  const confirmedCount = outcomes.filter(o => o.outcome === 'confirmed').length
  const accuracy       = resolved.length > 0 ? Math.round((confirmedCount / resolved.length) * 100) : null
  const vcounts = {
    TRUE_FRAUD:              outcomes.filter(o => o.verdict === 'TRUE_FRAUD').length,
    FIRST_PARTY_FRAUD:       outcomes.filter(o => o.verdict === 'FIRST_PARTY_FRAUD').length,
    CONSUMER_DISPUTE:        outcomes.filter(o => o.verdict === 'CONSUMER_DISPUTE').length,
    AUTHORIZED_PUSH_PAYMENT: outcomes.filter(o => o.verdict === 'AUTHORIZED_PUSH_PAYMENT').length,
  }
  const leadingVerdict = Object.entries(vcounts).sort((a, b) => b[1] - a[1])[0]
  const leadingLabel   = leadingVerdict[1] > 0
    ? classConfig[leadingVerdict[0]]?.label ?? leadingVerdict[0].split('_').join(' ')
    : '—'

  // ── Classify ─────────────────────────────────────────────────────────────────

  const classify = async () => {
    if (!customerReason.trim()) { setError("Customer's stated reason is required."); return }
    setLoading(true)
    setError(null)
    setResult(null)

    const prompt = `You are an expert fraud and disputes triage analyst at a financial institution. Classify this incoming dispute claim. You serve credit unions, banks, fintechs, and lenders — your output must apply regardless of institution type.

FOUR VERDICT DEFINITIONS:
- TRUE_FRAUD: A third party used the account/card without the cardholder's knowledge or consent. The cardholder is a genuine victim of unauthorized access or card compromise.
- FIRST_PARTY_FRAUD: The cardholder made the transaction themselves and is falsely disputing it to obtain a refund. Also called friendly fraud or chargeback abuse.
- CONSUMER_DISPUTE: The cardholder made the transaction legitimately but has a genuine grievance — goods not received, item not as described, cancelled subscription still charged, credit not processed, service failure, or misrepresentation.
- AUTHORIZED_PUSH_PAYMENT: The cardholder deliberately authorized and initiated the payment themselves, but was deceived into doing so via social engineering. They believed the transfer was legitimate. Common scenarios: romance scams, fake invoice/vendor fraud, buyer-seller scams, investment fraud, fake family emergency, impersonation of a government official or bank employee. Applies primarily to Zelle, Interac e-Transfer, wire transfers, and P2P payments.

ACCOUNT & TRANSACTION:
- Account Type: ${accountType ? { debit: 'Debit Card', credit: 'Credit Card', p2p: 'P2P / e-Transfer', ach_eft: 'ACH / EFT', bnpl: 'BNPL (Buy Now Pay Later)' }[accountType] : 'Not specified'}
- Regulatory Framework: ${regFramework ?? 'Unknown'}
- Merchant / Recipient: ${merchant || 'Not provided'}
- Amount: ${amount ? `${amount} ${currency}` : 'Not provided'}
- Transaction Date: ${transactionDate || 'Not provided'}
- Transaction Type: ${transactionType || 'Not provided'}

CLAIM:
- How flagged: ${flaggedBy || 'Not provided'}
- Customer's stated reason: ${customerReason}

CARDHOLDER RISK SIGNALS:
- Prior disputes (12 months): ${priorDisputes || 'Unknown'}
- Account age: ${accountAge || 'Unknown'}
- Days since transaction: ${daysSince || 'Unknown'}
- Card in possession when reported: ${cardPossession || 'Unknown'}

ACCOUNT INTEGRITY SIGNALS:
- Recent account changes (login, password, contact details): ${accountChanges || 'Unknown'}
- Device / location at time of transaction: ${deviceRecognized || 'Unknown'}

MERCHANT / RECIPIENT RISK SIGNALS:
- VFMP listed: ${vfmp || 'Unknown'}
- Merchant dispute rate: ${merchantDisputeRate || 'Unknown'}
- MCC risk tier: ${mccRisk || 'Unknown'}

CLASSIFICATION GUIDANCE:
TRUE_FRAUD: 0 prior disputes, account 3+ years, reported within 30 days, VFMP merchant, system alert, card lost/stolen, no suspicious account changes, known device.
FIRST_PARTY_FRAUD: 3+ prior disputes, account under 6 months, filed 60+ days after transaction, low-risk merchant, card in possession, customer-reported only, inconsistent claim.
CONSUMER_DISPUTE: Specific grievance stated (non-receipt, cancellation, defect), 1–2 prior disputes, plausible for merchant category, customer attempted contact.
AUTHORIZED_PUSH_PAYMENT: Customer explicitly authorized the transfer but describes being deceived — romance, fake emergency, investment, impersonation. Payment rail is P2P, e-Transfer, Zelle, or wire. The transfer itself was authorized; the deception was external.

ATO DETECTION: If recent account changes (login/password/contact) AND new/unrecognized device/location AND fraudulent activity are all present — set ato_suspected to true. ATO should be escalated to the security team in parallel with any dispute filing.

ROUTING LOGIC (factor in account type, payment rail, and classification):
- Debit or credit card dispute (TRUE_FRAUD, CONSUMER_DISPUTE) → card network chargeback. Use "VISA_CHARGEBACK" or "MC_CHARGEBACK" if network is known; otherwise "CARD_CHARGEBACK".
- ACH / EFT dispute → NACHA return code path. Use "NACHA_RETURN".
- P2P / Zelle / Interac e-Transfer / wire (TRUE_FRAUD or AUTHORIZED_PUSH_PAYMENT) → contact recipient's financial institution, initiate network recall where applicable. Use "RECIPIENT_FI".
- BNPL dispute → contact the BNPL provider directly; this is not a card network chargeback. Use "PROVIDER_DISPUTE".
- FIRST_PARTY_FRAUD (any rail) → flag for internal investigation; do not file. Use "FLAG_INVESTIGATION".
- CONSUMER_DISPUTE (any rail) → attempt goodwill or merchant outreach first. Use "GOODWILL_FIRST".
- Suspected ATO regardless of rail → add SECURITY_ESCALATION note.

SIGNAL INFLUENCE: For signal_influences, list 3–5 specific signals from the data above that most influenced your verdict. Each entry shows what the signal was, how strongly it weighed (HIGH / MEDIUM / LOW), and which verdict it pushed toward. Be specific — reference actual values from the inputs (e.g. "Zero prior disputes in 12 months" not just "Prior dispute history").

Return ONLY valid JSON with no markdown:
{
  "classification": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "label": "True Fraud" | "First-Party Fraud" | "Consumer Dispute" | "Authorized Push Payment",
  "headline": "One tight sentence summarizing the triage assessment.",
  "signals": [
    "Signal 1 — specific observation from the data provided",
    "Signal 2 — specific observation from the data provided",
    "Signal 3 — specific observation from the data provided"
  ],
  "signal_influences": [
    { "signal": "Specific signal from inputs", "weight": "HIGH" | "MEDIUM" | "LOW", "toward": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT" }
  ],
  "ato_suspected": true | false,
  "ato_note": "Brief ATO note if suspected, empty string otherwise.",
  "routing": "VISA_CHARGEBACK" | "MC_CHARGEBACK" | "CARD_CHARGEBACK" | "NACHA_RETURN" | "RECIPIENT_FI" | "PROVIDER_DISPUTE" | "FLAG_INVESTIGATION" | "GOODWILL_FIRST",
  "routing_label": "Human-readable routing label (e.g. 'File Card Network Chargeback')",
  "routing_detail": "1–2 sentences: exactly what the agent should do next, including any time-sensitive steps.",
  "risk_notes": "Caveats or watch-outs — or empty string if none.",
  "proceed_to_dispute": true | false
}`

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const text = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .replace(/```json|```/g, '')
        .trim()
      const parsed = JSON.parse(text)
      setResult(parsed)
      setOutcomes(prev => [{
        id: `T-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        date: new Date().toISOString(),
        merchant: merchant || '—',
        amount: amount ? `${amount} ${currency}` : '—',
        verdict: parsed.classification,
        confidence: parsed.confidence,
        outcome: 'pending',
      }, ...prev].slice(0, 100))
    } catch (e) {
      setError(`Classification failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const markOutcome = (id, val) =>
    setOutcomes(prev => prev.map(o => o.id === id ? { ...o, outcome: val } : o))

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#F5F1EA', fontFamily: 'Georgia, "Times New Roman", serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap');
        .display-font { font-family: 'Fraunces', Georgia, serif; }
        .mono-font    { font-family: 'JetBrains Mono', 'Courier New', monospace; }
        .input-field {
          background: #FAF7F1;
          border: 1px solid #D4CCBC;
          padding: 12px 14px;
          font-family: 'Fraunces', Georgia, serif;
          font-size: 15px;
          width: 100%;
          color: #1A1814;
          transition: border-color 0.15s ease;
          appearance: none;
          -webkit-appearance: none;
        }
        .input-field:focus { outline: none; border-color: #1A1814; }
        select.input-field { cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B5F4D' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
        .input-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #6B5F4D;
          margin-bottom: 6px;
          display: block;
        }
        .section-rule { border: none; border-top: 1px solid #D4CCBC; margin: 28px 0; }
        .sub-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #A89B88;
          margin-bottom: 12px;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 sm:py-12">

        {/* ── Masthead ─────────────────────────────────────────────────────────── */}
        <div className="border-b-2 border-black pb-6 mb-8 sm:pb-8 sm:mb-12">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div className="mono-font text-xs tracking-widest text-stone-600 hidden sm:block">ISSUE Nº 003 — FRAUD &amp; DISPUTES TRIAGE</div>
            <div className="mono-font text-xs tracking-widest text-stone-600 sm:hidden">FRAUD &amp; DISPUTES TRIAGE</div>
            <div className="mono-font text-xs tracking-widest text-stone-600">
              {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
          <h1 className="display-font font-bold text-stone-900 leading-none" style={{ fontSize: 'clamp(48px, 8vw, 96px)', letterSpacing: '-0.03em' }}>
            <span style={{ fontWeight: 700 }}>Tri</span><span style={{ fontStyle: 'italic', fontWeight: 500 }}>age</span>
          </h1>
          <p className="display-font text-stone-700 mt-3 sm:mt-4 max-w-2xl" style={{ fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: '1.55' }}>
            Classify incoming dispute claims before anything is filed. Four verdicts. Every case routed by account type, payment rail, and regulatory framework — Reg E, Reg Z, NACHA, or provider.
          </p>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* ══ LEFT: Inputs ══════════════════════════════════════════════════════ */}
          <div>

            {/* 01 — Transaction Details */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="mono-font text-xs text-stone-400">01</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Transaction Details</h2>
            </div>

            <div className="space-y-4">

              {/* Account type */}
              <div>
                <label className="input-label">Account Type</label>
                <select value={accountType} onChange={e => setAccountType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                  <option value="">Select type…</option>
                  <option value="debit">Debit Card</option>
                  <option value="credit">Credit Card</option>
                  <option value="p2p">P2P / e-Transfer</option>
                  <option value="ach_eft">ACH / EFT</option>
                  <option value="bnpl">BNPL (Buy Now Pay Later)</option>
                </select>
              </div>

              {/* Reg framework badge — shown as soon as account type is selected */}
              {regLabel && (
                <div className="flex items-start gap-3 py-2">
                  <span className="mono-font text-xs px-2 py-1 shrink-0" style={{ background: regColor.bg, color: regColor.text }}>
                    {regLabel}
                  </span>
                  <span className="mono-font text-xs text-stone-400 leading-relaxed">{regSubtext}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Merchant / Recipient</label>
                  <input type="text" value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. TechGadget Co." className="input-field" />
                </div>
                <div>
                  <label className="input-label">Amount</label>
                  <div className="flex gap-2">
                    <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="284.00" className="input-field" style={{ flex: 2 }} />
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field mono-font" style={{ flex: 1, fontSize: '13px' }}>
                      <option>CAD</option>
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Transaction Date</label>
                  <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="input-field mono-font" style={{ fontSize: '13px' }} />
                </div>
                <div>
                  <label className="input-label">Transaction Type</label>
                  <select value={transactionType} onChange={e => setTransactionType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Select type…</option>
                    <optgroup label="Card">
                      <option>Card-Present (In-person)</option>
                      <option>Card-Not-Present (Online)</option>
                      <option>Card-Not-Present (Phone order)</option>
                      <option>Recurring / Subscription</option>
                      <option>ATM Withdrawal</option>
                    </optgroup>
                    <optgroup label="Digital / P2P">
                      <option>Digital Payment / Wallet</option>
                      <option>Zelle</option>
                      <option>Interac e-Transfer</option>
                      <option>P2P (Venmo / Cash App / PayPal)</option>
                    </optgroup>
                    <optgroup label="Transfer">
                      <option>ACH / EFT Transfer</option>
                      <option>Wire Transfer</option>
                      <option>Bill Payment (ACH)</option>
                    </optgroup>
                    <optgroup label="Lending">
                      <option>BNPL Purchase</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            <hr className="section-rule" />

            {/* 02 — Claim & Context */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="mono-font text-xs text-stone-400">02</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Claim &amp; Context</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="input-label">How Was This Flagged?</label>
                <select value={flaggedBy} onChange={e => setFlaggedBy(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                  <option value="">Select…</option>
                  <option>Customer-reported (inbound call)</option>
                  <option>Customer-reported (app / self-serve)</option>
                  <option>Customer-reported (email / chat)</option>
                  <option>System alert (fraud detection)</option>
                  <option>Proactive outreach (bank contacted customer first)</option>
                  <option>Chargeback / representment queue</option>
                </select>
              </div>
              <div>
                <label className="input-label">Customer's Stated Reason <span style={{ color: '#B45309' }}>*</span></label>
                <textarea
                  value={customerReason}
                  onChange={e => setCustomerReason(e.target.value)}
                  placeholder="What is the customer saying happened? Paste or summarize their complaint…"
                  rows={5}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <hr className="section-rule" />

            {/* 03 — Risk Signals */}
            <div className="flex items-baseline gap-3 mb-2">
              <span className="mono-font text-xs text-stone-400">03</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Risk Signals</h2>
            </div>
            <p className="display-font text-stone-500 text-[14px] mb-5 ml-7 italic" style={{ lineHeight: '1.5' }}>
              Fill what you know. Unknowns are treated as neutral.
            </p>

            {/* Cardholder signals */}
            <div className="mb-5">
              <div className="sub-label ml-0">Cardholder</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Prior Disputes (12 months)</label>
                  <select value={priorDisputes} onChange={e => setPriorDisputes(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option>None</option>
                    <option>1–2</option>
                    <option>3–5</option>
                    <option>5+</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Account Age</label>
                  <select value={accountAge} onChange={e => setAccountAge(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option>Under 6 months</option>
                    <option>6–12 months</option>
                    <option>1–3 years</option>
                    <option>3+ years</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Days Since Transaction</label>
                  <select value={daysSince} onChange={e => setDaysSince(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option>0–30 days</option>
                    <option>31–60 days</option>
                    <option>61–90 days</option>
                    <option>Over 90 days</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Card in Possession When Reported</label>
                  <select value={cardPossession} onChange={e => setCardPossession(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option>Yes — card in hand</option>
                    <option>No — card lost or stolen</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Account integrity signals */}
            <div className="mb-5">
              <div className="sub-label ml-0">Account Integrity</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Recent Account Changes</label>
                  <select value={accountChanges} onChange={e => setAccountChanges(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="Yes — login, password or contact details changed recently">Yes — login or contact details changed</option>
                    <option value="No — no recent changes detected">No changes detected</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Device / Location</label>
                  <select value={deviceRecognized} onChange={e => setDeviceRecognized(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="New or unrecognized device / location flagged">New or unrecognized device</option>
                    <option value="Known device and location">Known device and location</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Merchant signals */}
            <div>
              <div className="sub-label ml-0">Merchant</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="input-label">VFMP Listed</label>
                  <select value={vfmp} onChange={e => setVfmp(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="Yes — VFMP listed">Yes</option>
                    <option value="No — not VFMP listed">No</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Merchant Dispute Rate</label>
                  <select value={merchantDisputeRate} onChange={e => setMerchantDisputeRate(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="Low (under 1%)">Low (&lt;1%)</option>
                    <option value="Medium (1–2%)">Medium</option>
                    <option value="High (over 2%)">High (&gt;2%)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">MCC Risk Tier</label>
                  <select value={mccRisk} onChange={e => setMccRisk(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="Low risk MCC">Low</option>
                    <option value="Medium risk MCC">Medium</option>
                    <option value="High risk MCC (travel, digital goods, gambling)">High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CTA button */}
            <div className="mt-8">
              <button
                onClick={classify}
                disabled={loading || !customerReason.trim()}
                className="w-full bg-stone-900 text-stone-50 py-4 mono-font text-xs tracking-widest hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 group"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>CLASSIFYING CLAIM</span></>
                  : <><span>CLASSIFY CLAIM</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                }
              </button>

              {error && (
                <div className="mt-4 border border-red-700 bg-red-50 p-4 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div className="display-font text-sm text-red-900">{error}</div>
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT: Output ══════════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-baseline gap-3 mb-5">
              <span className="mono-font text-xs text-stone-400">04</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Classification</h2>
            </div>

            {!result && !loading && (
              <div className="border border-dashed border-stone-300 p-12 text-center" style={{ background: '#FAF7F1' }}>
                <Shield className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                <p className="display-font text-stone-400 italic text-[15px]">
                  Triage result will appear here after classification.
                </p>
              </div>
            )}

            {loading && (
              <div className="border border-stone-200 p-12 text-center" style={{ background: '#FAF7F1' }}>
                <Loader2 className="w-8 h-8 text-stone-600 mx-auto mb-3 animate-spin" />
                <p className="display-font text-stone-600 italic">Weighing signals and classifying claim…</p>
              </div>
            )}

            {result && cfg && (
              <div className="space-y-4">

                {/* Reg framework badge */}
                {regLabel && (
                  <div className="flex items-center gap-2">
                    <span className="mono-font text-xs px-2 py-0.5" style={{ background: regColor.bg, color: regColor.text }}>
                      {regLabel}
                    </span>
                    <span className="mono-font text-xs text-stone-400 uppercase tracking-wider">framework</span>
                  </div>
                )}

                {/* Verdict card */}
                <div className="p-6" style={{ background: cfg.bg }}>
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                    <div className="mono-font text-xs tracking-widest" style={{ color: cfg.badgeText, opacity: 0.8 }}>
                      TRIAGE VERDICT
                    </div>
                    <div className="mono-font text-xs px-2 py-1" style={{ background: cfg.badge, color: cfg.badgeText }}>
                      {result.confidence} CONFIDENCE
                    </div>
                  </div>
                  <div className="display-font font-bold mb-3" style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', color: cfg.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {cfg.label}
                  </div>
                  <p className="display-font italic" style={{ color: cfg.text, fontSize: '15px', lineHeight: '1.55', opacity: 0.85 }}>
                    {result.headline}
                  </p>
                </div>

                {/* ATO flag */}
                {result.ato_suspected && (
                  <div className="border border-red-800 p-5" style={{ background: '#FFF1F2' }}>
                    <div className="flex items-center gap-2 mono-font text-xs tracking-widest text-red-900 mb-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>ACCOUNT TAKEOVER SUSPECTED</span>
                    </div>
                    <p className="display-font text-stone-900 text-[14px] leading-relaxed mb-3">{result.ato_note}</p>
                    <div className="mono-font text-xs text-red-800 tracking-wide">
                      → Escalate to security team in parallel. Block card and flag account for identity verification before or alongside dispute filing.
                    </div>
                  </div>
                )}

                {/* Provisional credit flag */}
                {provisionalCreditApplies && (
                  <div className="border p-4" style={{ borderColor: '#1D4ED8', background: '#EFF6FF' }}>
                    <div className="mono-font text-xs tracking-widest mb-2" style={{ color: '#1E3A8A' }}>REG E — PROVISIONAL CREDIT</div>
                    <p className="display-font text-stone-900 text-[14px] leading-relaxed">
                      This Reg E dispute must be resolved within <strong>10 business days</strong> of the complaint date — or provisional credit must be issued to the member's account. Investigation may extend to <strong>45 business days</strong> (90 days for POS, international, or new accounts) with provisional credit posted.
                    </p>
                  </div>
                )}

                {/* Key signals */}
                <div className="border border-stone-200 p-5" style={{ background: '#FAF7F1' }}>
                  <div className="mono-font text-xs tracking-widest text-stone-500 mb-3">KEY SIGNALS</div>
                  <div className="space-y-2.5">
                    {result.signals?.map((signal, i) => (
                      <div key={i} className="display-font text-stone-800 text-[15px] flex gap-2 items-start leading-snug">
                        <span className="text-stone-400 shrink-0 mt-0.5">→</span>
                        <span>{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signal influence breakdown */}
                {result.signal_influences?.length > 0 && (
                  <div className="border border-stone-200 p-5" style={{ background: '#FAF7F1' }}>
                    <div className="mono-font text-xs tracking-widest text-stone-500 mb-3">WHAT DROVE THIS VERDICT</div>
                    <div className="space-y-2.5">
                      {result.signal_influences.map((inf, i) => {
                        const ws = weightStyle(inf.weight)
                        const towardCfg = classConfig[inf.toward]
                        return (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <span className="mono-font text-xs px-1.5 py-0.5 shrink-0" style={{ background: ws.bg, color: ws.text }}>
                              {inf.weight}
                            </span>
                            <span className="display-font text-stone-700 text-[13px] flex-1 min-w-0">{inf.signal}</span>
                            {towardCfg && (
                              <span className="mono-font shrink-0 px-1.5 py-0.5" style={{ fontSize: '9px', letterSpacing: '0.08em', background: towardCfg.bg, color: towardCfg.badgeText }}>
                                → {towardCfg.label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Routing recommendation */}
                <div className="p-5" style={{ borderLeft: `4px solid ${cfg.borderColor}`, background: '#FAF7F1' }}>
                  <div className="mono-font text-xs tracking-widest text-stone-500 mb-2">ROUTING RECOMMENDATION</div>
                  <div className="display-font font-semibold text-stone-900 mb-2" style={{ fontSize: '17px', letterSpacing: '-0.01em' }}>
                    {result.routing_label}
                  </div>
                  <p className="display-font text-stone-700 text-[15px] leading-relaxed">
                    {result.routing_detail}
                  </p>
                </div>

                {/* Risk notes */}
                {result.risk_notes && (
                  <div className="border border-amber-200 bg-amber-50 p-4">
                    <div className="mono-font text-xs tracking-widest text-amber-900 mb-2">⚠ WATCH FOR</div>
                    <p className="display-font text-stone-800 text-[15px] leading-relaxed">{result.risk_notes}</p>
                  </div>
                )}

                {/* Proceed to Dispute Desk CTA */}
                {result.proceed_to_dispute && (
                  <a
                    href="https://dispute-desk-tau.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-5 transition-colors group"
                    style={{ background: '#1A1814' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2C2822'}
                    onMouseLeave={e => e.currentTarget.style.background = '#1A1814'}
                  >
                    <div>
                      <div className="mono-font text-xs tracking-widest mb-1" style={{ color: '#6B5F4D' }}>NEXT STEP</div>
                      <div className="display-font font-semibold text-lg" style={{ color: '#F5F1EA', letterSpacing: '-0.01em' }}>
                        Proceed to Dispute Desk →
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 shrink-0" style={{ color: '#6B5F4D' }} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 05: Outcome Log ──────────────────────────────────────────── */}
        {outcomes.length > 0 && (
          <div className="mt-12 sm:mt-16">
            <hr className="section-rule" style={{ margin: '0 0 28px 0' }} />
            <div className="flex items-baseline gap-3 mb-6 flex-wrap">
              <span className="mono-font text-xs text-stone-400">05</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Outcome Log</h2>
              <span className="mono-font text-xs text-stone-400 ml-auto">{outcomes.length} CASE{outcomes.length !== 1 ? 'S' : ''} CLASSIFIED</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'TOTAL',           value: outcomes.length,                           sub: 'classified'                                                                                     },
                { label: 'ACCURACY',        value: accuracy !== null ? `${accuracy}%` : '—',  sub: `${resolved.length} resolved`                                                                   },
                { label: 'LEADING VERDICT', value: leadingLabel,                              sub: leadingVerdict[1] > 0 ? `${leadingVerdict[1]} case${leadingVerdict[1] !== 1 ? 's' : ''}` : '' },
              ].map(s => (
                <div key={s.label} className="border border-stone-200 p-4" style={{ background: '#FAF7F1' }}>
                  <div className="mono-font text-xs tracking-widest text-stone-400 mb-1">{s.label}</div>
                  <div className="display-font font-semibold text-stone-900" style={{ fontSize: '22px', letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div className="mono-font text-xs text-stone-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Case list */}
            <div className="border border-stone-200 overflow-hidden" style={{ background: '#FAF7F1' }}>
              <div className="overflow-x-auto">
                <div style={{ minWidth: '600px' }}>
                  <div className="grid px-4 py-2 border-b border-stone-200" style={{ gridTemplateColumns: '80px 70px 1fr 90px 1fr' }}>
                    {['CASE', 'DATE', 'MERCHANT', 'AMOUNT', 'VERDICT / OUTCOME'].map(h => (
                      <span key={h} className="mono-font text-xs tracking-widest text-stone-400">{h}</span>
                    ))}
                  </div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {outcomes.map(o => {
                      const vc = classConfig[o.verdict]
                      if (!vc) return null
                      return (
                        <div key={o.id} className="grid px-4 py-3 border-b border-stone-100 items-center" style={{ gridTemplateColumns: '80px 70px 1fr 90px 1fr' }}>
                          <span className="mono-font text-xs text-stone-400">{o.id}</span>
                          <span className="mono-font text-xs text-stone-500">{new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className="display-font text-sm text-stone-700 truncate pr-3">{o.merchant}</span>
                          <span className="mono-font text-xs text-stone-600">{o.amount}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="mono-font px-1.5 py-0.5 shrink-0" style={{ fontSize: '8px', letterSpacing: '0.08em', background: vc.bg, color: vc.badgeText }}>
                              {vc.label}
                            </span>
                            {o.outcome === 'pending' ? (
                              <div className="flex gap-1">
                                <button onClick={() => markOutcome(o.id, 'confirmed')} className="mono-font text-xs px-2 py-0.5 border border-emerald-700 text-emerald-700 hover:bg-emerald-50 transition-colors" title="Verdict was correct">✓</button>
                                <button onClick={() => markOutcome(o.id, 'overridden')} className="mono-font text-xs px-2 py-0.5 border border-red-700 text-red-700 hover:bg-red-50 transition-colors" title="Verdict was overridden">✗</button>
                              </div>
                            ) : (
                              <span className={`mono-font text-xs ${o.outcome === 'confirmed' ? 'text-emerald-700' : 'text-red-700'}`}>
                                {o.outcome === 'confirmed' ? '✓ CONFIRMED' : '✗ OVERRIDDEN'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={() => { if (window.confirm('Clear all outcome history?')) setOutcomes([]) }}
                className="mono-font text-xs tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
              >CLEAR LOG</button>
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div className="mt-12 sm:mt-16 pt-6 flex flex-col sm:flex-row sm:items-baseline justify-between text-stone-500 gap-2" style={{ borderTop: '1px solid #D4CCBC' }}>
          <div className="mono-font text-xs tracking-widest">BUILT BY ADEOTI FASHOKUN — RISK &amp; TRUST OPERATIONS</div>
          <div className="display-font italic text-sm">"Classify before you file. The routing matters."</div>
        </div>
      </div>
    </div>
  )
}
