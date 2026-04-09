# Runbook Securite Production

Ce document fixe la marche a suivre avant la premiere ouverture publique de l'application.

Important:
- Des secrets de test ont ete exposes pendant les essais locaux du 9 avril 2026.
- Ne reutilise aucun secret de test ou de preprod en production.
- Regle la configuration de production avant toute premiere ecriture reelle en base.

## 1. Secrets a regenerer exactement

### Obligatoires avant ouverture publique

1. `APP_SECRET_KEY`
- Usage: signature des cookies de session et du serializer applicatif.
- Action: generer une nouvelle valeur aleatoire d'au moins 32 caracteres.
- Impact: invalide toutes les sessions existantes au prochain redemarrage.

2. `DATA_ENCRYPTION_KEY`
- Usage: chiffrement Fernet des donnees sensibles stockees en base et hash HMAC de recherche.
- Action: generer une nouvelle valeur aleatoire, differente de `APP_SECRET_KEY`.
- Impact critique: si tu changes cette cle apres avoir deja des donnees chiffrees en production, les valeurs existantes deviennent illisibles tant qu'elles ne sont pas re-chiffrees avec la nouvelle cle.
- Regle donc cette cle une seule fois avant les premieres vraies inscriptions/utilisations.

3. `STRIPE_SECRET_KEY`
- Usage: appels serveur vers Stripe.
- Action: utiliser une cle live `sk_live_...` creee en mode production Stripe.
- Interdiction: ne jamais reutiliser une cle `sk_test_...`.

4. `STRIPE_WEBHOOK_SECRET`
- Usage: verification de signature des webhooks Stripe.
- Action: creer un endpoint webhook live dedie et utiliser uniquement le `whsec_...` de cet endpoint live.
- Interdiction: ne jamais reutiliser le `whsec_...` de la Stripe CLI locale.

5. `STRIPE_PRICE_ID`
- Usage: prix d'abonnement mensuel.
- Action: recreer le produit et le prix en mode live Stripe puis utiliser le `price_...` live.
- Interdiction: ne jamais reutiliser le `price_...` du mode test.

6. `VITE_CESIUM_ION_TOKEN`
- Usage: acces Cesium cote frontend.
- Action: creer un token de production dedie, restreint au domaine public final, avec le minimum de droits possible.

7. `BACKUP_ENCRYPTION_KEY`
- Usage: chiffrement des archives de sauvegarde creees par `python -m app.backup create`.
- Action: generer une troisieme valeur aleatoire, differente de `APP_SECRET_KEY` et de `DATA_ENCRYPTION_KEY`.
- Important: les archives chiffrees existantes dependent de cette cle. Une rotation ulterieure impose soit de conserver l'ancienne cle pour les anciennes archives, soit de rechiffrer les sauvegardes.

8. `DATABASE_URL`
- Usage: acces a la base en production.
- Action: si tu utilises une base serveur, genere des identifiants neufs et ne reutilise aucun mot de passe de dev/preprod.

### Secrets et fichiers sensibles a purger ou isoler

Ces fichiers ne doivent pas etre deployes tels quels et doivent etre nettoyes, archives de facon chiffre, ou supprimes si tu n'en as plus besoin:

- [backend/.env](C:\Users\Alexis\App SAFTI\backend\.env)
- [backend/.env.preprod.local](C:\Users\Alexis\App SAFTI\backend\.env.preprod.local)
- [immo-app/.env](C:\Users\Alexis\App SAFTI\immo-app\.env)
- [immo-app/.env.preprod.local](C:\Users\Alexis\App SAFTI\immo-app\.env.preprod.local)
- [backend/token.txt](C:\Users\Alexis\App SAFTI\backend\token.txt)
- [immo-app/src/cesium token.txt](C:\Users\Alexis\App SAFTI\immo-app\src\cesium token.txt)
- [immo-app/src/cle google.txt](C:\Users\Alexis\App SAFTI\immo-app\src\cle google.txt)
- [backend/backups](C:\Users\Alexis\App SAFTI\backend\backups)
- [Sauvegarde app SATFI](C:\Users\Alexis\App SAFTI\Sauvegarde app SATFI)

