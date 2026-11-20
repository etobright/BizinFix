# Bizinfix Mobile Studio

Studio de mockups mobiles en 3D pour présenter Bizinfix. Le projet initial contient un écran d’exemple en français qui peut être remplacé par une capture ou une vidéo réelle.

Dans **Studio 3D**, importe une capture ou dépose-la sur l’aperçu. Choisis un châssis iPhone ou Android, puis règle la finition et l’éclairage. L’onglet **3D** permet de régler les poses **Début** et **Fin** de chaque scène. Tu peux orienter le téléphone directement dans l’aperçu et appliquer un préréglage dans **Mouvements**. Le rendu reprend les réglages de l’aperçu et propose un export MP4 ou PNG.

Les projets vidéo précédents restent accessibles dans **Projets**. Le bouton **Passer en mockup** applique la mise en page mobile au projet ouvert.

## Installation sous Windows

1. Installez [Node.js 22 LTS ou une version LTS plus récente](https://nodejs.org/en/download) et ouvrez un nouveau terminal PowerShell.
2. Placez-vous dans le dossier `BizinFix`, puis exécutez ces commandes. Utilisez `npm.cmd` pour éviter les restrictions PowerShell sur `npm.ps1`.

   ```powershell
   npm.cmd ci
   npm.cmd run build
   npm.cmd start
   ```

3. Ouvrez [http://127.0.0.1:4310](http://127.0.0.1:4310) dans Chrome ou Edge à jour. Gardez le terminal ouvert pendant les rendus.

Le premier export peut télécharger le navigateur de rendu Remotion et compiler la composition. Une connexion Internet est nécessaire à cette étape. Le moteur Remotion fournit ses binaires de traitement vidéo et audio. L’installation manuelle de FFmpeg sert aux vérifications avec `ffprobe` et aux traitements externes. Sous Windows, si le téléchargement du navigateur est bloqué, indiquez le chemin d’une installation Chrome locale avant de relancer.

```powershell
$env:STUDIO_CHROMIUM = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd start
```

Le rendu utilise SwiftShader par défaut pour assurer la disponibilité de WebGL sur les postes sans GPU compatible. Si le rendu logiciel est trop lent et que les pilotes du poste prennent en charge WebGL, essayez `$env:STUDIO_GL = "angle"` avant de relancer.

Le mode développement se lance avec `npm.cmd run dev` sur [http://127.0.0.1:5173](http://127.0.0.1:5173). Le port 4310 doit également être disponible pour l’API. Redémarrez le serveur après une modification des compositions pour rafraîchir le bundle de rendu.

## Créer une vidéo

1. Ouvrez un projet ou créez-en un à partir d’un modèle.
2. Importez un fichier MP4, WebM, PNG, JPG ou WebP. Le premier média visuel importé remplit l’écran de la scène sélectionnée s’il est vide. Le menu **Écran du smartphone** permet de choisir un autre média.
3. Modifiez le titre, le sous-titre, le mouvement et la durée. L’onglet **Identité** permet de changer les couleurs, la police, le logo et la fréquence d’images.
4. Ajoutez et réorganisez les scènes dans la timeline. Les scènes s’enchaînent avec un fondu. Si l’enregistrement est plus court que la scène, sa dernière image reste affichée. Le son des captures est coupé pour laisser la place aux pistes de narration et de musique.
5. Dans **Audio**, affectez les fichiers importés aux pistes musique et voix off. La musique peut boucler et son volume est réduit quand une voix off est configurée.
6. Choisissez le format près de l’aperçu. **Exporter** permet de demander un MP4 H.264 Full HD ou une miniature PNG aux dimensions du projet. Le téléchargement apparaît en fin de rendu.

Les projets sont enregistrés dans le stockage de votre navigateur pour l’adresse utilisée. Gardez la même adresse et le même profil Chrome ou Edge pour les retrouver. Les médias sont stockés dans `studio-data/media` et les fichiers rendus dans `studio-data/exports`. Les fichiers restent sur disque après un redémarrage. Les liens de téléchargement de la session sont actifs tant que le serveur tourne. Un projet dupliqué partage les fichiers source avec l’original. La suppression d’un projet conserve ces fichiers.

## Architecture

| Dossier | Rôle |
| --- | --- |
| `src/App.tsx` | Projets, modèles, bibliothèque, inspecteur, timeline et contrôles du Player |
| `src/model.ts` | Modèle des projets, formats, durées et modèles de départ |
| `src/video/Demo.tsx` | Composition Remotion, textes, transitions et mixage audio |
| `src/video/Phone.tsx` | Châssis 3D, caméra, éclairage et texture applicative synchronisée |
| `server/index.mjs` | API locale, validation, accès aux médias et aux exports |
| `server/render.mjs` | File de rendu et génération MP4/PNG par Remotion |

Le lecteur et le moteur de rendu utilisent `@remotion/media` en mode headless. Chaque image vidéo décodée alimente la texture WebGL et déclenche le rendu 3D avant la capture serveur. Les mouvements du téléphone et les transitions sont calculés à partir du numéro d’image. Les intégrations ElevenLabs et Playwright pour capturer le site de démonstration font partie des étapes suivantes après validation du MVP. Le flux bilingue de bout en bout requiert également l’URL de démonstration, un compte dédié et les parcours à automatiser.

## Vérifier un MP4

Le parcours de validation importe une mire vidéo, modifie les textes, recharge la page puis télécharge les sorties depuis l’éditeur. Avec FFmpeg installé, contrôlez le codec, les dimensions, la fréquence et le nombre d’images dans PowerShell.

```powershell
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of json .izinfix-demo.mp4
```

Pour une scène d’une seconde en 16:9 à 30 FPS, la sortie attendue est H.264, 1920 × 1080, 30/1 FPS et 30 images. Ouvrez aussi la vidéo et la miniature pour vérifier que le média importé est visible sur l’écran du téléphone. Pour vérifier la synchronisation, utilisez une mire qui imprime son numéro d’image et comparez plusieurs images exportées aux numéros de la source.

## Compatibilité et licences

- Toutes les dépendances Remotion utilisent la version **4.0.545**. React **18.3.1** satisfait les contraintes de React Three Fiber **8.18.0**, avec Three.js **0.170.0**. Le verrou npm fixe les dépendances transitives. [ThreeCanvas](https://www.remotion.dev/docs/three-canvas) · [Texture vidéo](https://www.remotion.dev/docs/videos/as-threejs-texture) · [Rendu](https://www.remotion.dev/docs/renderer/render-media)
- La licence Remotion 4 inclut notamment les particuliers, les organisations à but non lucratif et les entreprises à but lucratif jusqu’à trois employés. Une entreprise commerciale au-delà de ce seuil doit obtenir une licence Company pour un usage commercial. Consultez les conditions pour votre entité et votre mode de distribution. [Licence Remotion](https://github.com/remotion-dev/remotion/blob/v4.0.545/LICENSE.md)
- React, Three.js, React Three Fiber et Tailwind CSS sont distribués sous licence MIT. Le binaire FFmpeg Linux fourni avec Remotion pour ce test annonce GPL-2.0-or-later et active libx264. Pour une redistribution de binaires, vérifiez les conditions de la compilation et des composants réellement fournis. [React](https://github.com/facebook/react/blob/main/LICENSE) · [Three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE) · [React Three Fiber](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE) · [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) · [FFmpeg](https://ffmpeg.org/legal.html)

## Hébergement privé sur Render

Le [Blueprint Render](https://render.com/docs/blueprint-spec) configure un service Docker **Standard payant**, avec une instance et un disque persistant de 5 Go. Le conteneur inclut Chromium et le moteur Remotion fournit FFmpeg. Vérifiez le tarif affiché par Render avant de créer le service. [Tarifs Render](https://render.com/pricing)

Dans Render, ouvrez **New → Blueprint**, sélectionnez le dépôt et la branche contenant `render.yaml`, puis renseignez `STUDIO_ACCESS_PASSWORD` avec un mot de passe fort réservé au studio. Une fois le service disponible, ouvrez son URL HTTPS et connectez-vous avec l’identifiant `studio` et ce mot de passe. Render vérifie le service via `/healthz`.

Le disque héberge les médias et les fichiers exportés. Les projets sont enregistrés dans le navigateur utilisé à l’adresse Render. Un redémarrage interrompt les rendus en cours et efface l’historique de progression de la session. Les exports terminés restent sur le disque.
