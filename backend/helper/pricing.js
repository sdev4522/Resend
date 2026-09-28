const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");

// Standard multi-month duration discounts: 1mo (0%), 3mo (5%), 6mo (10%), 12mo (15%)
const DURATION_DISCOUNT_RATES = {
  1: 0.0,
  3: 0.05,
  6: 0.10,
  12: 0.15,
};

/**
 * Validates a coupon code against current subtotal
 * @param {string} code - Coupon code
 * @param {number} subtotal - The subtotal amount before coupon
 * @returns {Promise<{ valid: boolean, coupon?: object, discountAmount: number, message?: string }>}
 */
async function validateCoupon(code, subtotal = 0) {
  if (!code || typeof code !== "string" || code.trim() === "") {
    return { valid: false, discountAmount: 0, message: "No coupon provided" };
  }

  const normalizedCode = code.trim().toUpperCase();
  const [coupon] = await query(
    `SELECT * FROM coupon WHERE UPPER(code) = ? LIMIT 1`,
    [normalizedCode]
  );

  if (!coupon) {
    return { valid: false, discountAmount: 0, message: "Invalid coupon code" };
  }

  if (!coupon.is_active) {
    return { valid: false, discountAmount: 0, message: "This coupon is no longer active" };
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, discountAmount: 0, message: "This coupon has expired" };
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, discountAmount: 0, message: "Coupon usage limit reached" };
  }

  const minAmount = parseFloat(coupon.min_amount || 0);
  if (subtotal < minAmount) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Coupon requires a minimum purchase of ${minAmount}`,
    };
  }

  let discount = 0;
  const couponValue = parseFloat(coupon.value || 0);

  if (coupon.type === "percentage") {
    discount = (subtotal * couponValue) / 100;
    if (coupon.max_discount && parseFloat(coupon.max_discount) > 0) {
      discount = Math.min(discount, parseFloat(coupon.max_discount));
    }
  } else if (coupon.type === "fixed") {
    discount = couponValue;
  }

  // Cap discount at subtotal to prevent negative amounts
  discount = Math.min(discount, subtotal);
  discount = Math.round(discount * 100) / 100;

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: couponValue,
      max_discount: coupon.max_discount,
      min_amount: coupon.min_amount,
    },
    discountAmount: discount,
    message: "Coupon applied successfully",
  };
}

const DEFAULT_SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", usdRate: 1.0, rate: 1.0, name: "US Dollar", enabled: true },
  { code: "INR", symbol: "₹", usdRate: 85.0, rate: 85.0, name: "Indian Rupee", enabled: true },
  { code: "EUR", symbol: "€", usdRate: 0.92, rate: 0.92, name: "Euro", enabled: true },
  { code: "GBP", symbol: "£", usdRate: 0.79, rate: 0.79, name: "British Pound", enabled: true },
  { code: "AED", symbol: "د.إ", usdRate: 3.67, rate: 3.67, name: "UAE Dirham", enabled: true },
  { code: "CAD", symbol: "C$", usdRate: 1.36, rate: 1.36, name: "Canadian Dollar", enabled: false },
  { code: "AUD", symbol: "A$", usdRate: 1.52, rate: 1.52, name: "Australian Dollar", enabled: false },
  { code: "SGD", symbol: "S$", usdRate: 1.34, rate: 1.34, name: "Singapore Dollar", enabled: false },
];

/**
 * Applies smart SaaS psychological rounding to avoid awkward conversion numbers like 417.50.
 * @param {number} amount - Raw converted amount
 * @param {string} currency - Currency code (e.g. INR, USD, EUR, etc.)
 * @param {string} [roundingMode='smart_saas'] - 'smart_saas' | 'whole_number' | 'exact'
 * @returns {number} Clean rounded amount
 */
function applySmartRounding(amount, currency = "USD", roundingMode = "smart_saas") {
  const normCurr = (currency || "USD").toUpperCase();

  if (roundingMode === "exact") {
    return Math.round(amount * 100) / 100;
  }

  if (normCurr === "INR") {
    // In India, subscription prices NEVER have decimals (no paise).
    const rounded = Math.round(amount);
    if (roundingMode === "whole_number" || rounded < 50) {
      return rounded;
    }
    // Smart SaaS Charm Pricing for INR:
    // e.g. 417.5 -> 399 or 449 or 499 (never 417.50)
    if (rounded >= 100 && rounded <= 2000) {
      const rem = rounded % 100;
      if (rem >= 20 && rem <= 70) {
        return Math.floor(rounded / 100) * 100 + 49;
      } else if (rem > 70) {
        return Math.floor(rounded / 100) * 100 + 99;
      } else {
        return Math.max(49, Math.floor(rounded / 100) * 100 - 1);
      }
    } else if (rounded > 2000) {
      const rem = rounded % 500;
      if (rem >= 200) {
        return Math.ceil(rounded / 500) * 500 - 1;
      } else {
        return Math.floor(rounded / 500) * 500 - 1;
      }
    }
    return rounded;
  }

  // For USD, EUR, GBP, AED:
  if (roundingMode === "smart_saas") {
    return Math.round(amount);
  }

  return Math.round(amount * 100) / 100;
}

/**
 * Retrieves currency settings and supported currencies from database.
 */
async function getCurrencySettings() {
  const [webPublic] = await query(
    `SELECT currency_code, currency_symbol, exchange_rate, other FROM web_public LIMIT 1`
  );

  const baseCode = (webPublic?.currency_code || "USD").toUpperCase();
  const baseSymbol = webPublic?.currency_symbol || "$";
  const baseExchangeRate = parseFloat(webPublic?.exchange_rate || 1.0) || 1.0;

  let supportedCurrencies = DEFAULT_SUPPORTED_CURRENCIES;
  let roundingMode = "smart_saas";

  if (webPublic?.other && typeof webPublic.other === "string") {
    try {
      const parsed = JSON.parse(webPublic.other);
      if (Array.isArray(parsed?.supported_currencies) && parsed.supported_currencies.length > 0) {
        supportedCurrencies = parsed.supported_currencies;
      }
      if (parsed?.rounding_mode) {
        roundingMode = parsed.rounding_mode;
      }
    } catch (_) {
      // Ignore parse errors, use defaults
    }
  }

  // Find base USD rate
  const baseItem = supportedCurrencies.find(
    (c) => c.code.toUpperCase() === baseCode
  );
  const baseUsdRate = parseFloat(baseItem?.usdRate || baseItem?.rate || 1.0) || 1.0;

  // Normalize currencies relative to baseCode while preserving intuitive usdRate
  const normalizedCurrencies = supportedCurrencies.map((c) => {
    const usdRate = parseFloat(c.usdRate || c.rate || 1.0) || 1.0;
    const relativeRate = Math.round((usdRate / baseUsdRate) * 10000) / 10000;
    return {
      ...c,
      usdRate,
      rate: c.code.toUpperCase() === baseCode ? 1.0 : relativeRate,
    };
  });

  // Ensure base currency is in supported list with active flag
  const hasBase = normalizedCurrencies.some(
    (c) => c.code.toUpperCase() === baseCode
  );
  if (!hasBase) {
    normalizedCurrencies.unshift({
      code: baseCode,
      symbol: baseSymbol,
      usdRate: 1.0,
      rate: 1.0,
      name: `${baseCode} Currency`,
      enabled: true,
    });
  }

  return {
    baseCode,
    baseSymbol,
    baseExchangeRate,
    roundingMode,
    supportedCurrencies: normalizedCurrencies,
  };
}
const PPP_BENCHMARKS = {
  USD: { ratio: 1.0, forexRate: 1.0, symbol: "$", name: "US Dollar" },
  INR: { ratio: 0.35, forexRate: 85.0, symbol: "₹", name: "Indian Rupee" },
  EUR: { ratio: 0.90, forexRate: 0.92, symbol: "€", name: "Euro" },
  GBP: { ratio: 0.80, forexRate: 0.79, symbol: "£", name: "British Pound" },
  AED: { ratio: 0.85, forexRate: 3.67, symbol: "د.إ", name: "UAE Dirham" },
  CAD: { ratio: 0.95, forexRate: 1.36, symbol: "C$", name: "Canadian Dollar" },
  AUD: { ratio: 0.95, forexRate: 1.52, symbol: "A$", name: "Australian Dollar" },
  SGD: { ratio: 0.90, forexRate: 1.34, symbol: "S$", name: "Singapore Dollar" },
};

/**
 * Snaps a raw INR amount to clean SaaS psychological charm prices.
 * e.g. 178 -> 149 or 199, 480 -> 499, 780 -> 799, 2300 -> 2499.
 * Never produces awkward decimals.
 * @param {number} val
 * @returns {number}
 */
function snapToCharmInr(val) {
  if (val <= 0) return 0;
  if (val < 100) return val <= 50 ? 49 : 99;
  if (val < 1500) {
    const hundreds = Math.floor(val / 100) * 100;
    const rem = val % 100;
    if (rem < 25) return Math.max(99, hundreds - 1);
    if (rem < 75) return hundreds + 49;
    return hundreds + 99;
  }
  const thousands = Math.floor(val / 1000) * 1000;
  const rem = val % 1000;
  if (rem < 250) return Math.max(999, thousands - 1);
  if (rem < 750) return thousands + 499;
  return thousands + 999;
}

/**
 * Suggests purchasing-power parity (PPP) adjusted prices based on a baseline USD price.
 * Follows SaaS charm pricing rules (INR ending in 49/99, USD/EUR/GBP whole integers or .99, AED in multiples of 5).
 * @param {number} usdPrice - Baseline USD price
 * @param {number} [strikeMultiplier=2.5] - Multiplier for strike price
 * @returns {Record<string, { amount: number, strikeAmount: number|null, ratio: number, symbol: string, name: string, note: string }>}
 */
function suggestPppPrices(usdPrice, strikeMultiplier = 2.5) {
  const baseUsd = parseFloat(usdPrice) || 0;
  const suggestions = {};

  for (const [code, meta] of Object.entries(PPP_BENCHMARKS)) {
    let amount = 0;
    let strikeAmount = 0;
    const strikeUsd = baseUsd * strikeMultiplier;

    if (code === "USD") {
      amount = baseUsd;
      strikeAmount = Math.round(strikeUsd);
    } else if (code === "INR") {
      // Indian market PPP: target effective price is ~35% of US baseline converted to INR
      const rawInr = baseUsd * meta.ratio * meta.forexRate;
      amount = snapToCharmInr(rawInr);
      const rawStrikeInr = strikeUsd * meta.ratio * meta.forexRate;
      strikeAmount = snapToCharmInr(rawStrikeInr);
    } else if (code === "EUR" || code === "GBP") {
      const raw = baseUsd * meta.ratio;
      amount = Math.max(1, Math.round(raw));
      strikeAmount = Math.max(amount + 1, Math.round(strikeUsd * meta.ratio));
    } else if (code === "AED") {
      const raw = baseUsd * meta.ratio * meta.forexRate;
      amount = Math.max(5, Math.round(raw / 5) * 5);
      strikeAmount = Math.max(amount + 10, Math.round((strikeUsd * meta.ratio * meta.forexRate) / 5) * 5);
    } else {
      const raw = baseUsd * meta.ratio * meta.forexRate;
      amount = Math.max(1, Math.round(raw));
      strikeAmount = Math.max(amount + 1, Math.round(strikeUsd * meta.ratio * meta.forexRate));
    }

    suggestions[code] = {
      amount,
      strikeAmount: strikeAmount > amount ? strikeAmount : null,
      ratio: meta.ratio,
      symbol: meta.symbol,
      name: meta.name,
      note: code === "INR" ? "PPP ~35% with clean SaaS charm endings (₹49/₹99)" : `PPP ~${Math.round(meta.ratio * 100)}% benchmark`,
    };
  }

  return suggestions;
}

/**
 * Authoritatively retrieves the fixed price for a plan in a target currency.
 * Dual-tier lookup architecture:
 * 1. Tier 1 (Explicit): Checks `plan_prices` relational table for exact match on (plan_id, currency_code, billing_period_days).
 * 2. Tier 2 (Fallback): If no explicit currency price exists, finds USD row (or plan.price), applies exchange rate, and performs smart SaaS rounding.
 *
 * @param {number|string} planId
 * @param {string} [targetCurrency="USD"]
 * @param {number} [durationDays=null]
 * @returns {Promise<{ amount: number, strikeAmount: number|null, currency: string, isExplicit: boolean, billingPeriodDays: number }>}
 */
async function getPlanPrice(planId, targetCurrency = "USD", durationDays = null) {
  const normCurrency = (targetCurrency || "USD").trim().toUpperCase();

  // Tier 1: Query plan_prices table
  const priceRows = await query(
    `SELECT * FROM plan_prices WHERE plan_id = ? AND UPPER(currency_code) = ? AND is_active = 1`,
    [planId, normCurrency]
  );

  let selectedRow = null;
  if (priceRows && priceRows.length > 0) {
    if (durationDays && priceRows.length > 1) {
      selectedRow = priceRows.reduce((closest, row) => {
        const diffClosest = Math.abs(closest.billing_period_days - durationDays);
        const diffRow = Math.abs(row.billing_period_days - durationDays);
        return diffRow < diffClosest ? row : closest;
      }, priceRows[0]);
    } else {
      selectedRow = priceRows[0];
    }
  }

  if (selectedRow) {
    return {
      amount: parseFloat(selectedRow.amount),
      strikeAmount: selectedRow.strike_amount ? parseFloat(selectedRow.strike_amount) : null,
      currency: selectedRow.currency_code.toUpperCase(),
      billingPeriodDays: parseInt(selectedRow.billing_period_days || 30, 10),
      isExplicit: true,
    };
  }

  // Tier 2 (Fallback): Query USD baseline from plan_prices or plan table
  const [usdRow] = await query(
    `SELECT * FROM plan_prices WHERE plan_id = ? AND UPPER(currency_code) = 'USD' AND is_active = 1 LIMIT 1`,
    [planId]
  );
  const [plan] = await query(`SELECT * FROM plan WHERE id = ? LIMIT 1`, [planId]);
  if (!plan && !usdRow) {
    throw new Error(`Plan ${planId} not found`);
  }

  const baselineUsd = usdRow ? parseFloat(usdRow.amount) : parseFloat(plan?.price || 0);
  const baselineStrikeUsd = usdRow?.strike_amount
    ? parseFloat(usdRow.strike_amount)
    : plan?.price_strike
    ? parseFloat(plan.price_strike)
    : null;

  const { supportedCurrencies, roundingMode } = await getCurrencySettings();
  const currConfig = supportedCurrencies.find((c) => c.code.toUpperCase() === normCurrency);
  const rate = parseFloat(currConfig?.rate || currConfig?.usdRate || 1.0) || 1.0;

  const convertedAmount = applySmartRounding(baselineUsd * rate, normCurrency, roundingMode);
  const convertedStrike = baselineStrikeUsd
    ? applySmartRounding(baselineStrikeUsd * rate, normCurrency, roundingMode)
    : null;

  return {
    amount: convertedAmount,
    strikeAmount: convertedStrike,
    currency: normCurrency,
    billingPeriodDays: parseInt(plan?.plan_duration_in_days || 30, 10),
    isExplicit: false, // Fallback tier
  };
}

/**
 * Calculates authoritative checkout price on backend.
 * Never trusts client amounts or discount values.
 * Uses `getPlanPrice` to fetch currency-wise fixed pricing.
 *
 * @param {object} params
 * @param {number|string} params.planId
 * @param {number} [params.durationMonths=1] - 1, 3, 6, or 12
 * @param {string} [params.couponCode]
 * @param {string} [params.targetCurrency] - Desired currency code (e.g. "INR", "USD", "EUR")
 * @returns {Promise<object>} Price breakdown
 */
async function calculateCheckoutPrice({ planId, durationMonths = 1, couponCode = null, targetCurrency = null }) {
  if (!planId) {
    throw new Error("Plan ID is required");
  }

  // Load authoritative plan from DB
  const [plan] = await query(`SELECT * FROM plan WHERE id = ? LIMIT 1`, [planId]);
  if (!plan) {
    throw new Error("Plan not found");
  }

  if (plan.is_trial) {
    throw new Error("Trial plans cannot be purchased through checkout");
  }

  // Fetch site currency settings
  const { baseCode, baseSymbol, supportedCurrencies } = await getCurrencySettings();

  let currency = baseCode;
  let currencySymbol = baseSymbol;

  // Check if target currency requested and enabled
  if (targetCurrency && typeof targetCurrency === "string") {
    const normTarget = targetCurrency.trim().toUpperCase();
    const matchedCurr = supportedCurrencies.find(
      (c) => c.code.toUpperCase() === normTarget && (c.enabled !== false)
    );
    if (matchedCurr) {
      currency = matchedCurr.code;
      currencySymbol = matchedCurr.symbol;
    }
  }

  // Validate duration months
  const validMonths = [1, 3, 6, 12];
  const months = validMonths.includes(Number(durationMonths)) ? Number(durationMonths) : 1;
  const planDaysPerMonth = parseInt(plan.plan_duration_in_days || 30, 10);
  const totalDays = planDaysPerMonth * months;

  // Fetch authoritative currency-wise fixed price
  const priceInfo = await getPlanPrice(planId, currency, totalDays);
  const planUnitPrice = priceInfo.amount;
  const planStrikePrice = priceInfo.strikeAmount;

  const baseSubtotal = Math.round(planUnitPrice * months * 100) / 100;

  // Calculate duration discount
  const durationDiscountRate = DURATION_DISCOUNT_RATES[months] || 0;
  const durationDiscount = Math.round(baseSubtotal * durationDiscountRate * 100) / 100;
  const subtotalAfterDuration = Math.round((baseSubtotal - durationDiscount) * 100) / 100;

  // Calculate coupon discount
  let couponDiscount = 0;
  let couponDetails = null;
  let couponMessage = null;

  if (couponCode && couponCode.trim() !== "") {
    const couponRes = await validateCoupon(couponCode, subtotalAfterDuration);
    if (couponRes.valid) {
      couponDiscount = couponRes.discountAmount;
      couponDetails = couponRes.coupon;
      couponMessage = couponRes.message;
    } else {
      couponMessage = couponRes.message;
    }
  }

  // Tax calculation placeholder (default 0% as per requirements, extensible)
  const taxRate = 0;
  const taxableAmount = Math.max(0, subtotalAfterDuration - couponDiscount);
  const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;

  // Final payable amount (strictly non-negative)
  const finalAmount = Math.max(0, Math.round((taxableAmount + taxAmount) * 100) / 100);

  // Minor units for payment gateway (e.g. paise / cents)
  const amountMinor = Math.round(finalAmount * 100);

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      price: planUnitPrice,
      priceStrike: planStrikePrice,
      basePriceOriginal: parseFloat(plan.price || 0),
      plan_duration_in_days: planDaysPerMonth,
      total_days: totalDays,
    },
    durationMonths: months,
    currency,
    currencySymbol,
    isExplicitPrice: priceInfo.isExplicit,
    baseSubtotal,
    durationDiscountRate,
    durationDiscount,
    subtotalAfterDuration,
    couponCode: couponDetails ? couponDetails.code : null,
    couponDiscount,
    couponMessage,
    taxRate,
    taxAmount,
    finalAmount,
    amountMinor,
  };
}

module.exports = {
  validateCoupon,
  calculateCheckoutPrice,
  getPlanPrice,
  suggestPppPrices,
  getCurrencySettings,
  applySmartRounding,
  snapToCharmInr,
  PPP_BENCHMARKS,
  DEFAULT_SUPPORTED_CURRENCIES,
  DURATION_DISCOUNT_RATES,
};

