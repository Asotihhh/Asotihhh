# Sillon : guide de mise en ligne

Sillon est l'application qui permet aux étudiants en agronomie de rédiger leur mémoire de stage, section par section, avec des vérifications automatiques, un espace encadreur et un export Word.

Ce guide te permet de la mettre en ligne **sans écrire de code**. Compte environ une heure la première fois. Tout est gratuit au démarrage.

Tu auras besoin de trois comptes gratuits :

- **GitHub** (stocke le code) : https://github.com
- **Supabase** (base de données et comptes utilisateurs) : https://supabase.com
- **Vercel** (héberge le site) : https://vercel.com (inscris-toi avec ton compte GitHub)

---

## Étape 1 : mettre le code sur GitHub

1. Décompresse le fichier `sillon.zip` sur ton ordinateur.
2. Sur GitHub, clique sur **New repository**, nomme-le `sillon`, laisse-le **Private**, puis **Create repository**.
3. Sur la page du dépôt, clique sur **uploading an existing file**.
4. Fais glisser **le contenu** du dossier `sillon` (les dossiers `app`, `components`, `lib`, `supabase` et les fichiers `package.json`, etc.), pas le dossier lui-même.
5. Clique sur **Commit changes**.

## Étape 2 : créer la base de données sur Supabase

1. Sur Supabase, clique sur **New project**. Choisis un nom (`sillon`), un mot de passe de base de données (garde-le) et la région **Europe (Frankfurt)** ou la plus proche.
2. Attends 1 à 2 minutes que le projet soit prêt.
3. Dans le menu de gauche, ouvre **SQL Editor**, puis **New query**.
4. Ouvre le fichier `supabase/schema.sql`, copie **tout** son contenu, colle-le dans l'éditeur et clique sur **Run**. Le message « Success » doit s'afficher.
5. Ouvre **Project Settings > API** et note deux valeurs :
   - **Project URL** (commence par `https://` et finit par `.supabase.co`)
   - **anon public** (une longue clé)

## Étape 3 : mettre le site en ligne avec Vercel

1. Sur Vercel, clique sur **Add New > Project**, puis **Import** à côté du dépôt `sillon`.
2. Ouvre **Environment Variables** et ajoute ces lignes, une par une (nom à gauche, valeur à droite) :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | la Project URL de l'étape 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé anon public de l'étape 2 |
| `NEXT_PUBLIC_SITE_URL` | laisse vide pour l'instant |
| `NEXT_PUBLIC_PACK_PRICE` | `20 000 FCFA` |
| `NEXT_PUBLIC_PACK_MONTHS` | `6` |
| `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` | par exemple : `Envoie 20 000 FCFA par mobile money au +225 XX XX XX XX XX avec ton email en motif. Ton compte sera activé sous 24 h.` |
| `SCHOOL_HEADER` | les lignes d'en-tête de la page de garde (voir l'exemple sous ce tableau) |

Pour `SCHOOL_HEADER`, sépare les lignes par une barre verticale, par exemple :

```text
RÉPUBLIQUE DE CÔTE D'IVOIRE|MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR|ÉCOLE SUPÉRIEURE D'AGRONOMIE
```

3. Clique sur **Deploy** et attends 2 à 3 minutes. Vercel t'affiche l'adresse du site, par exemple `https://sillon-abc.vercel.app`.
4. Retourne dans **Settings > Environment Variables**, mets cette adresse dans `NEXT_PUBLIC_SITE_URL`, puis **Deployments > ⋯ > Redeploy**.

## Étape 4 : relier Supabase à ton site

1. Dans Supabase, ouvre **Authentication > URL Configuration**.
2. Dans **Site URL**, mets l'adresse de ton site (`https://sillon-abc.vercel.app`).
3. Dans **Redirect URLs**, ajoute `https://sillon-abc.vercel.app/auth/callback`.
4. Clique sur **Save**.

## Étape 5 : te donner les droits d'administrateur

1. Ouvre ton site et crée ton compte avec ton email, puis confirme-le grâce à l'email reçu.
2. Dans Supabase, ouvre **SQL Editor > New query**, colle cette ligne en remplaçant l'email, puis **Run** :

```sql
update public.profiles set role = 'admin' where email = 'ton.email@exemple.com';
```

3. Recharge le site : le lien **Administration** apparaît en haut. C'est là que tu actives le Pack mémoire d'un étudiant après réception de son paiement.

## Étape 6 : vérifier que tout marche

- [ ] Crée un compte étudiant de test (avec un autre email) et crée un mémoire.
- [ ] Écris quelques lignes : « Enregistré » doit s'afficher sous la zone de texte.
- [ ] Depuis ton compte admin, active le Pack mémoire de ce compte de test.
- [ ] Avec le compte de test, invite un encadreur (un troisième email), puis connecte-toi avec cet email : le mémoire doit apparaître dans « Mémoires que j'encadre ».
- [ ] Clique sur **Exporter en Word** et ouvre le fichier.

## Étape 7 (facultatif) : activer l'assistant de relecture

L'assistant relit une section et explique ce qui ne va pas, sans rédiger à la place de l'étudiant. Il est payant à l'usage (quelques francs CFA par demande).

1. Crée une clé sur https://console.anthropic.com (rubrique **API Keys**) et ajoute du crédit.
2. Dans Vercel, ajoute les variables `ANTHROPIC_API_KEY` (ta clé), `ANTHROPIC_MODEL` (`claude-haiku-5-5`) et `AI_DAILY_LIMIT` (`30`), puis **Redeploy**.

Le bouton **Demander conseil** apparaît alors pour les étudiants qui ont le Pack mémoire.

---

## Modifier le plan du mémoire

Tout le plan (ordre des sections, titres, consignes, conseils par parcours) se trouve dans **un seul fichier** : `lib/plan.ts`. Sur GitHub, ouvre ce fichier, clique sur le crayon, modifie, puis **Commit changes** : Vercel remet le site à jour tout seul en 2 minutes.

## Ce qui reste à faire

- **Adapter le plan et la page de garde au canevas officiel de l'ESA** (dès réception du canevas).
- **Paiement mobile money automatique** : pour l'instant, l'étudiant paie selon tes instructions et tu actives son compte dans Administration. L'étape suivante est de brancher un agrégateur de paiement (CinetPay, FedaPay, PayDunya…) pour que l'activation soit immédiate.
- **Nom de domaine** (par exemple `sillon.ci`) : à acheter puis à relier dans Vercel, rubrique **Domains**.

## Structure du code (pour un développeur)

| Dossier ou fichier | Rôle |
| --- | --- |
| `lib/plan.ts` | Plan du mémoire : sections, consignes, conseils par parcours |
| `lib/checks.ts` | Règles de vérification de cohérence |
| `lib/docx.ts` | Génération du fichier Word (page de garde, sommaire, figures, tableaux) |
| `components/Editor.tsx` | Éditeur : sauvegarde automatique, matrice, commentaires, figures, assistant |
| `app/` | Pages : accueil, connexion, tableau de bord, mémoire, administration, export, assistant |
| `supabase/schema.sql` | Tables, sécurité ligne par ligne, stockage des figures, fonctions |

Technologies : Next.js 14, Supabase (PostgreSQL, Auth, Storage), docx.
