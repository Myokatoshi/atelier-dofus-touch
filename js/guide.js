/* Guide : trames de quêtes à suivre pas à pas (parcours conseillé par le jeu, catégories, Dofus, trame perso),
   cases à cocher par quête et par objectif, courses des objets à ramener, monstres et âmes, prérequis (niveau, Papycha). */

const GD = { open: new Set(), trame: null }; // quêtes dépliées (gardées ouvertes quand la page se redessine)
const GD_MAIN = [543, 4, 757, 775, 759, 767, 761, 763, 771, 780, 777, 779, 781, 765, 2]; // parcours conseillé : catégories du jeu dans cet ordre
const gdQ = id => D.quests.quests[id];
const gdNpc = id => D.guide.npcs[id] || "un PNJ";
const gdLvl = () => +S.settings.lvl || 200;
function gdState() { S.qobj = S.qobj || {}; S.dofus = S.dofus || {}; S.ui.myTrame = S.ui.myTrame || []; }
const gdDone = id => !!S.quests[id];
// Objectifs d'une quête (à plat)
const gdObjs = id => (D.guide.steps[id] || []).flatMap(s => s[3]);
const gdObjDone = (qid, oid) => gdDone(qid) || !!S.qobj[oid];
function gdProgress(id) { const o = gdObjs(id); if (gdDone(id)) return [o.length, o.length]; return [o.filter(x => S.qobj[x[0]]).length, o.length]; }

/* ---------- Trames ---------- */
// Une trame = liste de chapitres [{titre, quêtes}]
function gdChapterQuests(cat) {
  const c = D.guide.cats[cat]; if (!c) return [];
  const ids = c[3].filter(id => gdQ(id));
  return gdSort(ids);
}
// Ordre conseillé : quêtes précédentes (Papycha, si chargé) d'abord, sinon niveau puis ordre du jeu
function gdSort(ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  const base = ids.slice().sort((a, b) => (gdQ(a)[2] || 0) - (gdQ(b)[2] || 0) || pos.get(a) - pos.get(b));
  if (!ADV.pq || !ADV.q) return base;
  const set = new Set(ids), before = new Map(ids.map(id => [id, new Set()]));
  for (const id of ids) {
    const p = advQPapy(id); if (!p) continue;
    for (const pr of p.previous_quests || []) for (const g of ADV.q.byKey[advQKey(pr.name)] || []) if (set.has(g) && g !== id) before.get(id).add(g);
  }
  const out = [], done = new Set();
  const visit = (id, stack = new Set()) => { if (done.has(id) || stack.has(id)) return; stack.add(id); for (const b of [...before.get(id)].sort((x, y) => base.indexOf(x) - base.indexOf(y))) visit(b, stack); done.add(id); out.push(id); };
  for (const id of base) visit(id);
  return out;
}
function gdTrame(key) {
  if (key === "main") return GD_MAIN.filter(c => D.guide.cats[c]?.[3].length).map(c => ({ title: D.guide.cats[c][0].replace(/^Quêtes prioritaires : /, ""), ids: gdChapterQuests(c) }));
  if (key === "mine") return [{ title: "Ma trame", ids: S.ui.myTrame.filter(id => gdQ(id)), mine: true }];
  if (key.startsWith("c:")) { const c = key.slice(2); return [{ title: D.guide.cats[c]?.[0] || "Quêtes", ids: gdChapterQuests(c) }]; }
  return [];
}
const gdTrameName = key => key === "main" ? "Parcours conseillé" : key === "mine" ? "Ma trame" : key === "dofus" ? "Les Dofus" : (D.guide.cats[key.slice(2)]?.[0] || "Quêtes");

