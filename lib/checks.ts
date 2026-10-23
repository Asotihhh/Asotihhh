import type { Parcours } from './plan';

export type Level = 'ok' | 'warn' | 'err';
export type Check = { key: string; level: Level; msg: string };
export type Content = Record<string, string>;

export const words = (t = '') => t.trim().split(/\s+/).filter(Boolean);
export const lines = (t = '') => t.split('\n').map((l) => l.trim()).filter(Boolean);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const firstWord = (s: string) => norm((s.trim().split(/\s+/)[0] || '').replace(/[^\p{L}'-]/gu, ''));
const NOT_VERBS = ['leur', 'notre', 'votre', 'entre', 'autre', 'contre', 'premier', 'dernier'];
export const isInfinitive = (s: string) => {
  const w = firstWord(s);
  return w.length > 2 && /(er|ir|re|oir)$/.test(w) && !NOT_VERBS.includes(w);
};
const VAGUE = ['comprendre', 'connaitre', 'savoir', 'voir', 'etudier', 'apprecier'];
const STOP = new Set(['dans', 'avec', 'pour', 'selon', 'entre', 'leurs', 'cette', 'ainsi', 'sont', 'plus', 'moins',
  'effet', 'effets', 'different', 'differentes', 'differents', 'production', 'producteurs', 'evaluer', 'determiner',
  'identifier', 'analyser', 'comparer', 'decrire']);
const keyWords = (s: string) =>
  new Set(norm(s).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 5 && !STOP.has(w)));
export const overlap = (a: string, b: string) => {
  const A = keyWords(a), B = keyWords(b);
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n;
};
const CITATION = /\(([^()]*?)(19|20)\d{2}[a-z]?\)/;
/** Texte sans les lignes de figures, pour compter les mots. */
const prose = (t = '') => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

const METHOD: Record<Parcours, { re: RegExp; msg: string }> = {
  phyto: { re: /(bloc|fisher|randomis|repetition|split|parcelle)/, msg: "Le dispositif expérimental n'est pas décrit (blocs, randomisation, répétitions)." },
  zoo: { re: /(lot|sujet|ration|repetition)/, msg: 'Les lots, le nombre de sujets ou les rations ne sont pas décrits.' },
  agroeco: { re: /(echantillon|enquete|questionnaire|entretien)/, msg: "La méthode d'échantillonnage ou l'outil d'enquête n'est pas décrit." },
};

export function runChecks(c: Content, parcours: Parcours): Check[] {
  const out: Check[] = [];
  const add = (key: string, level: Level, msg: string) => out.push({ key, level, msg });
  const g = (k: string) => c[k] || '';
  const okIfClean = (key: string, msg: string) => {
    if (!out.some((x) => x.key === key && x.level !== 'ok')) add(key, 'ok', msg);
  };
  const minWords = (key: string, min: number, label: string) => {
    const n = words(prose(g(key))).length;
    if (!n) add(key, 'err', `${label} est vide.`);
    else if (n < min) add(key, 'warn', `${label} compte ${n} mots : vise au moins ${min} mots.`);
  };

  // Pages liminaires
  if (!g('remerciements').trim()) add('remerciements', 'warn', 'Les remerciements sont vides.');
  okIfClean('remerciements', 'Remerciements rédigés.');
  const r = words(g('resume')).length;
  if (!r) add('resume', 'warn', 'Le résumé est vide : rédige-le en dernier, une fois les résultats connus.');
  else if (r < 200 || r > 300) add('resume', 'warn', `Le résumé compte ${r} mots : vise entre 200 et 300 mots.`);
  if (r && !/\d/.test(g('resume'))) add('resume', 'warn', 'Le résumé ne contient aucun chiffre : ajoute les principaux résultats chiffrés.');
  okIfClean('resume', 'Résumé de longueur adaptée.');
  const mc = g('mots_cles').split(/[,;]/).map((s) => s.trim()).filter(Boolean).length;
  if (mc < 3 || mc > 6) add('mots_cles', 'warn', `${mc} mot(s)-clé(s) : il en faut entre 3 et 6, séparés par des virgules.`);
  okIfClean('mots_cles', 'Nombre de mots-clés correct.');
  if (r && !g('abstract').trim()) add('abstract', 'warn', "L'abstract est vide alors que le résumé est rédigé.");
  okIfClean('abstract', 'Abstract présent.');

  // Introduction
  minWords('introduction', 300, "L'introduction");
  if (g('introduction') && !CITATION.test(g('introduction'))) add('introduction', 'warn', 'Aucune source citée au format (Auteur, année).');
  okIfClean('introduction', 'Introduction développée et sourcée.');

  if (!g('problematique').trim()) add('problematique', 'err', 'La problématique est vide.');
  else if (!g('problematique').includes('?')) add('problematique', 'err', 'Aucune question de recherche : formule une question qui se termine par « ? ».');
  okIfClean('problematique', 'Question de recherche présente.');

  const og = g('objectif_general').trim();
  if (!og) add('objectif_general', 'err', "L'objectif général est vide.");
  else {
    if (!isInfinitive(og)) add('objectif_general', 'err', "L'objectif général doit commencer par un verbe à l'infinitif.");
    if ((og.match(/[.!?](\s|$)/g) || []).length > 1) add('objectif_general', 'warn', "L'objectif général doit tenir en une seule phrase.");
  }
  okIfClean('objectif_general', "L'objectif général commence par un verbe à l'infinitif.");

  const os = lines(g('objectifs_specifiques'));
  const hs = lines(g('hypotheses'));
  if (os.length < 2 || os.length > 5) add('objectifs_specifiques', 'warn', `${os.length} objectif(s) spécifique(s) : vise entre 2 et 5.`);
  os.forEach((o, k) => {
    if (!isInfinitive(o)) add('objectifs_specifiques', 'err', `OS${k + 1} ne commence pas par un verbe à l'infinitif.`);
    else if (VAGUE.includes(firstWord(o))) add('objectifs_specifiques', 'warn', `OS${k + 1} utilise « ${o.split(/\s+/)[0]} », difficile à mesurer : préfère évaluer, déterminer, identifier ou analyser.`);
  });
  okIfClean('objectifs_specifiques', "Tous les objectifs spécifiques utilisent un verbe d'action.");

  if (hs.length !== os.length) add('hypotheses', 'err', `${os.length} objectif(s) pour ${hs.length} hypothèse(s) : il faut une hypothèse par objectif.`);
  hs.forEach((h, k) => {
    if (h.includes('?')) add('hypotheses', 'err', `H${k + 1} est une question : formule une affirmation vérifiable.`);
    else if (isInfinitive(h)) add('hypotheses', 'err', `H${k + 1} ressemble à un objectif : formule une affirmation.`);
    else if (os[k] && overlap(h, os[k]) < 1) add('hypotheses', 'warn', `H${k + 1} ne reprend aucun terme clé de OS${k + 1} : vérifie qu'elle y répond bien.`);
  });
  okIfClean('hypotheses', 'Chaque objectif a son hypothèse.');

  // Partie 1
  minWords('structure_accueil', 200, "La présentation de la structure d'accueil");
  okIfClean('structure_accueil', "Structure d'accueil présentée.");
  minWords('revue_litterature', 600, 'La revue de littérature');
  const citesRevue = (g('revue_litterature').match(new RegExp(CITATION.source, 'g')) || []).length;
  if (g('revue_litterature') && citesRevue < 5) add('revue_litterature', 'warn', `${citesRevue} citation(s) (Auteur, année) dans la revue : une revue de littérature en compte généralement beaucoup plus.`);
  okIfClean('revue_litterature', 'Revue de littérature développée et sourcée.');

  // Partie 2
  minWords('zone_etude', 80, "La présentation du site d'étude");
  okIfClean('zone_etude', "Site d'étude décrit.");
  minWords('materiel', 60, 'La partie Matériel');
  okIfClean('materiel', 'Matériel décrit.');
  const m = norm(g('methodes'));
  minWords('methodes', 120, 'La partie Méthodes');
  if (m && !METHOD[parcours].re.test(m)) add('methodes', 'err', METHOD[parcours].msg);
  if (parcours === 'agroeco' && m && !/\d+\s*(producteur|menage|exploitant|enquete|personne|individu)/.test(m))
    add('methodes', 'warn', "Indique la taille de l'échantillon.");
  okIfClean('methodes', 'Dispositif ou méthode de collecte décrit.');

  const a = norm(g('analyse_donnees'));
  if (!a.trim()) add('analyse_donnees', 'err', "L'analyse des données est vide.");
  else {
    if (!/(\br\b|spss|excel|xlstat|stata|statistica|sas|genstat|python|minitab)/.test(a)) add('analyse_donnees', 'warn', "Précise le logiciel utilisé pour l'analyse.");
    if (!/(anova|variance|newman|tukey|duncan|khi|chi|regression|student|correlation|compte d.exploitation|marge|ratio|descripti)/.test(a))
      add('analyse_donnees', 'err', 'Aucun test ni indicateur d\'analyse n\'est cité.');
    if (parcours !== 'agroeco' && !/(5\s*%|0[.,]05|seuil)/.test(a)) add('analyse_donnees', 'warn', 'Indique le seuil de signification (par exemple 5 %).');
    if (os.some((o) => /facteur|influenc|determinant/.test(norm(o))) && !/(regression|khi|chi|correlation|logit|probit)/.test(a))
      add('analyse_donnees', 'err', "Un objectif porte sur des facteurs d'influence, mais aucune régression ni aucun test d'association n'est prévu.");
  }
  okIfClean('analyse_donnees', 'Logiciel, tests et seuil précisés.');

  // Partie 3
  const res = g('resultats');
  minWords('resultats', 300, 'La partie Résultats');
  if (res && !/(tableau|figure|!\[)/i.test(res)) add('resultats', 'warn', 'Aucun tableau ni figure dans les résultats.');
  okIfClean('resultats', 'Résultats présentés avec tableaux ou figures.');
  const disc = g('discussion');
  minWords('discussion', 300, 'La discussion');
  if (disc && !CITATION.test(disc)) add('discussion', 'warn', "La discussion ne compare tes résultats à aucun auteur (Auteur, année).");
  if (disc && hs.length && !/(confirm|infirm|valid|rejet)/.test(norm(disc))) add('discussion', 'warn', 'Dis clairement si chaque hypothèse est confirmée ou infirmée.');
  okIfClean('discussion', 'Discussion sourcée et reliée aux hypothèses.');

  // Fin
  const concl = g('conclusion');
  minWords('conclusion', 150, 'La conclusion');
  if (concl) os.forEach((o, k) => {
    if (overlap(o, concl) < 1) add('conclusion', 'warn', `La conclusion ne semble pas répondre à OS${k + 1}.`);
  });
  okIfClean('conclusion', 'La conclusion répond aux objectifs.');
  if (lines(g('recommandations')).length < 2) add('recommandations', 'warn', 'Formule au moins 2 recommandations.');
  okIfClean('recommandations', 'Recommandations formulées.');

  const refs = lines(g('references'));
  if (refs.length < 10) add('references', 'warn', `${refs.length} référence(s) : un mémoire en compte généralement au moins 10.`);
  refs.forEach((x, k) => { if (!/(19|20)\d{2}/.test(x)) add('references', 'warn', `La référence ${k + 1} n'a pas d'année.`); });
  okIfClean('references', 'Références suffisantes et datées.');

  return out;
}

export function score(checks: Check[]) {
  if (!checks.length) return 0;
  const ok = checks.filter((c) => c.level === 'ok').length;
  const warn = checks.filter((c) => c.level === 'warn').length;
  return Math.round((100 * (ok + warn * 0.5)) / checks.length);
}

export function sectionStatus(checks: Check[], key: string): Level | '' {
  const c = checks.filter((x) => x.key === key);
  if (!c.length) return '';
  if (c.some((x) => x.level === 'err')) return 'err';
  if (c.some((x) => x.level === 'warn')) return 'warn';
  return 'ok';
}
