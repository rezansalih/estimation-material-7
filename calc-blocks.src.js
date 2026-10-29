/* calc-blocks.js — lazy-loaded calculator chunk. Loaded by app.js on first use
   (tab open or Calculate tap); registers its handler instead of running at startup. */
window.__calcHandlers = window.__calcHandlers || {};
window.__calcHandlers.blocks = function (ctx) {
  const { translations, fill, getCementBagMass, getCurrency, getWastageFactor, renderSessionTable, showError, sessionResults, lastCalcData, errorBox , formatMoney, formatQty, unitOf } = ctx;
                const lang = localStorage.getItem('language') || 'en';
                const T = translations[lang];

                const blockOpt = document.getElementById('block-type').options[document.getElementById('block-type').selectedIndex];
                const blockCustom = blockOpt.value === 'custom';
                const blockLengthM = blockCustom ? Number(document.getElementById('block-custom-length').value) / 1000 : parseFloat(blockOpt.getAttribute('data-length')) / 1000;
                const blockWidthM = blockCustom ? Number(document.getElementById('block-custom-width').value) / 1000 : parseFloat(blockOpt.getAttribute('data-width')) / 1000;
                const blockHeightM = blockCustom ? Number(document.getElementById('block-custom-height').value) / 1000 : parseFloat(blockOpt.getAttribute('data-height')) / 1000;
                
                if ([blockLengthM, blockWidthM, blockHeightM].some(v => isNaN(v) || v <= 0)) {
                    showError(T.errBlockDims);
                    return;
                }

                const blockCostRaw = document.getElementById('block-cost').value.trim();
                const cementCostRaw = document.getElementById('block-cement-cost').value.trim();
                const sandCostRaw = document.getElementById('block-sand-cost').value.trim();
                // An empty price field means "not entered" — it must never show as 0 cost.
                const blockCost = blockCostRaw === '' ? null : Number(blockCostRaw);
                const cementCost = cementCostRaw === '' ? null : Number(cementCostRaw);
                const sandCost = sandCostRaw === '' ? null : Number(sandCostRaw);
                const includeMortar = document.getElementById('block-include-mortar').checked;
                const mortarRatioParts = document.getElementById('block-mortar-ratio').value.split(':').map(Number);
                const cementDensity = Number(document.getElementById('block-cement-density').value);
                if ([blockCost, cementCost, sandCost].filter(v => v !== null).some(v => !Number.isFinite(v) || v < 0)) { showError(T.errRequiredFields); return; }
                const mortarMixActive = includeMortar && document.getElementById('block-joint-type')?.value !== 'glue';
                if (mortarMixActive && (!Number.isFinite(cementDensity) || cementDensity <= 0 || mortarRatioParts.some(v => !Number.isFinite(v) || v <= 0))) { showError(T.errRequiredFields); return; }

                const mode = document.querySelector('input[name="block-mode"]:checked').value;
                let totalWallVolume, length, height, dimsWallWidth = null;
                let totalOpeningVolumeForDisplay = 'N/A';
                let hasOpenings = false;
                
                if (mode === 'volume') {
                    // Total volume already includes the wall thickness, so the number of
                    // blocks follows from the block module alone (length × height × block
                    // width). No wall-thickness or leaves input is needed in this mode.
                    totalWallVolume = Number(document.getElementById('block-wall-volume').value);
                    if (!Number.isFinite(totalWallVolume) || totalWallVolume <= 0) {
                        showError(T.errTotalVolume);
                        return;
                    }
                    length = null; height = null;
                } else if (mode === 'dims') {
                    const wallWidth = parseFloat(document.getElementById('block-wall-width-input').value);
                    length = parseFloat(document.getElementById('block-wall-length').value);
                    height = parseFloat(document.getElementById('block-wall-height').value);
                    
                    if ([length, height, wallWidth].some(v => isNaN(v) || v <= 0)) {
                        showError(T.errDimsWallWidth);
                        return;
                    }
                    
                    const grossWallVolume = length * height * wallWidth;
                    dimsWallWidth = wallWidth;
                    const numWindows = Number(document.getElementById('block-num-windows').value);
                    const windowWidth = Number(document.getElementById('block-window-width').value);
                    const windowHeight = Number(document.getElementById('block-window-height').value);
                    const numDoors = Number(document.getElementById('block-num-doors').value);
                    const doorWidth = Number(document.getElementById('block-door-width').value);
                    const doorHeight = Number(document.getElementById('block-door-height').value);
                    if ([numWindows, windowWidth, windowHeight, numDoors, doorWidth, doorHeight].some(v => !Number.isFinite(v) || v < 0) || !Number.isInteger(numWindows) || !Number.isInteger(numDoors)) { showError(T.errOpeningDimensions); return; }
                    if ((numWindows > 0 && (windowWidth <= 0 || windowHeight <= 0)) || (numDoors > 0 && (doorWidth <= 0 || doorHeight <= 0))) { showError(T.errOpeningDimensions); return; }
                    
                    const totalOpeningVolumeToSubtract = (numWindows * windowWidth * windowHeight * wallWidth) + (numDoors * doorWidth * doorHeight * wallWidth);
                    totalWallVolume = grossWallVolume - totalOpeningVolumeToSubtract;
                    
                    if (!Number.isFinite(totalWallVolume) || totalWallVolume <= 0) {
                        showError(T.errOpeningExceeds);
                        return;
                    }
                    hasOpenings = totalOpeningVolumeToSubtract > 0;
                    const openingsTemplate = T.openingsDeducted || 'Deducted {v} m³: {nw} window(s) {ww} × {wh} m + {nd} door(s) {dw} × {dh} m, × wall thickness';
                    totalOpeningVolumeForDisplay = openingsTemplate
                        .replace('{v}', totalOpeningVolumeToSubtract.toFixed(3))
                        .replace('{nw}', numWindows).replace('{ww}', windowWidth).replace('{wh}', windowHeight)
                        .replace('{nd}', numDoors).replace('{dw}', doorWidth).replace('{dh}', doorHeight);
                }

                const wastageFactor = getWastageFactor();
                if (wastageFactor === null) return;
                const singleBlockVolume = blockLengthM * blockWidthM * blockHeightM;
                let blocksNeededUnwasted, mortarVolume = 0, mortarVolumeOrder = 0, cementBags = 0, sandVolume = 0, cementWeight = 0; let mixingWaterLitres = 0;
                
                // v70: total-volume mode counts one layer; dimensions mode derives layers from the wall width.
                const mortarThicknessM = includeMortar ? Number(document.getElementById('block-mortar-thickness').value) / 100 : 0;
                const mortarDryFactor = includeMortar ? Number(document.getElementById('block-mortar-dry-factor').value) : 1;
                const wallThicknessM = dimsWallWidth || blockWidthM;
                const glueMode = includeMortar && document.getElementById('block-joint-type')?.value === 'glue';
                const glueRate = glueMode ? Number(document.getElementById('block-glue-rate').value) : null;
                const glueBagSize = glueMode ? Number(document.getElementById('block-glue-bag').value) : null;
                const glueCostRaw = glueMode ? document.getElementById('block-glue-cost').value.trim() : '';
                const gluePrice = glueCostRaw === '' ? null : Number(glueCostRaw);
                if (glueMode && (!Number.isFinite(glueRate) || glueRate <= 0 || !Number.isFinite(glueBagSize) || glueBagSize <= 0 ||
                    (gluePrice !== null && (!Number.isFinite(gluePrice) || gluePrice < 0)))) { showError(T.errRequiredFields); return; }
                if (!Number.isFinite(mortarThicknessM) || mortarThicknessM < 0 || !Number.isFinite(mortarDryFactor) || mortarDryFactor < 1 || !Number.isFinite(wallThicknessM) || wallThicknessM <= 0) { showError(T.errRequiredFields); return; }
                /* v70: the wall width the user types already says how thick
                   the wall is — layers through the thickness are derived from
                   it automatically (no separate "leaves" question). */
                const leavesFit = Math.floor(wallThicknessM / blockWidthM); // never more leaves than physically fit
                const leaves = mode === 'volume' ? 1 : Math.max(1, Math.min(Math.round(wallThicknessM / (blockWidthM + mortarThicknessM)), leavesFit));
                const netWallArea = totalWallVolume / wallThicknessM;
                const unitFaceArea = (blockLengthM + mortarThicknessM) * (blockHeightM + mortarThicknessM);
                blocksNeededUnwasted = (netWallArea / unitFaceArea) * leaves;
                let glueKg = 0, glueBags = 0;
                if (glueMode) {
                    glueKg = netWallArea * leaves * glueRate * wastageFactor;
                    glueBags = Math.ceil(glueKg / glueBagSize);
                }
                // v79: width not covered by the leaves (cavity/insulation) is not mortar
                const wallGapM = Math.max(0, wallThicknessM - leaves * (blockWidthM + mortarThicknessM));
                const wallGapVolume = netWallArea * wallGapM;
                if (includeMortar && !glueMode) {
                    mortarVolume = totalWallVolume - (blocksNeededUnwasted * singleBlockVolume) - wallGapVolume;
                    if (mortarVolume < -1e-9) { showError(T.errRequiredFields); return; }
                    mortarVolume = Math.max(0, mortarVolume);
                    if (mortarVolume > 0) {
                        // Wastage is applied once, to the wet mortar, so cement and sand
                        // inherit it and the shown quantities reconcile with the shown
                        // mortar volume (same convention as the bricks tool).
                        mortarVolumeOrder = mortarVolume * wastageFactor;
                        const dryMortarVolume = mortarVolumeOrder * mortarDryFactor;
                        const sumOfRatio = mortarRatioParts.reduce((a, b) => a + b, 0);
                        const cementVolume = (dryMortarVolume * mortarRatioParts[0]) / sumOfRatio;
                        sandVolume = (dryMortarVolume * mortarRatioParts[1]) / sumOfRatio;
                        cementWeight = cementVolume * cementDensity;
                        cementBags = Math.ceil(cementWeight / getCementBagMass());
                    }
                    mixingWaterLitres = cementWeight * 0.6;
                }
                
                const blocksNeeded = Math.ceil(blocksNeededUnwasted * wastageFactor);
                const totalBlockCost = blockCost === null ? null : blocksNeeded * blockCost;
                // Mortar/glue-off means no joint materials in the bill: their prices are not
                // required for a complete total, and no zero cost rows are shown.
                const totalCementCost = (!glueMode && includeMortar && cementCost !== null) ? cementBags * cementCost : null;
                const totalSandCost = (!glueMode && includeMortar && sandCost !== null) ? sandVolume * sandCost : null;
                const totalGlueCost = glueMode ? (gluePrice === null ? null : glueBags * gluePrice) : null;
                const materialCostsComplete = (glueMode
                    ? [blockCost, gluePrice]
                    : (includeMortar ? [blockCost, cementCost, sandCost] : [blockCost])
                ).every(v => v !== null && Number.isFinite(v) && v >= 0);
                const totalCost = materialCostsComplete
                    ? totalBlockCost + (glueMode ? totalGlueCost : (includeMortar ? totalCementCost + totalSandCost : 0))
                    : null;
                const currency = getCurrency();
                const hollowGroutNote = ['hollow', 'thermo_20', 'thermo_15'].includes(blockOpt.value) ? T.hollowBlockNote : '';

                lastCalcData.blocks = {
                    nums: { blocks: blocksNeeded, cementBags: glueMode ? 0 : (includeMortar ? cementBags : 0), sand: (!glueMode && includeMortar) ? sandVolume : 0, glueBags: glueMode ? glueBags : 0 , cementBagKg: getCementBagMass(), glueBagKg: glueBagSize || 25 },
                    volume: `${totalWallVolume.toFixed(2)} m³`,
                    blocks: `${formatQty(blocksNeeded)} ${unitOf(blocksNeeded, T.pcUnitOne, T.piecesWord)}`,
                    cement: glueMode ? `${formatQty(glueBags)} ${unitOf(glueBags, T.bagUnitOne, T.bagsWord)}` : (includeMortar ? `${formatQty(cementBags)} ${unitOf(cementBags, T.bagUnitOne, T.bagsWord)}` : 'N/A'),
                    sand: (!glueMode && includeMortar) ? `${sandVolume.toFixed(2)} m³` : 'N/A',
                    cost: materialCostsComplete ? `${currency}${formatMoney(totalCost, currency)}` : T.costNotEntered,
                    quoteLines: [
                        { key: 'blocks', item: T.totalBlocks, qty: `${formatQty(blocksNeeded)} ${unitOf(blocksNeeded, T.pcUnitOne, T.piecesWord)}`, unitPrice: blockCost },
                        ...(glueMode
                            ? [{ key: 'glue', item: T.glueAdhesive, qty: `${formatQty(glueBags)} ${unitOf(glueBags, T.bagUnitOne, T.bagsWord)} (${formatQty(glueKg, 1)} kg)`, unitPrice: gluePrice }]
                            : (includeMortar ? [
                                { key: 'cement', item: T.cementBags, qty: `${formatQty(cementBags)} ${unitOf(cementBags, T.bagUnitOne, T.bagsWord)}`, unitPrice: cementCost },
                                { key: 'sand', item: T.sand, qty: `${sandVolume.toFixed(2)} m³`, unitPrice: sandCost }
                            ] : []))
                    ]
                };
                
                if (!window.__langRecalc) sessionResults.blocks.push(lastCalcData.blocks);
                renderSessionTable('blocks');
                
                const resultDiv = document.getElementById('blocks-result');
                let mortarResultsHTML = '', costResultsHTML = '';
                
                const costRow = (label, value) => `<div class="result-item flex items-center gap-2" data-kind="cost"><i data-lucide="wallet"></i><span><strong class="font-semibold block">${label}</strong> ${value}</span></div>`;
                const rowsCost = [];
                if (totalBlockCost !== null) rowsCost.push(costRow(T.blockCost, `${currency}${formatMoney(totalBlockCost, currency)}`));
                if (totalCementCost !== null) rowsCost.push(costRow(T.cementCost, `${currency}${formatMoney(totalCementCost, currency)}`));
                if (totalSandCost !== null) rowsCost.push(costRow(T.sandCost, `${currency}${formatMoney(totalSandCost, currency)}`));
                if (totalGlueCost !== null) rowsCost.push(costRow(T.glueAdhesive, `${currency}${formatMoney(totalGlueCost, currency)}`));
                if (glueMode) {
                    mortarResultsHTML = `
                        <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="shopping-bag"></i><span><strong class="font-semibold block">${T.glueAdhesive}</strong> ${formatQty(glueKg, 1)} kg · ${formatQty(glueBags)} ${unitOf(glueBags, T.bagUnitOne, T.bagsWord)} × ${glueBagSize} kg</span></div>
                    `;
                    costResultsHTML = rowsCost.join('');
                } else if (includeMortar && mortarVolume > 0) {
                    mortarResultsHTML = `
                        <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="blending"></i><span><strong class="font-semibold block">${T.mortarVolume}</strong> ${mortarVolumeOrder.toFixed(3)} m³ <span class="text-xs opacity-75">(${mortarVolume.toFixed(3)} ${T.netWord} + ${(mortarVolumeOrder - mortarVolume).toFixed(3)} ${T.wasteWord})</span></span></div>
                        <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="shopping-bag"></i><span><strong class="font-semibold block">${T.cementBags}</strong> ${formatQty(cementBags)} ${unitOf(cementBags, T.bagUnitOne, T.bagsWord)}</span></div>
                        <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="scale"></i><span><strong class="font-semibold block">${T.cementWeight}</strong> ${cementWeight.toFixed(2)} kg</span></div>
                        <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="waves"></i><span><strong class="font-semibold block">${T.sand}</strong> ${sandVolume.toFixed(2)} m³</span></div>
                        <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="droplets"></i><span><strong class="font-semibold block">${T.mixingWaterEstimate}</strong> ${fill(T.trailWaterPerKg, { v: mixingWaterLitres.toFixed(1) })}</span></div>
                    `;
                    costResultsHTML = rowsCost.join('');
                } else {
                    costResultsHTML = rowsCost.join('');
                }

                resultDiv.innerHTML = `
                    <div class="result-card">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-base font-bold header-title">${T.resultBlocks}</h3>
                             <div class="flex gap-2">
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
                             <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                                <div class="result-item flex items-center gap-2" data-kind="detail"><i data-lucide="box-select"></i><span><strong class="font-semibold block">${T.totalWallVolume}</strong> ${totalWallVolume.toFixed(2)} m³</span></div>
                                <div class="result-item flex items-center gap-2" data-kind="order"><i data-lucide="table-2"></i><span><strong class="font-semibold block">${T.totalBlocks}</strong> ${formatQty(blocksNeeded)}</span></div>
                                 
                                 ${mortarResultsHTML}
                                 ${wallGapM > 0.02 ? `<div class="result-item flex items-center gap-2 sm:col-span-2 text-start" data-kind="detail"><i data-lucide="info"></i><span>${fill(T.wallGapNote, { v: (wallGapM * 100).toFixed(0) })}</span></div>` : ''}

                                 ${hasOpenings ? `<div class="result-item flex items-center gap-2 sm:col-span-2 text-start" data-kind="detail"><i data-lucide="scan"></i><span><strong class="font-semibold block">${T.totalOpeningVolume}</strong> ${totalOpeningVolumeForDisplay}</span></div>` : ''}
                                ${hollowGroutNote ? `<div class="result-item flex items-center gap-2 sm:col-span-2 text-start"><i data-lucide="info"></i><span>${hollowGroutNote}</span></div>` : ''}
                                <details class="calculation-trail card p-3 mt-2 sm:col-span-2 text-sm text-start"><summary class="font-semibold">${T.calculationDetails || 'Calculation details'}</summary><div class="mt-2 space-y-1"><div>${mode === 'volume' ? `${T.totalWallVolume}: ${totalWallVolume.toFixed(3)} m³` : `${T.totalWallVolume}: ${totalWallVolume.toFixed(3)} m³; ${T.wallWidth}: ${wallThicknessM.toFixed(3)} m`}</div><div>${T.totalBlocks}: ${blocksNeededUnwasted.toFixed(2)} ${T.trailBeforeWaste} + ${(blocksNeeded - blocksNeededUnwasted).toFixed(2)} ${T.wasteWord} = ${formatQty(blocksNeeded)} ${T.orderedWord}</div>${(includeMortar && !glueMode) ? `<div>${T.mortarVolume}: ${fill(T.trailNetToBatch, { a: mortarVolume.toFixed(3), b: mortarVolumeOrder.toFixed(3), c: (mortarVolumeOrder - mortarVolume).toFixed(3) })}; ${T.mortarDryFactor}: ${mortarDryFactor.toFixed(2)}; ${T.mortarMixRatio}: <bdi dir="ltr">${mortarRatioParts.join(':')}</bdi></div>` : ''}<div>${T.trailWallLeaves}: ${leaves}</div>${hasOpenings ? `<div>${T.totalOpeningVolume}: ${totalOpeningVolumeForDisplay}</div>` : ''}${hollowGroutNote ? `<div>${hollowGroutNote}</div>` : ''}${glueMode ? `<div>${T.glueAdhesive}: ${glueKg.toFixed(1)} kg → ${glueBags} × ${glueBagSize} kg</div><div>${T.glueJointNote}</div>` : ''}</div></details>
                               
                                <div class="sm:col-span-2 mt-2 pt-2 border-t border-gray-700">
                                     <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                                        ${costResultsHTML}
                                     </div>
                                 </div>

                                <div class="col-span-2 text-center mt-2 pt-2 border-t border-gray-700 total-cost-print">
                                     <strong class="font-bold text-lg header-title">${T.totalCost} ${materialCostsComplete ? `${currency}${formatMoney(totalCost, currency)}` : T.costNotEntered}</strong>
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
