# Setup Stripe Immo 3D

## 0. Configuration locale recommandee

Objectif : faire tourner le parcours exactement comme une version commercialisable, mais en
mode `test` et en local.

Produit Stripe de test cree :

- Produit : `prod_UIuwcJaMMHN6AO`
- Prix mensuel 9,99 EUR : `price_1TKJ6O7l1fIGphcfTFJaKe8o`

Configuration locale conseillee dans `backend/.env` :

```env
APP_ENV=development
FRONTEND_ORIGIN=http://127.0.0.1:5173
FRONTEND_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
BILLING_REQUIRED=true
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_ID=price_1TKJ6O7l1fIGphcfTFJaKe8o
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_API_VERSION=2026-03-25.dahlia
```

Important :

- `sk_test_xxx` doit venir du dashboard Stripe en mode test.
- `whsec_xxx` doit venir du terminal `stripe listen`.
- Tant que `BILLING_REQUIRED=true`, l'app refusera l'acces sans abonnement actif.

## 0.bis. Webhook local Stripe

Pour que les renouvellements, echecs de paiement et annulations se comportent comme en prod,
fais tourner un forward local avec Stripe CLI :

```bash
stripe listen --forward-to http://127.0.0.1:8000/billing/webhook
```

Recopie ensuite le `Signing secret` affiche par Stripe CLI dans `STRIPE_WEBHOOK_SECRET`.

Le backend ecoute deja les evenements utiles :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## 0.ter. Parcours local attendu

1. L'utilisateur se connecte a l'app.
2. Sans abonnement actif, l'ecran Stripe s'affiche.
3. Le clic sur `Activer mon abonnement` ouvre Checkout Stripe.
4. Au retour, l'app resynchronise immediatement la session Checkout.
5. Le webhook local continue ensuite de tenir l'abonnement a jour comme en production.

## 1. Creer le produit mensuel dans Stripe

- Dashboard Stripe > `Product catalog`
- Creer un produit `Immo 3D`
- Ajouter un prix recurrent mensuel
- Recuperer le `Price ID` commence par `price_`

## 2. Configurer les variables backend

Dans `backend/.env.production` :

```env
APP_ENV=production
COOKIE_SECURE=true
COOKIE_SAMESITE=none
ALLOWED_HOSTS=api.ton-domaine.fr
BILLING_REQUIRED=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 3. Configurer le webhook Stripe

- Dashboard Stripe > `Developers` > `Webhooks`
- Ajouter un endpoint HTTPS :

```text
https://api.ton-domaine.fr/billing/webhook
```

- Ecouter au minimum :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

- Copier le secret webhook `whsec_...`

## 4. Activer le portail client Stripe

- Dashboard Stripe > `Billing` > `Customer portal`
- Activer la gestion abonnement / moyen de paiement
- Le backend cree ensuite la session portail automatiquement

## 5. Test complet avant prod

1. Mettre les cles `sk_test_...`, `price_...`, `whsec_...` de test.
2. Se connecter a l'app avec un compte Yanport.
3. Verifier que l'ecran abonnement apparait.
4. Cliquer `Activer mon abonnement`.
5. Finir un paiement test Stripe.
6. Revenir dans l'app et verifier que l'acces est debloque.
7. Ouvrir le portail client et tester une annulation ou un changement de carte.

## 6. Sauvegarde avant ouverture publique

```bash
cd backend
python -m app.backup create
python -m app.backup verify <chemin-vers-archive.zip>
```

## 6.bis. Cas Home Assistant OS / Raspberry

Si tu utilises l'app `PigePro` sur Home Assistant OS, active Stripe directement dans la
configuration de l'app :

- `billing_required`: `true`
- `billing_bypass_identities`: optionnel, pour exempter certains logins/emails Yanport du paiement
- `stripe_secret_key`: `sk_test_...` ou `sk_live_...`
- `stripe_price_id`: `price_...`
- `stripe_webhook_secret`: `whsec_...`
- `stripe_api_version`: `2026-03-25.dahlia`

Le webhook public a declarer dans Stripe devient alors :

```text
https://app.pigepro.fr/billing/webhook
```

## 7. Important

- Tant que `BILLING_REQUIRED=true`, le backend bloque les routes metier sans abonnement actif.
- Le front seul ne suffit pas pour contourner le paiement.
- Avant une restauration de backup, arreter le backend.
