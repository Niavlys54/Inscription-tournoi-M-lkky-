# Protection Firebase : installation obligatoire en deux étapes

La publication du HTML ne déploie PAS les règles Firebase.

## Fonctionnement choisi

- Consultation publique de `members` et `tournaments`, y compris leurs résultats.
- Disponibilités publiques : toute personne avec le lien peut changer les statuts de n'importe quel joueur. Il n'y a pas de contrôle d'identité, ni de limitation de fréquence. Les valeurs permises sont uniquement `registered`, `available`, `absent`, `none`.
- Aucun droit public de créer/supprimer un tournoi, une équipe, un résultat ou un membre.
- Seul le compte Firebase dont l'UID est configuré dans le HTML ET les règles peut administrer les données.
- Le mot de passe Firebase n'est jamais inscrit dans le dépôt. L'ancien mot de passe du mode Admin ne doit plus être utilisé ; son ancienne présence dans l'historique Git le rend impropre à tout autre usage.
- Les noms et disponibilités restent publics par choix fonctionnel. Ces règles ne permettent pas de supprimer toute alerte Firebase sur les accès anonymes : elles réduisent l'accès à la consultation et aux disponibilités explicitement autorisées.

## Installation

1. Dans Firebase Authentication, activer E-mail / Mot de passe et créer le compte administrateur. Vérifier que son UID correspond à `ADMIN_UID`.
2. Publier le nouveau HTML sur GitHub Pages et attendre le build terminé.
3. Sur le site, ouvrir Mode Admin et tester la connexion avec le compte Firebase créé, puis se déconnecter. Ne pas transmettre le mot de passe dans le chat.
4. Dans Firebase, ouvrir **Realtime Database > Règles**, conserver une copie des anciennes règles, puis remplacer TOUT leur contenu par `database.rules.json`. Attention : ce n'est pas l'onglet Données ; ne pas y importer ces règles comme des données.
5. Publier les règles. Elles ne suppriment pas de données. Elles bloquent les modifications non autorisées ; l'ancienne version du site ne pourra plus administrer la base.
6. Tester dans le simulateur de règles : lecture anonyme de `/members` et `/tournaments` autorisée, modification anonyme d'un nom de tournoi refusée, modification d'un statut valide d'un tournoi existant non archivé autorisée, modification admin autorisée avec l'UID configuré.
7. Sur le site, tester une disponibilité puis la remettre à sa valeur d'origine ; connecter le compte administrateur et vérifier une opération prévue. La vérification du HTML public ne prouve pas à elle seule le déploiement des règles ni la connexion réelle.

## Vérification locale

- `node test.cjs` : régressions fonctionnelles sur DOM et Firebase simulés.
- `node test-auth.cjs` : connexion et droits côté interface avec Firebase Auth simulé.
- `python test_rules.py` : règles réellement compilées et exécutées par l'émulateur Realtime Database sur `127.0.0.1:9000`, namespace `demo-pagny-security`. Aucun accès à la base de production. Nécessite un émulateur Firebase Database démarré localement.

Les tests de l'émulateur vérifient aussi le refus de suppression, les valeurs de statut invalides, les écritures aux chemins parents, les tournois inexistants et archivés, ainsi qu'un compte connecté non administrateur. Les identifiants numériques de statut sont limités à 20 caractères ; sans connexion les disponibilités restent exposées à des changements abusifs.
