# Logseq DeepSeek Tagger Plugin

[![Version du Marketplace](https://img.shields.io/logseq-plugin/version/logseq-deepseek-tagger-1-0-0)](https://logseq.github.io/plugins/marketplace/logseq-deepseek-tagger-1-0-0)
[![Téléchargements du Marketplace](https://img.shields.io/logseq-plugin/downloads/VOTRE_PLUGIN_ID_ICI)](https://logseq.github.io/plugins/marketplace/logseq-deepseek-tagger-1-0-0)

Boostez votre organisation dans Logseq en générant automatiquement des tags pertinents pour vos notes grâce à la puissance de l'IA de DeepSeek ! Ce plugin analyse le contenu de vos blocs ou de vos pages et suggère des tags contextuels, en y ajoutant également des tags temporels utiles.

## Fonctionnalités

*   **Tagging intelligent par IA** : Utilise l'API DeepSeek pour analyser votre texte et proposer des tags pertinents.
*   **Tags temporels automatiques** : Ajoute automatiquement des tags pour l'année, le mois, le mois-année, le trimestre-année, le quadrimestre-année et le semestre-année en cours.
*   **Trois modes de tagging :**
    *   `/tags` : Analyse le bloc de texte actuel et ajoute les tags dans un bloc enfant `tags:: ...`.
    *   `/tagpage` : Analyse le contenu textuel de tous les blocs de la page actuelle et ajoute les tags dans un nouveau bloc `Page Tags:: ...` en bas de la page.
*   **Configuration facile** : Entrez simplement votre clé API DeepSeek dans les paramètres du plugin.
*   **Formatage personnalisable** : Les tags générés sont en MAJUSCULES et formatés avec des virgules pour une intégration parfaite avec la propriété `tags::` de Logseq.

## Prérequis

*   Un compte DeepSeek et une clé API valide. Vous pouvez obtenir une clé API sur [le site de DeepSeek](https://platform.deepseek.com/).
*   Logseq version 0.10.9 ou supérieure (spécifiez la version minimale si vous la connaissez).

## Installation

### Depuis le Marketplace Logseq (Recommandé)

1.  Ouvrez Logseq.
2.  Cliquez sur les trois points (`...`) en haut à droite, puis allez dans `Plugins` (ou `Ctrl+Shift+P` / `Cmd+Shift+P` et cherchez `Plugins`).
3.  Cliquez sur l'onglet `Marketplace`.
4.  Recherchez "DeepSeek Tagger" (ou le nom que vous lui donnez).
5.  Cliquez sur "Installer".

### Manuellement (pour le développement ou si non disponible sur le marketplace)

1.  Téléchargez la dernière release du plugin depuis la [page des releases GitHub](https://github.com/VOTRE_NOM_UTILISATEUR/VOTRE_REPO_PLUGIN/releases) (remplacez par votre lien).
2.  Décompressez le fichier `.zip` téléchargé.
3.  Dans Logseq, activez le "Mode développeur" dans `Paramètres` -> `Avancé`.
4.  Allez dans `Plugins`, cliquez sur "Charger le plugin non empaqueté", et sélectionnez le dossier du plugin que vous venez de décompresser.

## Configuration

1.  Après avoir installé le plugin, allez dans la section `Plugins` de Logseq.
2.  Trouvez "DeepSeek Tagger" dans la liste et cliquez sur l'icône d'engrenage (⚙️) pour ouvrir ses paramètres.
3.  Entrez votre **Clé API DeepSeek** dans le champ prévu à cet effet.
    *   Votre clé API est stockée localement par Logseq et n'est jamais partagée ailleurs.
4.  Les modifications sont sauvegardées automatiquement.

## Comment utiliser

Une fois votre clé API configurée, vous pouvez utiliser les commandes slash suivantes dans n'importe quel bloc :

### 1. Tagger le bloc actuel : `/tags`

*   Tapez `/tags` dans un bloc contenant du texte.
*   Appuyez sur `Entrée`.
*   Le plugin analysera le contenu de ce bloc et ajoutera un bloc enfant contenant `tags:: TAG1, TAG2, ANNEE, MOIS, ...`. Si un bloc enfant `tags::` existe déjà, il sera mis à jour.

**(Exemple de capture d'écran ou GIF pour /tags)**

### 2. Tagger la page entière : `/tagpage`

*   Sur n'importe quelle page, tapez `/tagpage` dans un bloc (le contenu du bloc où vous tapez n'est pas utilisé, seule la page compte).
*   Appuyez sur `Entrée`.
*   Le plugin analysera le contenu textuel de tous les blocs de la page actuelle.
*   Un nouveau bloc de premier niveau sera ajouté en bas de la page, contenant `Page Tags:: TAG1, TAG2, ANNEE, MOIS, ...`.

**(Exemple de capture d'écran ou GIF pour /tagpage)**

### 3. Tagger une sélection : `/tagselect`

*   Sélectionnez une portion de texte (cela peut s'étendre sur un ou plusieurs blocs).
*   Dans un bloc (généralement celui où se termine votre sélection ou un nouveau bloc à proximité), tapez `/tagselect`.
*   Appuyez sur `Entrée`.
*   Le plugin analysera le texte que vous avez sélectionné.
*   Un nouveau bloc sera inséré *après* le bloc où vous avez tapé la commande `/tagselect`, contenant `Selection Tags:: TAG1, TAG2, ANNEE, MOIS, ...`.

**(Exemple de capture d'écran ou GIF pour /tagselect)**

## Format du prompt DeepSeek utilisé (pour information)

Le plugin utilise le prompt suivant pour interagir avec l'API DeepSeek (avec une température basse pour des résultats plus déterministes) :
"""
Analyse le texte suivant et suggère 3 à 10 mots-clés ou concepts pertinents de un ou deux mots qui pourraient servir de tags. Retourne-les sous forme de liste séparée par des virgules, sans aucune autre introduction ni explication, chaque tag est donné en majuscule. Par exemple: "TECHNOLOGIE, INTELLIGENCE ARTIFICIELLE, FUTUR".
TU DOIS OBLIGATOIREMENT AJOUTER aux tags proposés, l'année (sur quatre chiffres), le mois (en Français et en majuscules), le mois (en français et en majuscules) avec l'année (e.g. FEVRIER 2025), le trimestre avec l'année (e.g. T1 2025), le quadrimestre avec l'année (e.g. Q1 2025), le semestre avec l'année (e.g. S1 2025). Les tags temporels doivent aussi être en majuscules.
Texte: "{TEXTE_DU_BLOC}"
Date pour référence temporelle: "{DATE_ACTUELLE_YYYY-MM-DD}"
Tags suggérés:
"""

## Problèmes et Contributions

*   Pour signaler un bug ou suggérer une fonctionnalité, veuillez ouvrir une "Issue" sur le [dépôt GitHub du plugin](https://github.com/VOTRE_NOM_UTILISATEUR/VOTRE_REPO_PLUGIN/issues) (remplacez par votre lien).
*   Les contributions sont les bienvenues ! Si vous souhaitez contribuer au code, veuillez forker le dépôt et soumettre une Pull Request.

## Licence

Ce plugin est distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

Fait avec ❤️ pour la communauté Logseq.