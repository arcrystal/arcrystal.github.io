// Racing page tools: the pace calculators and the race-row enhancements (pace per mile, Strava links
// and route thumbnails). `mount()` is the interface the shell has always used: no arguments, run once
// per visit; it still works. It now also accepts a root element, returns a cleanup function, and can
// run again on the same document without doubling anything. The maths is exported as plain functions
// (no DOM) so tools/cinema/racing/calculator.test.mjs can check it.

export const DISTANCES = [
    { label: '1 mile', meters: 1609.344 },
    { label: '5K', meters: 5000 },
    { label: '10K', meters: 10000 },
    { label: 'Half marathon', meters: 21097.5 },
    { label: 'Marathon', meters: 42195 },
    { label: '50K', meters: 50000 }
];
export const MILE = 1609.344;
export const RIEGEL_EXPONENT = 1.06;

/** Seconds as h:mm:ss, or m:ss under an hour; '—' for anything that is not a positive time. */
export const clock = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
};

/** 'h:mm:ss' or 'm:ss' (fractions allowed on the seconds) to seconds; 0 when it cannot be read. */
export const secondsFromClock = (value) => {
    const parts = value.trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
};

/** Pace and equivalent efforts from one benchmark result (the first calculator). */
export function equivalents(baseMeters, baseSeconds) {
    const secondsPerMeter = baseSeconds / baseMeters;
    return {
        paceMile: secondsPerMeter * MILE,
        paceKm: secondsPerMeter * 1000,
        rows: DISTANCES.map(({ label, meters }) => {
            const equivalent = baseSeconds * Math.pow(meters / baseMeters, RIEGEL_EXPONENT);
            const exact = secondsPerMeter * meters;
            return { label, meters, equivalent, exact, projectedPace: equivalent / meters * MILE };
        })
    };
}

/** Finish time and the pace in the other unit from an exact pace (the second calculator). */
export function exactFinish(paceSeconds, paceUnitMeters, distanceMeters) {
    const secondsPerMeter = paceSeconds / paceUnitMeters;
    const otherUnit = paceUnitMeters === MILE ? 1000 : MILE;
    return {
        finish: secondsPerMeter * distanceMeters,
        otherPace: secondsPerMeter * otherUnit,
        otherLabel: paceUnitMeters === MILE ? 'km' : 'mi'
    };
}

/** The rows of the equivalents table as HTML (also used to prerender the page's default state). */
export function projectionRowsHtml(rows) {
    return rows.map(({ label, equivalent, exact, projectedPace }) =>
        `<tr><th>${label}</th><td>${clock(equivalent)}</td><td>${clock(exact)}</td><td>${clock(projectedPace)} / mi</td></tr>`).join('');
}

/** Average pace of a recorded row: per mile, or per 100 yd for a swim. */
export function rowPace(distance, unit, elapsedSeconds, isSwim = false) {
    const miles = unit === 'mi' ? distance : distance / 1760;
    if (miles < 1 || !elapsedSeconds) return null;
    return isSwim ? `${clock(elapsedSeconds / (distance / 100))} / 100 yd` : `${clock(elapsedSeconds / miles)} / mi`;
}

