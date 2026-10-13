# MedCare component branches

This repository separates the supplied medical appointment system into six component branches. All six components are now merged into main with their original author commits preserved. The first five were merged on 10 October 2026; Doctor Availability and Schedule Management was merged on 13 October 2026. The component branches are retained.

| Branch | Component owner | Integration status |
|---|---|---|
| patient-management | IT26100051 | Pushed and merged into main |
| doctor-management | IT26100271 | Pushed and merged into main |
| appointment-management | IT26100460 | Pushed and merged into main |
| access-control-staff-management | IT26100467 | Pushed and merged into main |
| doctor-availability-schedule-management | it26100420 | Pushed and merged into main |
| feedback-notification-management | IT26100002 | Pushed and merged into main |

See [the component guide](docs/COMPONENT-BRANCHES.md) for file ownership and merge instructions. The [original system documentation](docs/original-system/README.md) describes the complete application.

The individual branches are integration contributions with dependencies on other components. Use main to build and run the complete application. The frontend bundle is included for offline operation; rebuild it after editing the frontend modules.

GitHub's Contributors graph counts author commits on the default branch. All six confirmed authors now have their original component commits in main. Pulse can also include activity from other branches. Contributor statistics may take time to refresh after the merges. See [GitHub's contributor documentation](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors).
