# Backend CI lockfile

`package-lock.json` in this directory locks the dependencies of the current main
scaffold, which does not have a repository-root lockfile. The CI workflow copies
it to the root only when no root lockfile exists. Branches such as develop use
their existing root lockfile unchanged.

When changing dependencies, maintain a root package-lock.json alongside
package.json. npm ci intentionally fails if the selected lockfile does not match
the dependency manifest. No database credentials or migration commands are used.
