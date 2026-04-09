# Checklist preprod locale

## A. Infrastructure locale

- [ ] `app.immo3d.local` pointe vers le PC local.
- [ ] `api.immo3d.local` pointe vers le PC local.
- [ ] Le certificat HTTPS local est installe et approuve par le navigateur.
- [ ] Le front charge en HTTPS.
- [ ] L'API charge en HTTPS.

## B. Configuration quasi production

- [ ] Le backend tourne avec `APP_ENV=production`.
- [ ] Le backend tourne avec `COOKIE_SECURE=true`.
- [ ] Le backend tourne avec `COOKIE_SAMESITE=none`.
- [ ] `FRONTEND_ORIGIN` pointe vers `https://app.immo3d.local:4173`.
- [ ] `FRONTEND_ORIGINS` est restreint au front local preprod.
- [ ] `ALLOWED_HOSTS` contient `api.immo3d.local`.
- [ ] Le front utilise `VITE_API_BASE_URL=https://api.immo3d.local:8443`.

## C. Billing Stripe

- [ ] `BILLING_REQUIRED=true`.
- [ ] `STRIPE_SECRET_KEY` est une cle de test valide.
- [ ] `STRIPE_PRICE_ID` pointe vers l'abonnement mensuel 9,99 EUR.
- [ ] `STRIPE_WEBHOOK_SECRET` correspond au listener Stripe local.
- [ ] `Activer mon abonnement` ouvre Stripe Checkout.
- [ ] Le paiement test valide debloque l'acces.
- [ ] Le portail client Stripe s'ouvre correctement.
- [ ] Une annulation / reprise est bien repercutee dans l'app.

## D. Parcours fonctionnels

- [ ] Login Yanport OK.
- [ ] Logout OK.
- [ ] Session restauree apres refresh navigateur.
- [ ] Session refusee si abonnement inactif.
- [ ] Acces complet si abonnement actif.
- [ ] Recherche biens OK.
- [ ] Notes OK.
- [ ] Blacklist OK.
- [ ] Favoris OK.
- [ ] Mise de cote OK.
- [ ] Reperes perso OK.
- [ ] Placement manuel des biens OK.
- [ ] Export KML OK.

## E. Validation finale avant deploiement

- [ ] Tests backend OK : `python -m unittest discover -s tests -v`
- [ ] Tests frontend OK : `npm.cmd run test`
- [ ] Build frontend OK : `npm.cmd run build:preprod`
- [ ] Backup cree et verifie.
- [ ] Plus aucun secret obsolete n'est conserve dans des fichiers texte.
- [ ] Les cles Stripe de test exposees ont ete regenerees si besoin.
