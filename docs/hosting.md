# Hosting rules and release boundaries

Hosting account names, absolute server paths and credentials belong in environment settings and the private operations record.

Each website needs a separate document root and FTP account jailed to it. The uploader requires working directory `/` and `FTP_REMOTE_DIR=/`. A hosting-managed link in production points to the independent Factory Audit deployment. Do not move that application, follow its link in the uploader, or change its deployment account.

Production owns a separate, hosting-managed `.htaccess` file. It retains the reviewed Audit and Factory Audit access rules and adds only the homepage exceptions below. Both application directories link to their independently maintained deployment locations. Do not link the homepage's `.htaccess` to the application publisher's root configuration: that publisher validates and replaces its own rules independently. New application URL patterns or security-rule changes must be reviewed and carried into the homepage root's rules through hosting administration; application release files continue to update through their existing links.

## Homepage route allowlist

The FTPS workflow **never uploads `.htaccess`**. Configure homepage routes through the hosting administrator interface. Keep existing application and certificate-validation rules. Add these paths before the existing deny-all rule:

```apache
RewriteRule ^(?:index\.html)?$ - [END]
RewriteRule ^augmenta-tools-release\.json$ - [END]
RewriteRule ^augmenta-tools-assets/(?:styles\.css|augmenta-logo-96\.png|augmenta-favicon-32\.png)$ - [END]
```

Continue to disable directory listings and CGI execution. Retain independent application download content types and restrictions. Do not add broad extension-based access, catch-all proxies or SPA fallbacks.

For the static **beta homepage**, apply these headers (there are no inline scripts/styles):

```apache
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Content-Security-Policy "default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  Header always set Cache-Control "no-cache"
</IfModule>
```

Do not apply homepage CSP globally to production's independent applications: they may require their own scripts/styles. Review path-scoped production headers and the homepage allowlist with the owner after beta verification, before stable publication. Keep production environment approval enabled.

Validate HTTPS without bypassing certificate warnings and compare marker/asset checksums through the public URL. Check Factory Audit page, metadata, downloads and blocked configuration/directory paths before and after hosting changes. Report an existing failing destination separately; never silently repoint a card or replace that application.