// Strava activity for each race row, keyed by date|title: [activity id, has a route map in static/strava/activities].
export const RACE_ACTIVITIES = new Map([
    ['2026-02-17|TNR #7', ['17435011524', true]],
    ['2026-02-10|TNR #6', ['17435435356', false]],
    ['2026-02-03|TNR #5', ['17278650670', true]],
    ['2026-01-27|TNR #4', ['17200824239', true]],
    ['2026-01-20|TNR #3', ['17122799507', true]],
    ['2026-01-13|TNR #2', ['17041858026', true]],
    ['2026-01-06|TNR #1', ['16963367742', true]],
    ['2025-12-30|TNR Practice Race+', ['16889614358', true]],
    ['2025-03-04|TNR #10?: Handicapped', ['13791955976', true]],
    ['2025-02-18|TNR #7', ['13665744558', true]],
    ['2025-02-11|TNR #6', ['13604615858', true]],
    ['2025-02-04|TNR #5', ['13542728352', true]],
    ['2026-02-21|Birkie 2026', ['17475380288', true]],
    ['2025-02-22|Birkie 2025', ['13698700840', true]],
    ['2025-11-02|BUSA Bushwhack 2025', ['16334701119', false]],
    ['2023-10-29|BUSA 2023', ['10125847794', true]],
    ['2022-10-30|BUSA Bushwhack 2022', ['8043864183', true]],
    ['2026-08-08|Guinea Pig Mile', ['19662102258', false]],
    ['2024-04-20|Brown Invite Mile', ['11226313323', true]],
    ['2024-03-24|Home Meet Mile', ['11031156852', false]],
    ['2024-03-03|Mile at Harvard', ['10885249588', false]],
    ['2024-02-25|Mile at Brown', ['10837294033', false]],
    ['2023-11-11|Mile TT', ['10200726015', true]],
    ['2024-04-14|UMass Lowell Invite 4×400', ['11183910474', false]],
    ['2024-03-03|200m at Harvard', ['10885459288', false]],
    ['2024-02-25|400m at Brown', ['10837359905', false]],
    ['2025-10-22|Company 5K #2', ['16223892752', true]],
    ['2024-04-13|Newport Half Marathon', ['11174908379', false]],
    ['2022-10-22|NIRCA Regionals', ['8003720515', false]],
    ['2022-10-16|Lunch Run', ['7973693971', false]],
    ['2022-09-24|BC Race', ['7860219374', false]],
    ['2026-07-12|Loon Mountain Race', ['19283054118', false]],
    ['2026-06-27|Mt. Washington Auto Road Race', ['19088722062', false]],
    ['2026-06-05|24-hour Jamaica Pond Challenge', ['18818364156', true]],
    ['2026-01-30|Last Nordic Skier Standing Race', ['17233779181', true]],
    ['2025-11-19|Triple Stadium', ['16509588482', true]],
    ['2021-08-15|Half Ironman swim', ['5801177791', false]],
    ['2021-08-15|Half Ironman ride', ['5801405127', false]],
    ['2021-08-15|Half Ironman run', ['5801204412', false]]
]);

export function stravaUrl(id) { return `https://www.strava.com/activities/${id}`; }

