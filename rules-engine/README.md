# Parakh Rules Engine

Standalone deterministic compliance evaluation service.

The rules engine owns applicability checks and compliance decisions. It must not import frontend code, OCR provider code, or database internals.

## Run

```bash
npm start
```

Default service: `http://localhost:8090`

- `GET /health`
- `POST /evaluate` with `{ "product": {}, "rules": [] }`

AI extraction can provide inputs, but legal/compliance results must remain explicit and traceable to rule identifiers and versions.
