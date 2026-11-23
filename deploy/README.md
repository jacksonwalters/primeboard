# Deploy to the existing application server

This is a static app. Node is used locally for tests/builds; production needs
only Nginx and the server's existing Certbot installation.

## Initial setup

1. Add the following record at the DNS provider for `jacksonwalters.com`:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | primeboard | 137.184.128.197 |

   A TTL of 300 seconds is useful during setup. Avoid conflicting AAAA/CNAME
   records. DNS currently uses `ns-cloud-b*.googledomains.com` nameservers.

2. Stage a checked build from the repository:

   ```sh
   bash scripts/stage-deploy.sh
   ```

3. Once DNS resolves, install with server administrator access:

   ```sh
   ssh -t application_server 'sudo bash /home/jackson/primeboard-deploy/install.sh'
   ```

   The script checks DNS and the archive checksum, creates an isolated static
   release, installs the Primeboard Nginx host, obtains a certificate through
   the existing Certbot account, validates Nginx, and reloads it. It does not
   restart the other hosted apps. If a later step fails, it restores the previous
   Primeboard config and release link. Retained release directories allow rollback.
   When the previous managed Rainboard host exists, it becomes a permanent
   redirect to Primeboard, preserving paths and query strings. Its configuration
   is backed up and restored too if installation fails.

4. Verify the public HTTPS URL, an HTTP-to-HTTPS redirect, and the CSV:

   ```sh
   curl -I https://primeboard.jacksonwalters.com/
   curl -I http://primeboard.jacksonwalters.com/
   curl -I https://primeboard.jacksonwalters.com/data/CIE_xyz_1931_2deg.csv
   ```

HTTPS is required for clipboard access. The page itself makes no external requests.

## Later releases

Repeat staging and the install command. Existing certificates are reused.
Production files are under `/var/www/primeboard.jacksonwalters.com/releases/`;
Nginx serves the `current` symlink. No dependency installation or app restart is needed.

Staging alone is not a deployment. If noninteractive sudo reports that a password
is required, the server administrator must run the interactive SSH command above
and enter the password locally. A fresh clone does not include production access;
`application_server` is an SSH alias configured on the maintainer's machine.

After installation, verify the exact built home page with:

```sh
python3 deploy/verify-live.py dist/web/index.html
```

Also check the files and behavior affected by the release. For download-page
updates, compare the public `download.html` with `dist/web/download.html`, confirm
its desktop version, and verify the linked public installers and checksum file.
Publish desktop assets before making their links live. Record the deployed
version and verification result in [STATE.md](../STATE.md).

Keep the old `rainboard` DNS record pointing here if you want old links to redirect.
The old release and certificate webroot are retained for certificate renewal;
they are no longer served as the app after migration.

The installer assumes the existing server's Certbot account, Nginx TLS options,
and DH parameters. If these are removed, repair that server configuration first.
Certbot's existing renewal timer handles the webroot certificate; keep port 80
and `/.well-known/acme-challenge/` available. A Primeboard-specific deploy hook
validates and reloads Nginx after this certificate renews. See
[Certbot's renewal-hook documentation](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).
