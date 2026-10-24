(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.calculateConcreteEstimate = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function calculateConcreteEstimate(input) {
    const mode = input.mode || 'dims';
    const type = input.type || 'slab';
    const mixMode = input.mixMode || 'nominal';
    const ratio = Array.isArray(input.ratio) ? input.ratio.map(Number) : [];
    const wastePercent = Number(input.wastePercent);
    const dryFactor = Number(input.dryFactor);
    const density = Number(input.density);
    const bagKg = Number(input.bagKg);
    const quantity = Number(input.quantity);
    const finitePositive = value => Number.isFinite(value) && value > 0;

    if (!['dims', 'volume'].includes(mode)) return { ok: false, error: 'invalidMode' };
    if (!['nominal', 'custom'].includes(mixMode)) return { ok: false, error: 'invalidMixMode' };
    if (!ratio.length || ratio.length !== 3 || ratio.some(v => !finitePositive(v))) return { ok: false, error: 'invalidRatio' };
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 50) return { ok: false, error: 'invalidWaste' };
    if (!finitePositive(dryFactor) || dryFactor < 1) return { ok: false, error: 'invalidDryFactor' };
    if (!finitePositive(density)) return { ok: false, error: 'invalidMaterialSettings' };
    if (!finitePositive(bagKg)) return { ok: false, error: 'invalidMaterialSettings' };
    // Total-volume mode already receives the complete wet volume, so the
    // hidden element-count field must not affect validation or calculation.
    if (mode === 'dims' && (!Number.isInteger(quantity) || quantity < 1)) return { ok: false, error: 'invalidQuantity' };

    let wetVolume;
    if (mode === 'volume') {
      wetVolume = Number(input.totalVolume);
      if (!finitePositive(wetVolume)) return { ok: false, error: 'invalidTotalVolume' };
    } else {
      const length = Number(input.length);
      const width = Number(input.width);
      const thickness = Number(input.thickness);
      if (![length, width, thickness].every(finitePositive)) return { ok: false, error: 'invalidDimensions' };
      wetVolume = length * width * thickness * quantity;
    }
    if (!Number.isFinite(wetVolume) || wetVolume <= 0) return { ok: false, error: 'invalidWetVolume' };

    const wasteFactor = 1 + wastePercent / 100;
    let dryVolume = null;
    let cementVolume = null;
    let sandVolumeBeforeWaste;
    let aggregateVolumeBeforeWaste;
    let cementWeightRequired;
    let sandWeightRequired;
    let aggregateWeightRequired;
    let waterLitres;
    let admixtureAmount;
    let admixtureRateUnit;

    dryVolume = wetVolume * dryFactor;
    if (!Number.isFinite(dryVolume) || dryVolume <= 0) return { ok: false, error: 'invalidDryVolume' };
    const sum = ratio.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum) || sum <= 0) return { ok: false, error: 'invalidRatio' };
    cementVolume = dryVolume * ratio[0] / sum;
    sandVolumeBeforeWaste = dryVolume * ratio[1] / sum;
    aggregateVolumeBeforeWaste = dryVolume * ratio[2] / sum;
    cementWeightRequired = cementVolume * density;
    sandWeightRequired = null;
    aggregateWeightRequired = null;
    waterLitres = null;
    admixtureAmount = null;
    const cementWastageAllowance = cementWeightRequired * (wasteFactor - 1);
    const cementWeightWithWastage = cementWeightRequired + cementWastageAllowance;
    const cementBags = Math.ceil(cementWeightWithWastage / bagKg);
    const cementOrderWeight = cementBags * bagKg;
    const sandBaseQuantity = sandVolumeBeforeWaste;
    const aggregateBaseQuantity = aggregateVolumeBeforeWaste;
    const sandWastageAllowance = sandBaseQuantity * (wasteFactor - 1);
    const aggregateWastageAllowance = aggregateBaseQuantity * (wasteFactor - 1);
    const sandVolumeOrder = sandBaseQuantity + sandWastageAllowance;
    const aggregateVolumeOrder = aggregateBaseQuantity + aggregateWastageAllowance;

    const values = [cementVolume, sandBaseQuantity, aggregateBaseQuantity, cementWeightRequired, cementWastageAllowance, cementWeightWithWastage, cementOrderWeight, sandVolumeOrder, aggregateVolumeOrder].filter(v => v !== null);
    if (values.some(v => !Number.isFinite(v) || v < 0)) return { ok: false, error: 'invalidCalculatedQuantity' };
    return { ok: true, mode, type, mixMode, quantity: mode === 'dims' ? quantity : null, ratio, wasteFactor, wastePercent, wetVolume, dryVolume, cementVolume, cementWeightRequired, cementWastageAllowance, cementWeightWithWastage, cementBags, cementOrderWeight, sandVolumeBeforeWaste: sandBaseQuantity, sandWastageAllowance, sandVolumeOrder, aggregateVolumeBeforeWaste: aggregateBaseQuantity, aggregateWastageAllowance, aggregateVolumeOrder, quantityUnit: 'm³', sandWeightRequired, aggregateWeightRequired, waterLitres, admixtureAmount, admixtureRateUnit, admixtureTotalUnit: admixtureRateUnit };
  }
  return calculateConcreteEstimate;
});
