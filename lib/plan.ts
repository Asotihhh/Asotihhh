// =====================================================================
// PLAN DU MÉMOIRE DE STAGE
// C'est le seul fichier à modifier pour suivre le canevas officiel de l'école :
// l'ordre, les titres, les consignes et les parties affichées viennent d'ici.
// =====================================================================

export type Parcours = 'phyto' | 'zoo' | 'agroeco';

export const PARCOURS: Record<Parcours, string> = {
  phyto: 'Phytotechnie',
  zoo: 'Zootechnie',
  agroeco: 'Agroéconomie',
};

export type SectionKind = 'text' | 'short' | 'list';

export type Section = {
  key: string;
  title: string;
  /** Partie du mémoire dans laquelle la section apparaît (barre latérale et export). */
  part: string;
  /** Niveau de titre à l'export : 1 = partie, 2 = chapitre, 3 = sous-chapitre. */
  level: 1 | 2 | 3;
  kind: SectionKind;
  guide: string;
  /** Conseil propre à chaque parcours (facultatif). */
  tips?: Partial<Record<Parcours, string>>;
};

export const PARTS = [
  'Pages liminaires',
  'Introduction',
  'Partie 1 : Généralités',
  'Partie 2 : Matériel et méthodes',
  'Partie 3 : Résultats et discussion',
  'Fin du mémoire',
] as const;

