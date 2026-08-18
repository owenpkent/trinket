# Security Policy

## Supported versions

The latest release on `main` is the only supported version.

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/owenpkent/trinket/security/advisories/new)
rather than opening a public issue.

Expect an acknowledgement within a few days.

## Scope

Trinket runs entirely offline. It makes no network requests, stores no data, and
the desktop build declares only the core window permissions plus always-on-top.
The realistic surface is therefore small: the desktop webview and its content
security policy, the Tauri capability set in `src-tauri/capabilities/`, and the
release artifacts themselves.

Reports about the simulations producing odd visual results are bugs, not security
issues. Please open a normal issue for those.
