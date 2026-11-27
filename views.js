// DealProof views: every render builds DOM nodes and sets text with
// textContent, never innerHTML, so deal text can never become markup.
import { discountPct, savings, scoreDeal, formatMoney } from "./logic.js";
import { STORE_WINDOWS } from "./data.js";

export const SIGNAL_LABEL = {
  "new-low": "Verified new low",
  strong: "Strong price",
  routine: "Routine sale",
  inflated: "Inflated anchor",
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtChecked(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${time} UTC`;
}

export function signalBadge(deal) {
  const badge = el("span", `badge badge-${deal.signal}`);
  badge.append(el("span", "badge-dot"));
  badge.append(el("span", "", SIGNAL_LABEL[deal.signal]));
  return badge;
}

export function dealCard(deal, opts = {}) {
  const card = el("article", "card");
  card.id = `card-${deal.id}`;

  const top = el("div", "card-top");
  top.append(signalBadge(deal));
  if (opts.fresh) top.append(el("span", "new-tag", "New"));
  const saveBtn = el("button", `save-btn${opts.saved ? " saved" : ""}`, opts.saved ? "★ Saved" : "☆ Save");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    if (opts.onToggleSave) opts.onToggleSave(deal.id);
  });
  top.append(saveBtn);
  card.append(top);

  const title = el("h3", "card-title");
  const link = el("a", "", deal.title);
  link.href = `#/deal/${deal.id}`;
  title.append(link);
  card.append(title);

  card.append(el("p", "card-meta", `${deal.store} · ${deal.category}`));

  const prices = el("div", "card-prices");
  prices.append(el("span", "price-now", formatMoney(deal.price)));
  prices.append(el("span", "price-was", formatMoney(deal.was)));
  prices.append(el("span", "price-off", `-${discountPct(deal)}%`));
  card.append(prices);
  card.append(el("p", "card-saves", `You save ${formatMoney(savings(deal))}`));

  card.append(el("p", "card-evidence", deal.evidence));

  const foot = el("div", "card-foot");
  foot.append(el("span", "card-checked", `Checked ${fmtChecked(deal.checked)} · ${deal.source} · Sale ends ${STORE_WINDOWS[deal.store]}`));
  const links = el("span", "card-links");
  const detailsLink = el("a", "details-link", "Details →");
  detailsLink.href = `#/deal/${deal.id}`;
  links.append(detailsLink);
  const storeLink = el("a", "store-link", `View at ${deal.store}`);
  storeLink.href = deal.url;
  storeLink.target = "_blank";
  storeLink.rel = "noopener";
  links.append(storeLink);
  foot.append(links);
  card.append(foot);

  // The whole card opens the product page; only links and buttons act alone.
  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    location.hash = `/deal/${deal.id}`;
  });
  return card;
}

export function renderBoard(container, list, opts = {}) {
  container.replaceChildren();
  if (list.length === 0) {
    const empty = el("div", "empty-state");
    empty.append(el("h2", "", "No deals match that filter"));
    empty.append(
      el("p", "", "Try a wider search, or clear the category, store and discount filters to see the full board."),
    );
    container.append(empty);
    return;
  }
  const grid = el("div", "grid");
  for (const deal of list) {
    grid.append(
      dealCard(deal, {
        saved: opts.saved?.has(deal.id) ?? false,
        fresh: opts.fresh?.has(deal.id) ?? false,
        onToggleSave: opts.onToggleSave,
      }),
    );
  }
  container.append(grid);
}

// Groups of the same product sold at more than one store, cheapest first.
// Grouped on the first three title words, so the same product listed with
// slightly different wording at another store still lands in one group.
export function priceCheckGroups(deals) {
  const byKey = new Map();
  for (const deal of deals) {
    const key = deal.title.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(deal);
  }
  return [...byKey.values()]
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort((a, b) => a.price - b.price));
}

export function renderPriceChecks(container, deals) {
  container.replaceChildren();
  container.append(el("h2", "section-title", "Same product, checked across stores"));
  container.append(
    el(
      "p",
      "section-sub",
      "Where two stores sell the same product, we list both prices side by side. The cheapest is marked; the dearer one keeps its honesty grade, so a famous name cannot hide a weak price.",
    ),
  );
  for (const group of priceCheckGroups(deals)) {
    const row = el("div", "compare-row");
    const displayTitle = [...group].sort((a, b) => a.title.length - b.title.length)[0].title;
    row.append(el("h3", "compare-title", displayTitle));
    const cells = el("div", "compare-cells");
    group.forEach((deal, i) => {
      const cell = el("div", i === 0 ? "compare-cell cheapest" : "compare-cell");
      cell.append(el("span", "compare-store", deal.store));
      cell.append(el("span", "compare-price", formatMoney(deal.price)));
      cell.append(el("span", "compare-was", `was ${formatMoney(deal.was)}`));
      cell.append(signalBadge(deal));
      if (i === 0) cell.append(el("span", "compare-flag", "Cheapest here"));
      const link = el("a", "compare-link", "Details");
      link.href = `#/deal/${deal.id}`;
      cell.append(link);
      cells.append(cell);
    });
    row.append(cells);
    container.append(row);
  }
}

