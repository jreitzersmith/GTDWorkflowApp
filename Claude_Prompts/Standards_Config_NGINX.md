# Nginx Configuration Standards

> **Purpose.** This is a prompt/standards file. When Claude is asked to **generate, review, or harden an nginx configuration**, follow this document. It defines (1) a recommended baseline, (2) hardening directives drawn from three published sources, and (3) clarifying questions to ask the operator before producing a final config.
>
> **Source tracking.** Every hardening recommendation below carries a single `Source:` tag identifying where it comes from. Baseline items are general best practice and tagged `Source: Baseline`.

## Source legend

| Tag | Reference |
|---|---|
| `Baseline` | General best practice (Claude's default recommendation, not from the three documents) |
| `Hackviser` | Hackviser — *Nginx Web Server Hardening* — https://hackviser.com/tactics/hardening/nginx |
| `Acunetix` | Acunetix / Tomasz Nidecki — *nginx Security: How To Harden Your Server Configuration* — https://www.acunetix.com/blog/web-security-zone/hardening-nginx/ |
| `Medium-Fivesec` | Jens@Fivesec — *Advanced Nginx Hardening* — https://medium.com/@js_9757/advanced-nginx-hardening-15bf96058327 |

---

## How to use this file

1. **Ask the clarifying questions first** (next section). Do not emit a final config until the app-dependent answers are known. Where an answer is missing, state the assumption you are making and flag it inline in the generated config with a `# TODO(confirm): ...` comment.
2. **Apply the baseline**, then layer the hardening directives that fit the deployment.
3. **Keep the source tags** as comments in any config you generate, so each non-obvious directive is traceable.
4. **Validate** before finishing (see Validation section): run `nginx -t`, and ideally check with Gixy.

---

## Clarifying questions (ask before generating config)

These areas depend on the specific application. Ask each relevant question; if the user defers, record the chosen default as an assumption.

1. **Server role** — Is this serving static files, acting as a reverse proxy to an upstream app, or both? (Affects `proxy_pass`, buffering, upstream blocks.)
2. **Domain(s) & TLS source** — What server names? Are certificates from Let's Encrypt, an internal CA, or provided files? (Affects `server_name`, `ssl_certificate*`.)
3. **HTTP methods** — Which methods does the app legitimately need (e.g. REST API needing `PUT`/`PATCH`/`DELETE`, or a static site needing only `GET HEAD POST`)? (Affects the method-restriction block.)
4. **Uploads / max body size** — Does the app accept file uploads or large POST bodies? What is the largest legitimate request? (Affects `client_max_body_size` and buffer limits — the hardened default of `1k`/`10M` will break uploads otherwise.)
5. **Expected traffic / rate** — What is the normal and peak legitimate request rate per client? (Affects `limit_req_zone` rate and `burst`.)
6. **Restricted areas** — Any admin paths or internal endpoints that should be IP-restricted? What are the allowed IPs/CIDRs?
7. **Upload directories** — Are there directories where user-uploaded files land and where script execution (e.g. `.php`) must be blocked?
8. **CSP requirements** — What external origins does the app load (scripts, styles, images, fonts, XHR/connect, frames)? A strict `default-src 'self'` will break apps that rely on CDNs or inline scripts.
9. **HSTS scope** — Is it safe to enforce HTTPS on all subdomains and submit to the preload list? (`includeSubDomains; preload` is hard to reverse.)
10. **WAF** — Should a WAF (ModSecurity + OWASP CRS) be deployed, and is the module available in this build?
11. **Protocol features** — Enable HTTP/2 (and HTTP/3 if available)? Enable TCP Fast Open? (Kernel support required for the latter.)
12. **Edge topology** — Is nginx behind a load balancer or CDN? If so, how should real client IP and `X-Forwarded-For` be trusted (affects logging and rate-limit keys)?
13. **Log destination** — Plain text or JSON access logs? Is there a SIEM/OpenSearch pipeline that prefers structured JSON?

---

## 1. Baseline setup (recommended default)

Start here regardless of the application.

- **Run with least privilege.** Run worker processes as an unprivileged user (`user www-data;` or a dedicated service account); never run workers as root. `Source: Baseline`
- **Tune workers.** `worker_processes auto;` and a sane `worker_rlimit_nofile`; set `worker_connections` in the `events` block to match expected concurrency. `Source: Baseline`
- **Modular layout.** Keep `nginx.conf` lean; split virtual hosts into `sites-available/` (symlinked into `sites-enabled/`) or `conf.d/`, and reusable fragments into `/etc/nginx/snippets/`. `Source: Baseline`
- **Terminate TLS and redirect.** A port-80 server block that issues a `301` redirect to HTTPS; all real serving happens on the `443` block. `Source: Baseline`
- **OCSP stapling + strong DH params.** Enable `ssl_stapling on;`, `ssl_stapling_verify on;` and reference a strong `ssl_dhparam` file for non-ECDHE fallbacks. `Source: Baseline`
- **Restrict file permissions.** Config files owned by root and not world-writable; private keys `chmod 600` and readable only by the nginx master process owner. `Source: Baseline`
- **Connection limiting.** In addition to request-rate limiting, consider `limit_conn` to cap simultaneous connections per client. `Source: Baseline`
- **Test before reload.** Always `nginx -t` before `systemctl reload nginx`. `Source: Baseline`

```nginx
# Baseline skeleton
user  www-data;
worker_processes  auto;
worker_rlimit_nofile  65535;

events {
    worker_connections  4096;
}

http {
    # ... directives from sections 2-13 go here ...

    # HTTP -> HTTPS redirect            # Source: Baseline
    server {
        listen 80;
        listen [::]:80;
        server_name example.com;        # TODO(confirm): server_name
        return 301 https://$host$request_uri;
    }
}
```

---

## 2. Keep nginx updated

- Always run the latest stable version; updates carry security fixes (e.g. the historical directory-traversal CVE-2009-3898). Automate patching via the distro package manager / unattended-upgrades. `Source: Acunetix`

---

## 3. Reduce information disclosure

- **Hide the version banner.** Set `server_tokens off;` so the nginx version is removed from error pages and the `Server` response header. `Source: Hackviser`

```nginx
server_tokens off;                      # Source: Hackviser
```

---

## 4. Disable unwanted modules

- Compile out modules you do not need to shrink the attack surface (modules are selected at build time, not runtime). Example: build `--without-http_autoindex_module` to remove automatic directory listings. `Source: Acunetix`

```sh
# ./configure --without-http_autoindex_module
# make && make install        # Source: Acunetix
```

---

## 5. TLS / SSL configuration

- **Restrict to modern protocols.** Allow only `TLSv1.2` and `TLSv1.3`; drop SSLv3/TLSv1.0/TLSv1.1 (mitigates BEAST and downgrade attacks). `Source: Acunetix`
- **Strong cipher suite.** Pin an explicit, modern `ssl_ciphers` list (ECDHE + AES-GCM). `Source: Hackviser`
- **Prefer server ciphers.** `ssl_prefer_server_ciphers on;` so the server, not the client, chooses the cipher. `Source: Acunetix`
- **Session cache.** `ssl_session_cache shared:SSL:10m;` to reduce handshake overhead. `Source: Hackviser`
- **HSTS.** Declare HTTPS-only with `Strict-Transport-Security`. Confirm subdomain/preload scope first (see clarifying Q9). `Source: Acunetix`

```nginx
ssl_protocols TLSv1.2 TLSv1.3;                                              # Source: Acunetix
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';   # Source: Hackviser
ssl_prefer_server_ciphers on;                                              # Source: Acunetix
ssl_session_cache shared:SSL:10m;                                          # Source: Hackviser
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;  # Source: Acunetix
```

---

## 6. Restrict HTTP methods

Choose **one** approach based on the app's needs (clarifying Q3).

- **Per-location allowlist** (recommended for clarity): permit only required methods. `Source: Acunetix`
- **Block specific dangerous methods** (e.g. `TRACE`, `PATCH`) when most methods are allowed. `Source: Medium-Fivesec`

```nginx
# Option A — allowlist (e.g. static site)        # Source: Acunetix
location / {
    limit_except GET HEAD POST { deny all; }
}

# Option B — block dangerous methods only        # Source: Medium-Fivesec
if ($request_method ~ ^(PATCH|TRACE)$) {
    return 405;
}
```

---

## 7. Resource & buffer limits (anti-DoS)

- **Tighten buffers.** Cap `client_body_buffer_size` (~`1k`), `client_header_buffer_size` (`1k`), and `large_client_header_buffers 2 1k;` to reduce buffer-overflow / resource-exhaustion exposure. Raise only as the app requires. `Source: Acunetix`
- **Parameterize body size & timeouts.** Keep `client_max_body_size`, `client_body_timeout`, `client_header_timeout`, and `keepalive_timeout` as low as the app allows (clarifying Q4). `Source: Medium-Fivesec`

```nginx
client_body_buffer_size   1k;            # Source: Acunetix
client_header_buffer_size  1k;           # Source: Acunetix
large_client_header_buffers 2 1k;        # Source: Acunetix

client_max_body_size  10M;               # Source: Medium-Fivesec  # TODO(confirm): uploads
client_body_timeout   10s;               # Source: Medium-Fivesec
client_header_timeout 10s;               # Source: Medium-Fivesec
keepalive_timeout     5s 5s;             # Source: Medium-Fivesec
```

---

## 8. Rate limiting

- **Define a per-IP zone and basic rate.** `limit_req_zone $binary_remote_addr ...` is the foundation. `Source: Hackviser`
- **Apply with burst and a clear status code.** Allow short bursts and return `429 Too Many Requests` when exceeded. `Source: Medium-Fivesec`

```nginx
# Basic zone                                                  # Source: Hackviser
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

# Apply with burst + explicit status                         # Source: Medium-Fivesec
limit_req_status 429;
location / {
    limit_req zone=mylimit burst=10;
}
```

---

## 9. Access control & sensitive paths

- **Deny VCS/config metadata.** Block access to `.ht*`, `.git`, `.svn`, etc. `Source: Hackviser`
- **Drop all dotfile requests.** Return `444` (connection closed, no response) for any `/.`-prefixed path such as `.env` or `.bash_history`. `Source: Medium-Fivesec`
- **IP-restrict admin areas.** Use `allow`/`deny` on sensitive locations (clarifying Q6). `Source: Hackviser`

```nginx
location ~ /(\.ht|\.git|\.svn) { deny all; }    # Source: Hackviser

location ~ /\. { return 444; }                  # Source: Medium-Fivesec

location /admin {                               # Source: Hackviser
    allow 192.168.0.1;                          # TODO(confirm): allowed IPs
    deny all;
}
```

---

## 10. Block server-side execution in upload directories

- For directories that hold user uploads, deny execution of script files so a malicious upload cannot run (clarifying Q7). `Source: Hackviser`

```nginx
location /uploads {                       # Source: Hackviser
    location ~ \.php$ { return 403; }
}
```

---

## 11. Security response headers

- Add `X-Frame-Options`, `X-Content-Type-Options: nosniff`, and `X-XSS-Protection`. `Source: Hackviser`

```nginx
add_header X-Frame-Options "SAMEORIGIN";          # Source: Hackviser
add_header X-Content-Type-Options "nosniff";      # Source: Hackviser
add_header X-XSS-Protection "1; mode=block";      # Source: Hackviser
```

---

## 12. Content Security Policy

- Implement a CSP to reduce XSS and injection risk. Start strict and widen only to the origins the app actually needs (clarifying Q8). `Source: Hackviser`

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'";   # Source: Hackviser
# TODO(confirm): widen per app's required external origins
```

---

## 13. Bot / scanner deflection

- Map known-bad user agents (e.g. `wpscan`, `dirbuster`, `gobuster`) to a blacklist flag and return `444` to close the connection without a response — which also trips up some scanners. Maintain in `/etc/nginx/snippets/bot.protection.conf`. `Source: Medium-Fivesec`

```nginx
# /etc/nginx/snippets/bot.protection.conf          # Source: Medium-Fivesec
map $http_user_agent $blacklist_user_agents {
    ~*wpscan     1;
    ~*dirbuster  1;
    ~*gobuster   1;
}

# in the vhost:
include /etc/nginx/snippets/bot.protection.conf;
if ($blacklist_user_agents) { return 444; }
```

---

## 14. Web Application Firewall

- Deploy ModSecurity as a WAF in front of nginx, loaded with the **OWASP Core Rule Set** for broad coverage (SQLi, XSS, etc.). Confirm the module is available in the build (clarifying Q10). `Source: Hackviser`

---

## 15. Logging & monitoring

- **Enable and locate logs.** Configure `access_log` / `error_log`; set `error_log ... crit;` (or chosen severity) and monitor continuously. Rotate with `logrotate`. `Source: Acunetix`
- **Structured JSON logging (optional).** When forwarding to a SIEM/OpenSearch, use a JSON `log_format` for machine-readable, richer access logs (clarifying Q13). `Source: Medium-Fivesec`

```nginx
error_log  /var/log/nginx/error.log crit;          # Source: Acunetix
access_log /var/log/nginx/access.log;              # Source: Acunetix

# Optional JSON access log                          # Source: Medium-Fivesec
log_format json-logger escape=json '{'
  '"time":"$time_iso8601",'
  '"remote-ip":"$remote_addr",'
  '"x-forward-for":"$proxy_add_x_forwarded_for",'
  '"request-id":"$request_id",'
  '"status":"$status",'
  '"vhost":"$host",'
  '"protocol":"$server_protocol",'
  '"path":"$uri",'
  '"query":"$args",'
  '"duration":"$request_time",'
  '"method":"$request_method",'
  '"referer":"$http_referer",'
  '"user-agent":"$http_user_agent"'
'}';
# access_log /var/log/nginx/access.log json-logger;
```

---

## 16. Performance (security-adjacent)

These improve resilience and efficiency; apply where supported (clarifying Q11).

- **TCP Fast Open.** Reduces handshake latency; requires kernel support (`/proc/sys/net/ipv4/tcp_fastopen` = 1). `Source: Medium-Fivesec`
- **gzip compression.** Enable for text-based types to cut bandwidth and load time. `Source: Medium-Fivesec`

```nginx
listen 443 ssl http2 fastopen=500;       # Source: Medium-Fivesec

gzip on;                                  # Source: Medium-Fivesec
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

---

## 17. Backups

- Automate backups of nginx configuration and web content; store them securely off-site and test restoration regularly. `Source: Hackviser`

---

## 18. Validation (do this before finishing)

- **Syntax check.** `nginx -t` must pass before any reload. `Source: Baseline`
- **Misconfiguration scan.** Run **Gixy** against the finished config to catch common security mistakes. `Source: Acunetix`
- **Optional visual builder.** DigitalOcean's nginx config tool can scaffold a config for comparison. `Source: Acunetix`

---

## Quick source-attribution index

| Section | Recommendation | Source |
|---|---|---|
| 1 | Baseline skeleton (least-priv, workers, modular, redirect, OCSP, perms, limit_conn, `nginx -t`) | Baseline |
| 2 | Keep nginx updated | Acunetix |
| 3 | `server_tokens off` | Hackviser |
| 4 | Disable unwanted modules at build | Acunetix |
| 5 | `ssl_protocols TLSv1.2 TLSv1.3` | Acunetix |
| 5 | `ssl_ciphers` strong list | Hackviser |
| 5 | `ssl_prefer_server_ciphers on` | Acunetix |
| 5 | `ssl_session_cache` | Hackviser |
| 5 | HSTS header | Acunetix |
| 6 | `limit_except` method allowlist | Acunetix |
| 6 | Block `PATCH`/`TRACE` via `if` | Medium-Fivesec |
| 7 | Buffer limits (`client_*_buffer_size`, `large_client_header_buffers`) | Acunetix |
| 7 | Body size & timeouts (`client_max_body_size`, timeouts, keepalive) | Medium-Fivesec |
| 8 | `limit_req_zone` basic zone | Hackviser |
| 8 | `limit_req` burst + `429` | Medium-Fivesec |
| 9 | Deny `.ht`/`.git`/`.svn` | Hackviser |
| 9 | `return 444` on dotfiles | Medium-Fivesec |
| 9 | IP-restrict admin (`allow`/`deny`) | Hackviser |
| 10 | Block script execution in upload dirs | Hackviser |
| 11 | Security headers (XFO, nosniff, XSS) | Hackviser |
| 12 | Content Security Policy | Hackviser |
| 13 | Bot/scanner deflection (`444`) | Medium-Fivesec |
| 14 | WAF (ModSecurity + OWASP CRS) | Hackviser |
| 15 | Access/error logs, `crit`, rotate | Acunetix |
| 15 | JSON logging | Medium-Fivesec |
| 16 | TCP Fast Open | Medium-Fivesec |
| 16 | gzip compression | Medium-Fivesec |
| 17 | Backups | Hackviser |
| 18 | `nginx -t` | Baseline |
| 18 | Gixy scan; DigitalOcean tool | Acunetix |
