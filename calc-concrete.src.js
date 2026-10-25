/* calc-concrete.js — lazy-loaded calculator chunk. Loaded by app.js on first use
   (tab open or Calculate tap); registers its handler instead of running at startup. */
window.__calcHandlers = window.__calcHandlers || {};
window.__calcHandlers.concrete = function (ctx) {
  const { translations, fill, getCementBagMass, getCurrency, getWastageFactor, renderSessionTable, showError, sessionResults, lastCalcData, errorBox, formatMoney, formatQty } = ctx;
                /* ~4 m³ pickup/dump truck is how sand and gravel are sold —
                   show what fraction of a standard load the order is. */
                const truckLoadNote = (m3) => {
                    const loads = Number(m3) / 4;
                    if (!Number.isFinite(loads) || loads <= 0) return '';
                    if (loads >= 1) return fill(T.truckLoadMany, { f: String(Math.round(loads * 10) / 10) });
                    const fr = [[0.125, '\u215b'], [0.25, '\u00bc'], [1 / 3, '\u2153'], [0.375, '\u215c'], [0.5, '\u00bd'], [0.625, '\u215d'], [2 / 3, '\u2154'], [0.75, '\u00be'], [0.875, '\u215e']];
                    let best = fr[0];
                    fr.forEach(f => { if (Math.abs(f[0] - loads) < Math.abs(best[0] - loads)) best = f; });
                    return fill(T.truckLoadOne, { f: best[1] });
                };
                const lang = localStorage.getItem('language') || 'en';
                const T = translations[lang];
                
                let wetVolume, length, width, thickness;
                const mode = document.querySelector('input[name="concrete-mode"]:checked').value;
                const type = document.getElementById('concrete-type').value;
                const quantity = Number(document.getElementById('concrete-quantity').value);
                const mixMode = document.getElementById('concrete-mix-basis')?.value || 'nominal';
                const ratioText = mixMode === 'custom' ? document.getElementById('concrete-approved-ratio').value : document.getElementById('concrete-ratio').value;
                const ratio = ratioText.split(':').map(Number);
                const dryFactor = Number(document.getElementById('concrete-dry-factor').value);
                const cementDensity = Number(document.getElementById('concrete-cement-density').value);
                const cementCostRaw = document.getElementById('concrete-cement-cost').value.trim();
                const sandCostRaw = document.getElementById('concrete-sand-cost').value.trim();
                const aggregateCostRaw = document.getElementById('concrete-aggregate-cost').value.trim();
                const formworkCostRaw = document.getElementById('concrete-formwork-cost')?.value.trim() || '';
                const cementCost = cementCostRaw === '' ? null : Number(cementCostRaw);
                const sandCost = sandCostRaw === '' ? null : Number(sandCostRaw);
                const aggregateCost = aggregateCostRaw === '' ? null : Number(aggregateCostRaw);
                const formworkCostPerM2 = formworkCostRaw === '' ? null : Number(formworkCostRaw);
                const wastageFactor = getWastageFactor();
                if (wastageFactor === null) return;
                const core = window.calculateConcreteEstimate({ mode, type, length: Number(document.getElementById('concrete-length').value), width: Number(document.getElementById('concrete-width').value), thickness: Number(document.getElementById('concrete-thickness').value), totalVolume: Number(document.getElementById('concrete-total-volume').value), quantity, ratio, mixMode, dryFactor, density: cementDensity, bagKg: getCementBagMass(), wastePercent: (wastageFactor - 1) * 100 });
                if (!core.ok) {
                    const errorMap = { invalidQuantity: 'errNumElements', invalidTotalVolume: 'errTotalVolumeSingle', invalidDimensions: 'errDimensions', invalidWetVolume: 'errDimensions', invalidDryVolume: 'errRequiredFields', invalidDryFactor: 'errRequiredFields', invalidRatio: 'errRequiredFields', invalidMaterialSettings: 'errRequiredFields', invalidCalculatedQuantity: 'errRequiredFields' };
                    showError(T[errorMap[core.error] || 'errRequiredFields']);
                    return;
                }
                wetVolume = core.wetVolume; length = Number(document.getElementById('concrete-length').value); width = Number(document.getElementById('concrete-width').value); thickness = Number(document.getElementById('concrete-thickness').value);
                const dryVolume = core.dryVolume;
                const materialUnit = 'm³';
                const cementVolume = core.cementVolume;
                const sandVolumeBeforeWaste = core.sandVolumeBeforeWaste;
                const aggregateVolumeBeforeWaste = core.aggregateVolumeBeforeWaste;
                const sandVolume = core.sandVolumeOrder;
                const aggregateVolume = core.aggregateVolumeOrder;
                const cementWeight = core.cementWeightRequired;
                const cementWastageAllowance = core.cementWastageAllowance;
                const totalCementWeightWithWastage = core.cementWeightWithWastage;
                const cementOrderWeight = core.cementOrderWeight;
                const cementBags = core.cementBags;
                const dryVolumeText = `${dryVolume.toFixed(3)} m³ (${dryFactor} ${T.trailDryFactorNote})`;
                const mixDetailsText = `${mixMode === 'custom' ? T.customNominalWord : T.nominalWord} ${T.ratioLooseVolume}: <bdi dir="ltr">${ratio.join(':')}</bdi>; ${T.looseDensity}: ${cementDensity} kg/m³`;
                const costsValid = [cementCost, sandCost, aggregateCost, formworkCostPerM2].filter(v => v !== null).every(v => Number.isFinite(v) && v >= 0);
                if (!costsValid) { showError(T.errRequiredFields); return; }
                const materialCostsComplete = cementCost !== null && sandCost !== null && aggregateCost !== null;
                // Show each entered material subtotal independently. The grand
                // total remains unavailable until all required material prices exist.
                const totalCementCost = cementCost === null ? null : cementBags * cementCost;
                const totalSandCost = sandCost === null ? null : sandVolume * sandCost;
                const totalAggregateCost = aggregateCost === null ? null : aggregateVolume * aggregateCost;
                let totalCost = materialCostsComplete ? totalCementCost + totalSandCost + totalAggregateCost : null;
                
                const currency = getCurrency();

                lastCalcData.concrete = {
                    nums: { cementBags: cementBags, sand: sandVolume, aggregate: aggregateVolume },
                    description: mode === 'volume' ? `${wetVolume.toFixed(2)} m³` : `${length} × ${width} × ${thickness} m`,
                    totalVolume: `${wetVolume.toFixed(2)} m³`,
                    cement: `${formatQty(cementBags)} ${T.bagsWord}`,
                    sand: `${sandVolume.toFixed(2)} ${materialUnit}`,
                    aggregate: `${aggregateVolume.toFixed(2)} ${materialUnit}`,
                    cost: materialCostsComplete ? `${currency}${formatMoney(totalCost, currency)}` : T.costNotEntered,
                    quoteLines: [
                        { item: T.cementBags, qty: `${formatQty(cementBags)} ${T.bagsWord}`, unitPrice: (document.getElementById('concrete-cement-cost').value.trim() === '' ? null : Number(document.getElementById('concrete-cement-cost').value)) },
                        { item: T.sand, qty: `${sandVolume.toFixed(2)} ${materialUnit}`, unitPrice: (document.getElementById('concrete-sand-cost').value.trim() === '' ? null : Number(document.getElementById('concrete-sand-cost').value)) },
                        { item: T.aggregate, qty: `${aggregateVolume.toFixed(2)} ${materialUnit}`, unitPrice: (document.getElementById('concrete-aggregate-cost').value.trim() === '' ? null : Number(document.getElementById('concrete-aggregate-cost').value)) }
                    ]
                };
                
                let additionalResultsHTML = '';
                let formworkArea = 0;
                if (mode === 'dims') {
                    let formworkLabel = '';
                    // Slab quantity is a real multiplier too; formwork must
                    // cover every slab represented by the concrete volume.
                    const currentQuantity = quantity;
                    
                    if (type === 'slab') {
                        formworkArea = (2 * length + 2 * width) * thickness * currentQuantity;
                        formworkLabel = T.slabFormwork;
                    } 
                    else if (type === 'column') {
                        formworkArea = ((2 * width + 2 * thickness) * length) * currentQuantity;
                        formworkLabel = T.columnFormwork;
                    } 
                    else if (type === 'beam') {
                        formworkArea = ((width * length) + (2 * thickness * length)) * currentQuantity;
                        formworkLabel = T.beamFormwork;
                    }
                    
                    if(formworkArea > 0){
                        additionalResultsHTML += `
                            <div class="result-item flex items-center gap-2 sm:col-span-2 text-start">
                                <i data-lucide="square"></i>
                                <span><strong class="font-semibold block">${formworkLabel}</strong> ${formworkArea.toFixed(2)} m²</span>
                            </div>`;
                    }
                    // FIX: suspended slabs also need soffit (underside) formwork = L x W
                    if (type === 'slab' && document.getElementById('concrete-slab-support')?.value === 'suspended') {
                        const soffitArea = length * width * currentQuantity;
                        formworkArea += soffitArea;
                        additionalResultsHTML += `
                            <div class="result-item flex items-center gap-2 sm:col-span-2 text-start">
                                <i data-lucide="layers"></i>
                                <span><strong class="font-semibold block">${T.soffitFormwork}</strong> ${soffitArea.toFixed(2)} m²</span>
                            </div>`;
                    }
                    if(formworkArea > 0 && formworkCostPerM2 !== null && formworkCostPerM2 > 0){
                        additionalResultsHTML += `<div class="result-item flex items-center gap-2 sm:col-span-2 text-start" data-kind="cost"><i data-lucide="wallet"></i><span><strong class="font-semibold block">${T.formworkCostBreakdown}</strong> ${currency}${formatMoney(formworkArea * formworkCostPerM2, currency)}</span></div>`;
                    }
                }
                const formworkCost = formworkCostPerM2 !== null ? formworkArea * formworkCostPerM2 : 0;
                if (materialCostsComplete) totalCost += formworkCost;
                lastCalcData.concrete.cost = materialCostsComplete ? `${currency}${formatMoney(totalCost, currency)}` : T.costNotEntered;
                if (!window.__langRecalc) sessionResults.concrete.push(lastCalcData.concrete);
                renderSessionTable('concrete');

                const calculationTrailHTML = `<details class="calculation-trail card p-3 mt-3 text-sm text-start"><summary class="font-semibold">${T.calculationDetails}</summary><div class="mt-2 space-y-1"><div>${T.trailInputs}: ${mode === 'volume' ? `${T.trailTotalVolumeWord} ${wetVolume.toFixed(3)} m³` : `${length} × ${width} × ${thickness} m × ${quantity} ${T.trailElements}`}</div><div>${T.trailWetVolume}: ${wetVolume.toFixed(3)} m³; ${T.trailDryVolume}: ${dryVolumeText}</div><div>${mixDetailsText}</div><div>${T.trailCementBeforeWaste}: ${cementWeight.toFixed(1)} kg</div><div>${T.trailCementWasteAllowance}: ${cementWastageAllowance.toFixed(1)} kg; ${T.trailOrderQuantity}: ${fill(T.trailBagsOrdered, { n: cementBags, kg: getCementBagMass(), w: cementOrderWeight.toFixed(1) })}</div><div>${fill(T.trailMaterialLine, { name: T.sand, a: sandVolumeBeforeWaste.toFixed(3), u: materialUnit, b: (sandVolume - sandVolumeBeforeWaste).toFixed(3), c: sandVolume.toFixed(3) })}</div><div>${fill(T.trailMaterialLine, { name: T.aggregate, a: aggregateVolumeBeforeWaste.toFixed(3), u: materialUnit, b: (aggregateVolume - aggregateVolumeBeforeWaste).toFixed(3), c: aggregateVolume.toFixed(3) })}</div><div>${T.excludedMaterialsNote}</div><div>${materialCostsComplete ? `<div>${T.trailPrice}: ${cementBags} ${T.bagsWord} × ${currency}${formatMoney(cementCost, currency)} + ${sandVolume.toFixed(3)} ${materialUnit} × ${currency}${formatMoney(sandCost, currency)} + ${aggregateVolume.toFixed(3)} ${materialUnit} × ${currency}${formatMoney(aggregateCost, currency)}${formworkCostPerM2 ? ` + ${T.formworkWord} ${currency}${formatMoney(formworkCostPerM2, currency)}` : ''} = ${currency}${formatMoney(totalCost, currency)}</div>` : T.costNotEntered}</div><div>${T.trailAssumption}</div></div></details>`;
                const visibleScopeNoteHTML = `<div class="text-xs opacity-75 mb-3 text-start">${T.costScopeNote}${mode === 'volume' ? ` ${T.formworkNotIncludedVolume}` : ''}</div>`;
                const resultDiv = document.getElementById('concrete-result');
                resultDiv.innerHTML = `
                    <div class="result-card">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-base font-bold header-title">${T.resultConcrete}</h3>
                            <div class="flex gap-2">
<button type="button" class="btn btn-primary result-action-btn export-open-btn">
    <i data-lucide="upload" class="w-4 h-4 me-1 pointer-events-none"></i>
    <span data-lang="exportOpenBtn">${T.exportOpenBtn}</span>
</button>
                                <button type="button" class="btn btn-secondary result-action-btn save-history-btn" hidden aria-hidden="true" tabindex="-1" title="${T.saveToHistoryTitle}">
                                    <i data-lucide="save" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="saveBtn">${T.saveBtn}</span>
                                </button>
                                <button type="button" class="btn btn-secondary result-action-btn export-csv-btn" hidden aria-hidden="true" tabindex="-1" title="${T.exportCsvTitle}">
                                    <i data-lucide="file-spreadsheet" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="csvBtn">${T.csvBtn}</span>
                                </button>
                                <button type="button" class="btn btn-secondary result-action-btn export-btn" hidden aria-hidden="true" tabindex="-1" title="${T.exportPdfTitle}">
                                    <i data-lucide="printer" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="pdfBtn">${T.pdfBtn}</span>
                                </button>
<button type="button" class="btn btn-secondary result-action-btn quote-btn" hidden aria-hidden="true" tabindex="-1" title="${T.quoteBtn}">
                                    <i data-lucide="file-text" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="quoteBtn">${T.quoteBtn}</span>
                                </button>
                            </div>
                        </div>
                         <div class="result-content">
                            ${calculationTrailHTML}
                            ${visibleScopeNoteHTML}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                                <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="cuboid"></i><span><strong class="font-semibold block">${T.totalVolume}</strong> ${wetVolume.toFixed(2)} m³</span></div>
                                <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="scale"></i><span><strong class="font-semibold block">${T.cementRequiredWeight}</strong> ${cementWeight.toFixed(1)} kg</span></div><div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="shopping-bag"></i><span><strong class="font-semibold block">${T.cementOrderQuantity}</strong> ${formatQty(cementBags)} × ${getCementBagMass()} kg = ${formatQty(cementOrderWeight)} kg</span></div>
                                <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="waves"></i><span><strong class="font-semibold block">${T.sand}</strong> ${sandVolumeBeforeWaste.toFixed(2)} ${materialUnit} + ${(sandVolume - sandVolumeBeforeWaste).toFixed(2)} ${materialUnit} ${T.wasteWord} = ${sandVolume.toFixed(2)} ${materialUnit} ${T.orderedWord} ${truckLoadNote(sandVolume)}</span></div>
                                <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="mountain-snow"></i><span><strong class="font-semibold block">${T.aggregate}</strong> ${aggregateVolumeBeforeWaste.toFixed(2)} ${materialUnit} + ${(aggregateVolume - aggregateVolumeBeforeWaste).toFixed(2)} ${materialUnit} ${T.wasteWord} = ${aggregateVolume.toFixed(2)} ${materialUnit} ${T.orderedWord} ${truckLoadNote(aggregateVolume)}</span></div>
                                
                                ${additionalResultsHTML}
                                <div class="result-item flex items-center gap-2" data-kind="cost"><i data-lucide="circle-dollar-sign"></i><span><strong class="font-semibold block">${T.cementCost}</strong> ${cementCost === null ? T.costNotEntered : currency + formatMoney(totalCementCost, currency)}</span></div>
                                <div class="result-item flex items-center gap-2" data-kind="cost"><i data-lucide="circle-dollar-sign"></i><span><strong class="font-semibold block">${T.sandCost}</strong> ${sandCost === null ? T.costNotEntered : currency + formatMoney(totalSandCost, currency)}</span></div>
                                <div class="result-item flex items-center gap-2 sm:col-span-2" data-kind="cost"><i data-lucide="circle-dollar-sign"></i><span><strong class="font-semibold block">${T.aggregateCost}</strong> ${aggregateCost === null ? T.costNotEntered : currency + formatMoney(totalAggregateCost, currency)}</span></div>
                                <div class="col-span-2 text-center mt-2 pt-2 border-t border-gray-700 total-cost-print">
                                    <strong class="font-bold text-lg header-title">${T.totalCost} ${materialCostsComplete ? currency + formatMoney(totalCost, currency) : T.costNotEntered}</strong>
                                </div>
                             </div>
                         </div>
                     </div>`;
                resultDiv.classList.remove('hidden');
                window.lucide?.createIcons?.();
                errorBox.classList.add('hidden');
                
                // Smooth scroll to the result
                setTimeout(() => {
                    if (!window.__langRecalc) resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
};
