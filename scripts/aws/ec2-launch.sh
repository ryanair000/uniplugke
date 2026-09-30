#!/usr/bin/env bash
set -Eeuo pipefail

REGION=${AWS_REGION:-us-east-2}
ACCOUNT_ID=732142858368
NAME=uniplug-web
INSTANCE_TYPE=t3.small
REPO_RAW=https://raw.githubusercontent.com/ryanair000/uniplugke/codex/aws-lightsail

for command in aws jq curl; do
  command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }
done

actual_account=$(aws sts get-caller-identity --query Account --output text)
[[ "$actual_account" == "$ACCOUNT_ID" ]] || { echo "Wrong AWS account: $actual_account" >&2; exit 1; }

plan=$(aws freetier get-account-plan-state --region us-east-1 --output json)
echo "$plan" | jq '{accountPlanType,accountPlanStatus,accountPlanRemainingCredits,accountPlanExpirationDate}'
echo "$plan" | jq -e '(.accountPlanType == "FREE") and (.accountPlanStatus == "ACTIVE") and (.accountPlanRemainingCredits.amount > 0)' >/dev/null || {
  echo 'AWS Free plan is not active with positive credits; refusing to launch.' >&2; exit 1;
}
expiration=$(echo "$plan" | jq -r .accountPlanExpirationDate)
[[ $(date -u -d "$expiration" +%s) -gt $(date -u +%s) ]] || {
  echo 'AWS Free plan has expired; refusing to launch.' >&2; exit 1;
}

existing=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME" 'Name=instance-state-name,Values=pending,running,stopping,stopped' \
  --query 'Reservations[].Instances[].InstanceId' --output text)
[[ -z "$existing" ]] || { echo "Existing UniPlug instance: $existing. Refusing duplicate." >&2; exit 1; }

eligible=$(aws ec2 describe-instance-types --region "$REGION" --instance-types "$INSTANCE_TYPE" \
  --query 'InstanceTypes[0].FreeTierEligible' --output text)
[[ "$eligible" == True ]] || { echo "$INSTANCE_TYPE is not marked Free Tier eligible." >&2; exit 1; }

ami=$(aws ec2 describe-images --region "$REGION" --owners 099720109477 \
  --filters 'Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*' \
    'Name=free-tier-eligible,Values=true' \
  --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text)
[[ -n "$ami" && "$ami" != None ]] || { echo 'No eligible Ubuntu 24.04 AMI.' >&2; exit 1; }

vpc=$(aws ec2 describe-vpcs --region "$REGION" --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
[[ -n "$vpc" && "$vpc" != None ]] || { echo 'No default VPC; refusing to guess network.' >&2; exit 1; }
subnet=$(aws ec2 describe-subnets --region "$REGION" \
  --filters "Name=vpc-id,Values=$vpc" Name=map-public-ip-on-launch,Values=true \
  --query 'Subnets[0].SubnetId' --output text)
[[ -n "$subnet" && "$subnet" != None ]] || { echo 'No public subnet in default VPC.' >&2; exit 1; }

quota=$(aws service-quotas get-service-quota --region "$REGION" --service-code ec2 \
  --quota-code L-1216C47A --query Quota.Value --output text)
used=$(aws ec2 describe-instances --region "$REGION" \
  --filters 'Name=instance-state-name,Values=pending,running' \
  --query 'Reservations[].Instances[].InstanceType' --output text | tr '\t' '\n' | \
  while read -r type; do
    [[ -z "$type" ]] && continue
    aws ec2 describe-instance-types --region "$REGION" --instance-types "$type" \
      --query 'InstanceTypes[0].VCpuInfo.DefaultVCpus' --output text
  done | awk '{sum += $1} END {print sum+0}')
if ! awk -v quota="$quota" -v used="$used" 'BEGIN {exit !(quota >= used + 2)}'; then
  echo "Insufficient Standard On-Demand vCPU quota: $used used of $quota; need 2 more." >&2
  exit 1
fi

# No SSH ingress or key pair is created. Systems Manager provides shell access.
role=uniplug-ec2-ssm
if ! aws iam get-role --role-name "$role" >/dev/null 2>&1; then
  trust=$(mktemp)
  printf '%s\n' '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' > "$trust"
  aws iam create-role --role-name "$role" --assume-role-policy-document "file://$trust" >/dev/null
  rm -f "$trust"
fi
aws iam attach-role-policy --role-name "$role" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
if ! aws iam get-instance-profile --instance-profile-name "$role" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$role" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$role" --role-name "$role"
  sleep 10 # Allow the new instance profile to propagate to EC2.
fi

sg_name=uniplug-web-http
sg=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=vpc-id,Values=$vpc" "Name=group-name,Values=$sg_name" \
  --query 'SecurityGroups[0].GroupId' --output text)
if [[ -z "$sg" || "$sg" == None ]]; then
  sg=$(aws ec2 create-security-group --region "$REGION" --vpc-id "$vpc" \
    --group-name "$sg_name" --description 'UniPlug public web' --query GroupId --output text)
  for port in 80 443; do
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$sg" \
      --protocol tcp --port "$port" --cidr 0.0.0.0/0 >/dev/null
  done
fi

userdata=$(mktemp)
trap 'rm -f "$userdata"' EXIT
curl -fsSL "$REPO_RAW/scripts/aws/lightsail-bootstrap.sh" -o "$userdata"
head -n 1 "$userdata" | grep -qx '#!/usr/bin/env bash'

echo "Launching $NAME: $INSTANCE_TYPE, $ami, subnet $subnet, 20 GiB gp3."
instance=$(aws ec2 run-instances --region "$REGION" \
  --image-id "$ami" --instance-type "$INSTANCE_TYPE" --subnet-id "$subnet" \
  --security-group-ids "$sg" --associate-public-ip-address \
  --iam-instance-profile "Name=$role" \
  --metadata-options 'HttpTokens=required,HttpEndpoint=enabled' \
  --credit-specification 'CpuCredits=standard' \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3,DeleteOnTermination=true}' \
  --tag-specifications \
    'ResourceType=instance,Tags=[{Key=Name,Value=uniplug-web},{Key=Project,Value=UniPlug}]' \
    'ResourceType=volume,Tags=[{Key=Name,Value=uniplug-web-root},{Key=Project,Value=UniPlug}]' \
  --user-data "file://$userdata" \
  --query 'Instances[0].InstanceId' --output text)
echo "Created instance: $instance"
aws ec2 wait instance-running --region "$REGION" --instance-ids "$instance"
aws ec2 describe-instances --region "$REGION" --instance-ids "$instance" \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PublicIpAddress]' --output text
