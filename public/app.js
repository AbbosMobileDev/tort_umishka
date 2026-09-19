/**
 * TortBot Mini App.
 *
 * Ekranlar: katalog -> mahsulot -> sana -> vaqt -> yetkazish -> (telefon) -> hisob -> to'lov.
 * Holat bitta `state` obyektida; har o'zgarishdan keyin `render()` chaqiriladi.
 *
 * Matnlar serverdan keladi (`/api/bootstrap` -> `src/texts/webapp-uz.ts`), shuning uchun
 * bu faylda foydalanuvchiga ko'rinadigan satr yozilmaydi.
 */
import { calcPrice, formatKg, formatSom } from '/price.js';

const tg = window.Telegram?.WebApp;
const screenEl = document.getElementById('screen');
const actionEl = document.getElementById('actionbar');
const tabbarEl = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

/** Serverdan kelgan matnlar lug'ati. */
let S = {};
let data = null;

const state = {
  view: 'catalog',
  stack: [],
  categoryId: null,
  draft: null,
  dates: null,
  datesLoading: false,
  quote: null,
  order: null,
  orders: null,
  busy: false,
  error: '',
  errorText: '',
};

/* ------------------------------------------------------------------ utils */

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** '{kg} sig'adi' + {kg: '2 kg'} → '2 kg sig'adi' */
const fmt = (tpl, vars) =>
  String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

const haptic = (type = 'light') => {
  try {
    if (type === 'success' || type === 'error') tg?.HapticFeedback?.notificationOccurred(type);
    else tg?.HapticFeedback?.impactOccurred(type);
  } catch {
    /* eski Telegram versiyasi */
  }
};

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Init-Data': tg?.initData ?? '',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    /* bo'sh javob */
  }
  if (!res.ok) {
    const err = new Error(payload.error || S.errorGeneric || 'error');
    err.code = payload.code;
    err.status = res.status;
    throw err;
  }
  return payload;
}

/* ------------------------------------------------------------- navigation */

function go(view) {
  state.stack.push(state.view);
  state.view = view;
  state.error = '';
  window.scrollTo(0, 0);
  render();
}

function back() {
  // Hisob ekranida sana 15 daqiqaga band qilingan edi — ortga qaytsa bo'shatiladi.
  if (state.view === 'summary') {
    state.quote = null;
    void api('/api/hold/cancel', { method: 'POST' }).catch(() => undefined);
  }
  if (!state.stack.length) {
    tg?.close();
    return;
  }
  state.view = state.stack.pop();
  state.error = '';
  window.scrollTo(0, 0);
  render();
}

function switchTab(tab) {
  state.stack = [];
  state.view = tab;
  state.error = '';
  window.scrollTo(0, 0);
  if (tab === 'orders') void loadOrders();
  render();
}

/* ---------------------------------------------------------------- helpers */

const product = () => data?.products.find((p) => p.id === state.draft?.productId) ?? null;

function optionGroups(p) {
  const groups = [];
  for (const o of p.options) {
    let g = groups.find((x) => x.name === o.groupName);
    if (!g) groups.push((g = { name: o.groupName, items: [] }));
    g.items.push(o);
  }
  return groups;
}

function selectedOptions() {
  const p = product();
  if (!p) return [];
  return Object.values(state.draft.options)
    .map((id) => p.options.find((o) => o.id === id))
    .filter(Boolean);
}

/** Ko'rsatish uchun narx. Buyurtmadagi haqiqiy summani server hisoblaydi. */
function localPrice() {
  const p = product();
  if (!p || !state.draft?.weightKg) return null;
  return calcPrice({
    pricePerKg: p.pricePerKg,
    weightKg: state.draft.weightKg,
    options: selectedOptions(),
    hasInscription: Boolean(state.draft.inscription),
    inscriptionPrice: data.shop.inscriptionPrice,
    deliveryFee: state.draft.deliveryType === 'delivery' ? data.shop.deliveryFee : 0,
    prepaymentPercent: data.shop.prepaymentPercent,
  });
}

