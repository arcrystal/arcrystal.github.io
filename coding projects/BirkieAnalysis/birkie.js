document.addEventListener('DOMContentLoaded', () => {
    const YEARS = [2022, 2023, 2024, 2025, 2026];
    const PAGE_SIZE = 40;
    const RACES = {
        skate: { label: 'Birkebeiner Skate', short: 'Skate' },
        classic: { label: 'Birkebeiner Classic', short: 'Classic' },
    };
    const WAVE_COLORS = {
        Elite: 'var(--wave-elite)',
        'Wave 1': 'var(--wave-1)',
        'Wave 2': 'var(--wave-2)',
        'Wave 3': 'var(--wave-3)',
        'Wave 4': 'var(--wave-4)',
        'Wave 5': 'var(--wave-5)',
        'Wave 6': 'var(--wave-6)',
        'Wave 7': 'var(--wave-7)',
        'Wave 8': 'var(--wave-8)',
        'Wave 9': 'var(--wave-9)',
        'Wave 10': 'var(--wave-10)',
        '15-Year': '#9f79b9',
        '30-Year': '#b486cf',
        '?': '#899792',
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const cache = new Map();
    const cutoffCache = new Map();
    let loadToken = 0;
    let historyToken = 0;

    const state = {
        race: 'skate',
        year: 2026,
        view: 'overview',
        file: null,
        results: [],
        finishers: [],
        times: [],
        winner: null,
        waveGroups: new Map(),
        cutoffs: null,
        resultPage: 1,
        selectedWave: null,
        waveRacer: null,
    };

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[char]));
    }

    function repairText(value) {
        const text = String(value ?? '');
        if (!/[ÃÄÂâ]/.test(text) || typeof TextDecoder === 'undefined') return text;
        const cp1252 = new Map([
            [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
            [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
            [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
            [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
            [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
            [0x017e, 0x9e], [0x0178, 0x9f],
        ]);
        const bytes = [];
        for (const character of text) {
            const code = character.codePointAt(0);
            if (code <= 255) bytes.push(code);
            else if (cp1252.has(code)) bytes.push(cp1252.get(code));
            else return text;
        }
        try {
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
            return decoded.includes('�') ? text : decoded;
        } catch (_error) {
            return text;
        }
    }

    function displayName(value) {
        const repaired = repairText(value);
        const pieces = repaired.split(',').map((part) => part.trim()).filter(Boolean);
        return pieces.length > 1 ? `${pieces.slice(1).join(' ')} ${pieces[0]}` : repaired;
    }

    function parseTime(value) {
        const parts = String(value ?? '').trim().split(':').map(Number);
        if (parts.some((part) => !Number.isFinite(part))) return NaN;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return NaN;
    }

    function formatTime(seconds, includeSeconds = true) {
        if (!Number.isFinite(seconds)) return '—';
        const value = Math.max(0, Math.round(seconds));
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        const secs = value % 60;
        if (!includeSeconds) return `${hours}:${String(minutes).padStart(2, '0')}`;
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function median(values) {
        if (!values.length) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function waveFromBib(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '?';
        if (number < 1000) return 'Elite';
        if (number >= 70000) return '30-Year';
        if (number >= 35000) return '15-Year';
        let wave = Math.floor(number / 1000);
        if (wave >= 11) wave -= 10;
        return `Wave ${wave}`;
    }

    function waveOrder(wave) {
        if (wave === 'Elite') return 0;
        const match = wave.match(/Wave (\d+)/);
        if (match) return Number(match[1]);
        if (wave === '15-Year') return 30;
        if (wave === '30-Year') return 31;
        return 99;
    }

    function waveStyle(wave) {
        return `--wave-color:${WAVE_COLORS[wave] || WAVE_COLORS['?']}`;
    }

    function normalizeResult(result) {
        const timeSeconds = parseTime(result.time);
        const overallPlace = String(result.overallPlace ?? '');
        const placeNumber = Number(overallPlace);
        return {
            ...result,
            name: repairText(result.name),
            location: repairText(result.location),
            timeSeconds,
            placeNumber: Number.isFinite(placeNumber) && placeNumber > 0 ? placeNumber : Infinity,
            isFinisher: Number.isFinite(timeSeconds) && !['DNS', 'DNF', 'DSQ', 'OVT'].includes(overallPlace),
            wave: waveFromBib(result.bib),
            search: `${result.name} ${result.bib} ${result.location}`.toLowerCase(),
        };
    }

    function resultKey(race, year) {
        return `${race}_${year}`;
    }

    async function fetchDataset(race, year) {
        const key = resultKey(race, year);
        if (cache.has(key)) return cache.get(key);
        const request = fetch(`data/results_${key}.json`).then(async (response) => {
            if (!response.ok) throw new Error(`${RACES[race].label} ${year} returned ${response.status}.`);
            const file = await response.json();
            return { ...file, results: file.results.map(normalizeResult) };
        });
        cache.set(key, request);
        try {
            return await request;
        } catch (error) {
            cache.delete(key);
            throw error;
        }
    }

    async function fetchCutoffs(race) {
        if (cutoffCache.has(race)) return cutoffCache.get(race);
        const request = fetch(`data/wave_placements_${race}.json`).then(async (response) => {
            if (!response.ok) throw new Error(`Wave placements returned ${response.status}.`);
            return response.json();
        });
        cutoffCache.set(race, request);
        try {
            return await request;
        } catch (error) {
            cutoffCache.delete(race);
            throw error;
        }
    }

    function buildDerived(file) {
        state.file = file;
        state.results = file.results;
        state.finishers = file.results
            .filter((result) => result.isFinisher)
            .sort((a, b) => a.placeNumber - b.placeNumber || a.timeSeconds - b.timeSeconds);
        state.times = state.finishers.map((result) => result.timeSeconds).sort((a, b) => a - b);
        state.winner = state.finishers[0] || null;
        state.waveGroups = new Map();
        state.finishers.forEach((result) => {
            if (!state.waveGroups.has(result.wave)) state.waveGroups.set(result.wave, []);
            state.waveGroups.get(result.wave).push(result);
        });
        state.waveGroups = new Map([...state.waveGroups.entries()].sort(([a], [b]) => waveOrder(a) - waveOrder(b)));
        const largest = [...state.waveGroups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        state.selectedWave = largest?.[0] || null;
        state.resultPage = 1;
        state.waveRacer = null;
    }

    function setLoading(isLoading) {
        $('#dashboard').setAttribute('aria-busy', String(isLoading));
        $('#loadingState').hidden = !isLoading;
        if (isLoading) {
            $('#dashboardContent').hidden = true;
            $('#errorState').hidden = true;
        }
    }

    async function loadSelected() {
        const token = ++loadToken;
        setLoading(true);
        if ($('#racerDialog').open) $('#racerDialog').close();
        try {
            const [file, cutoffs] = await Promise.all([
                fetchDataset(state.race, state.year),
                fetchCutoffs(state.race),
            ]);
            if (token !== loadToken) return;
            state.cutoffs = cutoffs;
            buildDerived(file);
            resetControls();
            renderAll();
            $('#dashboardContent').hidden = false;
            $('#errorState').hidden = true;
            setLoading(false);
            loadHistory();
        } catch (error) {
            if (token !== loadToken) return;
            setLoading(false);
            $('#dashboardContent').hidden = true;
            $('#errorMessage').textContent = error.message;
            $('#errorState').hidden = false;
        }
    }

    function resetControls() {
        $('#resultSearch').value = '';
        $('#genderFilter').value = 'all';
        $('#resultSort').value = 'place';
        $('#waveRacerSearch').value = '';
        $('#predictorRacerSearch').value = '';
        $('#finishTimeInput').value = '';
        $('#waveSuggestions').hidden = true;
        $('#predictorSuggestions').hidden = true;
        $('#waveComparison').hidden = true;
        $('#waveComparisonEmpty').hidden = false;
        $('#predictorOutput').innerHTML = '<div class="predictor-placeholder"><span aria-hidden="true">↗</span><h3>Your trail starts here.</h3><p>Enter a time or select a finisher to calculate a projection.</p></div>';
        const waveFilter = $('#waveFilter');
        waveFilter.innerHTML = '<option value="all">All waves</option>';
        state.waveGroups.forEach((_results, wave) => {
            const option = document.createElement('option');
            option.value = wave;
            option.textContent = wave;
            waveFilter.appendChild(option);
        });
    }

    function renderAll() {
        const label = `${RACES[state.race].short} · ${state.year}`;
        $$('[data-race-year]').forEach((node) => { node.textContent = label; });
        renderOverview();
        renderResults();
        renderWaves();
        renderCutoffs();
    }

    function renderOverview() {
        const entries = state.results.length;
        const finishers = state.finishers.length;
        const completion = entries ? finishers / entries * 100 : 0;
        const largest = [...state.waveGroups.entries()].sort((a, b) => b[1].length - a[1].length)[0] || ['—', []];
        $('#overviewTitle').textContent = RACES[state.race].label;
        $('#overviewSummary').textContent = `${finishers.toLocaleString()} finishers moved through a ${state.race === 'skate' ? 'freestyle' : 'classic-technique'} field shaped by ${state.waveGroups.size} starting groups.`;
        $('#statFinishers').textContent = finishers.toLocaleString();
        $('#statCompletion').textContent = `${completion.toFixed(1)}% of ${entries.toLocaleString()} entries`;
        $('#statWinner').textContent = state.winner ? formatTime(state.winner.timeSeconds) : '—';
        $('#statWinnerName').textContent = state.winner ? displayName(state.winner.name) : 'Field leader';
        $('#statMedian').textContent = formatTime(median(state.times));
        $('#statLargestWave').textContent = largest[0];
        $('#statLargestWaveCount').textContent = `${largest[1].length.toLocaleString()} finishers`;
        renderGender();
        renderTimeDistribution();
        renderAges();
        renderRegions();
        $('#historyChart').innerHTML = '<span class="history-loading">Loading the five-edition view…</span>';
    }

    async function loadHistory() {
        const token = ++historyToken;
        const race = state.race;
        try {
            const files = await Promise.all(YEARS.map((year) => fetchDataset(race, year)));
            if (token !== historyToken || race !== state.race) return;
            const values = files.map((file) => file.results.filter((result) => result.isFinisher).length);
            const max = Math.max(...values, 1);
            $('#historyChart').innerHTML = files.map((file, index) => {
                const count = values[index];
                const height = Math.max(4, count / max * 205);
                return `<div class="history-column ${file.year === state.year ? 'active' : ''}" aria-label="${file.year}: ${count.toLocaleString()} finishers"><b>${count.toLocaleString()}</b><i style="height:${height}px"></i><span>${file.year}</span></div>`;
            }).join('');
        } catch (_error) {
            if (token === historyToken) $('#historyChart').innerHTML = '<span class="history-loading">Five-edition history unavailable.</span>';
        }
    }

    function renderGender() {
        const counts = new Map();
        state.finishers.forEach((result) => {
            const label = result.gender === 'M' ? 'Men' : result.gender === 'F' ? 'Women' : 'Other';
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        const items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const total = state.finishers.length || 1;
        const colors = { Men: 'var(--birkie-mint)', Women: 'var(--birkie-red)', Other: 'var(--birkie-gold)' };
        let cursor = 0;
        const gradient = items.map(([label, count]) => {
            const start = cursor;
            cursor += count / total * 100;
            return `${colors[label]} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
        }).join(', ');
        const largestPercent = items.length ? items[0][1] / total * 100 : 0;
        $('#genderDonut').style.background = `conic-gradient(${gradient || 'var(--birkie-line) 0 100%'})`;
        $('#genderDonut').setAttribute('aria-label', items.map(([label, count]) => `${label} ${count}`).join(', '));
        $('#genderPrimaryPct').textContent = `${largestPercent.toFixed(0)}%`;
        $('#genderTotal').textContent = `${state.finishers.length.toLocaleString()} athletes`;
        $('#genderLegend').innerHTML = items.map(([label, count]) => `<div><i style="background:${colors[label]}"></i><span>${label}</span><strong>${count.toLocaleString()}</strong></div>`).join('');
    }

    function renderTimeDistribution() {
        if (!state.times.length) {
            $('#timeDistribution').innerHTML = '';
            return;
        }
        const step = 1800;
        const start = Math.floor(state.times[0] / step) * step;
        const end = Math.ceil(state.times[state.times.length - 1] / step) * step;
        const bins = [];
        for (let value = start; value <= end; value += step) bins.push({ start: value, count: 0 });
        state.times.forEach((time) => {
            const index = Math.min(bins.length - 1, Math.floor((time - start) / step));
            bins[index].count += 1;
        });
        const max = Math.max(...bins.map((bin) => bin.count), 1);
        $('#timeDistribution').innerHTML = bins.map((bin) => {
            const height = Math.max(3, bin.count / max * 210);
            return `<div class="distribution-bin" aria-label="${formatTime(bin.start, false)}: ${bin.count} finishers"><b>${bin.count || ''}</b><i style="height:${height}px"></i><span>${formatTime(bin.start, false)}</span></div>`;
        }).join('');
    }

    function renderAges() {
        const buckets = [
            { label: '<20', min: 0, max: 20 }, { label: '20–29', min: 20, max: 30 },
            { label: '30–39', min: 30, max: 40 }, { label: '40–49', min: 40, max: 50 },
            { label: '50–59', min: 50, max: 60 }, { label: '60–69', min: 60, max: 70 },
            { label: '70+', min: 70, max: Infinity },
        ];
        buckets.forEach((bucket) => {
            bucket.count = state.finishers.filter((result) => {
                const age = Number(result.age);
                return Number.isFinite(age) && age >= bucket.min && age < bucket.max;
            }).length;
        });
        const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
        $('#ageDistribution').innerHTML = buckets.map((bucket) => `<div class="compact-bar"><span>${bucket.label}</span><div class="compact-bar-track"><i style="width:${bucket.count / max * 100}%"></i></div><strong>${bucket.count}</strong></div>`).join('');
    }

    function renderRegions() {
        const counts = new Map();
        state.finishers.forEach((result) => {
            const parts = result.location.split(',').map((part) => part.trim());
            const region = parts.length > 1 ? parts[1] : '';
            if (region) counts.set(region, (counts.get(region) || 0) + 1);
        });
        const regions = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
        const total = state.finishers.length || 1;
        $('#regionList').innerHTML = regions.map(([region, count], index) => `<div class="region-item"><span>0${index + 1} · ${escapeHTML(region)}</span><strong>${count.toLocaleString()}</strong><small>${(count / total * 100).toFixed(1)}% of field</small></div>`).join('');
    }

    function filteredResults() {
        const query = $('#resultSearch').value.trim().toLowerCase();
        const gender = $('#genderFilter').value;
        const wave = $('#waveFilter').value;
        const sort = $('#resultSort').value;
        const list = state.results.filter((result) => {
            if (query && !result.search.includes(query)) return false;
            if (gender !== 'all' && result.gender !== gender) return false;
            if (wave !== 'all' && result.wave !== wave) return false;
            return true;
        });
        list.sort((a, b) => {
            if (sort === 'name') return displayName(a.name).localeCompare(displayName(b.name));
            if (sort === 'time') return (a.timeSeconds || Infinity) - (b.timeSeconds || Infinity);
            if (sort === 'age') return Number(a.age || 999) - Number(b.age || 999);
            return a.placeNumber - b.placeNumber;
        });
        return list;
    }

    function renderResults() {
        const list = filteredResults();
        const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        state.resultPage = Math.min(state.resultPage, pages);
        const start = (state.resultPage - 1) * PAGE_SIZE;
        const page = list.slice(start, start + PAGE_SIZE);
        $('#resultsCount').textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'result' : 'results'}`;
        $('#resultsEmpty').hidden = list.length > 0;
        $('#resultsBody').innerHTML = page.map((result) => {
            const place = Number.isFinite(result.placeNumber) ? `#${result.placeNumber.toLocaleString()}` : result.overallPlace || '—';
            return `<tr>
                <td class="place-cell ${result.isFinisher ? '' : 'status'}">${escapeHTML(place)}</td>
                <td class="skier-cell"><strong>${escapeHTML(displayName(result.name))}</strong><small>${escapeHTML(result.location || 'Location unavailable')}</small></td>
                <td class="mono-cell">${escapeHTML(result.bib)}</td>
                <td><span class="wave-chip" style="${waveStyle(result.wave)}">${escapeHTML(result.wave)}</span></td>
                <td class="mono-cell">${escapeHTML(result.gender)}${escapeHTML(result.age)}</td>
                <td class="mono-cell">${escapeHTML(result.pace || '—')}</td>
                <td class="time-cell">${escapeHTML(result.time || '—')}</td>
                <td><button class="detail-button" type="button" data-bib="${escapeHTML(result.bib)}" aria-label="Open details for ${escapeHTML(displayName(result.name))}">↗</button></td>
            </tr>`;
        }).join('');
        $('#pageStatus').textContent = `Page ${state.resultPage} of ${pages}`;
        $('#prevPage').disabled = state.resultPage <= 1;
        $('#nextPage').disabled = state.resultPage >= pages;
    }

    function renderWaves() {
        const entries = [...state.waveGroups.entries()];
        const max = Math.max(...entries.map(([, results]) => results.length), 1);
        $('#waveBars').innerHTML = entries.map(([wave, results]) => `<button type="button" class="wave-bar ${wave === state.selectedWave ? 'active' : ''}" data-wave="${escapeHTML(wave)}" style="${waveStyle(wave)}" aria-pressed="${wave === state.selectedWave}"><span>${escapeHTML(wave)}</span><span class="wave-track"><i style="width:${Math.max(1, results.length / max * 100)}%"></i></span><b>${results.length.toLocaleString()}</b></button>`).join('');
        if (state.selectedWave) renderWaveInspector(state.selectedWave);
    }

    function renderWaveInspector(wave) {
        const results = state.waveGroups.get(wave) || [];
        if (!results.length) return;
        const sorted = [...results].sort((a, b) => a.timeSeconds - b.timeSeconds);
        const male = results.filter((result) => result.gender === 'M').length;
        const ages = results.map((result) => Number(result.age)).filter(Number.isFinite);
        const places = results.map((result) => result.placeNumber).filter(Number.isFinite);
        const averagePlace = places.length ? Math.round(places.reduce((sum, place) => sum + place, 0) / places.length) : NaN;
        $('#waveInspector').innerHTML = `<p class="micro-label">Wave profile</p><h3 style="color:${WAVE_COLORS[wave] || WAVE_COLORS['?']}">${escapeHTML(wave)}.</h3><p>${results.length.toLocaleString()} finishers started in this group. Its middle skier finished in ${formatTime(median(sorted.map((result) => result.timeSeconds)))}.</p><div class="wave-inspector-stats"><div><span>Fastest</span><strong>${formatTime(sorted[0].timeSeconds)}</strong></div><div><span>Median</span><strong>${formatTime(median(sorted.map((result) => result.timeSeconds)))}</strong></div><div><span>Gender</span><strong>${male} M · ${results.length - male} F</strong></div><div><span>Mean age</span><strong>${ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : '—'}</strong></div><div><span>Avg place</span><strong>${Number.isFinite(averagePlace) ? `#${averagePlace.toLocaleString()}` : '—'}</strong></div><div><span>Wave size</span><strong>${results.length.toLocaleString()}</strong></div></div>`;
        $$('.wave-bar').forEach((button) => {
            const active = button.dataset.wave === wave;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function searchFinishers(query) {
        const value = query.trim().toLowerCase();
        if (value.length < 2) return [];
        return state.finishers.filter((result) => result.search.includes(value)).slice(0, 7);
    }

    function renderSuggestions(input, container, kind) {
        const results = searchFinishers(input.value);
        if (!results.length) {
            container.hidden = true;
            container.innerHTML = '';
            return;
        }
        container.innerHTML = results.map((result) => `<button type="button" data-bib="${escapeHTML(result.bib)}" data-kind="${kind}"><span>${escapeHTML(displayName(result.name))}</span><small>Bib ${escapeHTML(result.bib)} · ${escapeHTML(result.time)}</small></button>`).join('');
        container.hidden = false;
    }

    function resultByBib(bib) {
        return state.results.find((result) => String(result.bib) === String(bib));
    }

    function renderWaveComparison(result) {
        state.waveRacer = result;
        $('#waveComparisonEmpty').hidden = true;
        $('#waveComparison').hidden = false;
        $('#waveComparison').innerHTML = `<div class="comparison-racer"><div><strong>${escapeHTML(displayName(result.name))}</strong><span>${escapeHTML(result.wave)} · Bib ${escapeHTML(result.bib)} · #${result.placeNumber.toLocaleString()}</span></div><b>${formatTime(result.timeSeconds)}</b></div>${[...state.waveGroups.entries()].map(([wave, group]) => {
            const sorted = group.map((item) => item.timeSeconds).sort((a, b) => a - b);
            const faster = sorted.filter((time) => time < result.timeSeconds).length;
            const slower = sorted.filter((time) => time > result.timeSeconds).length;
            const position = faster + 1;
            const marker = sorted.length > 1 ? faster / (sorted.length - 1) * 100 : 50;
            const beatPercent = sorted.length ? slower / sorted.length * 100 : 0;
            return `<div class="comparison-row" style="${waveStyle(wave)}"><span>${escapeHTML(wave)}</span><div class="comparison-track" aria-label="Projected ${position} of ${sorted.length}"><i style="width:${beatPercent}%"></i><b style="left:${Math.min(100, marker)}%"></b></div><small>#${position.toLocaleString()} of ${sorted.length.toLocaleString()} · beats ${slower.toLocaleString()}</small></div>`;
        }).join('')}`;
    }

    function projectionFor(pbe, year) {
        if (!state.cutoffs) return null;
        for (const wave of state.cutoffs.waves) {
            const cutoff = wave.cutoffs?.[String(year)];
            if (!cutoff) continue;
            const lower = cutoff.pbeLower ?? 0;
            if (cutoff.pbeUpper != null && pbe >= lower && pbe < cutoff.pbeUpper) return wave.wave;
            if (cutoff.pbeUpper == null && cutoff.pbeLower != null && pbe >= lower) return wave.wave;
        }
        return pbe < 0 ? 1 : null;
    }

    function equivalentPlace(time) {
        const index = state.times.findIndex((value) => value >= time);
        return index < 0 ? state.times.length : index + 1;
    }

    function renderPrediction(timeSeconds, racer = null) {
        if (!Number.isFinite(timeSeconds) || timeSeconds < 1200 || !state.winner) {
            $('#predictorOutput').innerHTML = '<div class="prediction-error"><p>Enter a finish time such as <strong>3:15:00</strong>.</p></div>';
            return;
        }
        const pbe = (timeSeconds - state.winner.timeSeconds) / state.winner.timeSeconds * 100;
        const place = equivalentPlace(timeSeconds);
        const projections = [2025, 2023, 2022].map((year) => ({ year, wave: projectionFor(pbe, year) }));
        const title = racer ? displayName(racer.name) : formatTime(timeSeconds);
        const subtitle = racer ? `${RACES[state.race].short} ${state.year} · ${formatTime(timeSeconds)}` : `Equivalent to approximately #${place.toLocaleString()} in the ${state.year} field`;
        $('#predictorOutput').innerHTML = `<div class="prediction-heading"><span>Projection ready</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(subtitle)}</p></div><div class="prediction-pbe"><strong>${pbe.toFixed(1)}%</strong><span>behind the ${state.year}<br>race leader</span></div><div class="projection-grid">${projections.map(({ year, wave }) => `<article class="projection-card" style="${waveStyle(wave ? `Wave ${wave}` : '?')}"><span>${year} cutoffs</span><strong>${wave ? `Wave ${wave}` : 'No match'}</strong><small>${wave ? 'Projected start group' : 'Outside archived bands'}</small></article>`).join('')}</div><p class="prediction-note">This compares relative performance against archived percent-back cutoff bands. It does not account for future weather, course, policy, or discretionary placement changes.</p>`;
    }

    function renderCutoffs() {
        if (!state.cutoffs || !state.winner) {
            $('#cutoffBody').innerHTML = '<tr><td colspan="4" class="no-cutoff">Cutoff data unavailable.</td></tr>';
            return;
        }
        const referenceYear = $('#cutoffYear').value;
        $('#cutoffBody').innerHTML = state.cutoffs.waves.map((wave) => {
            const cutoff = wave.cutoffs?.[referenceYear];
            const waveName = `Wave ${wave.wave}`;
            if (!cutoff) return `<tr style="${waveStyle(waveName)}"><td>${waveName}</td><td colspan="3" class="no-cutoff">${escapeHTML(wave.note || 'No performance cutoff · new participants')}</td></tr>`;
            const boundary = cutoff.pbeUpper ?? cutoff.pbeLower;
            const comparison = cutoff.pbeUpper != null ? `≤ ${cutoff.pbeUpper.toFixed(1)}%` : `≥ ${cutoff.pbeLower.toFixed(1)}%`;
            const time = state.winner.timeSeconds * (1 + boundary / 100);
            return `<tr style="${waveStyle(waveName)}"><td>${waveName}</td><td>${comparison}</td><td>${formatTime(time)}</td><td>#${equivalentPlace(time).toLocaleString()}</td></tr>`;
        }).join('');
    }

    function openRacer(result) {
        const dialog = $('#racerDialog');
        const content = $('#racerDialogContent');
        const isFinisher = result.isFinisher;
        const percentile = isFinisher && state.finishers.length > 1 ? (1 - (result.placeNumber - 1) / state.finishers.length) * 100 : NaN;
        const pbe = isFinisher && state.winner ? (result.timeSeconds - state.winner.timeSeconds) / state.winner.timeSeconds * 100 : NaN;
        const wave = state.waveGroups.get(result.wave) || [];
        const waveSorted = [...wave].sort((a, b) => a.timeSeconds - b.timeSeconds);
        const wavePosition = isFinisher ? waveSorted.findIndex((item) => item.bib === result.bib) + 1 : 0;
        const timeBack = isFinisher && state.winner ? result.timeSeconds - state.winner.timeSeconds : NaN;
        content.innerHTML = `<div class="racer-dialog-inner"><span class="racer-kicker">${escapeHTML(RACES[state.race].label)} · ${state.year}</span><h2 id="racerDialogTitle">${escapeHTML(displayName(result.name))}</h2><p class="racer-location">${escapeHTML(result.location || 'Location unavailable')}</p><div class="racer-time-hero"><span>${isFinisher ? 'Finish time' : 'Race status'}</span><strong>${escapeHTML(isFinisher ? formatTime(result.timeSeconds) : result.overallPlace || '—')}</strong><small>${isFinisher ? `${escapeHTML(result.pace || '—')} min/km · ${formatTime(timeBack)} behind leader` : 'No valid finish time recorded'}</small><i aria-hidden="true"></i></div><div class="racer-stat-grid"><div><span>Overall</span><strong>${Number.isFinite(result.placeNumber) ? `#${result.placeNumber.toLocaleString()}` : '—'}</strong></div><div><span>Bib</span><strong>${escapeHTML(result.bib)}</strong></div><div><span>Start</span><strong>${escapeHTML(result.wave)}</strong></div><div><span>Age / gender</span><strong>${escapeHTML(result.age || '—')} · ${escapeHTML(result.gender || '—')}</strong></div><div><span>Field percentile</span><strong>${Number.isFinite(percentile) ? `${percentile.toFixed(1)}%` : '—'}</strong></div><div><span>Percent back</span><strong>${Number.isFinite(pbe) ? `${pbe.toFixed(1)}%` : '—'}</strong></div><div><span>Wave place</span><strong>${wavePosition ? `#${wavePosition} / ${wave.length}` : '—'}</strong></div><div><span>Beat in wave</span><strong>${wavePosition ? (wave.length - wavePosition).toLocaleString() : '—'}</strong></div><div><span>Lost to in wave</span><strong>${wavePosition ? (wavePosition - 1).toLocaleString() : '—'}</strong></div></div><section class="racer-section"><h3>Five-edition history</h3><div id="racerHistory"><span class="racer-history-loading">Tracing this skier through the archive…</span></div></section></div>`;
        if (!dialog.open) dialog.showModal();
        loadRacerHistory(result, state.race);
    }

    async function loadRacerHistory(result, race) {
        try {
            const files = await Promise.all(YEARS.map((year) => fetchDataset(race, year)));
            if (!$('#racerDialog').open || race !== state.race) return;
            const key = result.name.trim().toLowerCase();
            const history = files.map((file) => {
                const match = file.results.find((item) => item.name.trim().toLowerCase() === key && item.isFinisher);
                if (!match) return null;
                const winner = file.results.filter((item) => item.isFinisher).sort((a, b) => a.placeNumber - b.placeNumber)[0];
                const pbe = winner ? (match.timeSeconds - winner.timeSeconds) / winner.timeSeconds * 100 : NaN;
                return { year: file.year, match, pbe };
            }).filter(Boolean).sort((a, b) => b.year - a.year);
            $('#racerHistory').innerHTML = history.length ? history.map((item) => `<div class="racer-history-row"><span>${item.year}</span><b>${formatTime(item.match.timeSeconds)}</b><small>#${item.match.placeNumber.toLocaleString()}</small><small>${item.pbe.toFixed(1)}% PBE</small></div>`).join('') : '<span class="racer-history-loading">No other matching finishes found in this race archive.</span>';
        } catch (_error) {
            if ($('#racerHistory')) $('#racerHistory').innerHTML = '<span class="racer-history-loading">Historical finishes could not be loaded.</span>';
        }
    }

    function selectView(view, focus = false) {
        state.view = view;
        $$('.dashboard-tabs [role="tab"]').forEach((tab) => {
            const active = tab.dataset.view === view;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            if (active && focus) tab.focus();
        });
        $$('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== view; });
    }

    function bindEvents() {
        $$('.race-switch button').forEach((button) => button.addEventListener('click', () => {
            if (button.dataset.race === state.race) return;
            state.race = button.dataset.race;
            $$('.race-switch button').forEach((item) => {
                const active = item.dataset.race === state.race;
                item.classList.toggle('active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            loadSelected();
        }));
        $('#yearSelect').addEventListener('change', (event) => {
            state.year = Number(event.target.value);
            loadSelected();
        });
        $$('.dashboard-tabs [role="tab"]').forEach((tab) => tab.addEventListener('click', () => selectView(tab.dataset.view)));
        $('.dashboard-tabs').addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = $$('.dashboard-tabs [role="tab"]');
            const current = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
            let next = current;
            if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            event.preventDefault();
            selectView(tabs[next].dataset.view, true);
        });

        ['resultSearch', 'genderFilter', 'waveFilter', 'resultSort'].forEach((id) => {
            $(`#${id}`).addEventListener(id === 'resultSearch' ? 'input' : 'change', () => {
                state.resultPage = 1;
                renderResults();
            });
        });
        $('#clearResults').addEventListener('click', () => {
            $('#resultSearch').value = '';
            $('#genderFilter').value = 'all';
            $('#waveFilter').value = 'all';
            $('#resultSort').value = 'place';
            state.resultPage = 1;
            renderResults();
        });
        $('#prevPage').addEventListener('click', () => { state.resultPage -= 1; renderResults(); $('#panel-results').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        $('#nextPage').addEventListener('click', () => { state.resultPage += 1; renderResults(); $('#panel-results').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        $('#resultsBody').addEventListener('click', (event) => {
            const button = event.target.closest('[data-bib]');
            if (!button) return;
            const result = resultByBib(button.dataset.bib);
            if (result) openRacer(result);
        });
        $('#waveBars').addEventListener('click', (event) => {
            const button = event.target.closest('[data-wave]');
            if (!button) return;
            state.selectedWave = button.dataset.wave;
            renderWaveInspector(state.selectedWave);
        });

        $('#waveRacerSearch').addEventListener('input', () => renderSuggestions($('#waveRacerSearch'), $('#waveSuggestions'), 'wave'));
        $('#predictorRacerSearch').addEventListener('input', () => renderSuggestions($('#predictorRacerSearch'), $('#predictorSuggestions'), 'predictor'));
        $$('.search-suggestions').forEach((container) => container.addEventListener('click', (event) => {
            const button = event.target.closest('[data-bib]');
            if (!button) return;
            const result = resultByBib(button.dataset.bib);
            if (!result) return;
            container.hidden = true;
            if (button.dataset.kind === 'wave') {
                $('#waveRacerSearch').value = displayName(result.name);
                renderWaveComparison(result);
            } else {
                $('#predictorRacerSearch').value = displayName(result.name);
                $('#finishTimeInput').value = formatTime(result.timeSeconds);
                renderPrediction(result.timeSeconds, result);
            }
        }));
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.typeahead-wrap')) $$('.search-suggestions').forEach((container) => { container.hidden = true; });
        });

        $('#predictorForm').addEventListener('submit', (event) => {
            event.preventDefault();
            renderPrediction(parseTime($('#finishTimeInput').value));
        });
        $('#cutoffYear').addEventListener('change', renderCutoffs);
        $('#retryLoad').addEventListener('click', loadSelected);
        $('#closeRacerDialog').addEventListener('click', () => $('#racerDialog').close());
        $('#racerDialog').addEventListener('click', (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
        });
    }

    bindEvents();
    selectView('overview');
    loadSelected();
});
