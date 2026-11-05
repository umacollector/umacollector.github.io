// UmaCollector yarış motoru (web worker).
// Yarış hesabının tamamı alpha123'ün açık kaynak motorundan gelir (uma-skill-tools / uma-tools, GPL-3.0-or-later):
//   https://github.com/alpha123/uma-tools  ·  https://github.com/alpha123/uma-skill-tools
// Bu dosya yalnızca UmaCollector arayüzü ile motor arasındaki köprüdür; o da GPL-3.0-or-later lisanslıdır.
import { CourseHelpers } from '../uma-tools/uma-skill-tools/CourseData';
import { Rule30CARng } from '../uma-tools/uma-skill-tools/Random';
import { runComparison } from '../compat/compare';
import { SkillSet } from '../compat/HorseDefTypes';
import skillmeta from '../uma-tools/umalator-global/skill_meta.json';

const ORDER_RANGE = { Nige: [1, 1], Senkou: [2, 4], Sasi: [5, 9], Oikomi: [5, 9], Oonige: [1, 1] };

function toHorse(u) {
	return {
		outfitId: String(u.outfitId || ''), starCount: u.starCount || 3,
		speed: u.speed, stamina: u.stamina, power: u.power, guts: u.guts, wisdom: u.wisdom,
		strategy: u.strategy, distanceAptitude: u.distanceAptitude, surfaceAptitude: u.surfaceAptitude,
		strategyAptitude: u.strategyAptitude, aptitudes: u.aptitudes || [],
		skills: SkillSet((u.skills || []).filter((id) => skillmeta[id])),
		samplePolicies: new Map(), uniqueLv: u.uniqueLv || 1, mood: u.mood ?? 2, popularity: 1,
	};
}

function params(r, strategy) {
	return {
		groundCondition: r.ground, weather: r.weather, season: r.season, time: r.time, grade: r.grade ?? 100,
		skillId: '', orderRange: strategy ? ORDER_RANGE[strategy] : null, numUmas: 9,
	};
}

// Grafik için koşuyu seyrelt: her n'inci nokta
function thin(run) {
	if (!run) return null;
	const pick = (arr) => arr.map((a) => { const s = Math.max(1, Math.floor(a.length / 300)); return a.filter((_, i) => i % s === 0 || i === a.length - 1); });
	return { t: pick(run.t), p: pick(run.p), v: pick(run.v), hp: pick(run.hp),
		sk: run.sk.map((m) => (m ? Object.fromEntries(m) : {})), sdly: run.sdly };
}

function stats(results) {
	const n = results.length;
	const mid = Math.floor(n / 2);
	return {
		n, min: results[0], max: results[n - 1],
		mean: results.reduce((a, b) => a + b, 0) / n,
		median: n % 2 === 0 ? (results[mid - 1] + results[mid]) / 2 : results[mid],
		results,
	};
}

function compare({ courseId, race, uma1, uma2, nsamples, options }, id) {
	const course = CourseHelpers.getCourse(courseId);
	const h1 = toHorse(uma1), h2 = toHorse(uma2);
	const seedgen = new Rule30CARng(options.seed);
	let done = 0;
	for (let n = Math.min(20, nsamples), mul = 6; ; n = Math.min(n * mul, nsamples), mul = Math.max(mul - 1, 2)) {
		const r = runComparison(n, course, params(race, null), h1, h2, seedgen.pair(), options);
		const final = n >= nsamples;
		postMessage({ id, type: 'compare', final, stats: stats(r.results),
			run: thin(r.runData.medianrun || r.runData.meanrun), minrun: final ? thin(r.runData.minrun) : null,
			maxrun: final ? thin(r.runData.maxrun) : null, nspurt: r.runData.nspurt });
		if (final) break;
		if (++done > 8) break;
	}
}

// Skill değeri: aynı Uma'ya skill eklenince kaç boy kazandırıyor (aşamalı, gereksizleri eler)
function chart({ courseId, race, uma, skills, options }, id) {
	const course = CourseHelpers.getCourse(courseId);
	const base = toHorse(uma);
	const seedgen = new Rule30CARng(options.seed);
	const acc = new Map();
	const failed = new Set<string>();
	const round = (n, list) => {
		const seed = seedgen.pair();
		list.forEach((sid) => {
			if (!skillmeta[sid] || failed.has(sid)) return;
			const withSkill = { ...base, skills: new Map(base.skills) };
			withSkill.skills.set(skillmeta[sid].groupId, sid);
			try {
				const r = runComparison(n, course, params(race, uma.strategy), base, withSkill, seed, options);
				const prev = acc.get(sid);
				acc.set(sid, prev ? prev.concat(r.results) : r.results.slice());
			} catch (err) {   // motorun tanımadığı koşullar: bu skill hesaplanamaz, diğerleri devam eder
				failed.add(sid); acc.delete(sid);
			}
		});
	};
	const send = (final) => {
		const out = {};
		acc.forEach((res, sid) => { const s = res.slice().sort((a, b) => a - b); const st = stats(s); delete st.results; out[sid] = st; });
		postMessage({ id, type: 'chart', final, results: out, failed: [...failed] });
	};
	let list = skills.slice();
	round(5, list); send(false);
	list = list.filter((s) => acc.has(s) && Math.max(...acc.get(s)) > 0.05);
	round(25, list); send(false);
	list = list.filter((s) => acc.has(s) && Math.max(...acc.get(s)) - Math.min(...acc.get(s)) > 0.05);
	round(70, list); send(true);
}

self.addEventListener('message', (e) => {
	const { msg, data, id } = e.data;
	try {
		if (msg === 'compare') compare(data, id);
		else if (msg === 'chart') chart(data, id);
	} catch (err) {
		postMessage({ id, type: 'error', error: String(err && err.stack || err) });
	}
});
