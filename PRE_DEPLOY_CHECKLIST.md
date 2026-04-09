# Checklist de pre-mise en ligne

## 0. Securite production

- [ ] Lire et appliquer [PROD_SECURITY_RUNBOOK.md](C:/Users/Alexis/App%20SAFTI/PROD_SECURITY_RUNBOOK.md).
- [ ] Regenerer tous les secrets exposes pendant les essais locaux du 9 avril 2026 avant toute ouverture publique.

## 1. Secrets

- [ ] Regenerer tous les anciens tokens stockes dans d'anciens fichiers texte.
- [ ] Garder les vrais secrets uniquement dans `backend/.env` et `immo-app/.env`.
- [ ] Ne jamais deployer les sauvegardes locales du dossier `Sauvegarde app SATFI`.

## 2. Backend production

- [ ] Partir de [backend/.env.production.example](C:/Users/Alexis/App%20SAFTI/backend/.env.production.example).
- [ ] Mettre `APP_ENV=production`.
- [ ] Mettre une vraie `APP_SECRET_KEY` longue et aleatoire.
- [ ] Mettre une vraie `DATA_ENCRYPTION_KEY` longue et aleatoire.
- [ ] Mettre une vraie `BACKUP_ENCRYPTION_KEY` longue et aleatoire.
- [ ] Mettre `COOKIE_SECURE=true`.
- [ ] Renseigner `ALLOWED_HOSTS` avec le vrai domaine API.
- [ ] Heberger l'API derriere HTTPS.
- [ ] Configurer Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`) si `BILLING_REQUIRED=true`.
- [ ] Choisir une version Python stable pour le deploiement, idealement `3.12` ou `3.13`.

## 3. Frontend production

- [ ] Partir de [immo-app/.env.production.example](C:/Users/Alexis/App%20SAFTI/immo-app/.env.production.example).
- [ ] Pointer `VITE_API_BASE_URL` vers l'URL HTTPS du backend.
- [ ] Restreindre le token Cesium aux vrais domaines de production.
- [ ] Donner au token Cesium le minimum de droits possible.

## 4. Avant ouverture aux utilisateurs

- [ ] Lancer les tests backend: `python -m unittest discover -s tests -v`
- [ ] Creer un backup teste: `python -m app.backup create` puis `python -m app.backup verify <archive.zip>`
- [ ] Verifier qu'une sauvegarde produite en production est bien chiffree (`.zip.enc`).
- [ ] Lancer les tests frontend: `npm.cmd run test`
- [ ] Verifier le build frontend: `npm.cmd run build`
- [ ] Verifier login, logout, synchro Yanport, notes, blacklist et bascule plan/satellite.

## 5. A ne pas oublier

- [ ] Si tu changes `APP_SECRET_KEY`, toutes les sessions existantes seront invalidees au redemarrage.
- [ ] Si tu deploies depuis ce PC, ne copie pas `node_modules`, `dist`, `Sauvegarde app SATFI` ni les anciens fichiers texte.
- [ ] Si tu mets l'app en ligne pour de vrais utilisateurs, prevoir aussi des sauvegardes de la base SQLite ou passer ensuite sur une base serveur.
- [ ] Avant toute restauration, arreter le backend puis utiliser `python -m app.backup restore <archive.zip>`.
