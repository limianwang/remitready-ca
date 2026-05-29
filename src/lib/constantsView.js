export function getInspectableRates(periods, activeRates, inspectedEffectivePeriod) {
  return periods.find((period) => period.effectivePeriod === inspectedEffectivePeriod) ?? activeRates;
}

export function getRatePeriodRows({
  periods,
  activeEffectivePeriod,
  inspectedEffectivePeriod
}) {
  return periods.map((period) => ({
    effectivePeriod: period.effectivePeriod,
    source: period.source,
    sourceUrl: period.sourceUrl,
    active: period.effectivePeriod === activeEffectivePeriod,
    inspected: period.effectivePeriod === inspectedEffectivePeriod
  }));
}
