# database/

SQLite database file (`jbos.db`) is auto-created here on first server boot or via:

```powershell
npm run db:init
```

Optional seed data (gold/diamond/gemstone/making masters):

```powershell
npm run db:seed --prefix server
```

The `.db` file is git-ignored.
