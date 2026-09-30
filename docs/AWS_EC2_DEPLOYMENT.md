# UniPlug on AWS EC2 with Free plan credits

The deployment is conditional on AWS reporting `accountPlanType: FREE`,
`accountPlanStatus: ACTIVE`, a future expiration date, and positive remaining
credits. The Free plan closes the account when its six-month term or credits end.
Do not upgrade the account to a Paid plan for this deployment.

## Verify the AWS account first

From the signed-in AWS CloudShell, run:

```bash
aws sts get-caller-identity
aws freetier get-account-plan-state --region us-east-1 --output json
aws ec2 describe-instance-types --region us-east-2 \
  --filters Name=free-tier-eligible,Values=true \
  --query 'InstanceTypes[].InstanceType' --output text
aws ec2 describe-instances --region us-east-2 \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType,PublicIpAddress]' \
  --output table
```

Stop if the plan check does not meet every condition above. Check for an existing
usable instance before creating another one.

## EC2 instance

Use one Free Tier eligible `t3.small` in `us-east-2` with a Free Tier eligible
Ubuntu 24.04 AMI and a 20 GiB `gp3` root disk. Require IMDSv2. Allow inbound
TCP 80 and 443 and restrict management access. Use the contents of
`scripts/aws/lightsail-bootstrap.sh` as EC2 user data. Despite its name, it is
an Ubuntu bootstrap for either Lightsail or EC2. It creates a 2 GiB swap file
for the build, clones `codex/aws-lightsail`, installs Node.js 22 and Nginx,
builds Next.js, and starts the `uniplug` systemd service.

EC2, EBS, public IPv4, and data transfer consume credits. Recheck remaining
credits after launch and before leaving the instance running. An Elastic IP
provides a stable address for DNS but also consumes credits.

## Production secrets

The public Supabase URL and publishable key are in `config/aws-public.env`.
Checkout and webhooks need the production `SUPABASE_SERVICE_ROLE_KEY` and
`PAYSTACK_SECRET_KEY`. Put secrets only in `/etc/uniplug/runtime.env` on the
instance with ownership `root:uniplug` and mode `0640`. Do not put them in Git,
user data, or shell history. Restart `uniplug` after adding them. The optional
portal and mail workflows need the additional variables listed in
`docs/AWS_LIGHTSAIL_DEPLOYMENT.md`.

## Verify and cut over

Check `/var/log/uniplug-bootstrap.log`, `systemctl status uniplug`, and the
public instance IP with `curl -H 'Host: uniplug.shop' http://IP/`. Test the
store, login, and payment flow with production secrets and a safe test purchase.
Then point the apex, `www`, and `vip` records in the authoritative Vercel DNS
zone to the stable EC2 IPv4 address. Request HTTPS certificates for all three
names with Certbot and Nginx, and verify HTTPS on each hostname. Confirm the
Paystack webhook destination after the DNS change.

To release a later commit, run
`sudo /srv/uniplug/app/scripts/aws/lightsail-update.sh <branch-or-ref>` on the
instance after validating it locally.
