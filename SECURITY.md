# Security Policy

## Supported versions

Only the [latest release](https://github.com/akaneghro/md-viewer/releases/latest) receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/akaneghro/md-viewer/security/advisories/new)
(**Security** tab → **Report a vulnerability**). Please include:

- what an attacker can do (for example, run script or read files from a crafted Markdown document)
- steps or a sample file to reproduce it
- the MD Viewer version and your OS

You should get a reply within a week. Once a fix is released, the advisory is published with credit
to you, unless you prefer to stay anonymous.

## Scope

MD Viewer renders untrusted Markdown, so these are especially relevant:

- HTML or script injection through the rendered document
- reading or writing files outside the ones the user opened or saved
- links or images that bypass the `http`/`https`/`mailto` and image path restrictions
