# PigePro pour Home Assistant OS

Cette app Home Assistant permet de lancer PigePro directement sur un Raspberry Pi qui tourne deja sous Home Assistant OS.

## Ce que fait cette app

- build le frontend React
- lance le backend FastAPI
- sert toute l'application sur le port `10000`
- stocke SQLite et les backups dans `/data`
- desactive Stripe pour l'instant

## Options a renseigner

- `public_hostname`: `app.pigepro.fr`
- `allowed_hosts`: `app.pigepro.fr,localhost,127.0.0.1`
- `app_secret_key`: secret long
- `data_encryption_key`: secret long
- `backup_encryption_key`: secret long

## URL de test local

```text
http://IP_DU_RASPBERRY:10000/health
```

## URL cible publique

```text
https://app.pigepro.fr
```
