# MedCare component branches

This repository separates the supplied medical appointment system into six component branches. The main branch contains the shared foundation and the four confirmed components, merged on 10 October 2026 with their original author commits preserved. The component branches are retained.

| Branch | Component owner | Integration status |
|---|---|---|
| patient-management | IT26100051 | Pushed and merged into main |
| doctor-management | IT26100271 | Pushed and merged into main |
| appointment-management | IT26100460 | Pushed and merged into main |
| access-control-staff-management | IT26100467 | Pushed and merged into main |
| doctor-availability-schedule-management | Pending confirmation | Local only; no author-assigned commit |
| feedback-notification-management | Pending confirmation | Local only; no author-assigned commit |

See [the component guide](docs/COMPONENT-BRANCHES.md) for file ownership and merge instructions. The [original system documentation](docs/original-system/README.md) describes the complete application.

The individual branches are integration contributions, not independently runnable applications: their Java types, services, shared controllers and frontend entry point depend on the other components. Assemble all six before building and running the system.

GitHub's Contributors graph counts author commits on the default branch. The four confirmed authors now have their original component commits in main. Pulse can also include activity from other branches. Contributor statistics may take time to refresh after the merges. See [GitHub's contributor documentation](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors).
