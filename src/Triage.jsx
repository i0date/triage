import React, { useState, useEffect, useMemo } from 'react'
import { Shield, AlertTriangle, MessageSquare, Loader2, ArrowRight, ExternalLink, AlertCircle, Send, Lock, Copy, Check, Download, Bitcoin } from 'lucide-react'

// ── Transaction types per account type ──────────────────────────────────────
const TX_TYPES = {
  debit:   ['Card-Present (In-person)', 'Card-Not-Present (Online)', 'Card-Not-Present (Phone order)', 'Digital Payment / Wallet', 'ATM Withdrawal'],
  credit:  ['Card-Present (In-person)', 'Card-Not-Present (Online)', 'Card-Not-Present (Phone order)', 'Digital Payment / Wallet', 'Recurring / Subscription'],
  p2p:     ['Zelle', 'Interac e-Transfer', 'P2P (Venmo / Cash App / PayPal)', 'Wire Transfer'],
  ach_eft: ['ACH / EFT Transfer', 'Wire Transfer', 'Bill Payment (ACH)'],
  bnpl:    ['BNPL Purchase', 'Recurring / Subscription'],
  crypto:  ['Card-funded exchange purchase', 'Bank transfer to exchange', 'Wallet-to-wallet transfer', 'NFT marketplace purchase', 'Crypto investment platform deposit'],
}

// ── Known crypto exchanges / platforms for auto-detection ───────────────────
const CRYPTO_MERCHANTS = ['coinbase', 'binance', 'kraken', 'bitbuy', 'newton', 'ndax', 'shakepay', 'gemini', 'crypto.com', 'bybit', 'kucoin', 'bitfinex', 'opensea', 'rarible', 'blur', 'magic eden']
const isCryptoMerchantName = (name) => name && CRYPTO_MERCHANTS.some(k => name.toLowerCase().includes(k))

