# SolarSizerPro — Rhône Solaire

Outil de dimensionnement solaire : on cherche une adresse, Google Solar analyse le toit,
et on place des grilles de panneaux sur la photo satellite avant d'exporter le plan de toiture.

Portage sur Next.js 15 (App Router) du prototype `SolarSizerPro.dc.html`, conservé à la
racine comme référence de design.

## Périmètre

Ne fait que ça, volontairement :

1. **Recherche d'adresse** — Places Autocomplete, restreint à la France.
2. **Analyse du toit** — Solar API `buildingInsights`. Hors couverture, l'app bascule en
   mode « délimitation estimée » et le placement reste entièrement manuel.
3. **Placement des panneaux** — grilles déplaçables, orientables, redimensionnables
   directement sur la carte ou depuis le panneau latéral. Le bouton « Poignées », en bas
   à droite, bascule en vue client : la flèche de rotation et les boutons + / −
   disparaissent et les panneaux passent en noir, pour une vue proche du rendu installé ;
   le champ reste déplaçable par son point central.
4. **Export** — plan de toiture en PNG via Maps Static API.

Le formulaire de simulation en 5 étapes, la liste des simulations, les calculs de
production/ROI et les liens de partage du prototype ont été retirés.

## Deux piles cartographiques

L'app tourne au choix sur Google ou sur une pile entièrement libre et sans clé, choisie
par `NEXT_PUBLIC_MAP_PROVIDER` :

| | `google` | `osm` |
|---|---|---|
| Carte | Maps JavaScript API | Leaflet + OpenStreetMap (plan) / Esri World Imagery (satellite) |
| Recherche d'adresse | Places Autocomplete | API Adresse (BAN), `api-adresse.data.gouv.fr` |
| Géocodage | Geocoding API | inutile — la BAN renvoie les coordonnées avec la suggestion |
| Analyse du toit | Solar API | **aucun équivalent** — placement 100 % manuel |
| Export PNG | Maps Static API | tuiles proxifiées par `/api/tiles`, composées sur `<canvas>` |
| Clés requises | deux | aucune |

**`google` est le défaut** : variable vide ou absente = pile Google. Un déploiement à qui
il manque une clé doit échouer visiblement plutôt que servir discrètement OpenStreetMap en
production. Le mode libre est donc explicite, `NEXT_PUBLIC_MAP_PROVIDER=osm`.

Le mode `osm` sert au développement et à la démonstration. Il n'apporte pas d'analyse de
toiture : le bandeau « Placement manuel » remplace le résultat Solar, les panneaux gardent
les dimensions par défaut (1,95 × 1,13 m, 500 Wc) et le premier champ est orienté plein
sud. Vérifiez les conditions d'utilisation d'Esri et d'OpenStreetMap avant tout usage
au-delà des tests.

Tout passe par `lib/map/` : `MapProvider` / `MapHandle` / `MarkerHandle` décrivent le
strict minimum dont l'app a besoin, et `fieldLayers.ts` ne connaît que ces interfaces. Les
deux implémentations vivent dans `googleProvider.ts` et `leafletProvider.ts`.

## Clés Google — le point important

Le prototype embarquait la clé en clair dans le HTML. Sur une URL publique elle serait
scrapée en quelques heures, et la facturation est à votre charge. Ici :

| Clé | Exposée ? | Sert à |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Oui, inévitablement | Charger Maps JavaScript API |
| `GOOGLE_MAPS_SERVER_KEY` | Non, jamais | Places, Geocoding, Solar, Static Maps (via `/api/*`) |

Utilisez **deux clés distinctes** dans Google Cloud Console :

**Clé navigateur** — la seule visible dans le code source de la page.
- *Application restrictions* : HTTP referrers → `https://votre-site.netlify.app/*`
- *API restrictions* : Maps JavaScript API, et rien d'autre

**Clé serveur** — jamais envoyée au navigateur.
- *Application restrictions* : None (Netlify n'a pas d'IP sortante fixe)
- *API restrictions* : Places API (New), Geocoding API, Solar API, Maps Static API

Dans les deux cas, fixez des **quotas journaliers** dans la console Google : les routes
`/api/*` appliquent un throttle par IP, mais il est en mémoire — il se réinitialise à
chaque démarrage à froid et n'est pas partagé entre instances de fonction. C'est un
garde-fou, pas un plafond de dépense.

## Développement local

