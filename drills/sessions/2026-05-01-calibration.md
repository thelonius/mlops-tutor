# Calibration session — 2026-05-01

**Kind:** calibration · **Length:** 10 questions · **Duration:** ~one sitting

## Results

| # | id | domain | difficulty | kind | verdict | score |
|---|---|---|---|---|---|---|
| 1 | k8s-001 | k8s | 2 | recall | partial | 0.50 |
| 2 | tf-001 | tf | 2 | recall | partial | 0.35 |
| 3 | cloud-001 | cloud | 3 | recall | correct | 0.85 |
| 4 | cicd-001 | cicd | 3 | recall | partial | 0.60 |
| 5 | obs-001 | obs | 3 | recall | partial | 0.65 |
| 6 | sec-001 | sec | 3 | recall | partial | 0.45 |
| 7 | k8s-002 | k8s | 3 | debug | correct | 0.85 |
| 8 | tf-005 | tf | 4 | scenario | partial | 0.40 |
| 9 | cloud-002 | cloud | 4 | scenario | wrong | 0.20 |
| 10 | obs-003 | obs | 4 | design | partial | 0.45 |

**Overall avg score:** 0.53

## Domain mastery

| Domain | Avg | Verdict |
|---|---|---|
| k8s | 0.68 | strong (debug/ops senior) |
| cloud | 0.52 | mixed (IAM theory ok, practical end-to-end weak) |
| cicd | 0.60 | mid (map ok, OIDC pitfall missed) |
| obs | 0.55 | mid (concepts ok, design weak) |
| sec | 0.45 | weak (familiar, not hands-on) |
| tf | 0.38 | **weakest** (shallow answers) |

## Top gaps (must-points missed across domains)

1. Terraform full-workflow: drift recovery (`refresh-only`, `lifecycle.ignore_changes`), repo structure (modules/envs/state-per-service), policy-as-code gates.
2. Cloud practical setup: Workload Identity end-to-end (KSA↔GSA binding, workload pool, metadata server), IRSA trust-policy conditions.
3. Security in production: SOPS with KMS backend + controller decryption (ArgoCD/Flux), Kyverno/Gatekeeper concrete policies.
4. Observability design: signal correlation (Prom exemplars, trace_id in structured JSON logs), SLO burn-rate alerting, cardinality discipline.
5. CI/CD security: OIDC trust-policy `sub` condition (StringLike on ref), immutable image tags, supply chain (cosign/SBOM).

## Recommended next sessions

1. Sprint TF (10 q, focus terraform deep)
2. Sprint Cloud-practical (IRSA + Workload Identity scenarios)
3. Sprint Sec-as-code (SOPS hands-on, Kyverno, supply chain)
4. Sprint Observability (SLO/SLI design, OTel, cardinality, Datadog vs OSS)
5. Targeted mock interview on weakest domains

Calibration questions will resurface via FSRS schedule (1-3 days).

## Notes on session quality

- Strong points: k8s ops/debug methodology (real experience visible), AWS IAM mental model, RED/USE concepts.
- Weak points: practical end-to-end implementation (knows what exists, hasn't shipped it).
- Style observation: tends to name tools rather than describe their interaction. On Senior interviews this reads as "familiar with stack" rather than "built it" — closing this gap is the main training objective.
