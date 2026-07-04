import React, { useState } from 'react'
import { Shield, AlertTriangle, MessageSquare, Loader2, ArrowRight, ExternalLink, AlertCircle } from 'lucide-react'

export default function Triage() {
  // 01 — Transaction details
  const [merchant, setMerchant]               = useState('')
  const [amount, setAmount]                   = useState('')
  const [currency, setCurrency]               = useState('CAD')
  const [transactionDate, setTransactionDate] = useState('')
  const [transactionType, setTransactionType] = useState('')

  // 02 — Claim & context
  const [flaggedBy, setFlaggedBy]         = useState('')
  const [customerReason, setCustomerReason] = useState('')

  // 03 — Risk signals (cardholder)
  const [priorDisputes, setPriorDisputes]   = useState('')
  const [accountAge, setAccountAge]         = useState('')
  const [daysSince, setDaysSince]           = useState('')
  const [cardPossession, setCardPossession] = useState('')

  // 03 — Risk signals (merchant)
  const [vfmp, setVfmp]                           = useState('')
  const [merchantDisputeRate, setMerchantDisputeRate] = useState('')
  const [mccRisk, setMccRisk]                     = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  // ─── Classify ────────────────────────────────────────────────────────────────

  const classify = async () => {
    if (!customerReason.trim()) { setError("Customer's stated reason is required."); return }
    setLoading(true)
    setError(null)
    setResult(null)

    const prompt = `You are an expert fraud and disputes triage analyst at a financial institution. Analyze this incoming dispute claim and classify it into exactly one category.

DEFINITIONS:
- TRUE_FRAUD: A third party used the cardholder's card or credentials without their knowledge or consent. The cardholder is a genuine victim of unauthorized use.
- FIRST_PARTY_FRAUD: The cardholder made the transaction themselves and is falsely claiming fraud, non-receipt, or another dispute reason to obtain a refund. Also called friendly fraud or chargeback abuse.
- CONSUMER_DISPUTE: The cardholder made the transaction but has a legitimate grievance — goods not received (but likely shipped), item not as described, cancelled subscription still charged, credit not processed, service failure, or misrepresentation.

TRANSACTION DETAILS:
- Merchant: ${merchant || 'Not provided'}
- Amount: ${amount ? `${amount} ${currency}` : 'Not provided'}
- Transaction Date: ${transactionDate || 'Not provided'}
- Transaction Type: ${transactionType || 'Not provided'}

CLAIM:
- How was this flagged: ${flaggedBy || 'Not provided'}
- Customer's stated reason: ${customerReason}

RISK SIGNALS:
- Prior disputes in last 12 months: ${priorDisputes || 'Unknown'}
- Account age: ${accountAge || 'Unknown'}
- Days since transaction: ${daysSince || 'Unknown'}
- Card in cardholder's possession when reported: ${cardPossession || 'Unknown'}
- VFMP listed merchant: ${vfmp || 'Unknown'}
- Merchant dispute rate: ${merchantDisputeRate || 'Unknown'}
- MCC risk category: ${mccRisk || 'Unknown'}

CLASSIFICATION GUIDANCE — weigh these signals:
TRUE FRAUD indicators: 0 prior disputes, account 3+ years old, reported within 30 days, VFMP-listed merchant, high merchant dispute rate, system alert triggered, card lost or stolen.
FIRST_PARTY_FRAUD indicators: 3+ prior disputes in 12 months, account under 6 months, dispute filed 60+ days after transaction, low-risk non-VFMP merchant, customer-reported (not system-flagged), card in possession, inconsistency between claim and transaction type.
CONSUMER_DISPUTE indicators: specific service grievance stated (non-receipt, cancellation, defect), customer mentions attempting merchant contact, medium merchant dispute rate, 1-2 prior disputes, claim is plausible for merchant category.

Return ONLY valid JSON with no markdown:
{
  "classification": "TRUE_FRAUD",
  "confidence": "HIGH",
  "label": "True Fraud",
  "headline": "One tight sentence summarizing the triage assessment and why.",
  "signals": [
    "Signal 1 — specific observation from the data",
    "Signal 2 — specific observation from the data",
    "Signal 3 — specific observation from the data"
  ],
  "routing": "ROUTE_DISPUTE",
  "routing_label": "Proceed to Dispute Filing",
  "routing_detail": "1-2 sentences on exactly what the agent should do next.",
  "risk_notes": "Any important caveats or watch-outs — or empty string if none.",
  "proceed_to_dispute": true
}

For classification "TRUE_FRAUD": routing must be "ROUTE_DISPUTE", routing_label "Proceed to Dispute Filing", proceed_to_dispute true.
For classification "FIRST_PARTY_FRAUD": routing must be "FLAG_INVESTIGATION", routing_label "Flag for Investigation — Do Not File", proceed_to_dispute false.
For classification "CONSUMER_DISPUTE": routing must be "GOODWILL_FIRST", routing_label "Attempt Goodwill Outreach First", proceed_to_dispute false.`

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
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
      setResult(JSON.parse(text))
    } catch (e) {
      setError(`Classification failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ─── Classification appearance config ────────────────────────────────────────

  const classConfig = {
    TRUE_FRAUD: {
      bg: '#064E3B',
      text: '#D1FAE5',
      badge: '#065F46',
      badgeText: '#6EE7B7',
      borderColor: '#065F46',
      label: 'TRUE FRAUD',
      Icon: Shield,
    },
    FIRST_PARTY_FRAUD: {
      bg: '#7F1D1D',
      text: '#FEE2E2',
      badge: '#991B1B',
      badgeText: '#FCA5A5',
      borderColor: '#991B1B',
      label: 'FIRST-PARTY FRAUD',
      Icon: AlertTriangle,
    },
    CONSUMER_DISPUTE: {
      bg: '#78350F',
      text: '#FEF3C7',
      badge: '#92400E',
      badgeText: '#FCD34D',
      borderColor: '#92400E',
      label: 'CONSUMER DISPUTE',
      Icon: MessageSquare,
    },
  }

  const cfg = result ? classConfig[result.classification] : null

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
            <div className="mono-font text-xs tracking-widest text-stone-600">ISSUE Nº 003 — FRAUD &amp; DISPUTES TRIAGE</div>
            <div className="mono-font text-xs tracking-widest text-stone-600">
              {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
          <h1
            className="display-font font-bold text-stone-900 leading-none"
            style={{ fontSize: 'clamp(52px, 8vw, 96px)', letterSpacing: '-0.03em' }}
          >
            <span style={{ fontWeight: 700 }}>Tri</span><span style={{ fontStyle: 'italic', fontWeight: 500 }}>age</span>
          </h1>
          <p className="display-font text-stone-700 mt-4 max-w-2xl" style={{ fontSize: '17px', lineHeight: '1.55' }}>
            Classify incoming dispute claims before anything is filed — true fraud, first-party fraud, or consumer dispute. Every case routed to the right resolution path from the first call.
          </p>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* ══ LEFT: Inputs ══════════════════════════════════════════════════ */}
          <div>

            {/* 01 — Transaction Details */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="mono-font text-xs text-stone-400">01</span>
              <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Transaction Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Merchant</label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={e => setMerchant(e.target.value)}
                    placeholder="e.g. TechGadget Co."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="input-label">Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="284.00"
                      className="input-field"
                      style={{ flex: 2 }}
                    />
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="input-field mono-font"
                      style={{ flex: 1, fontSize: '13px' }}
                    >
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
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={e => setTransactionDate(e.target.value)}
                    className="input-field mono-font"
                    style={{ fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label className="input-label">Transaction Type</label>
                  <select
                    value={transactionType}
                    onChange={e => setTransactionType(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '14px' }}
                  >
                    <option value="">Select type…</option>
                    <option>Card-Present (In-person)</option>
                    <option>Card-Not-Present (Online)</option>
                    <option>Card-Not-Present (Phone order)</option>
                    <option>Digital Payment / Wallet</option>
                    <option>Recurring / Subscription</option>
                    <option>ATM Withdrawal</option>
                    <option>ACH / EFT</option>
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
                <select
                  value={flaggedBy}
                  onChange={e => setFlaggedBy(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '14px' }}
                >
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
              Fill what you know. Unknowns are treated as neutral in the classification.
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

          {/* ══ RIGHT: Output ═════════════════════════════════════════════════ */}
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

                {/* ── Verdict card ── */}
                <div className="p-6" style={{ background: cfg.bg }}>
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                    <div className="mono-font text-xs tracking-widest" style={{ color: cfg.badgeText, opacity: 0.8 }}>
                      TRIAGE VERDICT
                    </div>
                    <div
                      className="mono-font text-xs px-2 py-1"
                      style={{ background: cfg.badge, color: cfg.badgeText }}
                    >
                      {result.confidence} CONFIDENCE
                    </div>
                  </div>
                  <div
                    className="display-font font-bold mb-3"
                    style={{
                      fontSize: 'clamp(26px, 3.5vw, 38px)',
                      color: cfg.text,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                    }}
                  >
                    {cfg.label}
                  </div>
                  <p
                    className="display-font italic"
                    style={{ color: cfg.text, fontSize: '15px', lineHeight: '1.55', opacity: 0.85 }}
                  >
                    {result.headline}
                  </p>
                </div>

                {/* ── Key signals ── */}
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

                {/* ── Routing recommendation ── */}
                <div
                  className="p-5"
                  style={{ borderLeft: `4px solid ${cfg.borderColor}`, background: '#FAF7F1' }}
                >
                  <div className="mono-font text-xs tracking-widest text-stone-500 mb-2">ROUTING RECOMMENDATION</div>
                  <div
                    className="display-font font-semibold text-stone-900 mb-2"
                    style={{ fontSize: '17px', letterSpacing: '-0.01em' }}
                  >
                    {result.routing_label}
                  </div>
                  <p className="display-font text-stone-700 text-[15px] leading-relaxed">
                    {result.routing_detail}
                  </p>
                </div>

                {/* ── Risk notes ── */}
                {result.risk_notes && (
                  <div className="border border-amber-200 bg-amber-50 p-4">
                    <div className="mono-font text-xs tracking-widest text-amber-900 mb-2">⚠ WATCH FOR</div>
                    <p className="display-font text-stone-800 text-[15px] leading-relaxed">{result.risk_notes}</p>
                  </div>
                )}

                {/* ── Proceed to Dispute Desk CTA ── */}
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
                    <ExternalLink className="w-5 h-5 shrink-0 transition-colors" style={{ color: '#6B5F4D' }} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div className="mt-16 pt-6 flex items-baseline justify-between text-stone-500 flex-wrap gap-2" style={{ borderTop: '1px solid #D4CCBC' }}>
          <div className="mono-font text-xs tracking-widest">BUILT BY ADEOTI FASHOKUN — RISK &amp; TRUST OPERATIONS</div>
          <div className="display-font italic text-sm">"Classify before you file. The routing matters."</div>
        </div>
      </div>
    </div>
  )
}
