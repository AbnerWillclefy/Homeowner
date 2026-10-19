#!/usr/bin/env bash
# Empties every table in the staging database and deletes every staging Cognito
# user, so tests start from sign-up. The schema and goose's migration history stay.
#
# Needs psql and an AWS SSO session: aws sso login --profile homeowner
set -euo pipefail

aws_staging() {
  env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_DEFAULT_REGION -u AWS_REGION \
    aws --profile homeowner --region us-east-1 "$@"
}

read -r -p "This deletes ALL staging data. Type 'staging' to continue: " answer
[[ "$answer" == "staging" ]] || { echo "Aborted."; exit 1; }

url=$(aws_staging ssm get-parameter --name /homeowner/staging/migrate-database-url \
  --with-decryption --query Parameter.Value --output text)

psql "$url" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
    FROM pg_tables
   WHERE schemaname = 'public' AND tablename <> 'goose_db_version';
  IF tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
    RAISE NOTICE 'Truncated: %', tables;
  END IF;
END
$$;
SQL

pool_id=$(aws_staging cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='homeowner-staging'].Id" --output text)
[[ -n "$pool_id" ]] || { echo "Cognito pool homeowner-staging not found." >&2; exit 1; }

usernames=$(aws_staging cognito-idp list-users --user-pool-id "$pool_id" \
  --query 'Users[].Username' --output text)
for username in $usernames; do
  aws_staging cognito-idp admin-delete-user --user-pool-id "$pool_id" --username "$username"
done
echo "Deleted $(wc -w <<<"$usernames" | tr -d ' ') Cognito users."