```bash
cp .env.example .env.local   # puis renseignez les deux clés
npm install
npm run dev                  # http://localhost:4173
```

Pour que la clé navigateur fonctionne en local, ajoutez `http://localhost:4173/*` à ses
référents autorisés.

Sans clé sous la main, mettez `NEXT_PUBLIC_MAP_PROVIDER=osm` : tout fonctionne hormis
l'analyse de toiture.

## Déploiement Netlify

La configuration est dans `netlify.toml` : `@netlify/plugin-nextjs` transforme les routes
`/api/*` en fonctions Netlify et gère le rendu serveur.

**Via l'interface** — poussez le dépôt sur GitHub, puis dans Netlify : *Add new site →
Import an existing project*. La commande de build (`npm run build`) et le dossier publié
(`.next`) sont lus depuis `netlify.toml`, il n'y a rien à saisir.

**Via le CLI** :

```bash
npx netlify-cli deploy --build --prod
```

Dans les deux cas, avant le premier build, renseignez les variables d'environnement dans
*Site configuration → Environment variables* :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_MAP_PROVIDER` | `google` (facultatif, c'est le défaut) |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | clé navigateur |
| `GOOGLE_MAPS_SERVER_KEY` | clé serveur |

`NEXT_PUBLIC_*` est inlinée au moment du build : si vous l'ajoutez après coup, relancez un
déploiement, sinon la carte restera vide. Une fois le domaine `.netlify.app` connu,
revenez y restreindre la clé navigateur.

## APIs à activer dans Google Cloud

Maps JavaScript API · Places API (New) · Geocoding API · Solar API · **Maps Static API**

La dernière n'est pas activée sur la clé actuelle : l'export renvoie une 403 tant qu'elle
ne l'est pas. Toutes les autres fonctionnent.

## Structure

```
app/
  api/places/autocomplete/  proxy Places (clé serveur)
  api/geocode/              placeId → lat/lng
  api/solar/                buildingInsights, 200 + available:false hors couverture
  api/staticmap/            construit l'URL Static Maps et renvoie le PNG (google)
  api/tiles/                proxy de tuiles aériennes pour l'export canvas (osm)
lib/
  geo.ts                    géométrie des grilles de panneaux (pur, testable)
  fieldLayers.ts            overlays de la carte, piloté impérativement
  map/                      abstraction carte + implémentations google et leaflet
  export/canvasExport.ts    PNG composé dans le navigateur (osm)
  server/ban.ts             recherche d'adresse via l'API Adresse (osm)
  mapsLoader.ts             injection du script Maps, une seule fois (google)
components/
  SolarSizer.tsx            état + orchestration
  AddressSearch.tsx         écran de recherche
  EditorSidebar.tsx         panneau latéral de l'éditeur
```

`lib/geo.ts` est partagé entre le navigateur et la route d'export : les panneaux dessinés
sur la carte et ceux du PNG sortent du même calcul.

## Points d'attention

- **Logo** — le prototype référençait `uploads/brand_file-1783412124036.png`, absent du
  dossier. Remplacé par un intitulé texte « Rhône Solaire ». Déposez le PNG dans `public/`
  et remettez un `<img>` dans `components/Topbar.tsx` quand vous l'aurez.
- **`google.maps.Marker`** est déprécié au profit de `AdvancedMarkerElement`. Toujours
  fonctionnel, mais à migrer un jour (nécessite un `mapId`, ce qui exclut les `styles`
  inline actuels).
- **Contours de toit** — le prototype dessinait les segments de toiture renvoyés par
  l'API Solar sous forme de rectangles jaunes. Ils encombraient la vue et ont été
  retirés ; seul l'azimut du premier segment est conservé, pour orienter le premier
  champ dans le sens de la pente.
- **Dimensions de panneau** — `DEFAULT_PANEL_SPEC` dans `lib/geo.ts` est la seule source
  de vérité : 1,95 × 1,13 m, 500 Wc. Solar API renvoie ses propres dimensions, elles sont
  ignorées volontairement — un plan doit être dessiné au module qui sera réellement posé.
  Conséquence : `maxArrayPanelsCount`, affiché comme « emplacements recommandés par Google
  Solar », reste calculé par Google avec *son* panneau. C'est un ordre de grandeur, pas le
  nombre de nos panneaux ; le compteur du panneau latéral, lui, compte les vôtres.
- **Pas de persistance** — rien n'est sauvegardé, par choix. Rafraîchir la page repart de
  zéro.