Si un secret sensible a transite dans l'un de ces fichiers, considere-le comme expose et remplace-le avant la mise en ligne.

## 2. .env production cible

### Backend

Base de travail:
- [backend/.env.production.example](C:\Users\Alexis\App SAFTI\backend\.env.production.example)

Bloc cible recommande:

```env
APP_ENV=production
APP_SECRET_KEY=genere-une-valeur-longue-et-aleatoire
DATA_ENCRYPTION_KEY=genere-une-deuxieme-valeur-longue-et-aleatoire
DATABASE_URL=sqlite:////var/lib/immo3d/immo3d.db
FRONTEND_ORIGIN=https://app.example.com
FRONTEND_ORIGINS=https://app.example.com
SESSION_COOKIE_NAME=immo3d_session
SESSION_MAX_AGE_SECONDS=604800
COOKIE_SECURE=true
COOKIE_SAMESITE=none
CSRF_HEADER_NAME=X-CSRF-Token
ALLOWED_HOSTS=api.example.com
BILLING_REQUIRED=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PRICE_ID=price_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxx
STRIPE_API_VERSION=
BACKUP_DIR=/var/lib/immo3d/backups
BACKUP_RETENTION_COUNT=14
BACKUP_ENCRYPTION_KEY=genere-une-troisieme-valeur-longue-et-aleatoire
```

Notes:
- `STRIPE_API_VERSION` peut rester vide si tu laisses Stripe utiliser la version par defaut du compte live.
- Si tu choisis de la figer, verifie la vraie version du compte live dans Workbench le jour du deploiement.
- Le 9 avril 2026, la doc Stripe publique indiquait `2026-02-25.clover` comme version GA courante, mais la version effective de ton compte doit etre verifiee au moment du go-live.
- Si tu restes sur SQLite au lancement, place la base et les backups sur un disque chiffre ou un volume serveur chiffre.
- Les sauvegardes creees par l'application seront chiffrees si `BACKUP_ENCRYPTION_KEY` est renseignee.

Commandes utiles pour generer les trois secrets backend:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Frontend

Base de travail:
- [immo-app/.env.production.example](C:\Users\Alexis\App SAFTI\immo-app\.env.production.example)

