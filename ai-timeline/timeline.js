document.addEventListener('DOMContentLoaded', () => {
    const results = document.querySelector('[data-timeline-results]');
    if (!results) return;

    const timelineWindow = document.querySelector('[data-timeline-window]');
    const searchInput = document.querySelector('[data-timeline-search]');
    const yearSelect = document.querySelector('[data-year-filter]');
    const topicSelect = document.querySelector('[data-topic-filter]');
    const actorSelect = document.querySelector('[data-actor-filter]');
    const resultCount = document.querySelector('[data-result-count]');
    const yearJumps = [...document.querySelectorAll('[data-year-jump]')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const topicTags = {
        models: ['model', 'reasoning', 'multimodal', 'vision', 'image', 'video', 'audio', 'speech', 'embeddings'],
        agents: ['agents', 'tooling', 'tool-use', 'tools', 'coding', 'computer-use', 'protocol', 'research'],
        hardware: ['hardware', 'gpu', 'networking', 'foundry', 'compute', 'inference', 'wafer-scale', 'interconnect'],
        business: ['company', 'capital', 'funding', 'distribution', 'partnership', 'product'],
        governance: ['regulation', 'governance', 'courts', 'copyright', 'safety', 'privacy', 'policy', 'cyber'],
        open: ['open-weights', 'open-source', 'open-science']
    };

    const params = new URLSearchParams(location.search);
    const state = {
        year: params.get('year') || 'all',
        topic: params.get('topic') || 'all',
        actor: params.get('actor') || 'all',
        query: params.get('q') || ''
    };
    let data;
    let searchTimer;

    const make = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const updateUrl = () => {
        const next = new URLSearchParams();
        if (state.year !== 'all') next.set('year', state.year);
        if (state.topic !== 'all') next.set('topic', state.topic);
        if (state.actor !== 'all') next.set('actor', state.actor);
        if (state.query) next.set('q', state.query);
        const query = next.toString();
        history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    };

    const createDetail = (label, text) => {
        const section = make('section', 'event-detail');
        section.append(make('p', 'detail-label', label), make('p', '', text));
        return section;
    };

    const copyEventLink = async (event, button) => {
        const url = new URL(location.href);
        url.hash = event.id;
        try {
            await navigator.clipboard.writeText(url.href);
        } catch (_) {
            const helper = document.createElement('textarea');
            helper.value = url.href;
            document.body.append(helper);
            helper.select();
            document.execCommand('copy');
            helper.remove();
        }
        button.textContent = 'Copied ✓';
        window.setTimeout(() => { button.textContent = 'Copy link'; }, 1400);
    };

    const createEvent = (event) => {
        const card = make('details', `timeline-event${event.inflection ? ' is-inflection' : ''}`);
        card.id = event.id;
        const summary = make('summary', 'event-summary');
        const date = make('time', 'event-date', event.displayDate);
        date.dateTime = event.date;
        const dot = make('span', 'event-dot');
        dot.setAttribute('aria-hidden', 'true');
        const titleBlock = make('div', 'event-title-block');
        titleBlock.append(make('h3', '', event.title));
        if (event.inflection) titleBlock.append(make('p', '', 'Felt inflection'));
        const meaning = make('p', 'event-meaning', event.meaning);
        const toggle = make('i', 'event-toggle', '+');
        toggle.setAttribute('aria-hidden', 'true');
        summary.append(date, dot, titleBlock, meaning, toggle);

        const body = make('div', 'event-body');
        if (event.whyItFeltDifferent) {
            const felt = make('section', 'felt-note');
            felt.append(make('p', 'detail-label', 'Why it felt different'), make('p', '', event.whyItFeltDifferent));
            body.append(felt);
        }
        const details = make('div', 'event-detail-grid');
        details.append(
            createDetail('Development', event.development),
            createDetail('Technical change', event.technicalChange),
            createDetail('Contemporary reaction', event.reaction)
        );
        body.append(details);
        const power = make('div', 'power-row');
        const gained = make('div'); gained.append(make('span', '', '↗ Gained power'), make('p', '', event.gained));
        const lost = make('div'); lost.append(make('span', '', '↘ Lost power'), make('p', '', event.lost || 'No clear immediate loser.'));
        power.append(gained, lost);
        body.append(power);

        const footer = make('div', 'event-footer');
        const sources = make('div', 'event-sources');
        event.sources.forEach((source) => {
            const link = make('a', '', `${source.label} ↗`);
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noreferrer';
            sources.append(link);
        });
        const copy = make('button', 'copy-link', 'Copy link');
        copy.type = 'button';
        copy.addEventListener('click', () => copyEventLink(event, copy));
        footer.append(sources, copy);
        body.append(footer);
        card.append(summary, body);
        card.addEventListener('toggle', () => {
            if (card.open && document.activeElement === summary) history.replaceState(null, '', `${location.pathname}${location.search}#${event.id}`);
        });
        return card;
    };

    const matchesTopic = (event) => {
        if (state.topic === 'all') return true;
        if (state.topic === 'inflection') return event.inflection;
        return event.tags.some((tag) => topicTags[state.topic]?.includes(tag));
    };

    const renderTimeline = () => {
        const visible = data.events.filter((event) => (
            (state.year === 'all' || String(event.year) === state.year) &&
            (state.actor === 'all' || event.actors.includes(state.actor)) &&
            matchesTopic(event) && (!state.query || event.searchText.includes(state.query.toLowerCase()))
        ));
        results.replaceChildren();
        resultCount.textContent = visible.length;

        if (!visible.length) {
            const empty = make('div', 'timeline-empty');
            empty.append(make('strong', '', 'No moments found.'), make('p', '', 'Try a broader search or reset the filters.'));
            results.append(empty);
        } else {
            const grouped = visible.reduce((years, event) => {
                (years[event.year] ||= []).push(event);
                return years;
            }, {});
            Object.entries(grouped).forEach(([year, events]) => {
                const group = make('section', 'year-group');
                group.id = `year-${year}`;
                const heading = make('header', 'year-heading');
                heading.append(make('h2', '', year), make('p', '', `${events.length} ${events.length === 1 ? 'moment' : 'moments'}`));
                group.append(heading);
                events.forEach((event) => group.append(createEvent(event)));
                results.append(group);
            });
        }
        yearJumps.forEach((button) => { button.disabled = !document.getElementById(`year-${button.dataset.yearJump}`); });
        yearSelect.value = state.year;
        topicSelect.value = state.topic;
        actorSelect.value = state.actor;
        updateUrl();
        updateActiveYear();
    };

    const resetFilters = () => {
        state.year = 'all'; state.topic = 'all'; state.actor = 'all'; state.query = '';
        searchInput.value = '';
        renderTimeline();
    };

    const openHashEvent = () => {
        if (!location.hash.startsWith('#event-')) return;
        const card = document.querySelector(location.hash);
        if (!card) return;
        card.open = true;
        timelineWindow.scrollTo({ top: Math.max(0, card.offsetTop - 70), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    const updateActiveYear = () => {
        const groups = [...results.querySelectorAll('.year-group')];
        if (!groups.length) return;
        const current = groups.reduce((closest, group) => {
            const distance = Math.abs(group.offsetTop - timelineWindow.scrollTop - 20);
            return !closest || distance < closest.distance ? { year: group.id.slice(5), distance } : closest;
        }, null);
        yearJumps.forEach((button) => button.classList.toggle('active', button.dataset.yearJump === current.year));
    };

    searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => { state.query = searchInput.value.trim(); renderTimeline(); }, 120);
    });
    yearSelect.addEventListener('change', () => { state.year = yearSelect.value; renderTimeline(); timelineWindow.scrollTop = 0; });
    topicSelect.addEventListener('change', () => { state.topic = topicSelect.value; renderTimeline(); timelineWindow.scrollTop = 0; });
    actorSelect.addEventListener('change', () => { state.actor = actorSelect.value; renderTimeline(); timelineWindow.scrollTop = 0; });
    document.querySelector('[data-clear-filters]')?.addEventListener('click', resetFilters);
    yearJumps.forEach((button) => button.addEventListener('click', () => {
        const group = document.getElementById(`year-${button.dataset.yearJump}`);
        if (!group) return;
        timelineWindow.scrollTo({ top: group.offsetTop, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    timelineWindow.addEventListener('scroll', updateActiveYear, { passive: true });
    window.addEventListener('hashchange', openHashEvent);
    document.addEventListener('keydown', (event) => {
        const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
        if (event.key === '/' && !typing) { event.preventDefault(); searchInput.focus(); }
        if (event.key === 'Escape' && document.activeElement === searchInput) { state.query = ''; searchInput.value = ''; searchInput.blur(); renderTimeline(); }
    });

    fetch('timeline-data.json')
        .then((response) => {
            if (!response.ok) throw new Error(`Timeline data returned ${response.status}`);
            return response.json();
        })
        .then((timelineData) => {
            data = timelineData;
            data.events.forEach((event) => { event.searchText = JSON.stringify(event).toLowerCase(); });
            [...new Set(data.events.flatMap((event) => event.actors))].sort((a, b) => a.localeCompare(b)).forEach((actor) => {
                const option = make('option', '', actor); option.value = actor; actorSelect.append(option);
            });
            if (![...yearSelect.options].some((option) => option.value === state.year)) state.year = 'all';
            if (![...topicSelect.options].some((option) => option.value === state.topic)) state.topic = 'all';
            if (![...actorSelect.options].some((option) => option.value === state.actor)) state.actor = 'all';
            searchInput.value = state.query;
            renderTimeline();
            if (location.hash.startsWith('#event-')) requestAnimationFrame(openHashEvent);
        })
        .catch(() => {
            const empty = make('div', 'timeline-empty');
            empty.append(make('strong', '', 'The timeline could not be loaded.'), make('p', '', 'The sourced Markdown remains available above.'));
            results.replaceChildren(empty);
        });

    const benchmarkData = {
        knowledge: {
            caption: 'MMLU / MMMLU · percent correct',
            min: 65,
            note: 'MMLU became saturated and later releases increasingly report MMMLU or revised harnesses. Scores are vendor-reported and the final 2026 points use MMMLU, so the line is directional rather than a controlled league table.',
            sources: [
                ['OpenAI GPT-4 report', 'https://openai.com/index/gpt-4-research/'],
                ['Anthropic Claude 3 family card', 'https://assets.anthropic.com/m/61e7d27f8c8f5919/original/Claude-3-Model-Card.pdf'],
                ['Google Gemini report', 'https://deepmind.google/gemini/gemini_1_report.pdf'],
                ['Qwen 2.5 report', 'https://qwenlm.github.io/blog/qwen2.5-llm/'],
                ['Anthropic Opus 4.7 system card', 'https://www-cdn.anthropic.com/037f06850df7fbe871e206dad004c3db5fd50340/Claude%20Opus%204.7%20System%20Card.pdf']
            ],
            series: [
                { name: 'OpenAI', color: '#2f6f5c', points: [
                    { date: '2022-11-30', model: 'GPT-3.5', score: 70.0 }, { date: '2023-03-14', model: 'GPT-4', score: 86.4 }, { date: '2024-05-13', model: 'GPT-4o', score: 88.7 }
                ]},
                { name: 'Claude', color: '#a36131', points: [
                    { date: '2024-03-04', model: 'Claude 3 Sonnet', score: 78.3 }, { date: '2024-03-05', model: 'Claude 3 Opus', score: 86.8 }, { date: '2024-06-20', model: 'Claude 3.5 Sonnet', score: 88.7 }, { date: '2026-04-16', model: 'Claude Opus 4.7 · MMMLU', score: 91.5 }
                ]},
                { name: 'Gemini', color: '#3d6f9b', points: [
                    { date: '2023-12-06', model: 'Gemini 1.0 Ultra', score: 90.0 }, { date: '2024-02-15', model: 'Gemini 1.5 Pro', score: 85.9 }, { date: '2026-02-19', model: 'Gemini 3.1 Pro · MMMLU', score: 92.6 }
                ]},
                { name: 'Qwen', color: '#765998', points: [
                    { date: '2024-02-04', model: 'Qwen 1.5 72B', score: 75.6 }, { date: '2024-06-07', model: 'Qwen2 72B', score: 82.3 }, { date: '2024-09-19', model: 'Qwen2.5 72B', score: 86.1 }
                ]}
            ]
        },
        coding: {
            caption: 'SWE-bench Verified · resolved tasks (%)',
            min: 15,
            note: 'SWE-bench scores measure a model plus its agent scaffold, tools, prompt, and inference budget. In February 2026, OpenAI said the benchmark had become contaminated and recommended SWE-bench Pro; the historical line still captures the rapid 2024–2026 rise in coding-agent capability.',
            sources: [
                ['OpenAI SWE-bench Verified', 'https://openai.com/index/introducing-swe-bench-verified/'],
                ['Anthropic Claude 3.5 agent', 'https://www.anthropic.com/news/swe-bench-sonnet'],
                ['Anthropic Claude 4', 'https://www.anthropic.com/news/claude-4'],
                ['OpenAI GPT-5', 'https://openai.com/index/introducing-gpt-5-for-developers/'],
                ['OpenAI GPT-5.2', 'https://openai.com/index/introducing-gpt-5-2/'],
                ['Google Gemini 3', 'https://blog.google/intl/en-mena/product-updates/explore-get-answers/gemini-3-launches-in-mena/'],
                ['Anthropic Opus 4.7 system card', 'https://www-cdn.anthropic.com/037f06850df7fbe871e206dad004c3db5fd50340/Claude%20Opus%204.7%20System%20Card.pdf'],
                ['Why Verified was retired', 'https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/']
            ],
            series: [
                { name: 'OpenAI', color: '#2f6f5c', points: [
                    { date: '2024-08-13', model: 'GPT-4o', score: 33.2 }, { date: '2025-04-16', model: 'o3', score: 69.1 }, { date: '2025-08-07', model: 'GPT-5', score: 74.9 }, { date: '2025-12-11', model: 'GPT-5.2', score: 80.0 }
                ]},
                { name: 'Claude', color: '#a36131', points: [
                    { date: '2024-06-20', model: 'Claude 3.5 Sonnet', score: 33.0 }, { date: '2024-10-22', model: 'Claude 3.5 Sonnet · new', score: 49.0 }, { date: '2025-02-24', model: 'Claude 3.7 Sonnet', score: 62.3 }, { date: '2025-05-22', model: 'Claude Sonnet 4', score: 72.7 }, { date: '2026-02-05', model: 'Claude Opus 4.6', score: 80.84 }, { date: '2026-04-16', model: 'Claude Opus 4.7', score: 87.6 }
                ]},
                { name: 'Gemini', color: '#3d6f9b', points: [
                    { date: '2025-03-25', model: 'Gemini 2.5 Pro', score: 63.8 }, { date: '2025-11-18', model: 'Gemini 3 Pro', score: 76.2 }, { date: '2026-02-19', model: 'Gemini 3.1 Pro', score: 80.6 }
                ]}
            ]
        }
    };

    const canvas = document.querySelector('[data-benchmark-chart]');
    const chartWrap = canvas?.parentElement;
    const tooltip = document.querySelector('[data-chart-tooltip]');
    const legend = document.querySelector('[data-chart-legend]');
    const caption = document.querySelector('[data-benchmark-caption]');
    const notes = document.querySelector('[data-benchmark-notes]');
    const benchmarkButtons = [...document.querySelectorAll('[data-benchmark]')];
    let activeBenchmark = 'knowledge';
    let hitPoints = [];

    const dateNumber = (value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return date.getUTCFullYear() + date.getUTCMonth() / 12 + date.getUTCDate() / 365;
    };

    const drawChart = () => {
        if (!canvas || !chartWrap) return;
        const chart = benchmarkData[activeBenchmark];
        const rect = chartWrap.getBoundingClientRect();
        const width = Math.max(280, rect.width - 32);
        const height = Math.max(280, rect.height - 32);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * ratio; canvas.height = height * ratio;
        canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);
        const pad = { top: 28, right: 34, bottom: 42, left: 45 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;
        const minX = 2022.7; const maxX = 2026.55; const minY = chart.min; const maxY = 100;
        const x = (value) => pad.left + ((dateNumber(value) - minX) / (maxX - minX)) * plotW;
        const y = (value) => pad.top + (1 - (value - minY) / (maxY - minY)) * plotH;
        ctx.font = '10px "DM Mono", monospace';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(23,32,29,.14)';
        ctx.fillStyle = 'rgba(23,32,29,.62)';
        const step = activeBenchmark === 'coding' ? 20 : 5;
        for (let tick = Math.ceil(minY / step) * step; tick <= maxY; tick += step) {
            const yy = y(tick);
            ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(width - pad.right, yy); ctx.stroke();
            ctx.textAlign = 'right'; ctx.fillText(String(tick), pad.left - 9, yy);
        }
        [2023, 2024, 2025, 2026].forEach((year) => {
            const xx = pad.left + ((year - minX) / (maxX - minX)) * plotW;
            ctx.beginPath(); ctx.moveTo(xx, pad.top); ctx.lineTo(xx, height - pad.bottom); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillText(String(year), xx, height - 18);
        });
        hitPoints = [];
        chart.series.forEach((series) => {
            ctx.strokeStyle = series.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
            ctx.beginPath();
            series.points.forEach((point, index) => {
                const px = x(point.date); const py = y(point.score);
                if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.stroke();
            series.points.forEach((point) => {
                const px = x(point.date); const py = y(point.score);
                ctx.beginPath(); ctx.fillStyle = '#fffdf8'; ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.strokeStyle = series.color; ctx.lineWidth = 2; ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.stroke();
                hitPoints.push({ ...point, family: series.name, color: series.color, x: px + 16, y: py + 16 });
            });
        });
        caption.textContent = chart.caption;
        legend.replaceChildren(...chart.series.map((series) => {
            const item = make('span'); const line = make('i'); line.style.setProperty('--series-color', series.color); item.append(line, document.createTextNode(series.name)); return item;
        }));
        notes.replaceChildren();
        notes.append(make('p', '', chart.note));
        const sourceLine = make('p'); sourceLine.append(document.createTextNode('Sources: '));
        chart.sources.forEach(([label, url], index) => {
            const link = make('a', '', label); link.href = url; link.target = '_blank'; link.rel = 'noreferrer';
            sourceLine.append(link, document.createTextNode(index === chart.sources.length - 1 ? '.' : ' · '));
        });
        notes.append(sourceLine);
    };

    benchmarkButtons.forEach((button) => button.addEventListener('click', () => {
        activeBenchmark = button.dataset.benchmark;
        benchmarkButtons.forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
        tooltip.hidden = true;
        drawChart();
    }));
    canvas?.addEventListener('pointermove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left + 16; const py = event.clientY - rect.top + 16;
        const nearest = hitPoints.reduce((best, point) => {
            const distance = Math.hypot(point.x - px, point.y - py);
            return !best || distance < best.distance ? { point, distance } : best;
        }, null);
        if (!nearest || nearest.distance > 22) { tooltip.hidden = true; return; }
        const point = nearest.point;
        tooltip.replaceChildren(make('strong', '', point.model), document.createTextNode(`${point.family} · ${point.score}%`));
        tooltip.style.left = `${Math.min(rect.width - 165, Math.max(8, point.x + 7))}px`;
        tooltip.style.top = `${Math.max(8, point.y - 54)}px`;
        tooltip.hidden = false;
    });
    canvas?.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    if ('ResizeObserver' in window && chartWrap) new ResizeObserver(drawChart).observe(chartWrap); else window.addEventListener('resize', drawChart, { passive: true });
    drawChart();
});
