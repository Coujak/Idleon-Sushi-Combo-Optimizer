// Only the player-set Wind threshold is editable; its ceiling is determined
// by the highest prepared sushi tier. Values below tier 6 cannot activate Wind.
export function windTierMaximum(preparedTier){
  const tier=Number(preparedTier);
  if(!Number.isFinite(tier))return 0;
  return Math.max(0,Math.min(64,Math.trunc(tier))-6);
}
export function clampWindTier(value,preparedTier){
  const upper=windTierMaximum(preparedTier);
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return Math.max(0,Math.min(upper,Math.trunc(n)));
}
