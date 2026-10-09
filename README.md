# MedCare component branches

This repository separates the supplied medical appointment system into six component branches for later integration. The main branch contains only shared infrastructure and integration code.

| Branch | Component owner | Initial publication |
|---|---|---|
| patient-management | IT26100051 | Prepared for push |
| doctor-management | IT26100271 | Prepared for push |
| appointment-management | IT26100460 | Prepared for push |
| access-control-staff-management | IT26100467 | Prepared for push |
| doctor-availability-schedule-management | Pending confirmation | Local only; no author-assigned commit |
| feedback-notification-management | Pending confirmation | Local only; no author-assigned commit |

See [the component guide](docs/COMPONENT-BRANCHES.md) for file ownership and merge instructions. The [original system documentation](docs/original-system/README.md) describes the complete application.

The individual branches are integration contributions, not independently runnable applications: their Java types, services, shared controllers and frontend entry point depend on the other components. Assemble all six before building and running the system.
