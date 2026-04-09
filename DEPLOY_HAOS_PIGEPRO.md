# PigePro sur Raspberry avec Home Assistant OS

Tu as deja Home Assistant OS installe sur le Raspberry. Dans ce cas, le chemin propre n'est pas une installation Linux classique, mais une app Home Assistant personnalisée.

Sources de reference :

- Les apps Home Assistant peuvent executer des applications dans Home Assistant OS : [Home Assistant apps](https://developers.home-assistant.io/docs/apps/)
- Un depot d'apps Home Assistant est reconnu via `repository.yaml` a la racine : [Create an app repository](https://developers.home-assistant.io/docs/apps/repository/)
- L'acces terminal se fait generalement via l'add-on communautaire SSH & Web Terminal : [SSH & Web Terminal](https://community.home-assistant.io/t/home-assistant-community-add-on-ssh-web-terminal/33820)
- Pour publier `app.pigepro.fr` sans ouvrir les ports, Cloudflare Tunnel mappe un hostname public vers un service local : [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/) et [Publish an application](https://developers.cloudflare.com/tunnel/setup/)

## Ce qui a ete prepare dans le repo

- [repository.yaml](C:/Users/Alexis/App%20SAFTI/repository.yaml)
- [pigepro_haos/config.yaml](C:/Users/Alexis/App%20SAFTI/pigepro_haos/config.yaml)
- [pigepro_haos/Dockerfile](C:/Users/Alexis/App%20SAFTI/pigepro_haos/Dockerfile)
- [pigepro_haos/run.sh](C:/Users/Alexis/App%20SAFTI/pigepro_haos/run.sh)

Cette app lance PigePro sur le port `10000` du Raspberry et stocke ses donnees dans `/data`.

## Architecture recommandee

- Home Assistant reste en place sur le Raspberry
- PigePro tourne comme app Home Assistant sur le meme Raspberry
- `app.pigepro.fr` pointe vers un tunnel Cloudflare
- le tunnel envoie le trafic vers `http://IP_DU_RASPBERRY:10000`

## 1. Installer l'app PigePro dans Home Assistant

Dans Home Assistant :

1. Ouvre `Parametres` -> `Modules complementaires` -> `Boutique`
2. Dans le menu en haut a droite, ajoute le depot :

```text
https://github.com/Anonyme62/Immo3D
```

3. Installe l'app `PigePro`

## 2. Configurer l'app

Renseigne au minimum :

- `public_hostname`: `app.pigepro.fr`
- `allowed_hosts`: `app.pigepro.fr,localhost,127.0.0.1`
- `app_secret_key`: une cle longue et aleatoire
- `data_encryption_key`: une deuxieme cle longue et aleatoire
- `backup_encryption_key`: une troisieme cle longue et aleatoire
- `backup_retention_count`: nombre d'archives a conserver
- `backup_interval_minutes`: intervalle entre 2 backups auto (`0` pour desactiver, `60` = 1 heure)
- `backup_verify_after_create`: verifie automatiquement l'archive creee

Pour re-activer l'abonnement mensuel Stripe dans l'app Home Assistant :

- `billing_required`: `true`
- `stripe_secret_key`: ta cle Stripe `sk_test_...` ou `sk_live_...`
- `stripe_price_id`: ton prix mensuel `price_...`
- `stripe_webhook_secret`: le secret webhook `whsec_...`
- `stripe_api_version`: `2026-03-25.dahlia`

L'app force :

- `DATABASE_URL=sqlite:////data/immo3d.db`
- `BACKUP_DIR=/data/backups`

Si `billing_required=true`, le webhook public Stripe doit pointer vers :

```text
https://app.pigepro.fr/billing/webhook
```

## 3. Premier test local

Avant de brancher le domaine, teste :

```text
http://IP_DU_RASPBERRY:10000/health
```

Tu dois obtenir :

```json
{"status":"ok"}
```

## 4. Lier `app.pigepro.fr`

Le plus simple est Cloudflare Tunnel.

Principe officiel :

- `cloudflared` cree une connexion sortante vers Cloudflare
- pas besoin d'ouvrir les ports de ta box
- le hostname public pointe ensuite vers ton service local

Cloudflare documente ce flux ici :

- [Cloudflare Tunnel overview](https://developers.cloudflare.com/tunnel/)
- [Add a published application route](https://developers.cloudflare.com/tunnel/setup/)
- [Routing and DNS with Tunnel](https://developers.cloudflare.com/tunnel/routing/)

Route cible a creer :

- hostname public : `app.pigepro.fr`
- service local : `http://IP_DU_RASPBERRY:10000`

## 5. Important sur le domaine

Si tu veux utiliser Cloudflare Tunnel avec `pigepro.fr`, le plus simple est que la gestion DNS du domaine passe par Cloudflare.

Si ton domaine est chez un autre registrar, ce n'est pas grave :

- soit tu gardes juste l'achat chez ce registrar
- soit tu bascules les nameservers vers Cloudflare pour gerer le DNS et le tunnel

## 6. Recommandation pratique

Je te conseille de viser d'abord :

- Home Assistant OK
- PigePro OK en local sur `http://IP_DU_RASPBERRY:10000`
- puis seulement `app.pigepro.fr`

Cela permet de separer :

1. le demarrage de l'app
2. le reseau/domaine

## 7. Ce que je te conseille maintenant

Sur cette machine, la prochaine etape logique est :

1. pousser ce repo sur GitHub
2. ajouter le depot dans Home Assistant
3. installer l'app `PigePro`
4. verifier `/health` en local
5. ensuite brancher `app.pigepro.fr`