function startDraft(productId) {
  const p = data.products.find((x) => x.id === productId);
  const options = {};
  // Har guruhdan birinchisi oldindan tanlangan — mijoz faqat o'zgartirmoqchi bo'lsa tegadi.
  for (const g of optionGroups(p)) options[g.name] = g.items[0].id;
  state.draft = {
    productId,
    weightKg: p.weightOptions[0] ?? p.minKg,
    customWeight: false,
    options,
    inscription: '',
    inscriptionOn: false,
    date: null,
    timeSlot: null,
    deliveryType: null,
    addressText: '',
    addressNote: '',
    phone: data.customer.phone ?? '',
  };
  state.dates = null;
  state.quote = null;
  try {
    tg?.enableClosingConfirmation?.();
  } catch {
    /* ixtiyoriy */
  }
}

/* ----------------------------------------------------------------- views */

function viewCatalog() {
  const cats = data.categories;
  const list = state.categoryId
    ? data.products.filter((p) => p.categoryId === state.categoryId)
    : data.products;

  const chips = [
    `<button class="chip" data-act="cat" data-id="" aria-pressed="${!state.categoryId}">${esc(S.catalogAll)}</button>`,
    ...cats.map(
      (c) =>
        `<button class="chip" data-act="cat" data-id="${c.id}" aria-pressed="${state.categoryId === c.id}">${esc(c.name)}</button>`,
    ),
  ].join('');

  const cards = list
    .map(
      (p) => `
      <button class="card" data-act="product" data-id="${p.id}">
        <div class="card__media${p.photoUrl ? '' : ' card__media--empty'}">
          ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}" loading="lazy" />` : ''}
        </div>
        <div class="card__body">
          <div class="card__name">${esc(p.name)}</div>
          <div class="card__price"><b>${esc(formatSom(p.pricePerKg))}</b>${esc(S.perKgSuffix)}</div>
        </div>
      </button>`,
    )
    .join('');

  return `
    <header class="hero">
      <h1 class="hero__name">${esc(data.shop.name)}</h1>
      <p class="hero__sub">${esc(S.catalogSubtitle)}</p>
    </header>
    ${cats.length > 1 ? `<div class="chips">${chips}</div>` : ''}
    ${
      list.length
        ? `<div class="grid view-enter">${cards}</div>`
        : `<div class="empty"><div class="empty__mark">🎂</div><p>${esc(S.catalogEmpty)}</p></div>`
    }`;
}

function viewProduct() {
  const p = product();
  const d = state.draft;

  const weights = p.weightOptions
    .map(
      (kg) =>
        `<button class="pill" data-act="weight" data-kg="${kg}" aria-pressed="${!d.customWeight && d.weightKg === kg}">${esc(formatKg(kg))}</button>`,
    )
    .join('');

  const groups = optionGroups(p)
    .map(
      (g) => `
      <section class="block">
        <h2 class="block__title">${esc(g.name)}</h2>
        <div class="opts">
          ${g.items
            .map((o) => {
              const extra =
                o.extraPrice === 0
                  ? S.free
                  : `+${formatSom(o.priceType === 'per_kg' ? o.extraPrice * d.weightKg : o.extraPrice)}`;
              return `<button class="opt" data-act="option" data-group="${esc(g.name)}" data-id="${o.id}" aria-pressed="${d.options[g.name] === o.id}">
                  <span class="opt__mark"></span>
                  <span class="opt__name">${esc(o.optionName)}</span>
                  <span class="opt__extra">${esc(extra)}</span>
                </button>`;
            })
            .join('')}
        </div>
      </section>`,
    )
    .join('');

  return `
    <div class="sheet__hero${p.photoUrl ? '' : ' card__media--empty'}">
      ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}" />` : ''}
    </div>
    <h1 class="sheet__title">${esc(p.name)}</h1>
    ${p.description ? `<p class="sheet__desc">${esc(p.description)}</p>` : ''}
    <p class="sheet__price">${esc(S.perKg)} — ${esc(formatSom(p.pricePerKg))}</p>

    <section class="block">
      <h2 class="block__title">${esc(S.stepWeight)}</h2>
      <div class="pills">
        ${weights}
        <button class="pill" data-act="weight-other" aria-pressed="${d.customWeight}">${esc(S.weightOther)}</button>
      </div>
      ${
        d.customWeight
          ? `<div class="field">
               <input class="input${state.error === 'weight' ? ' input--error' : ''}" type="text"
                      inputmode="decimal" data-act="weight-input"
                      value="${esc(d.customWeightText ?? '')}"
                      placeholder="${esc(S.weightCustomPlaceholder)}" />
               ${
                 state.error === 'weight'
                   ? `<p class="error">${esc(fmt(S.weightInvalid, { min: formatKg(p.minKg), max: formatKg(p.maxKg) }))}</p>`
                   : ''
               }
             </div>`
          : ''
      }
    </section>

    ${groups}

    <section class="block">
      <h2 class="block__title">${esc(S.stepInscription)}</h2>
      <button class="switch" data-act="inscription-toggle" aria-pressed="${d.inscriptionOn}">
        <span class="switch__label">${esc(S.inscriptionToggle)}</span>
        <span class="opt__extra">+${esc(formatSom(data.shop.inscriptionPrice))}</span>
        <span class="switch__track"></span>
      </button>
      ${
        d.inscriptionOn
          ? `<div class="field">
               <input class="input" type="text" maxlength="40" data-act="inscription-input"
                      value="${esc(d.inscription)}" placeholder="${esc(S.inscriptionPlaceholder)}" />
               <p class="hint">${esc(S.inscriptionHint)}</p>
             </div>`
          : ''
      }
    </section>`;
}

function viewDate() {
  if (state.datesLoading || !state.dates) {
    return `
      <h1 class="sheet__title">${esc(S.stepDate)}</h1>
      <div class="days">${'<div class="skeleton" style="height:92px"></div>'.repeat(9)}</div>`;
  }
  if (!state.dates.length) {
    return `
      <h1 class="sheet__title">${esc(S.stepDate)}</h1>
      <div class="empty"><div class="empty__mark">📅</div><p>${esc(S.dateEmpty)}</p></div>`;
  }
  return `
    <h1 class="sheet__title">${esc(S.stepDate)}</h1>
    <p class="sheet__desc">${esc(fmt(S.dateHint, { kg: formatKg(state.draft.weightKg) }))}</p>
    <div class="days view-enter">
      ${state.dates
        .map(
          (d) => `
        <button class="day" data-act="date" data-date="${esc(d.date)}" aria-pressed="${state.draft.date === d.date}">
          <div class="day__wd">${esc(d.weekday)}</div>
          <div class="day__num">${d.day}</div>
          <div class="day__mo">${esc(d.month)}</div>
          ${d.slotsForRequest <= 2 ? `<div class="day__left">${esc(fmt(S.dateFewLeft, { n: d.slotsForRequest }))}</div>` : ''}
        </button>`,
        )
        .join('')}
    </div>`;
}

function viewTime() {
  return `
    <h1 class="sheet__title">${esc(S.stepTime)}</h1>
    <p class="sheet__desc">${esc(state.dates?.find((d) => d.date === state.draft.date)?.labelLong ?? '')}</p>
    <div class="block view-enter">
      ${data.shop.timeSlots
        .map(
          (slot) => `
        <button class="choice" data-act="time" data-slot="${esc(slot)}" aria-pressed="${state.draft.timeSlot === slot}">
          <span class="choice__icon">🕒</span>
          <span><span class="choice__title">${esc(slot)}</span></span>
        </button>`,
        )
        .join('')}
    </div>`;
}

function viewDelivery() {
  const d = state.draft;
  return `
    <h1 class="sheet__title">${esc(S.stepDelivery)}</h1>
    <div class="block">
      <button class="choice" data-act="delivery" data-type="pickup" aria-pressed="${d.deliveryType === 'pickup'}">
        <span class="choice__icon">🏠</span>
        <span>
          <span class="choice__title">${esc(S.pickupTitle)}</span>
          <span class="choice__desc">${esc(S.pickupDesc)}</span>
        </span>
      </button>
      <button class="choice" data-act="delivery" data-type="delivery" aria-pressed="${d.deliveryType === 'delivery'}">
        <span class="choice__icon">🚚</span>
        <span>
          <span class="choice__title">${esc(S.deliveryTitle)}</span>
          <span class="choice__desc">${esc(S.deliveryDesc)}</span>
        </span>
        <span class="choice__fee">${esc(formatSom(data.shop.deliveryFee))}</span>
      </button>
    </div>
    ${
      d.deliveryType === 'delivery'
        ? `<section class="block view-enter">
             <div class="field">
               <label class="field__label">${esc(S.addressLabel)}</label>
               <input class="input${state.error === 'address' ? ' input--error' : ''}" type="text"
                      data-act="address-input" value="${esc(d.addressText)}"
                      placeholder="${esc(S.addressPlaceholder)}" />
               ${state.error === 'address' ? `<p class="error">${esc(S.addressRequired)}</p>` : ''}
             </div>
             <div class="field">
               <label class="field__label">${esc(S.addressNoteLabel)}</label>
               <input class="input" type="text" data-act="note-input" value="${esc(d.addressNote)}"
                      placeholder="${esc(S.addressNotePlaceholder)}" />
             </div>
           </section>`
        : ''
    }`;
}

function viewPhone() {
  return `
    <h1 class="sheet__title">${esc(S.stepPhone)}</h1>
    <p class="sheet__desc">${esc(S.phoneHint)}</p>
    <div class="block">
      <input class="input${state.error === 'phone' ? ' input--error' : ''}" type="tel"
             inputmode="tel" data-act="phone-input" value="${esc(state.draft.phone)}"
             placeholder="${esc(S.phonePlaceholder)}" />
      ${state.error === 'phone' ? `<p class="error">${esc(S.phoneInvalid)}</p>` : ''}
      <button class="btn btn--ghost btn--wide" data-act="phone-request">${esc(S.phoneShare)}</button>
    </div>`;
}

function viewSummary() {
  const d = state.draft;
  const p = product();
  const price = state.quote ?? localPrice();
  const day = state.dates?.find((x) => x.date === d.date);

  const row = (key, val, cls = '') => `
    <div class="row ${cls}">
      <span class="row__key">${esc(key)}</span>
      <span class="row__dots"></span>
      <span class="row__val">${esc(val)}</span>
    </div>`;

  const optionRows = price.optionLines
    .map((l) => row(l.label, l.amount > 0 ? formatSom(l.amount) : S.free))
    .join('');

  return `
    <h1 class="sheet__title">${esc(S.stepSummary)}</h1>
    <div class="receipt view-enter">
      <h2 class="receipt__head">${esc(p.name)}</h2>
      <div class="rows">
        ${row(formatKg(d.weightKg), formatSom(price.base))}
        ${optionRows}
        ${d.inscription ? row(`${S.sumInscription}: "${d.inscription}"`, formatSom(price.inscription)) : ''}
        ${d.deliveryType === 'delivery' ? row(S.sumDelivery, formatSom(price.delivery)) : ''}
        ${row(S.sumTotal, formatSom(price.total), 'row--total')}
        ${row(S.sumPrepaid, formatSom(price.prepaid), 'row--accent')}
        ${row(S.sumRemaining, formatSom(price.remaining))}
      </div>
    </div>

    <div class="info" style="margin-top:14px">
      <div class="info__row">
        <span class="info__icon">📅</span>
        <span><span class="info__key">${esc(S.sumWhen)}</span><br /><span class="info__val">${esc(`${day?.labelLong ?? d.date}, ${d.timeSlot}`)}</span></span>
      </div>
      <div class="info__row">
        <span class="info__icon">${d.deliveryType === 'delivery' ? '🚚' : '🏠'}</span>
        <span><span class="info__key">${esc(d.deliveryType === 'delivery' ? S.sumWhere : S.stepDelivery)}</span><br />
        <span class="info__val">${esc(d.deliveryType === 'delivery' ? d.addressText : S.pickupTitle)}</span></span>
      </div>
      <div class="info__row">
        <span class="info__icon">📱</span>
        <span><span class="info__key">${esc(S.sumPhone)}</span><br /><span class="info__val">${esc(d.phone)}</span></span>
      </div>
    </div>
    ${state.error === 'submit' ? `<p class="error">${esc(state.errorText ?? S.errorGeneric)}</p>` : ''}`;
}

function viewPayment() {
  const o = state.order;
  return `
    <div class="payhead view-enter">
      <div class="payhead__mark">🎉</div>
      <h1 class="payhead__title">${esc(S.paymentTitle)}</h1>
      <p class="payhead__sub">${esc(fmt(S.paymentOrderNo, { n: o.orderNumber }))}</p>
    </div>
    <div class="amount">
      <div class="amount__label">${esc(S.paymentAmount)}</div>
      <div class="amount__value">${esc(formatSom(o.prepaid))}</div>
    </div>
    ${
      o.card
        ? `<div class="cardbox">
             <div>
               <div class="cardbox__holder">${esc(S.paymentCard)}</div>
               <div class="cardbox__num">${esc(o.card)}</div>
               ${o.cardHolder ? `<div class="cardbox__holder">${esc(o.cardHolder)}</div>` : ''}
             </div>
             <button class="cardbox__copy" data-act="copy-card" data-card="${esc(o.card)}">${esc(S.paymentCopy)}</button>
           </div>`
        : `<p class="hint" style="text-align:center">${esc(S.paymentNoCard)}</p>`
    }
    <ol class="steps">
      <li>${esc(S.paymentStep1)}</li>
      <li>${esc(S.paymentStep2)}</li>
      <li>${esc(S.paymentStep3)}</li>
    </ol>
    <button class="btn btn--ghost btn--wide" data-act="home">${esc(S.tabCatalog)}</button>`;
}

function viewOrders() {
  if (!state.orders) {
    return `<header class="hero"><h1 class="hero__name">${esc(S.tabOrders)}</h1></header>
      ${'<div class="skeleton" style="height:120px;margin-bottom:11px"></div>'.repeat(3)}`;
  }
  if (!state.orders.length) {
    return `<header class="hero"><h1 class="hero__name">${esc(S.tabOrders)}</h1></header>
      <div class="empty">
        <div class="empty__mark">🧾</div>
        <div class="empty__title">${esc(S.ordersEmpty)}</div>
        <p>${esc(S.ordersEmptyHint)}</p>
      </div>`;
  }
  const badge = (o) =>
    o.status === 'COMPLETED' ? 'badge--done' : o.status === 'CANCELLED' ? '' : 'badge--live';

  return `
    <header class="hero"><h1 class="hero__name">${esc(S.tabOrders)}</h1></header>
    <div class="view-enter">
      ${state.orders
        .map(
          (o) => `
        <article class="order">
          <div class="order__top">
            <span class="order__no">#${o.orderNumber}</span>
            <span class="badge ${badge(o)}">${esc(o.statusLabel)}</span>
          </div>
          <div class="order__name">${esc(o.productName)}, ${esc(formatKg(o.weightKg))}</div>
          <div class="order__meta">${esc(`${o.dateLabel}${o.timeSlot ? `, ${o.timeSlot}` : ''}`)}</div>
          <div class="order__foot">
            <span class="order__total">${esc(formatSom(o.total))}</span>
            <span class="order__rest">${esc(S.orderRemaining)}: ${esc(formatSom(o.remaining))}</span>
          </div>
        </article>`,
        )
        .join('')}
    </div>`;
}

function viewContact() {
  const s = data.shop;
  const info = [
    [
      '☎️',
      S.contactPhoneLabel,
      s.contactPhone ?? S.contactNoPhone,
    ],
    ['📆', S.contactHours, s.workingDays.join(', ')],
    ['🕒', S.contactSlots, s.timeSlots.join(' · ')],
  ];
  return `
    <header class="hero">
      <h1 class="hero__name">${esc(s.name)}</h1>
      <p class="hero__sub">${esc(S.tabContact)}</p>
    </header>
    <div class="info view-enter">
      ${info
        .map(
          ([icon, key, val]) => `
        <div class="info__row">
          <span class="info__icon">${icon}</span>
          <span><span class="info__key">${esc(key)}</span><br /><span class="info__val">${esc(val)}</span></span>
        </div>`,
        )
        .join('')}
    </div>
    <ul class="steps steps--facts">
      <li>${esc(fmt(S.contactPrepayment, { percent: s.prepaymentPercent }))}</li>
      <li>${esc(fmt(S.contactLeadTime, { hours: s.leadTimeHours }))}</li>
      <li>${esc(fmt(S.contactDeliveryFee, { fee: formatSom(s.deliveryFee) }))}</li>
    </ul>
    <button class="btn btn--wide" data-act="close">${esc(S.contactWrite)}</button>`;
}

/* ---------------------------------------------------------------- render */

const TABS = [
  { id: 'catalog', icon: '🎂', key: 'tabCatalog' },
  { id: 'orders', icon: '🧾', key: 'tabOrders' },
  { id: 'contact', icon: '☎️', key: 'tabContact' },
];

const VIEWS = {
  catalog: viewCatalog,
  orders: viewOrders,
  contact: viewContact,
  product: viewProduct,
  date: viewDate,
  time: viewTime,
  delivery: viewDelivery,
  phone: viewPhone,
  summary: viewSummary,
  payment: viewPayment,
};

/** Pastki tugma: qaysi ekranda qanday amal bo'lishi. */
function actionFor(view) {
  if (view === 'product') {
    const price = localPrice();
    return {
      label: S.btnContinue,
      act: 'to-date',
      price: price ? price.total : null,
      disabled: !price,
    };
  }
  if (view === 'delivery') {
    return { label: S.btnContinue, act: 'from-delivery', disabled: !state.draft.deliveryType };
  }
  if (view === 'phone') {
    return { label: S.btnContinue, act: 'from-phone' };
  }
  if (view === 'summary') {
    const price = state.quote ?? localPrice();
    return {
      label: state.busy ? S.confirming : S.btnConfirm,
      act: 'submit',
      price: price ? price.total : null,
      disabled: state.busy,
    };
  }
  if (view === 'payment') {
    return { label: S.btnSendReceipt, act: 'close' };
  }
  return null;
}

function render() {
  const view = VIEWS[state.view];
  screenEl.innerHTML = view ? view() : '';

  const action = actionFor(state.view);
  if (action) {
    actionEl.hidden = false;
    actionEl.innerHTML = `
      ${
        action.price != null
          ? `<div class="actionbar__price">
               <div class="actionbar__label">${esc(S.priceTotal)}</div>
               <div class="actionbar__value">${esc(formatSom(action.price))}</div>
             </div>`
          : ''
      }
      <button class="btn" data-act="${action.act}" ${action.disabled ? 'disabled' : ''}>${esc(action.label)}</button>`;
  } else {
    actionEl.hidden = true;
    actionEl.innerHTML = '';
  }

  const isTab = TABS.some((t) => t.id === state.view);
  tabbarEl.hidden = !isTab;
  if (isTab) {
    tabbarEl.innerHTML = TABS.map(
      (t) => `
      <button class="tab" data-act="tab" data-tab="${t.id}" aria-selected="${state.view === t.id}">
        <span class="tab__icon">${t.icon}</span>
        <span>${esc(S[t.key])}</span>
      </button>`,
    ).join('');
  }

  screenEl.classList.toggle('screen--action', Boolean(action));

  if (state.stack.length) tg?.BackButton?.show();
  else tg?.BackButton?.hide();
}

/* ---------------------------------------------------------------- actions */

async function loadDates() {
  state.datesLoading = true;
  render();
  try {
    const res = await api(`/api/dates?kg=${encodeURIComponent(state.draft.weightKg)}`);
    state.dates = res.days;
  } catch (e) {
    state.dates = [];
    toast(e.message);
  } finally {
    state.datesLoading = false;
    render();
  }
}

async function loadOrders() {
  try {
    const res = await api('/api/orders');
    state.orders = res.orders;
  } catch (e) {
    state.orders = [];
    toast(e.message);
  }
  render();
}

/** Hisob ekraniga o'tishdan oldin: narx serverdan, sana 15 daqiqaga band qilinadi. */
async function openSummary() {
  go('summary');
  try {
    const res = await api('/api/quote', { method: 'POST', body: draftPayload() });
    state.quote = res.price;
  } catch (e) {
    toast(e.message);
  }
  render();
}

function draftPayload() {
  const d = state.draft;
  return {
    productId: d.productId,
    weightKg: d.weightKg,
    optionIds: Object.values(d.options),
    inscription: d.inscriptionOn ? d.inscription : '',
    date: d.date,
    timeSlot: d.timeSlot,
    deliveryType: d.deliveryType,
    addressText: d.addressText,
    addressNote: d.addressNote,
    phone: d.phone,
  };
}

async function submitOrder() {
  if (state.busy) return;
  state.busy = true;
  state.error = '';
  render();
  try {
    state.order = await api('/api/order', { method: 'POST', body: draftPayload() });
    haptic('success');
    try {
      tg?.disableClosingConfirmation?.();
    } catch {
      /* ixtiyoriy */
    }
    // Orqaga qaytish katalogga olib chiqsin: buyurtma oqimi tugadi.
    state.stack = ['catalog'];
    state.view = 'payment';
    state.orders = null;
    window.scrollTo(0, 0);
  } catch (e) {
    haptic('error');
    if (e.code === 'SLOT_TAKEN') {
      state.dates = null;
      state.quote = null;
      state.draft.date = null;
      toast(e.message);
      state.stack = ['catalog', 'product'];
      state.view = 'date';
      void loadDates();
    } else {
      state.error = 'submit';
      state.errorText = e.message;
      toast(e.message);
    }
  } finally {
    state.busy = false;
    render();
  }
}

/* ----------------------------------------------------------------- events */

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  const d = state.draft;

  switch (act) {
    case 'tab':
      haptic();
      switchTab(target.dataset.tab);
      return;

    case 'cat':
      haptic();
      state.categoryId = target.dataset.id ? Number(target.dataset.id) : null;
      render();
      return;

    case 'product':
      haptic();
      startDraft(Number(target.dataset.id));
      go('product');
      return;

    case 'weight':
      haptic();
      d.weightKg = Number(target.dataset.kg);
      d.customWeight = false;
      state.error = '';
      state.dates = null;
      render();
      return;

    case 'weight-other':
      haptic();
      d.customWeight = true;
      render();
      return;

    case 'option':
      haptic();
      d.options[target.dataset.group] = Number(target.dataset.id);
      render();
      return;

    case 'inscription-toggle':
      haptic();
      d.inscriptionOn = !d.inscriptionOn;
      if (!d.inscriptionOn) d.inscription = '';
      render();
      return;

    case 'to-date':
      if (!validateWeight()) return;
      haptic();
      go('date');
      if (!state.dates) void loadDates();
      return;

    case 'date':
      haptic();
      d.date = target.dataset.date;
      go('time');
      return;

    case 'time':
      haptic();
      d.timeSlot = target.dataset.slot;
      go('delivery');
      return;

    case 'delivery':
      haptic();
      d.deliveryType = target.dataset.type;
      state.error = '';
      render();
      return;

    case 'from-delivery':
      if (d.deliveryType === 'delivery' && !d.addressText.trim()) {
        state.error = 'address';
        haptic('error');
        render();
        return;
      }
      haptic();
      if (!d.phone) go('phone');
      else void openSummary();
      return;

    case 'from-phone':
      if (!/^\+?998\d{9}$/.test(d.phone.replace(/[\s()-]/g, ''))) {
        state.error = 'phone';
        haptic('error');
        render();
        return;
      }
      haptic();
      void openSummary();
      return;

    case 'phone-request':
      requestContact();
      return;

    case 'submit':
      void submitOrder();
      return;

    case 'copy-card':
      copyText(target.dataset.card);
      return;

    case 'home':
      haptic();
      switchTab('catalog');
      return;

    case 'close':
      tg?.close();
      return;

    default:
  }
});

/** Matn maydonlari: har bosishda render bo'lmasin, faqat qiymat saqlanadi. */
document.addEventListener('input', (event) => {
  const target = event.target.closest('[data-act]');
  if (!target || !state.draft) return;
  const d = state.draft;
  switch (target.dataset.act) {
    case 'weight-input':
      d.customWeightText = target.value;
      d.weightKg = Number(target.value.replace(',', '.'));
      state.dates = null; // boshqa og'irlikka bo'sh kunlar ham boshqacha
      updateActionPrice();
      return;
    case 'inscription-input':
      d.inscription = target.value.slice(0, 40);
      updateActionPrice();
      return;
    case 'address-input':
      d.addressText = target.value;
      return;
    case 'note-input':
      d.addressNote = target.value;
      return;
    case 'phone-input':
      d.phone = target.value;
      return;
    default:
  }
});

/** Faqat pastki paneldagi summani yangilaydi — kiritish maydoni fokusni yo'qotmasin. */
function updateActionPrice() {
  const price = localPrice();
  const valueEl = actionEl.querySelector('.actionbar__value');
  const button = actionEl.querySelector('.btn');
  if (price && valueEl) valueEl.textContent = formatSom(price.total);
  if (button) button.toggleAttribute('disabled', !price);
}

function validateWeight() {
  const p = product();
  const kg = state.draft.weightKg;
  if (!Number.isFinite(kg) || kg < p.minKg || kg > p.maxKg) {
    state.error = 'weight';
    haptic('error');
    render();
    return false;
  }
  state.draft.weightKg = Math.round(kg * 100) / 100;
  return true;
}

function requestContact() {
  if (!tg?.requestContact) return;
  try {
    tg.requestContact((ok, event) => {
      const phone = event?.responseUnsafe?.contact?.phone_number;
      if (!ok || !phone) return;
      state.draft.phone = phone.startsWith('+') ? phone : `+${phone}`;
      state.error = '';
      render();
    });
  } catch {
    /* eski Telegram versiyasi — qo'lda yoziladi */
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const tmp = document.createElement('textarea');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
  }
  haptic('success');
  toast(S.paymentCopied);
}

/* ------------------------------------------------------------------ boot */

function applyTheme() {
  const dark = tg?.colorScheme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  try {
    tg?.setHeaderColor?.(bg);
    tg?.setBackgroundColor?.(bg);
  } catch {
    /* eski Telegram versiyasi rang qabul qilmaydi */
  }
}

async function boot() {
  try {
    tg?.ready();
    tg?.expand();
    tg?.BackButton?.onClick(back);
    tg?.onEvent?.('themeChanged', applyTheme);
  } catch {
    /* Telegramdan tashqarida ochilgan bo'lishi mumkin */
  }
  applyTheme();

  screenEl.innerHTML = `<div class="grid" style="padding-top:60px">${'<div class="skeleton skeleton--card"></div>'.repeat(4)}</div>`;

  try {
    data = await api('/api/bootstrap');
  } catch (e) {
    screenEl.innerHTML = `
      <div class="empty">
        <div class="empty__mark">⚠️</div>
        <p>${esc(e.message)}</p>
      </div>`;
    return;
  }
  S = data.texts;
  document.title = data.shop.name;
  render();
}

void boot();