export function renderDetail(container, deal, allDeals) {
  container.replaceChildren();
  const wrap = el("article", "detail");

  const back = el("a", "back-link", "← Back to the full board");
  back.href = "#/";
  wrap.append(back);

  const top = el("div", "card-top");
  top.append(signalBadge(deal));
  wrap.append(top);

  wrap.append(el("h2", "detail-title", deal.title));
  wrap.append(el("p", "card-meta", `${deal.store} · ${deal.category}`));

  const prices = el("div", "card-prices detail-prices");
  prices.append(el("span", "price-now", formatMoney(deal.price)));
  prices.append(el("span", "price-was", formatMoney(deal.was)));
  prices.append(el("span", "price-off", `-${discountPct(deal)}%`));
  wrap.append(prices);
  wrap.append(el("p", "card-saves", `You save ${formatMoney(savings(deal))} against the usual price.`));

  const why = el("section", "why-box");
  why.append(el("h3", "", `Why this grade: ${SIGNAL_LABEL[deal.signal]}`));
  why.append(el("p", "", deal.evidence));
  wrap.append(why);

  const facts = el("dl", "facts");
  const fact = (term, value) => {
    facts.append(el("dt", "", term));
    facts.append(el("dd", "", value));
  };
  fact("Store", deal.store);
  fact("Sale price", formatMoney(deal.price));
  fact("Usual price", formatMoney(deal.was));
  fact("Discount", `${discountPct(deal)}% off — you save ${formatMoney(savings(deal))}`);
  fact("Sale window", `Ends ${STORE_WINDOWS[deal.store]} — ${deal.store}'s Black Friday window`);
  fact("Price checked", fmtChecked(deal.checked));
  fact("Read from", deal.source);
  wrap.append(facts);

  // The seller container: who sells it, the price there, and the way out to
  // the store's own website.
  const seller = el("section", "seller-box");
  const sellerHead = el("div", "seller-head");
  sellerHead.append(el("span", "seller-label", "Sold by"));
  sellerHead.append(el("span", "seller-name", deal.store));
  sellerHead.append(
    el("span", "seller-price", `${formatMoney(deal.price)} · −${discountPct(deal)}%`),
  );
  seller.append(sellerHead);
  const cta = el("a", "cta-link", `Visit ${deal.store} →`);
  cta.href = deal.url;
  cta.target = "_blank";
  cta.rel = "noopener";
  seller.append(cta);
  seller.append(
    el("p", "seller-note", `Opens this product on ${deal.store}'s website. Price checked ${fmtChecked(deal.checked)}.`),
  );
  wrap.append(seller);

  const others = allDeals.filter((d) => d.title === deal.title && d.id !== deal.id);
  if (others.length > 0) {
    const alt = el("section", "alt-box");
    alt.append(el("h3", "", "The same product at other stores"));
    for (const other of others) {
      const line = el("p", "alt-line");
      const a = el("a", "", `${other.store}: ${formatMoney(other.price)} (was ${formatMoney(other.was)})`);
      a.href = `#/deal/${other.id}`;
      line.append(a);
      line.append(el("span", "", ` — graded ${SIGNAL_LABEL[other.signal].toLowerCase()}.`));
      alt.append(line);
    }
    wrap.append(alt);
  }
  container.append(wrap);
}

// The day's five best deals as a ranked strip — the board's front door.
export function renderTop5(container, deals) {
  container.replaceChildren();
  const head = el("div", "top5-head");
  head.append(el("h2", "top5-title", "Top 5 today"));
  head.append(el("span", "top5-note", "Ranked by cut, savings and honesty grade"));
  container.append(head);
  const list = el("ol", "top5-list");
  [...deals]
    .sort((a, b) => scoreDeal(b) - scoreDeal(a))
    .slice(0, 5)
    .forEach((deal, i) => {
      const row = el("li", "top5-row");
      row.append(el("span", "top5-rank", String(i + 1)));
      const link = el("a", "top5-link", deal.title);
      link.href = `#/deal/${deal.id}`;
      row.append(link);
      row.append(el("span", "top5-store", deal.store));
      row.append(el("span", "top5-price", `${formatMoney(deal.price)} · −${discountPct(deal)}%`));
      list.append(row);
    });
  container.append(list);
}
