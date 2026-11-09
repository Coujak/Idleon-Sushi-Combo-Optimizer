// Only the player-set Wind threshold is editable; its ceiling is determined
// by the highest prepared sushi tier. Values below tier 6 cannot activate Wind.
export function windTierMaximum(preparedTier){
  const tier=Number(preparedTier);
  if(!Number.isFinite(tier))return 0;
  return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.trunc(tier))-6);
}
export function clampWindTier(value,preparedTier){
  const upper=windTierMaximum(preparedTier);
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return Math.max(0,Math.min(upper,Math.trunc(n)));
}

// Follow the updated Wind ceiling if the player was using the previous
// ceiling; otherwise preserve their deliberately lower selection.
export function windTierAfterPreparedChange(currentWind,previousPreparedTier,nextPreparedTier){
  const oldMax=windTierMaximum(previousPreparedTier);
  const newMax=windTierMaximum(nextPreparedTier);
  const current=Number(currentWind);
  if(!Number.isFinite(current))return 0;
  return Math.trunc(current)===oldMax?newMax:clampWindTier(currentWind,nextPreparedTier);
}