export default function Triage() {

  // ── 01 Transaction details ──────────────────────────────────────────────────
  const [accountType, setAccountType]         = useState('')
  const [merchant, setMerchant]               = useState('')
  const [amount, setAmount]                   = useState('')
  const [currency, setCurrency]               = useState('CAD')
  const [transactionDate, setTransactionDate] = useState('')
  const [transactionType, setTransactionType] = useState('')

  // ── 02 Claim & context ──────────────────────────────────────────────────────
  const [flaggedBy, setFlaggedBy]           = useState('')
  const [customerReason, setCustomerReason] = useState('')

  // ── 03 Risk signals — cardholder ────────────────────────────────────────────
  const [priorDisputes, setPriorDisputes]   = useState('')
  const [accountAge, setAccountAge]         = useState('')
  const [cardPossession, setCardPossession] = useState('')

  // ── 03 Risk signals — account integrity (ATO) ───────────────────────────────
  const [accountChanges, setAccountChanges]       = useState('')
  const [deviceRecognized, setDeviceRecognized]   = useState('')

  // ── 03 Risk signals — merchant (card-based only) ────────────────────────────
  const [vfmp, setVfmp]                                   = useState('')
  const [merchantDisputeRate, setMerchantDisputeRate]     = useState('')
  const [mccRisk, setMccRisk]                             = useState('')

  // ── Network (card-based + crypto) ───────────────────────────────────────────
  const [network, setNetwork] = useState('')

  // ── Crypto-specific signals ──────────────────────────────────────────────────
  const [cryptoScenario, setCryptoScenario]       = useState('')
  const [exchangeRegulated, setExchangeRegulated] = useState('')
  const [walletCustody, setWalletCustody]         = useState('')
  const [contactedExchange, setContactedExchange] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const [exportCopied, setExportCopied] = useState(false)

  // ── Platform mode: 'fi' = Financial Institution, 'ce' = Crypto Exchange ──────
  const [platformMode, setPlatformMode] = useState('fi')

  // ── Crypto Exchange (CE) mode state ─────────────────────────────────────────
  const [ceAccountType, setCeAccountType]               = useState('')   // standard, business, api, otc
  const [ceAsset, setCeAsset]                           = useState('')   // BTC, ETH, USDC, etc.
  const [ceChain, setCeChain]                           = useState('')   // Bitcoin, Ethereum, Solana…
  const [ceTxType, setCeTxType]                         = useState('')   // withdrawal, deposit, trade…
  const [ceAmount, setCeAmount]                         = useState('')
  const [ceCurrency, setCeCurrency]                     = useState('USD')
  const [ceTxDate, setCeTxDate]                         = useState('')
  const [ceDestinationType, setCeDestinationType]       = useState('')   // internal, external, other_exchange
  const [ceDestinationAddress, setCeDestinationAddress] = useState('')
  const [ceReceivingExchange, setCeReceivingExchange]   = useState('')
  const [ceCompromiseVector, setCeCompromiseVector]     = useState('')   // sim_swap, phishing, api_key…
  const [ceRecentAcctChanges, setCeRecentAcctChanges]   = useState('')
  const [ceDeviceNew, setCeDeviceNew]                   = useState('')
  const [cePriorClaims, setCePriorClaims]               = useState('')
  const [ceKycLevel, setCeKycLevel]                     = useState('')
  const [ceBlockchainTrace, setCeBlockchainTrace]       = useState('')
  const [ceCountry, setCeCountry]                       = useState('both') // 'us' | 'ca' | 'both'
  const [ceComplaint, setCeComplaint]                   = useState('')
  const [ceFlaggedBy, setCeFlaggedBy]                   = useState('')
  const [ceSarDeadlineDate, setCeSarDeadlineDate]       = useState('')   // date incident reported (SAR countdown)
  const [ceActionPlan, setCeActionPlan]                 = useState(null)
  const [ceActionPlanLoading, setCeActionPlanLoading]   = useState(false)
  const [ceActionPlanError, setCeActionPlanError]       = useState(null)
  const [ceActionPlanCopied, setCeActionPlanCopied]     = useState(false)

  // ── 05 Outcome tracking ─────────────────────────────────────────────────────
  const [outcomes, setOutcomes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('triage_outcomes') || '[]') } catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('triage_outcomes', JSON.stringify(outcomes))
  }, [outcomes])

  // ── Reset transaction type when account type changes ─────────────────────────
  useEffect(() => {
    if (accountType && transactionType) {
      const validTypes = TX_TYPES[accountType] ?? []
      if (!validTypes.includes(transactionType)) setTransactionType('')
    }
  }, [accountType])

  // ── Computed values ──────────────────────────────────────────────────────────
  const isCardBased     = accountType === 'debit' || accountType === 'credit'
  const isCrypto        = accountType === 'crypto'
  const detectedCrypto  = !isCrypto && isCryptoMerchantName(merchant)
  const showNetworkSel  = isCardBased || isCrypto

  // Must be declared before fpfRiskScore useMemo (dep array evaluated immediately)
  const daysSinceTransaction = transactionDate
    ? Math.floor((Date.now() - new Date(transactionDate).getTime()) / 86400000)
    : null

  // FPF (first-party fraud) risk score — 0 = definitely genuine, 100 = definitely FPF
  const fpfRiskScore = useMemo(() => {
    let s = 40 // neutral baseline
    if (priorDisputes === '3–5')        s += 15
    if (priorDisputes === '5+')         s += 25
    if (priorDisputes === '1–2')        s +=  5
    if (priorDisputes === 'None')       s -= 20
    if (accountAge === 'Under 6 months') s += 15
    if (accountAge === '6–12 months')    s +=  5
    if (accountAge === '3+ years')       s -= 15
    if (cardPossession === 'Yes — card in hand')      s += 12
    if (cardPossession === 'No — card lost or stolen') s -= 15
    if (flaggedBy === 'System alert (fraud detection)')  s -= 20
    if (flaggedBy?.includes('Customer-reported'))        s +=  5
    if (daysSinceTransaction !== null && daysSinceTransaction > 60) s += 15
    if (daysSinceTransaction !== null && daysSinceTransaction <= 7) s -= 10
    if (accountChanges?.includes('Yes')) s += 8
    if (deviceRecognized?.includes('New')) s -= 10
    if (merchantDisputeRate === 'High (over 2%)') s -= 15
    if (vfmp === 'Yes — VFMP listed')              s -= 15
    if (mccRisk?.includes('High'))                 s -= 10
    return Math.max(0, Math.min(100, Math.round(s)))
  }, [priorDisputes, accountAge, cardPossession, flaggedBy, daysSinceTransaction, accountChanges, deviceRecognized, merchantDisputeRate, vfmp, mccRisk])

  const regFramework =
    accountType === 'debit' || accountType === 'ach_eft' ? 'REG_E' :
    accountType === 'credit'                             ? 'REG_Z' :
    accountType === 'p2p'                                ? 'PROVIDER' :
    accountType === 'bnpl'                               ? 'REG_Z_PROVIDER' :
    accountType === 'crypto'                             ? 'CRYPTO' : null

  const regLabel =
    regFramework === 'REG_E'          ? 'REG E'            :
    regFramework === 'REG_Z'          ? 'REG Z'            :
    regFramework === 'PROVIDER'       ? 'PROVIDER-HANDLED' :
    regFramework === 'REG_Z_PROVIDER' ? 'REG Z / PROVIDER' :
    regFramework === 'CRYPTO'         ? 'CRYPTO / DIGITAL ASSET' : null

  const regSubtext =
    regFramework === 'REG_E'          ? 'Debit / EFT — Electronic Fund Transfer Act applies' :
    regFramework === 'REG_Z'          ? 'Credit — Truth in Lending Act / network chargeback rules apply' :
    regFramework === 'PROVIDER'       ? 'No network chargeback path — contact recipient FI or network' :
    regFramework === 'REG_Z_PROVIDER' ? 'BNPL — dispute through provider, not card network' :
    regFramework === 'CRYPTO'         ? 'No blanket network protection — coverage depends on payment method used and exchange policies' : null

  const regColor =
    regFramework === 'REG_E'    ? { bg: '#1E3A8A', text: '#BFDBFE' } :
    regFramework === 'REG_Z'    ? { bg: '#4C1D95', text: '#DDD6FE' } :
    regFramework === 'CRYPTO'   ? { bg: '#064E3B', text: '#6EE7B7' } :
                                  { bg: '#374151', text: '#D1D5DB' }

  // ── CE computed values ───────────────────────────────────────────────────────
  const isCE           = platformMode === 'ce'
  const ceDaysSince    = ceTxDate ? Math.floor((Date.now() - new Date(ceTxDate).getTime()) / 86400000) : null
  const ceAmountNum    = parseFloat(ceAmount) || 0
  const ceSarFlagUS    = ceAmountNum >= 5000  && (ceCountry === 'us'   || ceCountry === 'both') && ceCurrency === 'USD'
  const ceStrFlagCA    = ceAmountNum >= 10000 && (ceCountry === 'ca'   || ceCountry === 'both') && ceCurrency === 'CAD'
  const ceSarRequired  = ceSarFlagUS || ceStrFlagCA
  // SAR deadline countdown (30 days from date incident reported)
  const ceSarDeadlineRaw = ceSarDeadlineDate
    ? new Date(new Date(ceSarDeadlineDate).getTime() + 30 * 86400000)
    : null
  const ceSarDeadline  = ceSarDeadlineRaw ? ceSarDeadlineRaw.toLocaleDateString('en-CA') : null
  const ceSarDaysLeft  = ceSarDeadlineRaw ? Math.ceil((ceSarDeadlineRaw - new Date()) / 86400000) : null
  const ceRegLabel     = ceCountry === 'us' ? 'FINCEN / FinCEN MSB' : ceCountry === 'ca' ? 'FINTRAC / PCMLTFA' : 'FinCEN (US) + FINTRAC (CA)'
  const ceRegSubtext   = ceCountry === 'us'
    ? 'FinCEN registration required; SAR if suspicious activity ≥ $5,000 USD'
    : ceCountry === 'ca'
    ? 'FINTRAC STR required for suspicious transactions; $10,000 CAD large cash threshold'
    : 'Dual jurisdiction — FinCEN SAR ($5k USD) and FINTRAC STR ($10k CAD) obligations apply'

  const provisionalCreditApplies = regFramework === 'REG_E' && result &&
    (result.classification === 'TRUE_FRAUD' || result.classification === 'AUTHORIZED_PUSH_PAYMENT')

  const weightStyle = (w) =>
    w === 'HIGH'   ? { bg: '#1A1814', text: '#F5F1EA' } :
    w === 'MEDIUM' ? { bg: '#6B5F4D', text: '#FAF7F1' } :
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
    ? (classConfig[leadingVerdict[0]]?.label ?? leadingVerdict[0].split('_').join(' '))
    : '—'

  // ── Classify ─────────────────────────────────────────────────────────────────

  const classify = async () => {
    if (!customerReason.trim()) { setError("Customer's stated reason is required."); return }
    setLoading(true)
    setError(null)
    setResult(null)

    const accountTypeLabel = { debit: 'Debit Card', credit: 'Credit Card', p2p: 'P2P / e-Transfer', ach_eft: 'ACH / EFT', bnpl: 'BNPL (Buy Now Pay Later)', crypto: 'Crypto / Digital Asset' }[accountType] ?? 'Not specified'
    const daysNote = daysSinceTransaction !== null ? `${daysSinceTransaction} days ago (transaction date: ${transactionDate})` : 'Unknown'

    const prompt = `You are an expert fraud and disputes triage analyst at a financial institution. Classify this incoming dispute claim. You serve credit unions, banks, fintechs, and lenders.

FOUR VERDICT DEFINITIONS:
- TRUE_FRAUD: A third party used the account/card without the cardholder's knowledge or consent. Genuine victim of unauthorized access or card compromise.
- FIRST_PARTY_FRAUD: The cardholder made the transaction themselves and is falsely disputing it. Friendly fraud / chargeback abuse.
- CONSUMER_DISPUTE: Cardholder made the transaction legitimately but has a genuine grievance — non-receipt, item not as described, cancelled subscription, credit not processed, service failure, or misrepresentation.
- AUTHORIZED_PUSH_PAYMENT: Cardholder deliberately authorized and initiated the payment but was deceived into doing so via social engineering (romance scam, fake invoice, buyer-seller fraud, investment scam, impersonation). They believed it was legitimate. Applies primarily to Zelle, Interac e-Transfer, wire transfers, and P2P payments.

ACCOUNT & TRANSACTION:
- Account Type: ${accountTypeLabel}
- Regulatory Framework: ${regFramework ?? 'Unknown'}
- Payment Network: ${network || 'Not specified'}
- ${isCrypto ? 'Destination Wallet / Platform' : 'Merchant / Recipient'}: ${merchant || 'Not provided'}
- Amount: ${amount ? `${amount} ${currency}` : 'Not provided'}
- Transaction occurred: ${daysNote}
- Transaction Type: ${transactionType || 'Not provided'}${(isCrypto || detectedCrypto) ? `
- Crypto / Digital Asset detected: YES${detectedCrypto && !isCrypto ? ' (auto-detected from merchant name)' : ''}
- Crypto Fraud Scenario: ${cryptoScenario || 'Not specified'}
- Exchange Regulated: ${exchangeRegulated || 'Unknown'}
- Wallet Custody: ${walletCustody || 'Unknown'}
- Customer Contacted Exchange First: ${contactedExchange || 'Unknown'}` : ''}

CLAIM:
- How flagged: ${flaggedBy || 'Not provided'}
- Customer's stated reason: ${customerReason}

CARDHOLDER RISK SIGNALS:
- Prior disputes (12 months): ${priorDisputes || 'Unknown'}
- Account age: ${accountAge || 'Unknown'}
${isCardBased ? `- Card in possession when reported: ${cardPossession || 'Unknown'}` : '- Physical card: N/A (non-card payment rail)'}

ACCOUNT INTEGRITY SIGNALS:
- Recent account changes (login, password, contact details): ${accountChanges || 'Unknown'}
- Device / location at time of transaction: ${deviceRecognized || 'Unknown'}

${isCardBased ? `MERCHANT RISK SIGNALS:
- VFMP listed: ${vfmp || 'Unknown'}
- Merchant dispute rate: ${merchantDisputeRate || 'Unknown'}
- MCC risk tier: ${mccRisk || 'Unknown'}` : `MERCHANT SIGNALS: N/A — non-card payment rail. Routing should follow ${regFramework === 'PROVIDER' ? 'recipient FI contact / network recall' : regFramework === 'NACHA' ? 'NACHA return code' : 'provider dispute process'}.`}

CLASSIFICATION GUIDANCE:
TRUE_FRAUD: 0 prior disputes, account 3+ years, reported within 30 days, VFMP merchant (card), system alert, card lost/stolen, no suspicious account changes, known device. For crypto: wallet hack, exchange breach, SIM-swap enabling unauthorized access — no cardholder initiation.
FIRST_PARTY_FRAUD: 3+ prior disputes, account under 6 months, filed 60+ days after transaction, low-risk merchant, card in possession, customer-reported only, inconsistent claim. Crypto FPF: customer claims non-receipt of crypto they actually received, or reverse-purchases a volatile asset after price drop.
CONSUMER_DISPUTE: Specific grievance stated, 1–2 prior disputes, plausible for merchant category, customer attempted merchant contact. Crypto dispute: exchange fees charged incorrectly, NFT not delivered, platform failed to execute trade.
AUTHORIZED_PUSH_PAYMENT: Customer explicitly authorized the transfer but describes being deceived — romance, fake emergency, impersonation, investment. Applies to crypto: pig butchering / investment scam where customer voluntarily sent crypto to fraudster. Also card-funded exchange purchases where the exchange itself is fraudulent.

CRYPTO SCENARIO GUIDANCE:
- "Card used to buy crypto (authorized scam)": Likely AUTHORIZED_PUSH_PAYMENT — card chargeback possible if exchange cooperates; limited network protection. Note: Visa/MC may allow chargeback on the card leg.
- "Pig butchering / investment scam": AUTHORIZED_PUSH_PAYMENT — customer induced to deposit incrementally; recovery very limited without law enforcement.
- "Wallet / exchange hack (unauthorized)": TRUE_FRAUD — unrecognized access; pursue exchange security team + law enforcement referral.
- "NFT / digital asset fraud": TRUE_FRAUD or CONSUMER_DISPUTE — depends on whether customer authorized purchase on legitimate platform or was deceived about asset authenticity.
- "Stablecoin transfer fraud (USDC/USDT used as wire substitute)": AUTHORIZED_PUSH_PAYMENT — customer was instructed to send stablecoins as payment or investment; no reversal path; same social engineering patterns as wire fraud. Treat urgently.
- "FI-held crypto — unauthorized withdrawal from integrated wallet": TRUE_FRAUD — ATO on the FI's integrated crypto wallet; escalate to security team; blockchain trace critical.

ATO DETECTION: If recent account changes (login/password/contact) AND new/unrecognized device/location AND fraudulent activity are all present — set ato_suspected true. For crypto: SIM-swap plus exchange account takeover is a strong ATO signal.

ROUTING LOGIC:
- Debit or credit card → card network chargeback: "CARD_CHARGEBACK"
- ACH / EFT → NACHA return code: "NACHA_RETURN"
- P2P / Zelle / e-Transfer / wire (fraud or APP) → recipient FI contact + network recall: "RECIPIENT_FI"
- BNPL → provider dispute: "PROVIDER_DISPUTE"
- Crypto (card-funded exchange) → card chargeback on the card leg + contact exchange: "CARD_CHARGEBACK"
- Crypto (direct transfer / wallet) → exchange security team + law enforcement referral: "RECIPIENT_FI"
- FIRST_PARTY_FRAUD (any rail) → do not file: "FLAG_INVESTIGATION"
- CONSUMER_DISPUTE → goodwill/merchant outreach first: "GOODWILL_FIRST"

SIGNAL INFLUENCE: List 3–5 signals that most drove the verdict. Reference specific values from the inputs (e.g. "Zero prior disputes" not just "Dispute history"). Include which verdict each signal pushed toward.

Return ONLY valid JSON, no markdown:
{
  "classification": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "label": "True Fraud" | "First-Party Fraud" | "Consumer Dispute" | "Authorized Push Payment",
  "headline": "One tight sentence summarizing the triage assessment.",
  "signals": ["Signal 1", "Signal 2", "Signal 3"],
  "signal_influences": [
    { "signal": "Specific signal from inputs", "weight": "HIGH" | "MEDIUM" | "LOW", "toward": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT" }
  ],
  "ato_suspected": true | false,
  "ato_note": "Brief ATO note if suspected, empty string otherwise.",
  "routing": "CARD_CHARGEBACK" | "NACHA_RETURN" | "RECIPIENT_FI" | "PROVIDER_DISPUTE" | "FLAG_INVESTIGATION" | "GOODWILL_FIRST",
  "routing_label": "Human-readable routing label",
  "routing_detail": "1–2 sentences on what the agent should do next, including time-sensitive steps.",
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
        accountType,
        network: network || '',
        verdict: parsed.classification,
        confidence: parsed.confidence,
        routing: parsed.routing,
        outcome: 'pending',
      }, ...prev].slice(0, 100))
    } catch (e) {
      setError(`Classification failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Crypto Exchange classify ─────────────────────────────────────────────────
  const classifyCE = async () => {
    if (!ceComplaint.trim()) { setError("Customer's stated reason is required."); return }
    setLoading(true); setError(null); setResult(null)

    const daysNote = ceDaysSince !== null ? `${ceDaysSince} days ago (${ceTxDate})` : 'Unknown'
    const sarNote  = ceSarRequired
      ? `⚠ SAR/STR THRESHOLD MET — ${ceSarFlagUS ? `FinCEN SAR required ($${ceAmountNum.toLocaleString()} USD ≥ $5,000)` : ''}${ceSarFlagUS && ceStrFlagCA ? ' + ' : ''}${ceStrFlagCA ? `FINTRAC STR required ($${ceAmountNum.toLocaleString()} CAD ≥ $10,000)` : ''}`
      : 'Below SAR/STR threshold'

    const prompt = `You are a senior fraud analyst at a crypto exchange / digital asset platform (e.g. Coinbase, Binance, Kraken, Newton, Shakepay). You are triaging an incoming fraud or dispute claim. You operate under FinCEN (US) and/or FINTRAC (Canada) obligations as a Money Services Business.

FOUR VERDICT DEFINITIONS:
- TRUE_FRAUD: Unauthorized third-party access to the customer's exchange account — account takeover (ATO), SIM-swap, credential phishing, API key theft. Customer did NOT initiate or authorize the transaction(s).
- FIRST_PARTY_FRAUD: Customer authorized the transactions themselves but is falsely claiming fraud — typically after a losing trade, price drop, or buyer's remorse on an NFT or asset. Friendly fraud / chargeback abuse via linked card.
- CONSUMER_DISPUTE: Customer authorized the transaction but has a legitimate grievance — trade execution error, withdrawal delay, incorrect fee, locked account, asset not credited, or platform malfunction.
- AUTHORIZED_PUSH_PAYMENT: Customer was socially engineered into sending crypto voluntarily — pig butchering / investment scam, romance scam, fake exchange impersonation, fake support agent, NFT marketplace fraud. Customer believed the transfer was legitimate.

EXCHANGE ACCOUNT:
- Account Type: ${ceAccountType || 'Not specified'} (exchange account tier)
- KYC / Verification Level: ${ceKycLevel || 'Unknown'}
- Prior Claims (12 months): ${cePriorClaims || 'Unknown'}
- Flagged by: ${ceFlaggedBy || 'Not specified'}

TRANSACTION:
- Asset: ${ceAsset || 'Not specified'}
- Blockchain / Network: ${ceChain || 'Not specified'}
- Transaction Type: ${ceTxType || 'Not specified'}
- Amount: ${ceAmount ? `${ceAmount} ${ceCurrency}` : 'Not specified'}
- SAR/STR Status: ${sarNote}
- Transaction occurred: ${daysNote}
- Destination type: ${ceDestinationType || 'Unknown'}
${ceDestinationAddress ? `- Destination address/exchange: ${ceDestinationAddress}` : ''}
${ceReceivingExchange ? `- Receiving exchange (if known): ${ceReceivingExchange}` : ''}

COMPROMISE SIGNALS:
- Suspected compromise vector: ${ceCompromiseVector || 'Unknown'}
- Recent account changes (email, phone, 2FA, API keys): ${ceRecentAcctChanges || 'Unknown'}
- Device / location at time of transaction: ${ceDeviceNew || 'Unknown'}
- Blockchain trace available: ${ceBlockchainTrace || 'Unknown'}

CUSTOMER'S STATED REASON:
${ceComplaint}

REGULATORY CONTEXT:
- Jurisdiction(s): ${ceRegLabel}
${ceSarRequired ? `- ⚠ SAR/STR filing obligation triggered by amount` : '- No automatic SAR/STR threshold triggered'}

CLASSIFICATION GUIDANCE:
TRUE_FRAUD: SIM-swap or phishing confirmed/suspected, new device, account changes not made by customer, rapid draining of funds, customer reports not receiving 2FA codes, unusual withdrawal destination.
FIRST_PARTY_FRAUD: Customer authorized trades during bull market but claims fraud after price crashed; customer-initiated withdrawal to their own wallet then claims unauthorized; high prior claims; no account anomalies; withdrawal matches customer's known wallets.
CONSUMER_DISPUTE: Withdrawal delayed/failed, asset credited incorrectly, fee discrepancy, account incorrectly locked, trade filled at wrong price (platform error), staking rewards not credited.
AUTHORIZED_PUSH_PAYMENT (pig butchering / investment scam): Customer voluntarily sent crypto to an "investment platform" promising high returns; customer was romanced or groomed over weeks/months; receiving address is external, unhosted wallet or unknown exchange; customer may have multiple transfers escalating in size.

ROUTING FOR CRYPTO EXCHANGE:
- TRUE_FRAUD (ATO) → immediate account freeze + blockchain trace + notify compliance: "ACCOUNT_FREEZE"
- TRUE_FRAUD with external destination → contact receiving exchange compliance team (TRUST network / direct): "EXCHANGE_CONTACT"
- AUTHORIZED_PUSH_PAYMENT → blockchain trace + law enforcement referral + SAR: "LEA_REFERRAL"
- CONSUMER_DISPUTE → internal support escalation + goodwill review: "INTERNAL_REVIEW"
- FIRST_PARTY_FRAUD → flag account, do not refund, document for SAR if pattern: "FLAG_INVESTIGATION"
- SAR/STR threshold met → always add SAR note regardless of routing

LAW ENFORCEMENT:
- US: FBI Internet Crime Complaint Center (IC3.gov) + FinCEN SAR via BSA E-Filing
- Canada: RCMP CAFC (Canadian Anti-Fraud Centre) + FINTRAC STR via FINTRAC portal
- Both: Blockchain analytics referral (Chainalysis, Elliptic, TRM Labs) if internal tool unavailable

ATO DETECTION: Account changes + new device + rapid/unusual withdrawals = ato_suspected: true. SIM-swap is a strong ATO signal — recommend immediate account freeze and identity re-verification.

Return ONLY valid JSON, no markdown:
{
  "classification": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "label": "True Fraud" | "First-Party Fraud" | "Consumer Dispute" | "Authorized Push Payment",
  "headline": "One tight sentence summarizing the triage assessment for a crypto exchange fraud team.",
  "signals": ["Signal 1", "Signal 2", "Signal 3"],
  "signal_influences": [
    { "signal": "Specific signal from inputs", "weight": "HIGH" | "MEDIUM" | "LOW", "toward": "TRUE_FRAUD" | "FIRST_PARTY_FRAUD" | "CONSUMER_DISPUTE" | "AUTHORIZED_PUSH_PAYMENT" }
  ],
  "ato_suspected": true | false,
  "ato_note": "Brief ATO/account compromise note if suspected, empty string otherwise.",
  "sar_note": "${ceSarRequired ? 'SAR/STR filing required — document this classification and all signals.' : ''}",
  "routing": "ACCOUNT_FREEZE" | "EXCHANGE_CONTACT" | "LEA_REFERRAL" | "INTERNAL_REVIEW" | "FLAG_INVESTIGATION",
  "routing_label": "Human-readable routing label for crypto exchange analysts",
  "routing_detail": "2–3 sentences on exact next steps: who to contact, what tool to use, time sensitivity, blockchain trace priority.",
  "risk_notes": "Watch-outs specific to crypto exchange context — or empty string.",
  "proceed_to_dispute": true | false
}`

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('').replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(text)
      setResult(parsed)
      setOutcomes(prev => [{
        id: `T-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        date: new Date().toISOString(),
        merchant: ceReceivingExchange || ceDestinationAddress || '—',
        amount: ceAmount ? `${ceAmount} ${ceCurrency}` : '—',
        accountType: 'crypto_exchange',
        network: ceChain || ceAsset || '',
        verdict: parsed.classification,
        confidence: parsed.confidence,
        routing: parsed.routing,
        outcome: 'pending',
      }, ...prev].slice(0, 100))
    } catch (e) {
      setError(`Classification failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── CE deep action plan (runs after classifyCE) ─────────────────────────────
  const generateCEActionPlan = async () => {
    if (!result) return
    setCeActionPlanLoading(true); setCeActionPlanError(null); setCeActionPlan(null)

    const prompt = `You are a senior fraud operations analyst at a crypto exchange. Based on this triage classification, generate a complete operational action plan.

INCIDENT CLASSIFICATION:
- Verdict: ${result.classification} — ${result.label}
- Headline: ${result.headline}
- Routing: ${result.routing} — ${result.routing_label}
- Confidence: ${result.confidence}
- Routing Detail: ${result.routing_detail}

TRANSACTION CONTEXT:
- Exchange / Platform: ${ceReceivingExchange || 'Not specified'}
- Asset: ${ceAsset || 'Not specified'}${ceChain ? ' on ' + ceChain : ''}
- Transaction Type: ${ceTxType || 'Not specified'}
- Amount: ${ceAmount ? ceAmount + ' ' + ceCurrency : 'Not specified'}
- Transaction Date: ${ceTxDate || 'Not specified'}${ceDaysSince !== null ? ' (' + ceDaysSince + ' days ago)' : ''}
- Destination Type: ${ceDestinationType || 'Unknown'}
- Destination: ${ceDestinationAddress || 'Not specified'}
- Receiving Exchange: ${ceReceivingExchange || 'Unknown'}
- Blockchain Trace: ${ceBlockchainTrace || 'Unknown'}

ACCOUNT CONTEXT:
- Compromise Vector: ${ceCompromiseVector || 'Unknown'}
- Recent Account Changes: ${ceRecentAcctChanges || 'Unknown'}
- Device / Location: ${ceDeviceNew || 'Unknown'}
- Prior Claims: ${cePriorClaims || 'Unknown'}
- KYC Level: ${ceKycLevel || 'Unknown'}
- Jurisdiction: ${ceCountry === 'us' ? 'United States (FinCEN/BSA)' : ceCountry === 'ca' ? 'Canada (FINTRAC/PCMLTFA)' : 'US + Canada (FinCEN + FINTRAC)'}
- SAR/STR Status: ${ceSarRequired ? '⚠ THRESHOLD MET — filing obligation triggered' : 'Below automatic threshold — assess for suspicion-based obligation'}

CUSTOMER STATEMENT:
${ceComplaint}

Generate a specific, actionable operational plan for this exact incident. Every step should be concrete and executable, not generic.

Return ONLY valid JSON, no markdown:
{
  "immediate_actions": [
    "Specific action within the next 60 minutes — name the tool, system, or person (e.g. 'Freeze account in Admin > Account Management > [account ID] > Suspend')",
    "..."
  ],
  "investigation_steps": [
    "Step within 24-48 hours — specific system queries, data pulls, or contacts (e.g. 'Pull login logs for past 30 days from Auth service — look for IP changes and 2FA bypass events')",
    "..."
  ],
  "evidence_required": {
    "internal": ["Pull from exchange systems — login history, 2FA audit log, API key activity, withdrawal logs, device fingerprint", "..."],
    "external": ["Collect from customer or third parties — signed affidavit, police report, SIM swap confirmation from carrier", "..."],
    "blockchain": ["On-chain evidence — trace destination address on Etherscan/Blockchain.com, OFAC screen receiving address, cluster analysis if available", "..."]
  },
  "sar_required": true | false,
  "sar_note": "SAR/STR filing note — which jurisdiction, deadline, what triggers it, what to include. Empty string if not required.",
  "lea_referral_recommended": true | false,
  "lea_note": "Which agency (FBI IC3 / RCMP CAFC / both), what to include, urgency level. Empty string if not applicable.",
  "exchange_contact_required": true | false,
  "exchange_note": "Contact method for receiving exchange compliance (TRUST network / compliance@exchange / freeze request), urgency, what to include in request. Empty string if not applicable.",
  "recovery_outlook": "HIGH" | "MODERATE" | "LOW" | "VERY_LOW",
  "recovery_note": "2-3 sentences on recovery probability, what drives it, and what the customer should be told about the likelihood of fund recovery.",
  "customer_letter": {
    "subject": "Re: Your Recent Account Security Incident",
    "body": "Professional, empathetic letter to the customer. 3-4 paragraphs. Do not admit liability. Explain what the exchange is doing, what the customer should do next, and expected timeline. Match tone to incident type — fraud victims need empathy; suspected FPF or consumer disputes need neutral professional tone."
  }
}`

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('').replace(/```json|```/g, '').trim()
      setCeActionPlan(JSON.parse(text))
    } catch (e) {
      setCeActionPlanError(`Action plan failed: ${e.message}`)
    } finally {
      setCeActionPlanLoading(false)
    }
  }

  const markOutcome = (id, val) =>
    setOutcomes(prev => prev.map(o => o.id === id ? { ...o, outcome: val } : o))

  // ── Export report to clipboard ──────────────────────────────────────────────
  const exportReport = () => {
    if (!result) return
    const caseId = outcomes[0]?.id ?? '—'
    const lines = [
      `TRIAGE REPORT — ${caseId}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `VERDICT: ${cfg?.label ?? result.classification}`,
      `Confidence: ${result.confidence}`,
      `Headline: ${result.headline}`,
      ``,
      `TRANSACTION`,
      `  Merchant: ${merchant || '—'}`,
      `  Amount: ${amount ? `${amount} ${currency}` : '—'}`,
      `  Date: ${transactionDate || '—'}${daysSinceTransaction !== null ? ` (${daysSinceTransaction} days ago)` : ''}`,
      `  Type: ${transactionType || '—'}`,
      `  Account Type: ${accountType || '—'}`,
      network ? `  Network: ${network}` : '',
      `  Regulatory Framework: ${regLabel ?? '—'}`,
      ``,
      `ROUTING`,
      `  Recommendation: ${result.routing_label}`,
      `  Next Steps: ${result.routing_detail}`,
      ``,
      `KEY SIGNALS`,
      ...(result.signals?.map(s => `  → ${s}`) ?? []),
      ``,
      result.ato_suspected ? [`ATO SUSPECTED: ${result.ato_note}`, ``].join('\n') : '',
      provisionalCreditApplies ? `PROVISIONAL CREDIT: Reg E applies — 10 BD deadline.\n` : '',
      result.risk_notes ? `WATCH FOR: ${result.risk_notes}\n` : '',
      `FPF RISK SCORE: ${fpfRiskScore}/100`,
      isCrypto && cryptoScenario  ? `Crypto Scenario: ${cryptoScenario}` : '',
      isCrypto && exchangeRegulated ? `Exchange Regulated: ${exchangeRegulated}` : '',
      isCrypto && walletCustody    ? `Wallet Custody: ${walletCustody}` : '',
      isCrypto && contactedExchange ? `Contacted Exchange: ${contactedExchange}` : '',
    ].filter(l => l !== '').join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    })
  }

  // ── Handoff to Dispute Desk via URL query params (localStorage is per-origin) ──
  const handleProceedToDisputeDesk = () => {
    if (!result) return
    const caseId = outcomes[0]?.id ?? `T-${Date.now().toString(36).toUpperCase().slice(-5)}`
    const params = new URLSearchParams()
    params.set('caseId',         caseId)
    params.set('classification', result.classification || '')
    params.set('confidence',     result.confidence || '')
    params.set('headline',       result.headline || '')
    params.set('routing',        result.routing || '')
    if (isCE) {
      // Crypto exchange handoff
      params.set('merchant',        ceReceivingExchange || ceDestinationAddress || '')
      params.set('amount',          ceAmount || '')
      params.set('currency',        ceCurrency || 'USD')
      params.set('transactionDate', ceTxDate || '')
      params.set('network',         ceAsset ? `${ceAsset}${ceChain ? ` (${ceChain})` : ''}` : '')
      params.set('accountType',     'crypto_exchange')
      params.set('complaint',       ceComplaint.slice(0, 800))
    } else {
      // FI handoff
      params.set('merchant',        merchant || '')
      params.set('amount',          amount || '')
      params.set('currency',        currency || 'CAD')
      params.set('transactionDate', transactionDate || '')
      params.set('network',         network || '')
      params.set('accountType',     accountType || '')
      params.set('complaint',       customerReason.slice(0, 800))
    }
    window.open(`https://dispute-desk-tau.vercel.app?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

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
            {isCE
              ? 'Crypto exchange fraud triage. Four verdicts. FinCEN + FINTRAC aware. Built for exchange fraud analysts handling ATO, pig butchering, stablecoin fraud, and consumer disputes on digital asset platforms.'
              : 'Classify incoming dispute claims before anything is filed. Four verdicts. Covers card, ACH, P2P, BNPL, and FI-held crypto and stablecoins — routed by payment rail and regulatory framework: Reg E, Reg Z, NACHA, or provider.'}
          </p>

          {/* ── Platform mode toggle ── */}
          <div className="mt-5 flex gap-1 p-1 w-fit" style={{ background: '#E8E3DA' }}>
            {[
              { id: 'fi', label: 'Financial Institution' },
              { id: 'ce', label: 'Crypto Exchange' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => { setPlatformMode(m.id); setResult(null); setError(null) }}
                className="mono-font text-xs tracking-widest px-4 py-2 transition-all"
                style={{
                  background: platformMode === m.id ? '#1A1814' : 'transparent',
                  color:      platformMode === m.id ? '#F5F1EA' : '#6B5F4D',
                }}
              >{m.label}</button>
            ))}
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* ══ LEFT: Inputs ══════════════════════════════════════════════════════ */}
          <div>

          {/* ════════ CRYPTO EXCHANGE MODE FORM ════════ */}
          {isCE && (
            <>
              {/* CE 01 — Account & Transaction */}
              <div className="flex items-baseline gap-3 mb-5">
                <span className="mono-font text-xs text-stone-400">01</span>
                <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Account &amp; Transaction</h2>
              </div>

              {/* Jurisdiction */}
              <div className="mb-4">
                <label className="input-label">Jurisdiction</label>
                <select value={ceCountry} onChange={e => setCeCountry(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                  <option value="both">Both — US (FinCEN) + Canada (FINTRAC)</option>
                  <option value="us">United States — FinCEN / BSA</option>
                  <option value="ca">Canada — FINTRAC / PCMLTFA</option>
                </select>
                {ceRegLabel && (
                  <div className="flex items-start gap-3 py-2">
                    <span className="mono-font text-xs px-2 py-1 shrink-0" style={{ background: '#064E3B', color: '#6EE7B7' }}>{ceRegLabel}</span>
                    <span className="mono-font text-xs text-stone-400 leading-relaxed">{ceRegSubtext}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Account Type</label>
                    <select value={ceAccountType} onChange={e => setCeAccountType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Select…</option>
                      <option value="Standard retail account">Standard retail account</option>
                      <option value="Business / corporate account">Business / corporate account</option>
                      <option value="API / programmatic access">API / programmatic access</option>
                      <option value="OTC desk account">OTC desk account</option>
                      <option value="Institutional account">Institutional account</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">KYC Level</label>
                    <select value={ceKycLevel} onChange={e => setCeKycLevel(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="Tier 1 — email only">Tier 1 — email only</option>
                      <option value="Tier 2 — ID verified">Tier 2 — ID verified</option>
                      <option value="Tier 3 — full KYB / enhanced due diligence">Tier 3 — full KYB / EDD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Digital Asset</label>
                    <select value={ceAsset} onChange={e => setCeAsset(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Select asset…</option>
                      <option>BTC (Bitcoin)</option>
                      <option>ETH (Ethereum)</option>
                      <option>USDT (Tether)</option>
                      <option>USDC (USD Coin)</option>
                      <option>SOL (Solana)</option>
                      <option>XRP (Ripple)</option>
                      <option>BNB (BNB Chain)</option>
                      <option>MATIC (Polygon)</option>
                      <option>Other / Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Blockchain Network</label>
                    <select value={ceChain} onChange={e => setCeChain(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Select chain…</option>
                      <option>Bitcoin mainnet</option>
                      <option>Ethereum mainnet</option>
                      <option>Solana</option>
                      <option>BNB Chain</option>
                      <option>Polygon</option>
                      <option>Tron (TRC-20)</option>
                      <option>Avalanche</option>
                      <option>Unknown / off-chain</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Transaction Type</label>
                    <select value={ceTxType} onChange={e => setCeTxType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Select…</option>
                      <option>External withdrawal</option>
                      <option>Internal transfer</option>
                      <option>Spot trade / conversion</option>
                      <option>Fiat deposit → crypto purchase</option>
                      <option>Fiat off-ramp (crypto → fiat)</option>
                      <option>Staking / yield withdrawal</option>
                      <option>API-initiated trade or transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Transaction Date</label>
                    <input type="date" value={ceTxDate} onChange={e => setCeTxDate(e.target.value)} className="input-field mono-font" style={{ fontSize: '13px' }} />
                    {ceDaysSince !== null && (
                      <div className="mono-font text-xs text-stone-400 mt-1.5">
                        {ceDaysSince === 0 ? 'Today' : `${ceDaysSince} day${ceDaysSince !== 1 ? 's' : ''} ago`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount + SAR flag */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Amount</label>
                    <div className="flex gap-2">
                      <input type="text" value={ceAmount} onChange={e => setCeAmount(e.target.value)} placeholder="0.00" className="input-field" style={{ flex: 2 }} />
                      <select value={ceCurrency} onChange={e => setCeCurrency(e.target.value)} className="input-field mono-font" style={{ flex: 1, fontSize: '13px' }}>
                        <option>USD</option>
                        <option>CAD</option>
                        <option>EUR</option>
                        <option>GBP</option>
                        <option>BTC</option>
                        <option>ETH</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-end">
                    {ceSarRequired && (
                      <div className="w-full px-3 py-2.5" style={{ background: '#FEF3C7', border: '1px solid #92400E' }}>
                        <div className="mono-font text-xs tracking-widest" style={{ color: '#92400E' }}>⚠ SAR / STR THRESHOLD</div>
                        <div className="mono-font text-xs mt-0.5" style={{ color: '#78350F' }}>
                          {ceSarFlagUS && 'FinCEN SAR required (≥$5k USD)'}
                          {ceSarFlagUS && ceStrFlagCA && ' · '}
                          {ceStrFlagCA && 'FINTRAC STR required (≥$10k CAD)'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="section-rule" />

              {/* CE 02 — Destination & Recovery */}
              <div className="flex items-baseline gap-3 mb-5">
                <span className="mono-font text-xs text-stone-400">02</span>
                <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Destination &amp; Recovery</h2>
              </div>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="input-label">Destination Type</label>
                  <select value={ceDestinationType} onChange={e => setCeDestinationType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="External unhosted wallet (self-custody)">External unhosted wallet</option>
                    <option value="Known regulated exchange">Known regulated exchange</option>
                    <option value="Unknown / suspicious exchange">Unknown / suspicious exchange</option>
                    <option value="Internal platform wallet">Internal platform wallet</option>
                    <option value="DeFi protocol / smart contract">DeFi protocol / smart contract</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Destination Address / Exchange</label>
                    <input type="text" value={ceDestinationAddress} onChange={e => setCeDestinationAddress(e.target.value)} placeholder="0x... or exchange name" className="input-field mono-font" style={{ fontSize: '12px' }} />
                  </div>
                  <div>
                    <label className="input-label">Receiving Exchange (if known)</label>
                    <input type="text" value={ceReceivingExchange} onChange={e => setCeReceivingExchange(e.target.value)} placeholder="e.g. Binance, OKX, Kraken" className="input-field" style={{ fontSize: '14px' }} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Blockchain Trace Available</label>
                  <select value={ceBlockchainTrace} onChange={e => setCeBlockchainTrace(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown</option>
                    <option value="Yes — funds still traceable on-chain">Yes — funds still traceable on-chain</option>
                    <option value="Yes — but already moved / mixed">Yes — but already moved or mixed</option>
                    <option value="No — off-chain or unknown destination">No — off-chain or unknown</option>
                  </select>
                </div>
              </div>

              <hr className="section-rule" />

              {/* CE 03 — Claim & Compromise Signals */}
              <div className="flex items-baseline gap-3 mb-2">
                <span className="mono-font text-xs text-stone-400">03</span>
                <h2 className="display-font font-semibold text-2xl text-stone-900" style={{ letterSpacing: '-0.01em' }}>Claim &amp; Signals</h2>
              </div>
              <p className="display-font text-stone-500 text-[14px] mb-5 ml-7 italic" style={{ lineHeight: '1.5' }}>Fill what you know. Unknowns are treated as neutral.</p>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="input-label">How Was This Flagged?</label>
                  <select value={ceFlaggedBy} onChange={e => setCeFlaggedBy(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Select…</option>
                    <option>Customer-reported (app / support ticket)</option>
                    <option>Customer-reported (email / chat)</option>
                    <option>Customer-reported (phone / live agent)</option>
                    <option>Automated fraud system alert</option>
                    <option>Compliance team flagged (SAR review)</option>
                    <option>Blockchain analytics alert (Chainalysis / Elliptic)</option>
                    <option>Law enforcement inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Suspected Compromise Vector</label>
                  <select value={ceCompromiseVector} onChange={e => setCeCompromiseVector(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Unknown / not determined</option>
                    <option value="SIM-swap — mobile number ported or hijacked">SIM-swap</option>
                    <option value="Phishing — fake exchange website or email">Phishing — fake exchange or email</option>
                    <option value="Credential stuffing — reused password from data breach">Credential stuffing / password breach</option>
                    <option value="API key theft — programmatic unauthorized access">API key theft</option>
                    <option value="Social engineering — fake support agent or impersonation">Social engineering / fake support</option>
                    <option value="Investment / pig butchering scam — customer voluntarily sent funds">Investment scam / pig butchering</option>
                    <option value="Malware / device compromise">Malware / device compromise</option>
                    <option value="Insider threat — potential internal actor">Insider threat</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Recent Account Changes</label>
                    <select value={ceRecentAcctChanges} onChange={e => setCeRecentAcctChanges(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="Yes — email, phone, 2FA, or API keys changed recently">Yes — email / phone / 2FA / API changed</option>
                      <option value="No recent account changes detected">No recent changes</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Device / Location</label>
                    <select value={ceDeviceNew} onChange={e => setCeDeviceNew(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="New or unrecognized device / IP flagged">New or unrecognized device / IP</option>
                      <option value="Known device and location">Known device and location</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Prior Claims (12 months)</label>
                    <select value={cePriorClaims} onChange={e => setCePriorClaims(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option>None</option>
                      <option>1</option>
                      <option>2–3</option>
                      <option>4+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="input-label">Customer's Stated Reason <span style={{ color: '#B45309' }}>*</span></label>
                  <textarea
                    value={ceComplaint}
                    onChange={e => setCeComplaint(e.target.value)}
                    placeholder="What is the customer saying happened? Include any details about how they believe the fraud occurred…"
                    rows={5}
                    className="input-field"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* SAR deadline date (optional — for countdown in result) */}
              <div>
                <label className="input-label">
                  Date Incident Reported <span className="mono-font text-[10px] text-stone-400 normal-case tracking-normal">(optional — enables SAR deadline countdown)</span>
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="date" value={ceSarDeadlineDate} onChange={e => setCeSarDeadlineDate(e.target.value)}
                    className="input-field mono-font" style={{ fontSize: '13px', maxWidth: '200px' }} />
                  {ceSarDeadline && (
                    <div className={`mono-font text-xs px-2 py-1 ${ceSarDaysLeft !== null && ceSarDaysLeft <= 7 ? 'bg-red-900 text-red-50' : ceSarDaysLeft !== null && ceSarDaysLeft <= 14 ? 'bg-amber-800 text-amber-50' : 'bg-stone-800 text-stone-100'}`}>
                      SAR deadline: {ceSarDeadline} · {ceSarDaysLeft !== null ? `${ceSarDaysLeft}d remaining` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* CE CTA */}
              <div className="mt-8">
                <button
                  onClick={classifyCE}
                  disabled={loading || !ceComplaint.trim()}
                  className="w-full bg-stone-900 text-stone-50 py-4 mono-font text-xs tracking-widest hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 group"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>CLASSIFYING CLAIM</span></>
                    : <><Bitcoin className="w-4 h-4" /><span>CLASSIFY EXCHANGE CLAIM</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  }
                </button>
                {error && (
                  <div className="mt-4 border border-red-700 bg-red-50 p-4 flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                    <div className="display-font text-sm text-red-900">{error}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════════ FI MODE FORM ════════ */}
          {!isCE && (
            <>
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
                  <option value="crypto">Crypto / Digital Asset (FI-held)</option>
                </select>
              </div>

              {/* Reg framework badge */}
              {regLabel && (
                <div className="flex items-start gap-3 py-2">
                  <span className="mono-font text-xs px-2 py-1 shrink-0" style={{ background: regColor.bg, color: regColor.text }}>
                    {regLabel}
                  </span>
                  <span className="mono-font text-xs text-stone-400 leading-relaxed">{regSubtext}</span>
                </div>
              )}

              {/* Network selector — card-based and crypto */}
              {showNetworkSel && (
                <div>
                  <label className="input-label">Payment Network</label>
                  <select value={network} onChange={e => setNetwork(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Select network…</option>
                    {isCrypto ? (
                      <>
                        <option>Bitcoin (BTC)</option>
                        <option>Ethereum (ETH)</option>
                        <option>Solana (SOL)</option>
                        <option>Polygon (MATIC)</option>
                        <option>USDT / USDC (Stablecoin)</option>
                        <option>Other / Unknown chain</option>
                      </>
                    ) : (
                      <>
                        <option>Visa</option>
                        <option>Mastercard</option>
                        <option>American Express</option>
                        <option>Interac</option>
                        <option>Other</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Auto-detected crypto banner */}
              {detectedCrypto && (
                <div className="flex items-start gap-2 p-3" style={{ background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                  <Bitcoin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#065F46' }} />
                  <div>
                    <span className="mono-font text-xs tracking-widest" style={{ color: '#064E3B' }}>CRYPTO MERCHANT DETECTED — </span>
                    <span className="mono-font text-xs" style={{ color: '#065F46' }}>{merchant} is a known exchange or digital asset platform. Switch account type to Crypto to unlock all crypto signals.</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">
                    {isCrypto ? 'Destination Wallet / Platform' : 'Merchant / Recipient'}
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={e => setMerchant(e.target.value)}
                    placeholder={isCrypto ? 'e.g. 0x1a2b… or Uniswap / receiving exchange' : 'e.g. TechGadget Co.'}
                    className="input-field"
                    style={isCrypto ? { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' } : {}}
                  />
                  {isCrypto && (
                    <div className="mono-font text-xs text-stone-400 mt-1">Wallet address, exchange name, or DeFi protocol</div>
                  )}
                </div>
                <div>
                  <label className="input-label">Amount</label>
                  <div className="flex gap-2">
                    <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="284.00" className="input-field" style={{ flex: 2 }} />
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field mono-font" style={{ flex: 1, fontSize: '13px' }}>
                      {isCrypto ? (
                        <>
                          <option>CAD</option>
                          <option>USD</option>
                          <option>BTC</option>
                          <option>ETH</option>
                          <option>USDC</option>
                          <option>USDT</option>
                        </>
                      ) : (
                        <>
                          <option>CAD</option>
                          <option>USD</option>
                          <option>EUR</option>
                          <option>GBP</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Transaction Date</label>
                  <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="input-field mono-font" style={{ fontSize: '13px' }} />
                  {/* Auto-compute days since — show as inline confirmation */}
                  {daysSinceTransaction !== null && (
                    <div className="mono-font text-xs text-stone-400 mt-1.5">
                      {daysSinceTransaction === 0 ? 'Today' : `${daysSinceTransaction} day${daysSinceTransaction !== 1 ? 's' : ''} ago`}
                    </div>
                  )}
                </div>
                <div>
                  <label className="input-label">Transaction Type</label>
                  <select value={transactionType} onChange={e => setTransactionType(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                    <option value="">Select type…</option>
                    {accountType && TX_TYPES[accountType]
                      ? TX_TYPES[accountType].map(t => <option key={t}>{t}</option>)
                      : (
                        <>
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
                        </>
                      )
                    }
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
                {/* Card possession — only makes sense for physical card products */}
                {isCardBased && (
                  <div className="sm:col-span-2">
                    <label className="input-label">Card in Possession When Reported</label>
                    <select value={cardPossession} onChange={e => setCardPossession(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option>Yes — card in hand</option>
                      <option>No — card lost or stolen</option>
                    </select>
                  </div>
                )}
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

            {/* Merchant signals — card-based only (VFMP, MCC are card-network concepts) */}
            {isCardBased && (
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
            )}

            {/* Crypto signals — shown when account type is crypto or merchant auto-detected as crypto */}
            {(isCrypto || detectedCrypto) && (
              <div className="mt-5">
                <div className="sub-label ml-0 flex items-center gap-2">
                  <Bitcoin className="w-3 h-3" style={{ color: '#065F46' }} />
                  <span>Crypto / Digital Asset Signals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="input-label">Crypto Fraud Scenario</label>
                    <select value={cryptoScenario} onChange={e => setCryptoScenario(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Select scenario…</option>
                      <option value="Card used to buy crypto (authorized scam)">Card used to buy crypto (authorized scam)</option>
                      <option value="Pig butchering / investment scam">Pig butchering / investment scam</option>
                      <option value="Wallet / exchange hack (unauthorized access)">Wallet / exchange hack (unauthorized access)</option>
                      <option value="NFT / digital asset fraud">NFT / digital asset fraud</option>
                      <option value="Stablecoin transfer fraud (USDC/USDT used as wire substitute)">Stablecoin fraud (USDC / USDT wire substitute)</option>
                      <option value="FI-held crypto — unauthorized withdrawal from integrated wallet">FI-held crypto — unauthorized withdrawal</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Exchange Regulated?</label>
                    <select value={exchangeRegulated} onChange={e => setExchangeRegulated(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="Yes — registered / licensed exchange">Yes — licensed exchange</option>
                      <option value="No — unregulated or offshore">No — unregulated / offshore</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Wallet Custody</label>
                    <select value={walletCustody} onChange={e => setWalletCustody(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="Custodial (exchange holds keys)">Custodial (exchange holds keys)</option>
                      <option value="Self-custody (customer holds keys)">Self-custody (customer holds keys)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Customer Contacted Exchange?</label>
                    <select value={contactedExchange} onChange={e => setContactedExchange(e.target.value)} className="input-field" style={{ fontSize: '14px' }}>
                      <option value="">Unknown</option>
                      <option value="Yes — exchange contacted, case open">Yes — case open with exchange</option>
                      <option value="Yes — exchange declined to help">Yes — exchange declined</option>
                      <option value="No — customer came to FI first">No — came to FI first</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

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
            </> /* end FI mode form */
          )}
          </div> {/* end LEFT column */}

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

                {/* Reg framework badge — FI mode */}
                {!isCE && regLabel && (
                  <div className="flex items-center gap-2">
                    <span className="mono-font text-xs px-2 py-0.5" style={{ background: regColor.bg, color: regColor.text }}>
                      {regLabel}
                    </span>
                    <span className="mono-font text-xs text-stone-400 uppercase tracking-wider">framework</span>
                  </div>
                )}

                {/* CE: jurisdiction + SAR flag */}
                {isCE && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="mono-font text-xs px-2 py-0.5" style={{ background: '#064E3B', color: '#6EE7B7' }}>{ceRegLabel}</span>
                      <span className="mono-font text-xs text-stone-400 uppercase tracking-wider">jurisdiction</span>
                    </div>
                    {ceSarRequired && (
                      <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#FEF3C7', border: '1px solid #D97706' }}>
                        <span className="mono-font text-xs tracking-widest" style={{ color: '#92400E' }}>
                          ⚠ SAR/STR FILING REQUIRED — document this case before closing
                        </span>
                      </div>
                    )}
                    {result.sar_note && !ceSarRequired && (
                      <div className="mono-font text-xs text-stone-400 italic">{result.sar_note}</div>
                    )}
                  </div>
                )}

                {/* Verdict card */}
                <div className="p-6" style={{ background: cfg.bg }}>
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                    <div className="mono-font text-xs tracking-widest" style={{ color: cfg.badgeText, opacity: 0.8 }}>TRIAGE VERDICT</div>
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
                      This Reg E dispute must be resolved within <strong>10 business days</strong> of the complaint date — or provisional credit must be issued. Investigation may extend to <strong>45 business days</strong> (90 days for POS, international, or new accounts) with provisional credit posted.
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

                {/* FPF Risk Score meter */}
                {(() => {
                  const fpfColor = fpfRiskScore >= 70 ? '#991B1B' : fpfRiskScore >= 45 ? '#92400E' : '#065F46'
                  const fpfBg    = fpfRiskScore >= 70 ? '#FEE2E2' : fpfRiskScore >= 45 ? '#FEF3C7' : '#ECFDF5'
                  const fpfLabel = fpfRiskScore >= 70 ? 'HIGH — Investigate further' : fpfRiskScore >= 45 ? 'MODERATE — Review carefully' : 'LOW — Claim appears genuine'
                  return (
                    <div className="border p-4" style={{ background: fpfBg, borderColor: fpfColor + '40' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="mono-font text-xs tracking-widest" style={{ color: fpfColor }}>FIRST-PARTY FRAUD RISK</span>
                        <span className="mono-font text-sm font-bold" style={{ color: fpfColor }}>{fpfRiskScore}/100</span>
                      </div>
                      <div className="w-full h-2 rounded-full mb-2" style={{ background: '#E7E5E4' }}>
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${fpfRiskScore}%`, background: fpfColor }} />
                      </div>
                      <div className="mono-font text-xs" style={{ color: fpfColor }}>{fpfLabel}</div>
                    </div>
                  )
                })()}

                {/* Export report button */}
                <button
                  onClick={exportReport}
                  className="w-full flex items-center justify-center gap-2 py-3 border transition-colors"
                  style={{ borderColor: '#D4CCBC', background: '#FAF7F1' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F0EBE2' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FAF7F1' }}
                >
                  {exportCopied
                    ? <><Check className="w-4 h-4 text-emerald-600" /><span className="mono-font text-xs tracking-widest text-emerald-600">COPIED TO CLIPBOARD</span></>
                    : <><Copy className="w-4 h-4 text-stone-500" /><span className="mono-font text-xs tracking-widest text-stone-600">EXPORT TRIAGE REPORT</span></>
                  }
                </button>

                {/* ── CE: SAR countdown banner ── */}
                {isCE && ceSarRequired && ceSarDeadline && (
                  <div className={`flex items-center gap-3 px-3 py-2.5 mono-font text-xs ${ceSarDaysLeft !== null && ceSarDaysLeft <= 7 ? 'bg-red-900 text-red-50' : ceSarDaysLeft !== null && ceSarDaysLeft <= 14 ? 'bg-amber-800 text-amber-50' : 'bg-stone-800 text-stone-100'}`}>
                    <span>⚠ SAR/STR DEADLINE:</span>
                    <span className="font-bold">{ceSarDeadline}</span>
                    {ceSarDaysLeft !== null && (
                      <span>{ceSarDaysLeft > 0 ? `${ceSarDaysLeft} DAYS REMAINING` : ceSarDaysLeft === 0 ? 'DUE TODAY' : `${Math.abs(ceSarDaysLeft)} DAYS OVERDUE`}</span>
                    )}
                  </div>
                )}

                {/* ── CE: Generate full action plan ── */}
                {isCE && !ceActionPlan && !ceActionPlanLoading && (
                  <button
                    onClick={generateCEActionPlan}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-stone-900 text-stone-50 mono-font text-xs tracking-widest hover:bg-stone-800 transition-all group"
                  >
                    <Shield className="w-4 h-4" />
                    <span>GENERATE FULL ACTION PLAN</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                {isCE && ceActionPlanLoading && (
                  <div className="border border-stone-300 p-8 text-center" style={{ background: '#FAF7F1' }}>
                    <Loader2 className="w-6 h-6 text-stone-600 mx-auto mb-2 animate-spin" />
                    <p className="display-font text-stone-600 italic text-sm">Building operational action plan…</p>
                  </div>
                )}
                {isCE && ceActionPlanError && (
                  <div className="border border-red-700 bg-red-50 p-4 flex gap-3 items-start">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div className="display-font text-sm text-red-900">{ceActionPlanError}</div>
                  </div>
                )}

                {/* ── CE: Action plan output ── */}
                {isCE && ceActionPlan && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="mono-font text-xs tracking-widest text-stone-500">FULL ACTION PLAN</div>
                      <button onClick={() => {
                        const t = [
                          `CE ACTION PLAN — ${result.classification?.replace(/_/g,' ')}`,
                          `Recovery Outlook: ${ceActionPlan.recovery_outlook}`,
                          '',
                          'IMMEDIATE ACTIONS:',
                          ...(ceActionPlan.immediate_actions||[]).map((a,i) => `${i+1}. ${a}`),
                          '',
                          'INVESTIGATION STEPS:',
                          ...(ceActionPlan.investigation_steps||[]).map((a,i) => `${i+1}. ${a}`),
                          '',
                          'EVIDENCE — INTERNAL:',
                          ...(ceActionPlan.evidence_required?.internal||[]).map(e => `• ${e}`),
                          '',
                          'EVIDENCE — EXTERNAL:',
                          ...(ceActionPlan.evidence_required?.external||[]).map(e => `• ${e}`),
                          '',
                          'EVIDENCE — BLOCKCHAIN:',
                          ...(ceActionPlan.evidence_required?.blockchain||[]).map(e => `• ${e}`),
                          ceActionPlan.sar_required ? '\nSAR/STR: ' + ceActionPlan.sar_note : '',
                          ceActionPlan.lea_referral_recommended ? '\nLEA REFERRAL: ' + ceActionPlan.lea_note : '',
                          ceActionPlan.exchange_contact_required ? '\nEXCHANGE CONTACT: ' + ceActionPlan.exchange_note : '',
                          '',
                          'RECOVERY OUTLOOK: ' + ceActionPlan.recovery_outlook,
                          ceActionPlan.recovery_note,
                          '',
                          'CUSTOMER LETTER\nSubject: ' + (ceActionPlan.customer_letter?.subject || ''),
                          'Dear Customer,\n\n' + (ceActionPlan.customer_letter?.body || ''),
                        ].filter(Boolean).join('\n')
                        navigator.clipboard.writeText(t)
                        setCeActionPlanCopied(true)
                        setTimeout(() => setCeActionPlanCopied(false), 2000)
                      }} className="mono-font text-xs flex items-center gap-1.5 text-stone-600 hover:text-stone-900 transition-colors">
                        {ceActionPlanCopied ? <><Check className="w-3 h-3" /> COPIED</> : <><Copy className="w-3 h-3" /> COPY ALL</>}
                      </button>
                    </div>

                    {/* Immediate actions */}
                    <div className="border-l-4 border-red-700 bg-red-50 p-5">
                      <div className="mono-font text-xs tracking-widest text-red-900 mb-3">IMMEDIATE ACTIONS — DO NOW</div>
                      <div className="space-y-2">
                        {ceActionPlan.immediate_actions?.map((a, i) => (
                          <div key={i} className="display-font text-stone-900 text-[14px] flex gap-2 items-start leading-snug">
                            <span className="mono-font text-[11px] text-red-700 shrink-0 mt-0.5 font-bold">{i+1}.</span>
                            <span>{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Investigation steps */}
                    <div className="border border-stone-300 p-5" style={{ background: '#FAF7F1' }}>
                      <div className="mono-font text-xs tracking-widest text-stone-600 mb-3">INVESTIGATION STEPS — 24–48 HOURS</div>
                      <div className="space-y-2">
                        {ceActionPlan.investigation_steps?.map((s, i) => (
                          <div key={i} className="display-font text-stone-800 text-[14px] flex gap-2 items-start leading-snug">
                            <span className="mono-font text-[11px] text-stone-500 shrink-0 mt-0.5">{i+1}.</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Evidence package */}
                    <div>
                      <div className="mono-font text-xs tracking-widest text-stone-500 mb-3">EVIDENCE PACKAGE</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'internal',   label: 'INTERNAL — YOUR SYSTEMS',        color: 'text-stone-900' },
                          { key: 'external',   label: 'EXTERNAL — CUSTOMER / THIRD PARTIES', color: 'text-amber-900' },
                          { key: 'blockchain', label: 'BLOCKCHAIN — ON-CHAIN',           color: 'text-purple-900' },
                        ].map(({ key, label, color }) => (
                          <div key={key} className="border border-stone-200 p-4" style={{ background: '#FAF7F1' }}>
                            <div className="mono-font text-[10px] tracking-widest text-stone-400 mb-3">{label}</div>
                            <div className="space-y-2">
                              {(ceActionPlan.evidence_required?.[key] || []).map((item, i) => (
                                <div key={i} className={`display-font text-[13px] flex gap-2 items-start leading-snug ${color}`}>
                                  <span className="shrink-0 mt-0.5 text-stone-400">→</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SAR/STR block */}
                    {ceActionPlan.sar_required && (
                      <div className="border-l-4 border-amber-700 bg-amber-50 p-5">
                        <div className="mono-font text-xs tracking-widest text-amber-900 mb-2">⚠ SAR / STR FILING REQUIRED</div>
                        <p className="display-font text-stone-900 text-[14px] leading-relaxed">{ceActionPlan.sar_note}</p>
                        {ceSarDeadline && (
                          <div className={`mt-3 mono-font text-xs px-3 py-1.5 inline-block ${ceSarDaysLeft !== null && ceSarDaysLeft <= 7 ? 'bg-red-900 text-red-50' : 'bg-stone-800 text-stone-100'}`}>
                            DEADLINE: {ceSarDeadline}{ceSarDaysLeft !== null ? ` · ${ceSarDaysLeft} days remaining` : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* LEA referral */}
                    {ceActionPlan.lea_referral_recommended && (
                      <div className="border border-stone-900 p-5" style={{ background: '#1A1814' }}>
                        <div className="mono-font text-xs tracking-widest text-stone-400 mb-2">LAW ENFORCEMENT REFERRAL</div>
                        <p className="display-font text-stone-100 text-[14px] leading-relaxed">{ceActionPlan.lea_note}</p>
                      </div>
                    )}

                    {/* Exchange contact */}
                    {ceActionPlan.exchange_contact_required && (
                      <div className="border border-stone-400 p-5" style={{ background: '#FAF7F1' }}>
                        <div className="mono-font text-xs tracking-widest text-stone-500 mb-2">RECEIVING EXCHANGE — CONTACT NOW</div>
                        <p className="display-font text-stone-800 text-[14px] leading-relaxed">{ceActionPlan.exchange_note}</p>
                      </div>
                    )}

                    {/* Recovery outlook */}
                    {(() => {
                      const ol = ceActionPlan.recovery_outlook
                      const olStyle = ol === 'HIGH' ? { bg: '#064e3b', text: '#6EE7B7' } :
                                      ol === 'MODERATE' ? { bg: '#78350f', text: '#FDE68A' } :
                                      ol === 'LOW' ? { bg: '#7f1d1d', text: '#FCA5A5' } :
                                      { bg: '#1c1917', text: '#A8A29E' }
                      return (
                        <div className="p-5 border border-stone-200" style={{ background: '#FAF7F1' }}>
                          <div className="mono-font text-xs tracking-widest text-stone-500 mb-2">RECOVERY OUTLOOK</div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="mono-font text-xs px-2 py-1" style={{ background: olStyle.bg, color: olStyle.text }}>{ol}</span>
                            <span className="mono-font text-xs text-stone-400">
                              {ol === 'HIGH' ? '60–80%' : ol === 'MODERATE' ? '35–60%' : ol === 'LOW' ? '15–35%' : '<15%'}
                            </span>
                          </div>
                          <p className="display-font text-stone-700 text-[14px] leading-relaxed">{ceActionPlan.recovery_note}</p>
                        </div>
                      )
                    })()}

                    {/* Customer letter */}
                    {ceActionPlan.customer_letter && (
                      <div className="border border-stone-900">
                        <div className="bg-stone-900 px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="mono-font text-xs tracking-widest text-stone-400 mb-0.5">CUSTOMER LETTER</div>
                            <div className="display-font text-stone-100 font-semibold text-[15px]">{ceActionPlan.customer_letter.subject}</div>
                          </div>
                          <button onClick={() => {
                            const full = `Subject: ${ceActionPlan.customer_letter.subject}

Dear Customer,

${ceActionPlan.customer_letter.body}

Sincerely,
Compliance & Fraud Operations Team`
                            navigator.clipboard.writeText(full)
                            setCeActionPlanCopied(true)
                            setTimeout(() => setCeActionPlanCopied(false), 2000)
                          }} className="mono-font text-xs flex items-center gap-1.5 text-stone-400 hover:text-stone-200 transition-colors">
                            {ceActionPlanCopied ? <><Check className="w-3 h-3" /> COPIED</> : <><Copy className="w-3 h-3" /> COPY</>}
                          </button>
                        </div>
                        <div className="bg-white p-5 space-y-3">
                          <p className="display-font text-stone-500 text-sm italic">Dear Customer,</p>
                          {ceActionPlan.customer_letter.body?.split('\n\n').map((para, i) => (
                            <p key={i} className="display-font text-stone-900 text-[15px] leading-relaxed">{para}</p>
                          ))}
                          <p className="display-font text-stone-500 text-sm italic pt-2">Sincerely,<br />Compliance & Fraud Operations Team</p>
                        </div>
                      </div>
                    )}

                    {/* Re-run action plan */}
                    <button onClick={() => setCeActionPlan(null)} className="mono-font text-[10px] tracking-widest text-stone-400 hover:text-stone-700 transition-colors">
                      ↺ REGENERATE ACTION PLAN
                    </button>
                  </div>
                )}

                {/* Send to Dispute Desk — FI mode only (CE analysts complete workflow here) */}
                {!isCE && (
                <div className="border" style={{ borderColor: result.proceed_to_dispute ? '#065F46' : '#D4CCBC' }}>
                  <button
                    onClick={handleProceedToDisputeDesk}
                    className="w-full flex items-center justify-between p-5 transition-colors"
                    style={{ background: result.proceed_to_dispute ? '#1A1814' : '#FAF7F1' }}
                    onMouseEnter={e => e.currentTarget.style.background = result.proceed_to_dispute ? '#2C2822' : '#F0EBE2'}
                    onMouseLeave={e => e.currentTarget.style.background = result.proceed_to_dispute ? '#1A1814' : '#FAF7F1'}
                  >
                    <div className="text-left">
                      <div className="mono-font text-xs tracking-widest mb-1" style={{ color: result.proceed_to_dispute ? '#6B5F4D' : '#A89B88' }}>
                        {result.proceed_to_dispute ? 'RECOMMENDED NEXT STEP' : 'OPTIONAL — SEND TO DESK'}
                      </div>
                      <div className="display-font font-semibold text-lg" style={{ color: result.proceed_to_dispute ? '#F5F1EA' : '#1A1814', letterSpacing: '-0.01em' }}>
                        Open in Dispute Desk →
                      </div>
                      <div className="mono-font text-xs mt-1" style={{ color: result.proceed_to_dispute ? '#6B5F4D' : '#A89B88' }}>
                        Merchant, amount, date &amp; complaint pre-filled
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 shrink-0" style={{ color: result.proceed_to_dispute ? '#6B5F4D' : '#D4CCBC' }} />
                  </button>
                  {!result.proceed_to_dispute && (
                    <div className="px-5 pb-3 mono-font text-xs" style={{ color: '#A89B88' }}>
                      Note: AI did not recommend filing — review signals before proceeding
                    </div>
                  )}
                </div>
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
                { label: 'TOTAL',           value: outcomes.length,                           sub: 'classified'                                                                                      },
                { label: 'ACCURACY',        value: accuracy !== null ? `${accuracy}%` : '—',  sub: `${resolved.length} resolved`                                                                    },
                { label: 'LEADING VERDICT', value: leadingLabel,                              sub: leadingVerdict[1] > 0 ? `${leadingVerdict[1]} case${leadingVerdict[1] !== 1 ? 's' : ''}` : ''  },
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