/* ---------- Objectifs lisibles ---------- */
function gdXY(o) { return o[5] != null && o[6] != null ? `<a class="chip" href="#carte/pos/${o[5]}/${o[6]}" title="Voir sur la carte">📍 [${o[5]},${o[6]}]</a>` : ""; }
function gdItemChip(id, n) {
  const have = S.stock[id] || 0, p = price(id);
  return `${itemLine(id, `× ${fmt(n)}${have ? ` · en stock ${fmt(have)}` : ""}${p != null ? ` · ${kam(p * Math.max(0, n - have))} à acheter` : ""}`, "s")}`;
}
function gdObjHtml(o) {
  const [, t, a, b, c] = o;
  const npc = `<b>${esc(gdNpc(a))}</b>`;
  switch (t) {
    case 1: return `Aller voir ${npc}`;
    case 9: return `Retourner voir ${npc}`;
    case 2: return `Montrer à ${npc} :<br>${gdItemChip(b, c)}`;
    case 3: return `Ramener à ${npc} :<br>${gdItemChip(b, c)}`;
    case 4: return `Découvrir la carte${D.guide.texts?.[a] ? ` <b>${esc(D.guide.texts[a])}</b>` : ""}`;
    case 5: return `Découvrir la zone <b>${esc(D.world.subareas[a]?.[0] || "")}</b>`;
    case 6: return `Vaincre ${fmt(b || 1)} × en un seul combat :<br>${monLine(a)}`;
    case 7: return `Vaincre :<br>${monLine(a)}`;
    case 14: return `Vaincre ${fmt(b || 1)} × :<br>${monLine(a)}`;
    case 12: return `Ramener ${fmt(c || 1)} âme${c > 1 ? "s" : ""} (pierre d'âme pleine) à ${npc} :<br>${monLine(b)}`;
    case 20: return `Fabriquer :<br>${itemLine(a, `× ${fmt(b || 1)}`, "s")}`;
    case 24: case 40: return `Fabriquer ${fmt(b || 1)} objet${b > 1 ? "s" : ""} de ${t === 40 ? "au moins " : ""}${fmt(a)} ingrédients`;
    case 41: case 45: case 46: return `Vaincre le boss dans son donjon :<br>${monLine(a)}`;
    case 44: return `En groupe, remporter ${fmt(a)} combat${a > 1 ? "s" : ""} contre des monstres`;
    case 39: return `Valider ${fmt(a)} étage${a > 1 ? "s" : ""} de l'Île de l'Ascension`;
    case 23: return `Terminer ${fmt(a)} quête${a > 1 ? "s" : ""} journalière${a > 1 ? "s" : ""}`;
    case 27: case 42: return `Combat${a > 1 ? "s" : ""} de Kolizéum (${fmt(a)})`;
    case 43: return `Battre ${fmt(a)} joueurs en JcJ`;
    case 0: case 10: if (D.guide.texts?.[a]) return esc(D.guide.texts[a]); return `Action en jeu (dialogue, objet à utiliser…)`;
    default: return `Action en jeu (dialogue, objet à utiliser…)`;
  }
}

/* ---------- Prérequis ---------- */
function gdPrereq(id) {
  const q = gdQ(id), out = [];
  if (q[2] && q[2] > gdLvl()) out.push(`<span class="chip warn">Niveau ${q[2]} requis</span>`);
  const p = ADV.pq ? advQPapy(id) : null;
  if (p) for (const pr of p.previous_quests || []) {
    const g = ADV.q?.byKey[advQKey(pr.name)]?.[0];
    const ok = g ? gdDone(g) : false;
    out.push(g ? `<button type="button" class="chip ${ok ? "up" : "warn"}" data-sheet="quest:${g}">${ok ? "✓" : "✗"} ${esc(advTxt(pr.name))}</button>` : `<span class="chip">${esc(advTxt(pr.name))}</span>`);
  }
  return out;
}

