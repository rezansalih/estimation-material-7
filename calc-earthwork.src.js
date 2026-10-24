/* calc-earthwork.js — lazy-loaded calculator chunk. Loaded by app.js on first use
   (tab open or Calculate tap); registers its handler instead of running at startup. */
window.__calcHandlers = window.__calcHandlers || {};
window.__calcHandlers.earthwork = function (ctx) {
  const { translations, renderSessionTable, showError, sessionResults, lastCalcData, errorBox, formatQty } = ctx;
                const lang = localStorage.getItem('language') || 'en';
                const T = translations[lang];

                const length = parseFloat(document.getElementById('earthwork-length').value);
                const width = parseFloat(document.getElementById('earthwork-width').value);
                const height = parseFloat(document.getElementById('earthwork-height').value);
                const quantity = Number(document.getElementById('earthwork-quantity').value);
                const truckCapacityRaw = String(document.getElementById('earthwork-truck-capacity').value).trim();
                // Empty or invalid capacity falls back to the standard 4 m³ truck
                // before any division happens.
                let truckCapacity = truckCapacityRaw === '' ? 4 : Number(truckCapacityRaw);
                if (!Number.isFinite(truckCapacity) || truckCapacity <= 0) truckCapacity = 4;
                const swellRaw = document.getElementById('earthwork-swell').value.trim();
                const swellPct = swellRaw === '' ? 0 : Number(swellRaw);
                
                if ([length, width, height, quantity, truckCapacity, swellPct].some(v => !Number.isFinite(v)) || [length, width, height, quantity, truckCapacity].some(v => v <= 0) || !Number.isInteger(quantity) || swellPct < 0 || swellPct > 100) {
                    showError(T.errEarthworkDims);
                    return;
                }
      
                const mode = (document.querySelector('input[name="earthwork-mode"]:checked') || {}).value || 'excavation';
                const volume = length * width * height * quantity;
                let looseVolume, totalLoads, factorUsed = swellPct;
                if (mode === 'backfill') {
                    // compacted fill required = bank volume; loose material to order
                    // shrinks when compacted: order = bank / (1 - compaction%).
                    // Backstop: never divide by ~zero even if a wild value slips through.
                    if (factorUsed >= 90) factorUsed = 89;
                    looseVolume = volume / (1 - factorUsed / 100);
                    totalLoads = Math.ceil(looseVolume / truckCapacity);
                } else {
                    // FIX: excavated soil bulks up, trucks carry the loose volume, not the bank volume
                    looseVolume = volume * (1 + swellPct / 100);
                    totalLoads = Math.ceil(looseVolume / truckCapacity);
                }

                lastCalcData.earthwork = {
                    nums: { volume: volume, loads: totalLoads, mode: mode },
                    description: `${length} × ${width} × ${height} m`,
                    quantity: quantity,
                    volume: `${volume.toFixed(2)} m³`,
                    truckLoads: mode === 'backfill' ? `${formatQty(totalLoads)} (${truckCapacity} m³, shrink ${factorUsed}%)` : `${formatQty(totalLoads)} (${truckCapacity} m³, +${swellPct}%)`,
                    quoteLines: [
                        { item: T.truckLoads, qty: `${formatQty(totalLoads)} × ${truckCapacity} m³`, unitPrice: null }
                    ]
                };

                if (!window.__langRecalc) sessionResults.earthwork.push(lastCalcData.earthwork);
                renderSessionTable('earthwork');

                const resultDiv = document.getElementById('earthwork-result');
                resultDiv.innerHTML = `
                    <div class="result-card">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-base font-bold header-title">${T.resultEarthwork}</h3>
                            <div class="flex gap-2">
                                <button type="button" class="btn btn-secondary result-action-btn save-history-btn" title="${T.saveToHistoryTitle}">
                                    <i data-lucide="save" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="saveBtn">${T.saveBtn}</span>
                                </button>
                                <button type="button" class="btn btn-secondary result-action-btn export-csv-btn" title="${T.exportCsvTitle}">
                                    <i data-lucide="file-spreadsheet" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="csvBtn">${T.csvBtn}</span>
                                </button>
                                <button type="button" class="btn btn-secondary result-action-btn export-btn" title="${T.exportPdfTitle}">
                                    <i data-lucide="printer" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="pdfBtn">${T.pdfBtn}</span>
                                </button>
<button type="button" class="btn btn-secondary result-action-btn quote-btn" title="${T.quoteBtn}">
                                    <i data-lucide="file-text" class="w-4 h-4 pointer-events-none"></i>
                                    <span data-lang="quoteBtn">${T.quoteBtn}</span>
                                </button>
                            </div>
                        </div>
                        <div class="result-content">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                                <div class="result-item flex items-center gap-2" data-kind="detail">
                                    <i data-lucide="land-plot"></i>
                                    <span>
                                        <strong class="font-semibold block">${mode === 'backfill' ? T.compactedVolume : T.excavationVolume}</strong> 
                                        ${volume.toFixed(2)} m³
                                    </span>
                                </div>
                                <div class="result-item flex items-center gap-2" data-kind="detail">
                                    <i data-lucide="layers"></i>
                                    <span>
                                        <strong class="font-semibold block">${mode === 'backfill' ? T.looseOrder : T.looseVolume}</strong> 
                                        ${looseVolume.toFixed(2)} m³ (${mode === 'backfill' ? 'shrink' : '+'}${mode === 'backfill' ? factorUsed : swellPct}%)
                                    </span>
                                </div>
                                <div class="result-item flex items-center gap-2" data-kind="order">
                                    <i data-lucide="truck"></i>
                                    <span>
                                        <strong class="font-semibold block">${T.truckLoads}</strong> 
                                        ${formatQty(totalLoads)}
                                    </span>
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
