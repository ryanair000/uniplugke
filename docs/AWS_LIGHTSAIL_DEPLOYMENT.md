# UniPlug on AWS Lightsail

The one Next.js process serves `uniplug.shop`, `www.uniplug.shop`, and `vip.uniplug.shop`. It requires a server runtime; a static S3 export does not support the checkout, authentication, webhook, or portal routes.

## EC2 alternative and cost boundary

The bootstrap script also works as Ubuntu 24.04 EC2 user data. Choose an instance with enough memory for `next build` (4 GB is the safe starting point); a micro instance is likely too small to build this application directly. An alternative is building off-instance and transferring a Next.js standalone artifact, which requires a separate packaging workflow. EC2 compute, EBS storage, public IPv4, and outbound transfer can consume AWS Free Tier credits or incur charges. Verify this account's Free plan and remaining credits before launching. The user has requested **no paid resources**, so this runbook does not authorize creating an instance or changing DNS.

## Instance

Use Ubuntu 24.04 in `us-east-2`, the `medium_3_0` Linux bundle (4 GB RAM, 2 vCPU, listed at USD 24/month), and the `scripts/aws/lightsail-bootstrap.sh` user-data script. The bootstrap clones `codex/aws-lightsail`, installs Node.js 22 and Nginx, builds the app, and starts systemd service `uniplug` on loopback port 3000. Nginx exposes port 80. The public Supabase publishable key is in `config/aws-public.env`; no production secrets belong in Git.

Use a Lightsail static IPv4 address. Open ports 80 and 443. Smoke-test with the static IP and a `Host: uniplug.shop` header before changing DNS.

## Runtime secrets

Store these in `/etc/uniplug/runtime.env` on the instance, readable by root and the `uniplug` group (`0640`):

- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `CRON_SECRET` if `/api/cron/portal-reconcile` is used
- `OPS_HUB_SECRET` if `/api/internal/telegram-ops` is used
- `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET`, `GOOGLE_GMAIL_REDIRECT_URI`, and `GMAIL_TOKEN_ENCRYPTION_KEY` if the mailbox and VeriFy workflows are used

Do not place these in the repository, user data, shell history, or a public build artifact. Restart `uniplug` after the runtime file is configured. Verify `/api/keys/checkout`, `/api/store/checkout`, `/api/payments/webhook`, sign-in, and portal access with test transactions before DNS cutover.

## HTTPS and DNS

The authoritative nameservers for `uniplug.shop` are currently Vercel DNS. Update the A records for the apex, `www`, and `vip` to the Lightsail static IPv4 address after the AWS smoke test. Then install `certbot` and `python3-certbot-nginx` and request certificates for all three names. Confirm that both the shop and VIP hostnames retain their intended routing and cookies, and update the Paystack webhook endpoint if its configured URL changes.

To release a later commit, run `sudo /srv/uniplug/app/scripts/aws/lightsail-update.sh <branch-or-ref>` after validating it locally.