Bloc cible recommande:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_CESIUM_ION_TOKEN=token-de-production-restreint-au-domaine-final
```

## 3. Ce que ton app protege deja

Etat actuel du code:

- Les numeros de carte et les CVC ne transitent pas par ton application: Stripe Checkout les gere directement.
- Le mot de passe Yanport n'est pas stocke en base.
- Les identifiants Yanport et le token d'acces Yanport sont chiffres au repos.
- Les recherches utilisateurs se font via hash HMAC plutot qu'en clair.
- Les cookies de session sont `HttpOnly`, signes, et compatibles `Secure`/`SameSite=None`.
- Le backend ajoute deja des en-tetes de securite et HSTS en production.

References code:
- [backend/app/config.py](C:\Users\Alexis\App SAFTI\backend\app\config.py)
- [backend/app/security.py](C:\Users\Alexis\App SAFTI\backend\app\security.py)
- [backend/app/routers/auth.py](C:\Users\Alexis\App SAFTI\backend\app\routers\auth.py)
- [backend/app/routers/billing.py](C:\Users\Alexis\App SAFTI\backend\app\routers\billing.py)
- [backend/app/services/stripe_billing.py](C:\Users\Alexis\App SAFTI\backend\app\services\stripe_billing.py)
- [backend/app/main.py](C:\Users\Alexis\App SAFTI\backend\app\main.py)

Limites a connaitre:

- La base SQLite n'est pas entierement chiffree champ par champ.
- Les donnees metier comme les notes, blacklistes ou reperes perso restent stockees en clair dans la base.
- Les backups ZIP ne sont pas chiffres par l'application.
- Les protections anti-bruteforce et rate-limit sont en memoire, donc non partagees entre plusieurs instances.

## 4. Derniers durcissements recommandes avant ouverture publique

### A faire avant le go-live

1. Rotation complete des secrets
- Remplacer tous les secrets exposes ou utilises en local/preprod.
- Verifier egalement les anciens dumps, backups et fichiers texte.

2. HTTPS uniquement
- Frontend et backend uniquement en HTTPS public.
- Conserver `COOKIE_SECURE=true`.
- Ajouter HSTS aussi au niveau du reverse proxy si tu en utilises un.

3. Webhook Stripe live dedie
- Creer un endpoint live HTTPS.
- Utiliser un `whsec_...` live.
- Verifier que l'endpoint gere les doublons, retards et ordre non garanti des evenements.

4. Evenements Stripe minimums a surveiller
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

5. Token Cesium restreint
- Restreindre le token au domaine final.
- Retirer tous les domaines de test, IP locales et origines temporaires.

6. Stockage chiffre au niveau infra
- Activer le chiffrement du disque ou du volume serveur.
- Chiffrer le stockage des backups.
- Si tu restes sur SQLite, c'est fortement recommande des le premier jour.

7. Permissions serveur minimales
- Fichier `.env` lisible uniquement par l'utilisateur du service.
- Dossier de base et dossier de backups non publics.
- Pas de secrets dans les logs, ni dans les messages d'erreur renvoyes au frontend.

8. MFA partout
- Stripe
- Hebergeur
- GitHub/Git
- Registraire DNS
- Boite mail administrateur

9. Test de restauration
- Faire un vrai test `create -> verify -> restore` sur un environnement de preprod.
- Verifier que l'app redemarre correctement apres restauration.

10. Revue de dependances
- Mettre en place une verification reguliere des mises a jour de securite Python et npm.
- Appliquer rapidement les patchs critiques.

### A faire tres vite apres le go-live

1. Rate-limit distribue
- Deplacer le rate-limit et les lockouts vers Redis ou un stockage partage si tu ajoutes plusieurs instances backend.

2. Logs d'audit
- Journaliser proprement les connexions, deconnexions, creations de session Stripe, webhooks recus, annulations et echecs de paiement.
- Ne jamais journaliser les secrets, cookies, tokens complets ou donnees bancaires.

3. Backup chiffre applicatif ou stockage manag
- Si possible, ajouter un chiffrement des archives de backup en plus du chiffrement disque.

4. Base serveur a moyen terme
- Si le nombre d'utilisateurs monte, envisager PostgreSQL gere plutot que SQLite pour la concurrence, les sauvegardes et l'exploitation.

5. Verification Stripe SDK
- Le code actuel fonctionne avec `requests` et une verification manuelle de signature webhook.
- A moyen terme, migrer vers le SDK officiel Stripe Python simplifiera les upgrades et reduira le risque d'ecart avec la doc officielle.

## 5. Go / No-Go

### Go si tout est vrai

- Tous les secrets de test et de preprod du 9 avril 2026 ont ete remplaces.
- Le `.env` de production contient des valeurs neuves et propres.
- Le prix et le webhook Stripe existent en live.
- Le domaine public final est en HTTPS.
- Le token Cesium est restreint.
- Les backups ont ete testes.
- Tu as valide une derniere fois le parcours complet en condition production.

### No-Go si un seul de ces points reste faux

- Un ancien `sk_test_...`, `whsec_...` local, `APP_SECRET_KEY` ou `DATA_ENCRYPTION_KEY` est encore present.
- Des secrets trainent encore dans des fichiers texte, backups ou dossiers de sauvegarde.
- Le webhook live n'a pas ete teste.
- Le stockage prod n'est pas chiffre au niveau machine/volume.
