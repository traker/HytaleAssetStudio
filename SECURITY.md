# Security Policy

## Supported versions

Hytale Asset Studio is an evolving local-only tool. There is no stable release with a separate LTS branch. Security fixes are applied to the current `main` branch.

## Scope

This tool is designed to run exclusively on a single trusted machine (local-only). It is not intended to be exposed to a network, hosted as a service, or accessed remotely.

By design:

- the backend binds to `127.0.0.1` only and rejects non-loopback clients by default (`HAS_LOCAL_ONLY=1`)
- the tool reads and writes local filesystem paths chosen by the operator — arbitrary path access is an intentional product capability, not an accidental exposure
- no authentication, no user accounts, no remote data storage

Vulnerabilities that only apply when the tool is deliberately misconfigured to run as a remote service (i.e. `HAS_LOCAL_ONLY=0` with a public bind address) are outside the supported product model and will be treated as low priority.

## Reporting a vulnerability

If you believe you have found a security vulnerability in the Studio source code, please **do not open a public GitHub issue**.

Instead:

- Open a [GitHub Security Advisory](https://github.com/features/security/advisories) (private disclosure) on this repository, or
- Contact the maintainer directly via a private channel.

Please include:

- a description of the vulnerability and its potential impact
- steps to reproduce or a proof of concept
- your suggested fix if you have one

You can expect an acknowledgement within a few days and a fix or workaround within a reasonable timeframe depending on severity.

## Third-party dependencies

Vulnerabilities in upstream dependencies (FastAPI, Uvicorn, React, Vite, etc.) should be reported to their respective maintainers. You are welcome to open an issue here to flag that an upgrade is needed.
