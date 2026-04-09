# Preprod locale quasi production

Objectif : reproduire localement le comportement du futur deploiement final avec :

- front sur un sous-domaine local HTTPS
- API sur un sous-domaine local HTTPS
- cookies `Secure`
- `SameSite=None`
- CORS et `ALLOWED_HOSTS` restreints
- Stripe en mode test

## 1. Noms de domaine locaux

Ajouter dans le fichier `hosts` Windows :

```text
127.0.0.1 app.immo3d.local
127.0.0.1 api.immo3d.local
```

Si tu testes aussi depuis le telephone sur le meme Wi-Fi, ajoute l'IP locale du PC :

```text
192.168.1.13 app.immo3d.local
192.168.1.13 api.immo3d.local
```

## 2. Certificats HTTPS locaux

Option recommandee : `mkcert`

Exemple :

```powershell
mkcert -install
mkcert app.immo3d.local api.immo3d.local 127.0.0.1 192.168.1.13
```

Placer ensuite les certificats dans :

```text
C:\Users\Alexis\App SAFTI\certs\
```

Exemple attendu :

- `C:\Users\Alexis\App SAFTI\certs\app.immo3d.local.pem`
- `C:\Users\Alexis\App SAFTI\certs\app.immo3d.local-key.pem`
- `C:\Users\Alexis\App SAFTI\certs\api.immo3d.local.pem`
- `C:\Users\Alexis\App SAFTI\certs\api.immo3d.local-key.pem`

## 3. Backend preprod locale

Copier :

- `backend/.env.preprod.example`
- vers `backend/.env.preprod.local`

Renseigner les vraies valeurs Stripe de test et une `BACKUP_ENCRYPTION_KEY` dediee si tu veux tester les sauvegardes chiffrees.

Le backend accepte maintenant un fichier d'environnement dedie via `APP_SETTINGS_FILE`.

Lancement PowerShell :

```powershell
cd "C:\Users\Alexis\App SAFTI\backend"
$env:APP_SETTINGS_FILE=".env.preprod.local"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-certfile "C:\Users\Alexis\App SAFTI\certs\api.immo3d.local.pem" --ssl-keyfile "C:\Users\Alexis\App SAFTI\certs\api.immo3d.local-key.pem"
```

## 4. Frontend preprod locale

Copier :

- `immo-app/.env.preprod.example`
- vers `immo-app/.env.preprod.local`

Adapter les chemins des certificats si besoin.

Build + preview HTTPS :

```powershell
cd "C:\Users\Alexis\App SAFTI\immo-app"
npm run build:preprod
npm run preview:preprod -- --mode preprod
```

Le front doit ensuite repondre sur :

```text
https://app.immo3d.local:4173
```

## 5. Stripe en preprod locale

Le webhook peut continuer a pointer vers l'API locale.

Si le backend est servi en HTTPS local avec certificat auto-signe :

```powershell
stripe listen --skip-verify --forward-to https://api.immo3d.local:8443/billing/webhook
```

Si tu gardes temporairement le backend local en HTTP pour Stripe uniquement :

```powershell
stripe listen --forward-to http://127.0.0.1:8000/billing/webhook
```

La premiere option est la plus proche de la production.

## 6. Etat cible avant deploiement

La preprod locale est correcte si les points suivants passent :

- `https://app.immo3d.local:4173` charge sans erreur
- `https://api.immo3d.local:8443/health` repond `{"status":"ok"}`
- login OK
- logout OK
- abonnement Stripe test OK
- retour Stripe debloque l'acces
- portail client Stripe OK
- notes OK
- blacklist OK
- markers OK
- synchro Yanport OK
- export KML OK

## 7. Ce qu'il restera le jour du deploiement

Si cette preprod locale est validee, le jour du deploiement il restera surtout a remplacer :

- `app.immo3d.local` par `app.ton-domaine.fr`
- `api.immo3d.local` par `api.ton-domaine.fr`
- `sk_test_...` par `sk_live_...`
- `whsec_...` local par le secret webhook de prod
- le certificat local par le HTTPS public reel
