// DealProof pure logic: discount maths, the honesty-weighted deal score,
// filtering and sorting. No DOM in here, so the same file runs in the browser
// and under `node --test`.

// How much each hand-checked honesty signal is worth in the score. A verified
// new low is the strongest thing a deal can be; an inflated anchor price is
// worth nothing, however big the headline percent looks.
const SIGNAL_POINTS = { "new-low": 25, strong: 18, routine: 8, inflated: 0 };

export function discountPct(deal) {
  if (!deal.was || deal.was <= deal.price) return 0;
  return Math.round((1 - deal.price / deal.was) * 100);
}

export function savings(deal) {
  return Math.round((deal.was - deal.price) * 100) / 100;
}

// 0-100 score: mostly the size of the cut, then the absolute dollars saved
// (capped so a pricey TV cannot win on dollars alone), then the honesty
// signal. The board sorts by this, so the deals a shopper should see first
// really are first.
export function scoreDeal(deal) {
  const pctPart = discountPct(deal) * 0.55;
  const dollarsPart = (Math.min(savings(deal), 300) / 300) * 20;
  const signalPart = SIGNAL_POINTS[deal.signal] ?? 0;
  return Math.max(0, Math.min(100, Math.round(pctPart + dollarsPart + signalPart)));
}

export function filterDeals(deals, { q = "", category = "", store = "", minDiscount = 0, signal = "" } = {}) {
  const needle = q.trim().toLowerCase();
  return deals.filter((deal) => {
    if (needle) {
      const hay = `${deal.title} ${deal.store} ${deal.category}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (category && deal.category !== category) return false;
    if (store && deal.store !== store) return false;
    if (signal && deal.signal !== signal) return false;
    if (minDiscount && discountPct(deal) < minDiscount) return false;
    return true;
  });
}

export function sortDeals(deals, mode = "score") {
  const by = {
    score: (a, b) => scoreDeal(b) - scoreDeal(a) || discountPct(b) - discountPct(a),
    discount: (a, b) => discountPct(b) - discountPct(a) || savings(b) - savings(a),
    savings: (a, b) => savings(b) - savings(a),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
  }[mode] ?? (() => 0);
  return [...deals].sort(by);
}

export function formatMoney(n) {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2);
  const [whole, cents] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return cents ? `$${grouped}.${cents}` : `$${grouped}`;
}