export const SECTIONS: Section[] = [
  { key: 'dedicace', title: 'Dédicace', part: 'Pages liminaires', level: 1, kind: 'short',
    guide: "Quelques lignes pour dédier ce travail. Facultatif selon l'école." },
  { key: 'remerciements', title: 'Remerciements', part: 'Pages liminaires', level: 1, kind: 'text',
    guide: "Remercie d'abord la direction de l'école, ton maître de stage, ton encadreur, la structure d'accueil, puis tes proches." },
  { key: 'sigles', title: 'Sigles et abréviations', part: 'Pages liminaires', level: 1, kind: 'list',
    guide: 'Une entrée par ligne, au format « SIGLE : signification », dans l\'ordre alphabétique.' },
  { key: 'resume', title: 'Résumé', part: 'Pages liminaires', level: 1, kind: 'text',
    guide: "200 à 300 mots, rédigé en dernier : contexte, objectif, méthode, principaux résultats chiffrés, conclusion." },
  { key: 'mots_cles', title: 'Mots-clés', part: 'Pages liminaires', level: 3, kind: 'short',
    guide: '3 à 6 mots-clés séparés par des virgules.' },
  { key: 'abstract', title: 'Abstract', part: 'Pages liminaires', level: 1, kind: 'text',
    guide: 'Traduction anglaise fidèle du résumé.' },
  { key: 'keywords', title: 'Keywords', part: 'Pages liminaires', level: 3, kind: 'short',
    guide: 'Traduction anglaise des mots-clés.' },

  { key: 'introduction', title: 'Introduction', part: 'Introduction', level: 1, kind: 'text',
    guide: "Contexte général, importance de la filière, situation actuelle et justification du stage. Va du général au particulier en citant tes sources (Auteur, année)." },
  { key: 'problematique', title: 'Problématique', part: 'Introduction', level: 3, kind: 'short',
    guide: 'Le problème précis que ton travail veut résoudre, puis la question de recherche principale, terminée par « ? ».' },
  { key: 'objectif_general', title: 'Objectif général', part: 'Introduction', level: 3, kind: 'short',
    guide: 'Une seule phrase qui commence par un verbe à l\'infinitif.' },
  { key: 'objectifs_specifiques', title: 'Objectifs spécifiques', part: 'Introduction', level: 3, kind: 'list',
    guide: "Un objectif par ligne, de 2 à 5, chacun avec un verbe d'action mesurable (évaluer, déterminer, comparer, identifier, analyser)." },
  { key: 'hypotheses', title: 'Hypothèses', part: 'Introduction', level: 3, kind: 'list',
    guide: "Une hypothèse par ligne, dans le même ordre que les objectifs : l'hypothèse 1 répond à l'objectif 1. Ce sont des affirmations vérifiables." },
  { key: 'annonce_plan', title: 'Annonce du plan', part: 'Introduction', level: 3, kind: 'short',
    guide: 'Une ou deux phrases qui présentent les trois parties du mémoire.' },

  { key: 'structure_accueil', title: "Présentation de la structure d'accueil", part: 'Partie 1 : Généralités', level: 2, kind: 'text',
    guide: "Historique, statut, missions, organisation (organigramme en figure), activités et place du stagiaire dans la structure." },
  { key: 'revue_litterature', title: 'Revue de littérature', part: 'Partie 1 : Généralités', level: 2, kind: 'text',
    guide: "Ce que disent les travaux existants sur ton sujet. Utilise des sous-titres avec « ## » et cite chaque source (Auteur, année).",
    tips: {
      phyto: "Botanique et écologie de la culture, exigences pédoclimatiques, itinéraire technique, travaux sur le facteur étudié.",
      zoo: "Caractéristiques de l'espèce ou de la souche, besoins nutritionnels, conduite d'élevage, travaux sur l'aliment ou le facteur étudié.",
      agroeco: "Concepts clés (rentabilité, filière, adoption), situation de la filière, études économiques antérieures sur le sujet.",
    } },

  { key: 'zone_etude', title: "Site ou zone d'étude", part: 'Partie 2 : Matériel et méthodes', level: 2, kind: 'text',
    guide: 'Localisation, climat (pluviométrie, températures), sols, végétation ou population. Ajoute une carte en figure si possible.' },
  { key: 'materiel', title: 'Matériel', part: 'Partie 2 : Matériel et méthodes', level: 2, kind: 'text',
    guide: 'Matériel végétal, animal ou population enquêtée, intrants, matériel technique et outils de collecte.',
    tips: {
      phyto: 'Précise la variété, son origine et son cycle, ainsi que les intrants (doses, formulations).',
      zoo: 'Précise la souche, l\'âge et le nombre de sujets, la composition des rations et le matériel d\'élevage.',
      agroeco: 'Décris la population cible, la base de sondage et les outils de collecte (questionnaire, guide d\'entretien).',
    } },
  { key: 'methodes', title: 'Méthodes', part: 'Partie 2 : Matériel et méthodes', level: 2, kind: 'text',
    guide: 'Dispositif expérimental ou méthode d\'échantillonnage, conduite de l\'essai ou de l\'enquête, variables mesurées.',
    tips: {
      phyto: 'Indique le dispositif (blocs de Fisher, split-plot…), le nombre de traitements et de répétitions, la taille des parcelles élémentaires.',
      zoo: 'Indique les lots, les répétitions, la durée de l\'essai et les paramètres zootechniques mesurés (poids, consommation, mortalité).',
      agroeco: 'Indique la taille de l\'échantillon, la méthode de choix (aléatoire, stratifiée, raisonnée) et le déroulement de l\'enquête.',
    } },
  { key: 'analyse_donnees', title: 'Analyse des données', part: 'Partie 2 : Matériel et méthodes', level: 2, kind: 'text',
    guide: 'Logiciels utilisés, tests statistiques et seuil de signification. Chaque hypothèse doit être testée par au moins une analyse.',
    tips: {
      phyto: "ANOVA puis comparaison des moyennes (Newman-Keuls, Tukey) au seuil de 5 %.",
      zoo: 'Gain moyen quotidien, indice de consommation et mortalité comparés par ANOVA puis test de comparaison des moyennes.',
      agroeco: "Statistiques descriptives, compte d'exploitation, puis régression ou khi-deux pour tester les facteurs.",
    } },

  { key: 'resultats', title: 'Résultats', part: 'Partie 3 : Résultats et discussion', level: 2, kind: 'text',
    guide: "Présente les résultats objectif par objectif, avec des tableaux et figures numérotés. Décris ce que montrent les données, sans les interpréter ici." },
  { key: 'discussion', title: 'Discussion', part: 'Partie 3 : Résultats et discussion', level: 2, kind: 'text',
    guide: "Explique tes résultats, compare-les aux travaux d'autres auteurs (Auteur, année) et dis si chaque hypothèse est confirmée ou infirmée." },

  { key: 'conclusion', title: 'Conclusion', part: 'Fin du mémoire', level: 1, kind: 'text',
    guide: "Rappelle l'objectif, réponds à chaque objectif spécifique avec les résultats clés, sans nouvelle information." },
  { key: 'recommandations', title: 'Recommandations et perspectives', part: 'Fin du mémoire', level: 1, kind: 'list',
    guide: 'Une recommandation par ligne, en précisant à qui elle s\'adresse (producteurs, structure, recherche).' },
  { key: 'references', title: 'Références bibliographiques', part: 'Fin du mémoire', level: 1, kind: 'list',
    guide: 'Une référence par ligne, par ordre alphabétique : Nom Initiale., année. Titre. Revue ou éditeur, volume (numéro) : pages.' },
  { key: 'annexes', title: 'Annexes', part: 'Fin du mémoire', level: 1, kind: 'text',
    guide: 'Questionnaires, fiches de collecte, tableaux détaillés. Commence chaque annexe par « ## Annexe 1 : titre ».' },
];

export const SECTION_BY_KEY: Record<string, Section> = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));

/** Aide à la mise en forme affichée sous chaque zone de texte. */
export const FORMAT_HELP =
  '« ## » en début de ligne = sous-titre · « - » = liste · lignes avec des « | » = tableau · bouton Figure = image avec légende';