/** Mounts the page tools on `root` (the whole document by default). Returns a cleanup function. */
export function mount(root = document) {
    const doc = root.ownerDocument || root;
    const $ = (id) => doc.getElementById(id);
    const cleanups = [];
    const listen = (target, type, fn) => {
        if (!target) return;
        target.addEventListener(type, fn);
        cleanups.push(() => target.removeEventListener(type, fn));
    };

    // Race rows: pace per mile, Strava links and route thumbnails. A row is enhanced once; cleanup
    // removes what was added, so Back and Forward on one document never double it.
    root.querySelectorAll('.race-row:not([data-enhanced])').forEach((row) => {
        const meta = row.querySelector('.race-meta');
        const finish = row.querySelector(':scope > strong, :scope > .race-time > strong');
        const distanceMatch = meta?.textContent.match(/([\d,.]+)\s*(mi|yd)\b/i);
        const title = row.querySelector('.race-title, h3')?.textContent.trim();
        const date = row.querySelector('time')?.getAttribute('datetime');
        const activity = RACE_ACTIVITIES.get(`${date}|${title}`);
        const added = [];
        let wrapped = null;

        let result = finish?.parentElement?.matches('.race-time, .race-result') ? finish.parentElement : null;
        if (finish && distanceMatch) {
            const distance = Number(distanceMatch[1].replace(/,/g, ''));
            const unit = distanceMatch[2].toLowerCase();
            const elapsed = secondsFromClock(finish.textContent);
            const isSwim = row.querySelector('.discipline-pill')?.textContent.trim().toLowerCase() === 'swim';
            const text = rowPace(distance, unit, elapsed, isSwim);
            if (text) {
                if (!result) {
                    result = doc.createElement('div');
                    result.className = 'race-result';
                    finish.replaceWith(result);
                    result.append(finish);
                    wrapped = { result, finish };
                }
                const pace = doc.createElement('small');
                pace.className = 'race-pace';
                pace.textContent = text;
                result.append(pace);
                added.push(pace);
            }
        }
        if (activity) {
            const [activityId, hasMap] = activity;
            const link = doc.createElement('a');
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.href = stravaUrl(activityId);
            if (hasMap) {
                link.className = 'race-route-thumb';
                link.setAttribute('aria-label', `Open ${title} on Strava`);
                const image = doc.createElement('img');
                image.src = `/static/strava/activities/${activityId}.png`;
                image.alt = `${title} route map from Strava`;
                image.loading = 'lazy';
                image.width = 1035;
                image.height = 350;
                link.append(image);
                const lead = row.querySelector(':scope > div:not(.race-result):not(.race-time)');
                lead?.prepend(link);
                added.push(link);
            } else if (result) {
                link.className = 'race-strava-link';
                link.textContent = 'Strava ↗';
                result.append(link);
                added.push(link);
            }
        }
        row.dataset.enhanced = '';
        cleanups.push(() => {
            added.forEach((node) => node.remove());
            if (wrapped) wrapped.result.replaceWith(wrapped.finish);
            delete row.dataset.enhanced;
        });
    });

    const number = (id) => Number($(id)?.value) || 0;
    const selectedDistance = (selectId, valueId, unitId) => {
        const select = $(selectId);
        return select.value === 'custom' ? number(valueId) * number(unitId) : Number(select.value);
    };
    const syncCustom = (selectId, containerId) => {
        const container = $(containerId);
        if (container) container.hidden = $(selectId).value !== 'custom';
    };

    const equivalentForm = $('raceEquivalentCalculator');
    const projectionRows = $('projectionRows');
    function updateEquivalents() {
        if (!equivalentForm) return;
        const baseDistance = selectedDistance('benchmarkDistance', 'benchmarkDistanceValue', 'benchmarkDistanceUnit');
        const baseTime = number('benchmarkHours') * 3600 + number('benchmarkMinutes') * 60 + number('benchmarkSeconds');
        const result = equivalents(baseDistance, baseTime);
        $('benchmarkPace').textContent = `${clock(result.paceMile)} / mi`;
        $('benchmarkMetricPace').textContent = `${clock(result.paceKm)} / km`;
        projectionRows.innerHTML = projectionRowsHtml(result.rows);
    }
    listen(equivalentForm, 'input', updateEquivalents);
    listen(equivalentForm, 'change', () => { syncCustom('benchmarkDistance', 'benchmarkCustom'); updateEquivalents(); });
    listen(equivalentForm, 'submit', (event) => event.preventDefault());
    listen(equivalentForm, 'reset', () => { const t = setTimeout(() => { syncCustom('benchmarkDistance', 'benchmarkCustom'); updateEquivalents(); }, 0); cleanups.push(() => clearTimeout(t)); });

    const exactForm = $('exactPaceCalculator');
    function updateExact() {
        if (!exactForm) return;
        const distance = selectedDistance('exactDistance', 'exactDistanceValue', 'exactDistanceUnit');
        const result = exactFinish(number('exactPaceMinutes') * 60 + number('exactPaceSeconds'), number('exactPaceUnit'), distance);
        $('exactFinishTime').textContent = clock(result.finish);
        $('exactConvertedPace').textContent = `${clock(result.otherPace)} / ${result.otherLabel}`;
    }
    listen(exactForm, 'input', updateExact);
    listen(exactForm, 'change', () => { syncCustom('exactDistance', 'exactCustom'); updateExact(); });
    listen(exactForm, 'submit', (event) => event.preventDefault());
    listen(exactForm, 'reset', () => { const t = setTimeout(() => { syncCustom('exactDistance', 'exactCustom'); updateExact(); }, 0); cleanups.push(() => clearTimeout(t)); });

    if (equivalentForm) { syncCustom('benchmarkDistance', 'benchmarkCustom'); updateEquivalents(); }
    if (exactForm) { syncCustom('exactDistance', 'exactCustom'); updateExact(); }

    let done = false;
    return () => {
        if (done) return;
        done = true;
        cleanups.splice(0).reverse().forEach((fn) => fn());
    };
}
