# Deploy Cloudflare Pages + Raspberry Pi

Ce guide sert a mettre :

- le front React/Vite sur Cloudflare Pages
- le backend FastAPI sur ton Raspberry Pi

## Architecture recommandee

- Front public : `https://app.ton-domaine.fr`
- API backend : `https://api.ton-domaine.fr`
- Le front Cloudflare appelle l'API du Raspberry Pi via `VITE_API_BASE_URL`

## 1. Frontend Cloudflare Pages

### Build settings

Dans Cloudflare Pages :

- Framework preset : `Vite`
- Build command : `npm run build`
- Build output directory : `dist`
- Root directory : `immo-app` si tu relies le repo complet, sinon laisse vide si tu deployes seulement le dossier front

### Variables d'environnement

Dans Cloudflare Pages, ajoute :

- `VITE_API_BASE_URL=https://api.ton-domaine.fr`
- `VITE_CESIUM_ION_TOKEN=ton-token-cesium-restreint-a-ton-domaine`

Le fichier [_redirects](C:\Users\Alexis\App SAFTI\immo-app\public\_redirects) est deja ajoute pour que le front React fonctionne correctement en SPA sur les routes rechargees.

## 2. Backend sur Raspberry Pi

### Variables d'environnement conseillees

Pars du modele [backend/.env.production.example](C:\Users\Alexis\App SAFTI\backend\.env.production.example) et mets au minimum :

```env
APP_ENV=production
APP_SECRET_KEY=une-cle-tres-longue-et-aleatoire
DATABASE_URL=sqlite:///./immo3d.db
FRONTEND_ORIGIN=https://app.ton-domaine.fr
FRONTEND_ORIGINS=https://app.ton-domaine.fr
SESSION_COOKIE_NAME=immo3d_session
SESSION_MAX_AGE_SECONDS=604800
COOKIE_SECURE=true
ALLOWED_HOSTS=api.ton-domaine.fr
BILLING_REQUIRED=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
BACKUP_DIR=backups
BACKUP_RETENTION_COUNT=14
```

### Lancement

Sur le Raspberry Pi, l'app doit etre servie derriere un vrai reverse proxy HTTPS.

Commande applicative simple :

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Ensuite, il faut exposer le backend en HTTPS sur `api.ton-domaine.fr`.

## 3. Exposer le backend proprement

### Option recommandee

Utiliser un sous-domaine `api.ton-domaine.fr` et un tunnel/reverse proxy HTTPS.

Options possibles :

- Cloudflare Tunnel
- Nginx Proxy Manager
- reverse proxy classique Nginx

### Ce qu'il faut eviter

- exposer directement `:8000` sur internet sans HTTPS
- garder `APP_ENV=development`
- garder `COOKIE_SECURE=false`

## 4. Domaine

Configuration recommandee :

- `app.ton-domaine.fr` -> Cloudflare Pages
- `api.ton-domaine.fr` -> Raspberry Pi via tunnel ou reverse proxy

## 5. Checklist avant test public

- le front s'ouvre bien sur `https://app.ton-domaine.fr`
- le login fonctionne
- les notes se sauvegardent
- la blacklist se sauvegarde
- les reperes blancs sont conserves
- `Vue plan / Vue satellite` fonctionne
- `Export KML` fonctionne
- les photos Leboncoin s'affichent

## 6. Checklist avant premiere vraie mise en ligne

- faire une sauvegarde de `immo3d.db`
- tester `python -m app.backup create` puis `python -m app.backup verify <archive.zip>`
- verifier que le token Cesium est restreint au domaine de prod
- verifier que `FRONTEND_ORIGINS` ne contient pas les anciennes URLs de dev
- verifier que le backend redemarre automatiquement apres reboot
- verifier les logs backend

## 7. Ordre recommande

1. choisir le domaine
2. deployer le front sur Cloudflare Pages
3. exposer le backend du Pi sur `api.ton-domaine.fr`
4. renseigner `VITE_API_BASE_URL`
5. tester login + synchro + notes + reperes
6. seulement apres, partager l'app a d'autres personnes