/* ---------- Bloc d'une quête ---------- */
function gdQuestHead(id, open) {
  const q = gdQ(id), [d, n] = gdProgress(id), pre = gdPrereq(id);
  const flags = [q[4] & 4 ? `<span class="chip sec">Principale</span>` : "", q[4] & 2 ? `<span class="chip warn">Donjon</span>` : "", q[4] & 1 ? `<span class="chip">Répétable</span>` : ""].join("");
  return `<details class="gdq ${gdDone(id) ? "done" : ""}" data-gq="${id}" ${open ? "open" : ""}><summary>
    <label class="check" onclick="event.stopPropagation()"><input type="checkbox" data-gqdone="${id}" ${gdDone(id) ? "checked" : ""} aria-label="Quête terminée"></label>
    <span class="t"><span class="nm">${esc(q[0])}</span><small>niv. ${q[2] || "—"} · ${n ? `${d}/${n} objectifs` : plural(q[5], "étape")}${(st => st ? ` · [${st.x},${st.y}]` : "")(gdStart(id))}</small></span>
    <span class="chips">${flags}${pre.slice(0, 3).join("")}</span></summary><div class="gdbody">${open ? gdQuestBody(id) : ""}</div></details>`;
}
// Point de départ : premier objectif qui a des coordonnées (et son PNJ s'il en a un)
function gdStart(id) {
  for (const o of gdObjs(id)) if (o[5] != null && o[6] != null) return { x: o[5], y: o[6], npc: [1, 2, 3, 9, 12].includes(o[1]) ? gdNpc(o[2]) : "" };
  return null;
}
function gdQuestBody(id) {
  const q = gdQ(id), steps = D.guide.steps[id] || [], pre = gdPrereq(id), p = ADV.pq ? advQPapy(id) : null, st = gdStart(id);
  let html = "";
  if (st) html += `<p class="small">📍 <b>Départ</b> : <a href="#carte/pos/${st.x}/${st.y}">[${st.x},${st.y}]</a>${st.npc ? ` · ${esc(st.npc)}` : ""}${D.world?.grid?.[`${st.x},${st.y}`] ? ` · ${esc(D.world.subareas[D.world.grid[`${st.x},${st.y}`]]?.[0] || "")}` : ""}</p>`;
  if (pre.length) html += `<div><p class="label">Prérequis</p><div class="chips">${pre.join("")}</div></div>`;
  html += steps.map((s, i) => `<div class="gdstep"><p class="label">Étape ${i + 1}${steps.length > 1 ? ` / ${steps.length}` : ""}${s[2] ? ` · niv. conseillé ${s[2]}` : ""}</p>
    ${s[0] && s[0] !== q[0] ? `<p class="nm">${esc(s[0])}</p>` : ""}${s[1] ? `<p class="small muted">${esc(s[1])}</p>` : ""}
    <div class="list">${s[3].map(o => `<div class="li ${gdObjDone(id, o[0]) ? "done" : ""}"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><label class="check"><input type="checkbox" data-gobj="${o[0]}" data-gobjq="${id}" ${gdObjDone(id, o[0]) ? "checked" : ""} aria-label="Objectif fait"></label><div class="grow">${gdObjHtml(o)}</div></div><div class="r">${gdXY(o)}</div></div>`).join("")}</div></div>`).join("");
  if (q[8].length) html += `<div><p class="label">Récompenses</p><div class="chips">${q[8].map(([it, n]) => `<button type="button" class="chip kamas" data-item="${it}">${esc(itemName(it))} × ${fmt(n)}</button>`).join("")}</div></div>`;
  html += `<div class="row"><button type="button" class="btn sm" data-sheet="quest:${id}">Fiche de la quête</button>${p ? papyLink(p.url, "Guide Papycha") : ""}${S.ui.myTrame.includes(id) ? "" : `<button type="button" class="btn sm" data-gmine="${id}">＋ Ma trame</button>`}</div>`;
  return html;
}

