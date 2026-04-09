# Deploy simple sur petit hebergeur, sans Stripe

Ce mode de deploiement sert a mettre l'app en ligne rapidement pour tes propres tests, sur PC et telephone, sans activer le paiement.

## Ce qui est prepare

- le frontend Vite est build dans l'image Docker
- le backend FastAPI sert ensuite le frontend final
- SQLite reste possible, a condition de monter un volume persistant
- Stripe est desactive via `BILLING_REQUIRED=false`

## 1. Fichiers utiles

- [Dockerfile](C:/Users/Alexis/App%20SAFTI/Dockerfile)
- [backend/.env.smallhost.example](C:/Users/Alexis/App%20SAFTI/backend/.env.smallhost.example)

## 2. Regle importante

Utilise un seul domaine public pour tout, par exemple :

- `https://app.example.com`

Le frontend et l'API seront servis par le meme service web. Cela simplifie fortement les cookies et evite les soucis de CORS.

## 3. Variables d'environnement

Pars de [backend/.env.smallhost.example](C:/Users/Alexis/App%20SAFTI/backend/.env.smallhost.example) et renseigne au minimum :

```env
APP_ENV=production
APP_SECRET_KEY=une-cle-longue-et-aleatoire
DATABASE_URL=sqlite:///./data/immo3d.db
FRONTEND_ORIGIN=https://app.example.com
FRONTEND_ORIGINS=https://app.example.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
ALLOWED_HOSTS=app.example.com
BILLING_REQUIRED=false
DATA_ENCRYPTION_KEY=une-deuxieme-cle-longue-et-aleatoire
BACKUP_DIR=./data/backups
BACKUP_ENCRYPTION_KEY=une-troisieme-cle-longue-et-aleatoire
```

## 4. Volume persistant

Le service doit avoir un volume persistant monte pour conserver la base SQLite et les sauvegardes.

Chemin a persister dans le conteneur :

```text
/app/backend/data
```

Sans ce volume, la base sera perdue au redeploiement ou au redemarrage.

## 5. Parametres de deploiement

Sur un hebergeur Docker :

- Build depuis [Dockerfile](C:/Users/Alexis/App%20SAFTI/Dockerfile)
- Port expose : `10000`
- Health check : `/health`
- Volume persistant : `/app/backend/data`

## 6. Ce qu'il ne faut pas deployer

Ces dossiers restent purement locaux :

- `Stripe/`
- `certs/`
- `tools/`
- `Sauvegarde app SATFI/`

Ils sont exclus du contexte Docker via [.dockerignore](C:/Users/Alexis/App%20SAFTI/.dockerignore).

## 7. Verification apres mise en ligne

Checklist minimale :

- `https://app.example.com/health` repond `{"status":"ok"}`
- la page d'accueil s'affiche
- le login Yanport fonctionne
- les notes fonctionnent
- la blacklist fonctionne
- les reperes fonctionnent
- les cookies restent valides apres recharge de page

## 8. Plus tard, quand tu voudras remettre Stripe

Il suffira de :

1. mettre `BILLING_REQUIRED=true`
2. renseigner `STRIPE_SECRET_KEY`
3. renseigner `STRIPE_PRICE_ID`
4. renseigner `STRIPE_WEBHOOK_SECRET`
5. ajouter le webhook public vers `/billing/webhook`

L'integration Stripe actuelle du code restera reutilisable.
