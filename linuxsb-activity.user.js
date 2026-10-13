// ==UserScript==
// @name         LINUX SB 我的活跃度
// @namespace    local.linuxsb.activity
// @version      1.0.1
// @description  突出活跃度和账号状态，按低分项目给出提升建议
// @match        https://linux.sb/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(() => {
    'use strict';
    if (window.top !== window.self || document.getElementById('linuxsb-activity-helper')) return;

    const ACTIVITY_URL = new URL('/community_activity/', location.origin);
    const PREFERENCE_KEY = 'linuxsb-activity-helper-expanded';
    // Names follow the official page. Score caps always come from the response.
    const METRICS = [
        { name: '参与红包', label: '参与红包' },
        { name: '精华/热议', label: '精华 / 热议' },
        { name: '参与主题', label: '参与主题' },
        { name: '参与版块', label: '参与版块' },
        { name: '有效主题', label: '有效主题' },
        { name: '有效参与天数', label: '有效参与天数' },
        { name: '注册时长', label: '注册时长' },
        { name: '签到天数', label: '签到天数' },
        { name: '主动打赏', label: '主动打赏' },
        { name: '被动打赏', label: '被动打赏' },
    ];
    const ICON_REFRESH = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    const ICON_CHEVRON = '<svg class="chev" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const host = document.createElement('div');
    host.id = 'linuxsb-activity-helper';
    host.style.cssText = 'all:initial!important;position:fixed!important;right:16px!important;bottom:max(16px,env(safe-area-inset-bottom))!important;z-index:2147483000!important;max-width:calc(100vw - 32px)!important;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
        <style>
            :host { color-scheme:light dark; }
            * { box-sizing:border-box; }
            [hidden] { display:none!important; }
            .panel { display:flex; flex-direction:column; width:360px; max-width:calc(100vw - 32px);
                max-height:min(78vh,680px); max-height:min(78dvh,680px); overflow:hidden;
                background:var(--bg); color:var(--text); border:1px solid var(--line);
                border-radius:18px; box-shadow:0 16px 48px #0003,0 2px 6px #0001;
                font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
                transform-origin:bottom right; animation:pop .18s ease-out;
                --bg:#fff; --text:#172033; --muted:#6b778c; --line:#e8ecf2;
                --soft:#f3f6fa; --link:#2563eb; --warn:#b45309; --warn-bg:#fff1d6;
                --low:#c2410c; --track:#edf0f5; --good:#17856d; --bar:#8194ad; }
            button,a,summary { -webkit-tap-highlight-color:transparent; }
            button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; }
            button:disabled { cursor:progress; }
            button:focus-visible,a:focus-visible,summary:focus-visible,.metric:focus-visible {
                outline:2px solid var(--link); outline-offset:2px; }
            a { color:var(--muted); text-decoration:none; }
            a:hover { color:var(--link); }

            header { display:flex; align-items:center; justify-content:space-between;
                padding:12px 12px 4px 16px; gap:12px; }
            header strong { font-size:13px; font-weight:600; }
            .actions { display:flex; gap:2px; }
            .icon-btn { display:grid; place-items:center; width:30px; height:30px; border-radius:8px;
                color:var(--muted); transition:background .15s,color .15s; }
            .icon-btn:hover:not(:disabled) { background:var(--soft); color:var(--text); }
            #refresh.loading svg { animation:spin .8s linear infinite; }

            .body { flex:1; min-height:0; padding:0 16px 8px; overflow:auto; overscroll-behavior:contain; }
            footer { display:flex; align-items:center; justify-content:space-between; gap:12px;
                padding:9px 16px 11px; border-top:1px solid var(--line); color:var(--muted); font-size:11px; }

            .hero { padding:6px 0 14px; border-bottom:1px solid var(--line); }
            .hero-main { display:flex; align-items:center; justify-content:space-between; gap:16px; }
            .score-line { display:flex; align-items:baseline; gap:6px; }
            #score { font-size:52px; font-weight:750; line-height:1.1; letter-spacing:-2px;
                font-variant-numeric:tabular-nums; }
            .unit { color:var(--muted); font-size:13px; }
            #period { margin-top:2px; color:var(--muted); font-size:11px; }
            #account-state { border-radius:999px; background:var(--soft); padding:5px 12px;
                color:var(--text); font-size:13px; font-weight:650; }
            #account-state.warning { color:var(--warn); background:var(--warn-bg); }
            .overall { margin-top:12px; --tone:var(--link); }
            .overall-miss { display:flex; justify-content:space-between; align-items:flex-start; gap:8px;
                margin:6px 0 0; color:var(--warn); font-size:11px; }
            .overall-miss .link-btn { flex-shrink:0; color:inherit; text-decoration:underline; }
            .overall-text { display:flex; justify-content:space-between; color:var(--muted); font-size:11px;
                font-variant-numeric:tabular-nums; }

            #status { display:flex; align-items:center; justify-content:space-between; gap:12px;
                margin:12px 0; padding:10px 12px; border-radius:10px; background:var(--soft);
                color:var(--muted); font-size:12px; }
            #status.error { color:var(--warn); background:var(--warn-bg); }
            #retry { flex-shrink:0; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:600;
                background:#0000000d; color:inherit; }
            #retry:hover { background:#0000001a; }

            .skeleton { padding:10px 0; }
            .sk { border-radius:8px; background:linear-gradient(90deg,var(--soft) 25%,var(--track) 50%,var(--soft) 75%);
                background-size:200% 100%; animation:shimmer 1.2s linear infinite; }
            .sk.big { width:46%; height:52px; margin-bottom:16px; }
            .sk.row { height:34px; margin-bottom:10px; }

            #content { transition:opacity .2s; }
            #content.stale { opacity:.45; pointer-events:none; }
            .section-head { display:flex; justify-content:space-between; align-items:center;
                margin:14px 0 4px; font-size:12px; }
            .section-head strong { font-weight:650; }
            .section-tools { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:11px; }
            .link-btn { color:var(--muted); font-size:11px; padding:2px 0; }
            .link-btn:hover { color:var(--link); }

            .metric { margin:0 -8px; padding:9px 8px; border-radius:10px; cursor:pointer;
                transition:background .15s; --tone:var(--bar); }
            .metric:hover, .metric.open { background:var(--soft); }
            .metric[data-tone=low] { --tone:var(--low); }
            .metric[data-tone=full] { --tone:var(--good); }
            .metric-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
            .metric-title { font-weight:600; }
            .metric-meta { display:flex; align-items:center; gap:8px; flex-shrink:0; font-size:12px;
                font-variant-numeric:tabular-nums; }
            .gap { color:var(--muted); font-size:11px; }
            .metric-score { color:var(--tone); font-weight:600; }
            .chev { color:var(--muted); transition:transform .2s; }
            .metric.open .chev { transform:rotate(180deg); }
            .track { height:4px; margin:7px 0 0; border-radius:4px; overflow:hidden; background:var(--track); }
            .fill { width:0; height:100%; border-radius:4px; background:var(--tone); transition:width .5s cubic-bezier(.2,.7,.2,1); }
            .hint-wrap { display:grid; grid-template-rows:0fr; transition:grid-template-rows .2s ease; }
            .hint-wrap > div { overflow:hidden; min-height:0; }
            .metric.open .hint-wrap { grid-template-rows:1fr; }
            .hint { margin:0; padding-top:8px; color:var(--muted); font-size:12px; line-height:1.6;
                visibility:hidden; transition:visibility 0s .2s; }
            .metric.open .hint { visibility:visible; transition-delay:0s; }
            .complete { margin:12px 0; color:var(--muted); font-size:12px; }

            details { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
            summary { cursor:pointer; color:var(--muted); font-size:12px; }
            summary:hover { color:var(--text); }
            .note { margin:10px 0 4px; color:var(--muted); font-size:11px; }

            #launcher { display:inline-flex; align-items:center; gap:8px;
                font:600 13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
                color:#fff; background:#263548; padding:9px 16px 9px 13px; border:1px solid #ffffff25;
                border-radius:24px; box-shadow:0 6px 24px #0003; animation:pop .18s ease-out;
                transition:transform .15s,background .15s; }
            #launcher:hover { transform:translateY(-1px); background:#2f4258; }
            #launcher:focus-visible { outline:2px solid #93c5fd; outline-offset:2px; }
            .dot { width:8px; height:8px; border-radius:50%; background:#8a97aa; }
            #launcher[data-tone=good] .dot { background:#4ade80; }
            #launcher[data-tone=warn] .dot { background:#fbbf24; }
            #launcher[data-tone=idle] .dot { animation:pulse 1s ease-in-out infinite; }

            @keyframes pop { from { opacity:0; transform:translateY(6px) scale(.97); } }
            @keyframes spin { to { transform:rotate(360deg); } }
            @keyframes shimmer { to { background-position:-200% 0; } }
            @keyframes pulse { 50% { opacity:.3; } }
            @media (prefers-color-scheme:dark) {
                .panel { --bg:#161e2b; --text:#edf2fa; --muted:#97a5bb; --line:#2c3749;
                    --soft:#212c3e; --link:#93c5fd; --warn:#ffca70; --warn-bg:#3a2d1c;
                    --low:#f0a05a; --track:#2a3547; --good:#74d4b2; --bar:#8194ad; }
                #retry { background:#ffffff14; }
                #retry:hover { background:#ffffff24; }
            }
            @media (max-width:480px) {
                .icon-btn { width:36px; height:36px; }
                .metric { padding:11px 8px; }
            }
            @media (prefers-reduced-motion:reduce) {
                *, *::before, *::after { animation:none!important; transition:none!important; }
            }
        </style>
        <section class="panel" id="panel" aria-label="我的社区活跃度">
            <header><strong>我的活跃度</strong><div class="actions">
                <button id="refresh" class="icon-btn" type="button" aria-label="刷新" title="刷新">${ICON_REFRESH}</button>
                <button id="collapse" class="icon-btn" type="button" aria-label="收起活跃度面板" title="收起">${ICON_CLOSE}</button>
            </div></header>
            <div class="body">
                <div id="skeleton" class="skeleton" aria-hidden="true" hidden>
                    <div class="sk big"></div><div class="sk row"></div><div class="sk row"></div><div class="sk row"></div>
                </div>
                <div id="hero" class="hero" hidden>
                    <div class="hero-main">
                        <div><div class="score-line"><strong id="score"></strong><span class="unit">分</span></div>
                            <div id="period"></div></div>
                        <span id="account-state" hidden></span>
                    </div>
                    <div id="overall" class="overall" hidden>
                        <div class="overall-text"><span>已识别项目合计</span><span id="overall-num"></span></div>
                        <div class="track"><div class="fill" id="overall-fill"></div></div>
                        <div id="overall-miss" class="overall-miss" hidden><span id="miss-text"></span><button id="copy-diag" class="link-btn" type="button">复制诊断信息</button></div>
                    </div>
                </div>
                <div id="status" role="status" aria-live="polite" hidden>
                    <span id="status-text"></span><button id="retry" type="button">重试</button>
                </div>
                <div id="content" aria-busy="false" hidden>
                    <div class="section-head"><strong id="priority-title">优先提升</strong>
                        <span class="section-tools"><span id="low-count"></span>
                            <button id="toggle-all" class="link-btn" type="button">展开/收起全部</button></span></div>
                    <div id="priorities"></div>
                    <div id="other-section" hidden>
                        <div class="section-head"><strong>其他可提升</strong></div>
                        <div id="other-metrics"></div>
                    </div>
                    <details id="all-details"><summary id="all-summary">已满分</summary>
                        <div id="all-metrics"></div>
                    </details>
                    <p class="note">点击项目查看提升说明，说明来自官方活跃度提升指南。</p>
                </div>
            </div>
            <footer><span id="updated"></span>
                <a href="${ACTIVITY_URL.href}" target="_blank" rel="noopener noreferrer">官方明细 ↗</a></footer>
        </section>
        <button id="launcher" type="button" hidden aria-expanded="false" data-tone="idle"><span class="dot"></span><span id="launcher-text">我的活跃度</span></button>
    `;
    document.body.appendChild(host);
    const get = id => root.getElementById(id);
    const panel = get('panel');
    const launcher = get('launcher');
    const refresh = get('refresh');
    const status = get('status');
    const content = get('content');
    const skeleton = get('skeleton');
    let pending = false;
    let hasData = false;
    let lastDiag = '';
    const fmt = n => String(Number(n.toFixed(2)));

    function setLauncher(text, title, tone) {
        get('launcher-text').textContent = text;
        launcher.title = title;
        launcher.dataset.tone = tone;
    }

    // Short excerpts around each unrecognised label, so the page layout can be checked without sharing the whole page.
    function buildDiag(data, unrecognized) {
        const lines = [`linuxsb-activity 1.3.1 诊断：识别 ${data.metrics.length}/${METRICS.length} 项`];
        for (const item of unrecognized) {
            const at = data.scoreText.search(new RegExp(Array.from(item.name, ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')));
            lines.push(at < 0 ? `[${item.name}] 页面文本中没有找到该名称`
                : `[${item.name}] …${data.scoreText.slice(Math.max(0, at - 20), at + 220)}…`);
        }
        return lines.join('\n');
    }

    function setBar(el, ratio) {
        const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = width; }));
    }

    function readText(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE || node.hidden
            || node.getAttribute('aria-hidden') === 'true'
            || node.matches('script,style,noscript,template,iframe,object,embed,form,svg,aside,nav,footer,.sidebar,.forum-enhancements-left-fixed,.mobile-menu-drawer')) return '';
        return Array.from(node.childNodes, readText).join(' ');
    }

    const normalize = text => text.replace(/\s+/g, ' ').trim();
    const titleKey = text => text.replace(/\s+/g, '').replace(/／/g, '/');

    function readGuide(main) {
        const elements = Array.from(main.querySelectorAll('*'));
        const heading = elements.find(node => titleKey(readText(node)) === '活跃度提升指南');
        if (!heading) return new Map();
        const knownNames = new Set(METRICS.map(metric => metric.name));
        // Match individual headings, not occurrences of item names inside prose.
        const titles = elements.filter(node => {
            if (!(heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
            if (!knownNames.has(titleKey(readText(node)))) return false;
            if (Array.from(node.children).some(child => titleKey(readText(child)) === titleKey(readText(node)))) return false;
            const prose = node.closest('p,li,dd');
            return !prose || prose === node;
        });
        if (!titles.length) return new Map();
        let scope = heading.parentElement;
        while (scope && scope !== main && !titles.some(title => scope.contains(title))) scope = scope.parentElement;
        if (!scope) return new Map();
        const scopedTitles = titles.filter(title => scope.contains(title));
        const guide = new Map();
        for (let i = 0; i < scopedTitles.length; i++) {
            const title = scopedTitles[i];
            const name = titleKey(readText(title));
            let description = '';
            // A card or a table row provides the most precise description boundary.
            for (let card = title.parentElement; card && card !== scope; card = card.parentElement) {
                const cardNames = new Set(scopedTitles.filter(node => card.contains(node)).map(node => titleKey(readText(node))));
                if (cardNames.size > 1) break;
                const full = normalize(readText(card));
                const label = normalize(readText(title));
                if (full.startsWith(label) && full.length > label.length) {
                    description = full.slice(label.length).trim();
                    break;
                }
            }
            // Also support guides consisting of alternating headings and paragraphs.
            if (!description) {
                const range = main.ownerDocument.createRange();
                range.setStartAfter(title);
                if (scopedTitles[i + 1]) range.setEndBefore(scopedTitles[i + 1]);
                else range.setEnd(scope, scope.childNodes.length);
                const wrapper = main.ownerDocument.createElement('div');
                wrapper.appendChild(range.cloneContents());
                description = normalize(readText(wrapper));
            }
            if (description && !guide.has(name)) guide.set(name, description);
        }
        return guide;
    }

    function parseActivity(main) {
        const text = normalize(readText(main)).replace(/／/g, '/');
        const total = /(?:社区)?活跃度\s*[:：]?\s*(-?\d+(?:\.\d+)?)\s*分/.exec(text);
        if (!total) throw new Error('未识别到活跃度分数，请打开官方明细查看。');
        const tail = text.slice(total.index + total[0].length);
        // Read the adjacent official status; never infer a tier from a numeric score.
        const adjacent = /^\s*(?:当前状态\s*[:：]?\s*)?([\u4e00-\u9fff]{2,8}?)(?=\s|已|$)/.exec(tail)?.[1] || '';
        // Exclude metric labels without discarding the legitimate tier “参与者”.
        const state = /^(已|根据|最近|得分|注册|有效|参与主题|参与版块|参与红包|签到|精华|社区|具体)/.test(adjacent) ? '' : adjacent;
        const period = /最近\s*(\d+)\s*天/.exec(text);
        const names = METRICS.map(metric => metric.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const guide = readGuide(main);
        const guideIndex = text.indexOf('活跃度提升指南');
        // Rule examples in the guide must not be mistaken for the user's scores.
        const scoreText = guideIndex < 0 ? text : text.slice(0, guideIndex);
        const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const SCORE = '得分\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*(\\d+(?:\\.\\d+)?)';
        // Whitespace between characters is tolerated: "被动 打赏" counts as "被动打赏".
        const spaced = name => Array.from(name, escape).join('\\s*');
        const found = new Map();
        const claimed = new Set();
        const attempt = (i, label, reach) => {
            const boundary = names.filter((_, j) => j !== i).join('|');
            const pattern = new RegExp(`${label}((?:(?!(?:${boundary}))[\\s\\S]){0,${reach}}?)${SCORE}`);
            const match = pattern.exec(scoreText);
            if (!match) return false;
            const value = Number(match[2]);
            const max = Number(match[3]);
            if (max <= 0) return false;
            found.set(i, { value, max });
            claimed.add(match.index + match[0].lastIndexOf('得分'));
            return true;
        };
        for (let i = 0; i < METRICS.length; i++) attempt(i, names[i], 100);
        for (let i = 0; i < METRICS.length; i++) if (!found.has(i)) attempt(i, spaced(METRICS[i].name), 400);
        // A single leftover score line can only belong to the single unrecognised item.
        const unmatched = METRICS.map((_, i) => i).filter(i => !found.has(i));
        const leftovers = Array.from(scoreText.matchAll(new RegExp(SCORE, 'g'))).filter(m => !claimed.has(m.index));
        if (unmatched.length === 1 && leftovers.length === 1 && Number(leftovers[0][2]) > 0) {
            found.set(unmatched[0], { value: Number(leftovers[0][1]), max: Number(leftovers[0][2]) });
        }
        const metrics = [];
        METRICS.forEach((metric, i) => {
            if (!found.has(i)) return;
            const { value, max } = found.get(i);
            metrics.push({ ...metric, value, max, ratio: value / max, gap: Math.max(0, max - value),
                hint: guide.get(metric.name) || '未识别到该项指南，请查看官方明细。' });
        });
        return { score: total[1], state, days: period?.[1] || '', metrics, scoreText };
    }

    function metricRow(metric) {
        const row = document.createElement('div');
        row.className = 'metric';
        row.dataset.tone = metric.ratio >= 1 ? 'full' : metric.ratio < 0.6 ? 'low' : 'mid';
        // Only fixed markup is inserted; all website data uses textContent.
        row.innerHTML = `<div class="metric-top"><span class="metric-title"></span><span class="metric-meta"><span class="gap"></span><span class="metric-score"></span>${ICON_CHEVRON}</span></div><div class="track"><div class="fill"></div></div><div class="hint-wrap"><div><p class="hint"></p></div></div>`;
        row.querySelector('.metric-title').textContent = metric.label;
        row.querySelector('.metric-score').textContent = `${fmt(metric.value)}/${fmt(metric.max)}`;
        row.querySelector('.gap').textContent = metric.gap > 0 ? `差 ${fmt(metric.gap)}` : '';
        setBar(row.querySelector('.fill'), metric.ratio);
        const hint = row.querySelector('.hint');
        hint.textContent = metric.hint;
        hint.id = `activity-hint-${METRICS.findIndex(item => item.name === metric.name)}`;
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-controls', hint.id);
        row.setAttribute('aria-expanded', 'false');
        const setOpen = open => {
            row.classList.toggle('open', open);
            row.setAttribute('aria-expanded', String(open));
        };
        row.setOpen = setOpen;
        const toggle = () => setOpen(!row.classList.contains('open'));
        // One click/tap/Enter path for every input type; hovering never shifts the layout.
        row.addEventListener('click', toggle);
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            } else if (event.key === 'Escape' && row.classList.contains('open')) {
                event.stopPropagation();
                setOpen(false);
            }
        });
        return row;
    }

    function render(data) {
        get('score').textContent = data.score;
        get('period').textContent = data.days ? `最近 ${data.days} 天` : '官方评分';
        const badge = get('account-state');
        badge.textContent = data.state;
        badge.hidden = !data.state;
        badge.classList.toggle('warning', data.state === '观察期');
        get('hero').hidden = false;

        const sum = data.metrics.reduce((total, metric) => total + metric.value, 0);
        const cap = data.metrics.reduce((total, metric) => total + metric.max, 0);
        get('overall').hidden = !cap;
        if (cap) {
            get('overall-num').textContent = `${fmt(sum)} / ${fmt(cap)}`;
            setBar(get('overall-fill'), sum / cap);
        }
        const unrecognized = METRICS.filter(item => !data.metrics.some(metric => metric.name === item.name));
        const miss = get('overall-miss');
        miss.hidden = !unrecognized.length;
        get('miss-text').textContent = unrecognized.length ? `未识别：${unrecognized.map(item => item.label).join('、')}（未计入合计）` : '';
        lastDiag = unrecognized.length ? buildDiag(data, unrecognized) : '';
        if (unrecognized.length) console.warn('[linuxsb-activity] 未识别的项目：', unrecognized.map(item => item.name));
        setLauncher(`${data.score} 分${data.state ? ` · ${data.state}` : ''}`, '查看活跃度',
            data.state === '观察期' ? 'warn' : 'good');

        // Largest point gap first: that is where a bit of effort pays off most.
        const missing = data.metrics.filter(metric => metric.gap > 0).sort((a, b) => b.gap - a.gap);
        const low = missing.filter(metric => metric.ratio < 0.6);
        const priorities = low.length ? low : missing;
        const other = low.length ? missing.filter(metric => metric.ratio >= 0.6) : [];
        const full = data.metrics.filter(metric => metric.gap === 0);
        get('priority-title').textContent = low.length ? '优先提升' : '还可提升';
        get('low-count').textContent = low.length ? `${low.length} 项偏低` : '';
        get('toggle-all').hidden = !missing.length;
        get('priorities').replaceChildren(...priorities.map(metricRow));
        get('other-section').hidden = !other.length;
        get('other-metrics').replaceChildren(...other.map(metricRow));
        if (!priorities.length) {
            const note = document.createElement('p');
            note.className = 'complete';
            note.textContent = data.metrics.length ? '已识别的项目均已满分 🎉' : '暂未识别各项评分，请查看官方明细。';
            get('priorities').appendChild(note);
        }
        get('all-summary').textContent = `已满分（${full.length} 项）`;
        get('all-details').hidden = !full.length;
        get('all-details').open = false;
        get('all-metrics').replaceChildren(...full.map(metricRow));
        content.hidden = false;
        hasData = true;
        get('updated').textContent = `${new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })} 更新`;
    }

    // Never keep a previous account's numbers around after a failed refresh.
    function clearData() {
        hasData = false;
        content.hidden = true;
        get('hero').hidden = true;
        get('score').textContent = '';
        get('account-state').textContent = '';
        get('overall-num').textContent = '';
        get('overall-miss').hidden = true;
        lastDiag = '';
        get('overall-fill').style.width = '0';
        get('priorities').replaceChildren();
        get('other-metrics').replaceChildren();
        get('all-metrics').replaceChildren();
        get('updated').textContent = '';
    }

    function showError(message) {
        status.className = 'error';
        get('status-text').textContent = message;
        status.hidden = false;
        setLauncher('我的活跃度', message, 'idle');
        launcher.dataset.tone = 'error';
    }

    async function load() {
        if (pending) return;
        pending = true;
        refresh.disabled = true;
        refresh.classList.add('loading');
        content.setAttribute('aria-busy', 'true');
        status.hidden = true;
        // Keep the last result dimmed while refreshing; show a skeleton only on the first load.
        if (hasData) content.classList.add('stale');
        else skeleton.hidden = false;
        setLauncher('读取中…', '正在读取官方活跃度', 'idle');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(ACTIVITY_URL.href, {
                credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
            });
            const url = new URL(response.url);
            if (url.origin !== location.origin) throw new Error('网站跳转到了其他地址，请查看官方明细。');
            if (!response.ok) throw new Error(`读取失败（HTTP ${response.status}），请稍后刷新。`);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            if (/^\/login\/?$/.test(url.pathname) || doc.querySelector('input[type="password"]')) {
                throw new Error('请先登录 linux.sb，再点击刷新。');
            }
            if (!/^\/community_activity\/?$/.test(url.pathname)) throw new Error('未返回活跃度页面，请查看官方明细。');
            const main = doc.querySelector('main .forum-main') || doc.querySelector('main');
            if (!main) throw new Error('未能识别官方明细，请打开原页面查看。');
            render(parseActivity(main));
        } catch (error) {
            clearData();
            showError(error.name === 'AbortError' ? '读取超时，请稍后刷新。'
                : error instanceof TypeError ? '网络请求失败，请确认网站可访问后刷新。' : error.message);
        } finally {
            clearTimeout(timeout);
            pending = false;
            refresh.disabled = false;
            refresh.classList.remove('loading');
            skeleton.hidden = true;
            content.classList.remove('stale');
            content.setAttribute('aria-busy', 'false');
        }
    }

    function setExpanded(expanded, remember = true) {
        panel.hidden = !expanded;
        launcher.hidden = expanded;
        launcher.setAttribute('aria-expanded', String(expanded));
        if (remember) {
            try { localStorage.setItem(PREFERENCE_KEY, String(expanded)); } catch { /* Optional preference. */ }
        }
    }
    const collapse = () => { setExpanded(false); launcher.focus(); };
    refresh.addEventListener('click', load);
    get('retry').addEventListener('click', load);
    get('copy-diag').addEventListener('click', async event => {
        const button = event.currentTarget;
        try { await navigator.clipboard.writeText(lastDiag); button.textContent = '已复制'; }
        catch { console.info(lastDiag); button.textContent = '已输出到控制台'; }
        setTimeout(() => { button.textContent = '复制诊断信息'; }, 1800);
    });
    get('collapse').addEventListener('click', collapse);
    launcher.addEventListener('click', () => { setExpanded(true); get('collapse').focus(); });
    // Escape closes an open hint first (handled on the row), otherwise the panel.
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') collapse(); });
    get('toggle-all').addEventListener('click', () => {
        const rows = Array.from(root.querySelectorAll('#priorities .metric, #other-metrics .metric'));
        const open = !rows.every(row => row.classList.contains('open'));
        rows.forEach(row => row.setOpen(open));
    });
    let expanded = true;
    try { expanded = localStorage.getItem(PREFERENCE_KEY) !== 'false'; } catch { /* Use default. */ }
    setExpanded(expanded, false);
    // Fetch on every page load, including when the saved preference is collapsed.
    void load();
})();
