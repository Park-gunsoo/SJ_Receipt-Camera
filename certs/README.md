# Supabase server root CA

Downloaded from the authenticated project's Database Settings → Download certificate link:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

This is a public CA certificate, not a private key. The runtime verifies both the certificate chain and hostname. Prisma migrations also use this CA with strict verification. Never replace this configuration with `rejectUnauthorized: false` to work around connectivity problems.
