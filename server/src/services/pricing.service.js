/**
 * Pricing engine.
 *
 *   Gold Cost     = Net Weight * Gold Rate
 *   Diamond Cost  = Carat * Rate
 *   Gemstone Cost = Carat * Rate
 *   Making Charge = per_gram | fixed | percentage
 *   Subtotal      = sum of all costs + extras
 *   GST           = 3% (configurable via env GST_RATE)
 *   Final Price   = Subtotal + GST
 *
 * Pure function — no DB access. Caller passes all inputs.
 */
export function computePricing(input = {}) {
  const num = (v) => (Number.isFinite(+v) ? +v : 0);

  const netWeight     = num(input.net_weight);
  const goldRate      = num(input.gold_rate_per_gram);
  const diamondCarat  = num(input.diamond_carat);
  const diamondRate   = num(input.diamond_rate_per_carat);
  const gemstoneCarat = num(input.gemstone_carat);
  const gemstoneRate  = num(input.gemstone_rate_per_carat);

  const makingType  = input.making_charge_type || 'per_gram';
  const makingValue = num(input.making_charge_value);

  const hallmarkCharge      = num(input.hallmark_charge);
  const certificationCharge = num(input.certification_charge);
  const shippingCharge      = num(input.shipping_charge);

  const goldCost     = round2(netWeight * goldRate);
  const diamondCost  = round2(diamondCarat * diamondRate);
  const gemstoneCost = round2(gemstoneCarat * gemstoneRate);

  let makingCharge = 0;
  if (makingType === 'per_gram')        makingCharge = netWeight * makingValue;
  else if (makingType === 'fixed')      makingCharge = makingValue;
  else if (makingType === 'percentage') makingCharge = (goldCost + diamondCost + gemstoneCost) * (makingValue / 100);
  makingCharge = round2(makingCharge);

  const subtotal = round2(
    goldCost + diamondCost + gemstoneCost + makingCharge +
    hallmarkCharge + certificationCharge + shippingCharge
  );

  const gstRate   = num(input.gst_rate) || num(process.env.GST_RATE) || 0.03;
  const gstAmount = round2(subtotal * gstRate);
  const finalPrice = round2(subtotal + gstAmount);

  return {
    gold_cost: goldCost,
    diamond_cost: diamondCost,
    gemstone_cost: gemstoneCost,
    making_charge: makingCharge,
    hallmark_charge: hallmarkCharge,
    certification_charge: certificationCharge,
    shipping_charge: shippingCharge,
    subtotal,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    final_price: finalPrice
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
