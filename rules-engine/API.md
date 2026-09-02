# Rules Engine API

## Health

`GET /health`

Returns:

```json
{"status":"ok","service":"parakh-rules-engine"}
```

## Evaluate

`POST /api/rules-engine/evaluate`

The request body is the `InspectionRequest` defined in `domain/types.ts`.

The response is `OverallInspectionResult` and contains:

- deterministic overall status
- engine version
- rule-set version
- per-rule findings
- legal source references
- evidence used
- missing evidence and unresolved conflicts
- deterministic SHA-256 audit hash

### Outcome precedence

`VIOLATION` > `UNABLE_TO_VERIFY` > `PASS` > `NOT_APPLICABLE`.

A missing evidence item is not automatically a violation. A visual rule without visual evidence is not automatically passed. Conflicting evidence blocks a legal conclusion unless the conflict has been explicitly resolved before evaluation.