/* ---------- Courses et objectifs restants d'une trame ---------- */
function gdNeeds(ids) {
  const items = {}, crafts = {}, souls = {}, mons = {};
  for (const id of ids) {
    if (gdDone(id)) continue;
    for (const o of gdObjs(id)) {
      if (S.qobj[o[0]]) continue;
      const [, t, a, b, c] = o;
      if ((t === 2 || t === 3) && b) items[b] = (items[b] || 0) + (c || 1);
      if (t === 20 && a) crafts[a] = (crafts[a] || 0) + (b || 1);
      if (t === 12 && b) souls[b] = (souls[b] || 0) + (c || 1);
      if ((t === 6 || t === 7 || t === 14 || t === 41 || t === 45 || t === 46) && a) mons[a] = (mons[a] || 0) + (t === 14 || t === 6 ? b || 1 : 1);
    }
  }
  return { items, crafts, souls, mons };
}
function gdNeedsHtml(ids) {
  const N = gdNeeds(ids);
  // Objets échangeables (à acheter ou farmer) ; les objets de quête (non échangeables) s'obtiennent pendant la quête
  const buyable = id => { const x = item(id); return x && !(x.flags & 1) && x.sup !== 14; };
  const all = Object.entries(N.items).sort((a, b) => itemName(a[0]).localeCompare(itemName(b[0])));
  const it = all.filter(([id]) => buyable(id)), qi = all.filter(([id]) => !buyable(id));
  let tot = 0, miss = 0;
  const rows = it.map(([id, n]) => { const have = S.stock[id] || 0, buy = Math.max(0, n - have), p = price(id); if (buy) { if (p == null) miss++; else tot += p * buy; }
    return `<div class="li ${buy ? "" : "done"}"><div>${itemLine(id, `besoin ${fmt(n)}${have ? ` · stock ${fmt(have)}` : ""} · <b>à acheter ${fmt(buy)}</b>`, "s")}</div><div class="r">${p != null ? `<b class="num gold">${kam(p * buy)}</b>` : `<span class="muted small">prix ?</span>`}${recipe(id) ? `<button class="btn sm" data-plan-add="${id}">＋ Plan</button>` : ""}</div></div>`; }).join("");
  const cr = Object.entries(N.crafts), so = Object.entries(N.souls), mo = Object.entries(N.mons);
  return `<div class="tiles"><div class="tile kamas"><span class="label">Objets à acheter</span><span class="v">${tot ? (miss ? "≥ " : "") + kam(tot) : "—"}</span></div><div class="tile"><span class="label">Objets différents</span><span class="v">${it.length}</span></div>
      <div class="tile"><span class="label">Monstres à vaincre</span><span class="v">${mo.length}</span></div><div class="tile"><span class="label">Âmes à capturer</span><span class="v">${so.length}</span></div></div>
    ${it.length ? `<div class="row"><button type="button" class="btn sm" data-gwatch>Suivre leurs prix (tournée)</button><button type="button" class="btn sm" data-gfarm>Ajouter à ma liste de farm</button></div><div class="list">${rows}</div>${miss ? `<p class="muted small">${plural(miss, "objet")} sans prix : note-les dans Prix HDV.</p>` : ""}` : `<p class="muted small">Aucun objet à ramener dans les quêtes restantes.</p>`}
    ${qi.length ? `<details><summary class="label" style="cursor:pointer">Objets de quête, obtenus en jeu (${qi.length})</summary><div class="list">${qi.map(([id, n]) => `<div class="li"><div>${itemLine(id, `× ${fmt(n)}`, "s")}</div></div>`).join("")}</div></details>` : ""}
    ${cr.length ? `<div><p class="label">À fabriquer</p><div class="list">${cr.map(([id, n]) => `<div class="li"><div>${itemLine(id, `× ${fmt(n)}`, "s")}</div><div class="r">${recipe(id) ? `<button class="btn sm" data-plan-add="${id}">＋ Plan</button>` : ""}</div></div>`).join("")}</div></div>` : ""}
    ${so.length ? `<div><p class="label">Âmes à capturer (pierres d'âme)</p><div class="list">${so.map(([m, n]) => `<div class="li"><div>${monLine(m)}</div><div class="r"><span class="chip">× ${fmt(n)}</span><a class="btn sm" href="#carte/mon/${m}">Où le trouver</a></div></div>`).join("")}</div></div>` : ""}
    ${mo.length ? `<details><summary class="label" style="cursor:pointer">Monstres à vaincre (${mo.length})</summary><div class="list">${mo.map(([m, n]) => `<div class="li"><div>${monLine(m)}</div><div class="r"><span class="chip">× ${fmt(n)}</span><a class="btn sm" href="#carte/mon/${m}">Où le trouver</a></div></div>`).join("")}</div></details>` : ""}`;
}

/* ---------- Trame des Dofus ---------- */
function gdDofusList() {
  return Object.entries(D.core.items).filter(([, r]) => r[1] === 23).map(([id, r]) => ({ id: +id, name: r[0], lvl: r[2] })).sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
}
function gdDofusCard(d) {
  const n = norm(d.name), Q = D.quests.quests;
  const qs = Object.entries(Q).filter(([, q]) => q[8].some(r => r[0] === d.id) || norm(q[0]).includes(n)).map(([id]) => +id);
  const drops = (typeof dropsOf === "function" ? dropsOf(d.id) : []).slice().sort((a, b) => b[2] - a[2]).slice(0, 4);
  const r = recipe(d.id);
  const ach = Object.entries(D.quests.achievements).filter(([, a]) => norm(a[0]).includes(n)).slice(0, 4);
  return `<details class="gdq ${S.dofus[d.id] ? "done" : ""}"><summary><label class="check" onclick="event.stopPropagation()"><input type="checkbox" data-gdofus="${d.id}" ${S.dofus[d.id] ? "checked" : ""} aria-label="Obtenu"></label>
    ${icon(d.id, "s")}<span class="t"><span class="nm">${esc(d.name)}</span><small>niv. ${d.lvl}${S.dofus[d.id] ? " · obtenu" : ""}</small></span></summary><div class="gdbody">
    <div>${itemLine(d.id)}</div>
    ${qs.length ? `<div><p class="label">Quêtes</p><div class="list">${qs.map(id => `<div class="li ${gdDone(id) ? "done" : ""}"><button type="button" class="link itemline" data-sheet="quest:${id}">${advQImg()}<span class="t"><span class="nm">${esc(Q[id][0])}</span><small>niv. ${Q[id][2] || "—"}${Q[id][8].some(x => x[0] === d.id) ? " · donne le Dofus" : ""}</small></span></button><div class="r">${S.ui.myTrame.includes(id) ? "" : `<button type="button" class="btn sm" data-gmine="${id}">＋ Ma trame</button>`}</div></div>`).join("")}</div></div>` : ""}
    ${drops.length ? `<div><p class="label">Lâché par</p><div class="list">${drops.map(x => `<div class="li"><div>${monLine(x[0])}</div><div class="r"><span class="chip">${fmt(x[1], 3)}${x[2] !== x[1] ? ` à ${fmt(x[2], 3)}` : ""} %</span><a class="btn sm" href="#carte/mon/${x[0]}">Où le trouver</a></div></div>`).join("")}</div></div>` : ""}
    ${r ? `<div><p class="label">Recette (${esc(D.core.jobs[r[0]]?.[0] || "")})</p><div class="list">${r[1].map((ing, i) => `<div class="li"><div>${itemLine(ing, `× ${fmt(r[2][i])}`, "s")}</div></div>`).join("")}</div><div class="row"><button class="btn sm" data-plan-add="${d.id}">＋ Plan de craft</button></div></div>` : ""}
    ${ach.length ? `<div><p class="label">Succès</p><div class="chips">${ach.map(([id, a]) => `<button type="button" class="chip" data-sheet="achievement:${id}">${esc(a[0])}</button>`).join("")}</div></div>` : ""}
    ${!qs.length && !drops.length && !r ? `<p class="muted small">Obtention particulière (événement, boutique ou succès) : voir le guide de Papycha.</p>` : ""}
  </div></details>`;
}

/* ---------- Page ---------- */
page("guide", {
  title: "Guide", icon: 87003, needs: ["quests", "guide", "world", "monsters"],
  intro: "Ta progression pas à pas : le parcours conseillé par le jeu, chaque catégorie de quêtes, les Dofus et ta propre trame. Coche les quêtes et les objectifs ; les objets à ramener forment ta liste de courses.",
  render(el, args) {
    gdState();
    const f = ui("gdF", { trame: "main", hide: false });
    if (args[0]) f.trame = args[0] === "dofus" || args[0] === "mine" || args[0] === "main" ? args[0] : "c:" + args[0];
    const cats = Object.entries(D.guide.cats).filter(([k, c]) => c[3].length && c[2] === 0 && !/^(Test|OLD QUEST|Almanax)$/i.test(c[0]) && !GD_MAIN.includes(+k)).sort((a, b) => a[1][1] - b[1][1]);
    el.innerHTML = `<div class="stack">` + hero("guide") + `
      <section class="panel"><div class="filters">
        <select id="gd-trame" aria-label="Trame"><option value="main">Parcours conseillé (jeu)</option><option value="dofus">Les Dofus</option><option value="mine">Ma trame</option>
          <optgroup label="Par catégorie">${cats.map(([k, c]) => `<option value="c:${k}">${esc(c[0])} (${c[3].length})</option>`).join("")}</optgroup></select>
        <label class="check"><input type="checkbox" id="gd-hide" ${f.hide ? "checked" : ""}> Cacher ce qui est fait</label>
        <label class="fld">Mon niveau<input type="number" id="gd-lvl" min="1" max="200" value="${gdLvl()}"></label></div>
        <div id="gd-top"></div></section>
      <div id="gd-body"></div></div>`;
    $("#gd-trame", el).value = f.trame;
    const body = $("#gd-body", el), top = $("#gd-top", el);
    const draw = () => {
      setUi("gdF", f);
      if (f.trame === "dofus") {
        const L = gdDofusList(), got = L.filter(d => S.dofus[d.id]).length;
        top.innerHTML = `<div class="row between"><b>${got} / ${L.length} Dofus obtenus</b><span class="row">${papyLink("https://papycha.fr/les-dofus-sur-dofus-touch/", "Les Dofus sur Papycha")}${papyLink("https://papycha.fr/calculer-le-taux-de-drop-des-dofus/", "Taux d'obtention (Papycha)")}</span></div><div class="bar"><span style="width:${L.length ? got / L.length * 100 : 0}%"></span></div>`;
        body.innerHTML = `<section class="panel"><h2>Les Dofus</h2><div class="list">${L.filter(d => !f.hide || !S.dofus[d.id]).map(gdDofusCard).join("")}</div></section>`;
        return;
      }
      const T = gdTrame(f.trame), all = T.flatMap(c => c.ids);
      const done = all.filter(gdDone).length;
      const next = all.find(id => !gdDone(id) && (gdQ(id)[2] || 0) <= gdLvl()) || all.find(id => !gdDone(id));
      if (GD.trame !== f.trame) { GD.trame = f.trame; GD.open = new Set(next ? [next] : []); }
      top.innerHTML = `<div class="row between"><b>${esc(gdTrameName(f.trame))} : ${done} / ${all.length} quêtes</b>${next ? `<button type="button" class="btn sm primary" data-gnext="${next}">Prochaine quête : ${esc(gdQ(next)[0])}</button>` : `<span class="chip up">Trame terminée</span>`}</div><div class="bar"><span style="width:${all.length ? done / all.length * 100 : 0}%"></span></div>`;
      let html = "";
      if (T[0]?.mine) html += `<section class="panel"><h2>Composer ma trame</h2><div class="search"><input type="search" id="gd-add" placeholder="Ajouter une quête…"></div><p class="muted small">Ajoute des quêtes ici ou avec « ＋ Ma trame » ; l'ordre se règle avec les flèches.</p></section>`;
      html += `<section class="panel"><h2>Courses et objectifs restants</h2>${gdNeedsHtml(all)}</section>`;
      for (const c of T) {
        const ids = c.ids.filter(id => !f.hide || !gdDone(id)), d = c.ids.filter(gdDone).length;
        if (!c.ids.length && !c.mine) continue;
        html += `<section class="panel"><div class="row between"><h2>${esc(c.title)}</h2><span class="chip ${d === c.ids.length && d ? "up" : ""}">${d} / ${c.ids.length}</span></div>
          <div class="bar"><span style="width:${c.ids.length ? d / c.ids.length * 100 : 0}%"></span></div>
          <div class="list">${ids.map(id => (c.mine ? `<div class="row" style="justify-content:flex-end;gap:4px"><button class="btn sm" data-gup="${id}" aria-label="Monter">↑</button><button class="btn sm" data-gdown="${id}" aria-label="Descendre">↓</button><button class="x" data-gdel="${id}" aria-label="Retirer">✕</button></div>` : "") + gdQuestHead(id, GD.open.has(id))).join("") || `<p class="muted small">${c.mine ? "Ta trame est vide." : "Tout est fait."}</p>`}</div></section>`;
      }
      body.innerHTML = html;
      if (T[0]?.mine) searchBox($("#gd-add", el), id => { if (!S.ui.myTrame.includes(id)) S.ui.myTrame.push(id); save(); draw(); }, { source: q => { const ws = norm(q).split(" "); return Object.entries(D.quests.quests).filter(([, x]) => ws.every(w => norm(x[0]).includes(w))).slice(0, 30).map(([id, x]) => ({ id: +id, html: `<button>${advQImg()}<span class="t"><span class="nm">${esc(x[0])}</span><span class="meta">niv. ${x[2] || "—"} · ${esc(D.quests.qcats[x[1]]?.[0] || "")}</span></span></button>` })); } });
    };
    // Quêtes précédentes de Papycha : affine l'ordre et les prérequis quand elles arrivent
    advQ();
    if (!ADV.pq) advPapyQ().then(() => { if ($("#gd-body", el)?.isConnected) draw(); }).catch(() => {});
    el.addEventListener("toggle", e => { const d = e.target.closest?.("details[data-gq]"); if (!d) return; const id = +d.dataset.gq; if (d.open) { GD.open.add(id); const b = $(".gdbody", d); if (!b.innerHTML) b.innerHTML = gdQuestBody(id); } else GD.open.delete(id); }, true);
    el.addEventListener("change", e => {
      const t = e.target;
      if (t.id === "gd-trame") { f.trame = t.value; draw(); return; }
      if (t.id === "gd-hide") { f.hide = t.checked; draw(); return; }
      if (t.id === "gd-lvl") { S.settings.lvl = clamp(+t.value || 200, 1, 200); save(); draw(); return; }
      if (t.dataset.gqdone) { const id = +t.dataset.gqdone; if (t.checked) S.quests[id] = 1; else delete S.quests[id]; save(); draw(); return; }
      if (t.dataset.gobj) {
        const oid = +t.dataset.gobj, qid = +t.dataset.gobjq;
        if (t.checked) S.qobj[oid] = 1; else { delete S.qobj[oid]; delete S.quests[qid]; }
        if (gdObjs(qid).every(o => S.qobj[o[0]])) { S.quests[qid] = 1; toast(`Quête terminée : ${gdQ(qid)[0]}`); }
        save(); draw(); return;
      }
      if (t.dataset.gdofus) { const id = +t.dataset.gdofus; if (t.checked) S.dofus[id] = 1; else delete S.dofus[id]; save(); draw(); }
    });
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.gnext) { const d = $(`details[data-gq="${b.dataset.gnext}"]`, el); if (d) { d.open = true; GD.open.add(+b.dataset.gnext); d.scrollIntoView({ behavior: "smooth", block: "start" }); } return; }
      if (b.dataset.gmine) { const id = +b.dataset.gmine; if (!S.ui.myTrame.includes(id)) S.ui.myTrame.push(id); save(); b.remove(); toast("Quête ajoutée à ta trame."); return; }
      const L = S.ui.myTrame;
      if (b.dataset.gdel) { S.ui.myTrame = L.filter(x => x !== +b.dataset.gdel); save(); draw(); return; }
      if (b.dataset.gup || b.dataset.gdown) { const id = +(b.dataset.gup || b.dataset.gdown), i = L.indexOf(id), j = i + (b.dataset.gup ? -1 : 1); if (j >= 0 && j < L.length) { [L[i], L[j]] = [L[j], L[i]]; save(); draw(); } return; }
      if ("gwatch" in b.dataset || "gfarm" in b.dataset) {
        const ids = Object.keys(gdNeeds(gdTrame(f.trame).flatMap(c => c.ids)).items).map(Number).filter(id => { const x = item(id); return x && !(x.flags & 1) && x.sup !== 14; });
        if ("gwatch" in b.dataset) { for (const id of ids) if (!S.watch.includes(id)) S.watch.push(id); save(); toast(`${plural(ids.length, "objet")} ajouté${ids.length > 1 ? "s" : ""} à la tournée des prix.`); }
        else { const fm = ui("farmF", { src: "list", list: [] }); for (const [id, n] of Object.entries(gdNeeds(gdTrame(f.trame).flatMap(c => c.ids)).items)) if (ids.includes(+id) && !fm.list.some(x => x.id === +id)) fm.list.push({ id: +id, n }); fm.src = "list"; setUi("farmF", fm); toast("Ajouté à ta liste de farm."); }
      }
    });
    draw();
  },
});
