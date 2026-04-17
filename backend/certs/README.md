# RDS TLS trust store

`rds-global-bundle.pem` is AWS’s **public** CA bundle for verifying TLS to Amazon RDS. It is not secret and is safe to commit.

- **Source:** https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem  
- **When to refresh:** When [AWS RDS SSL/TLS documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html) announces CA or bundle updates; replace the file and redeploy the API Lambda.

Loaded by `src/shared/db.ts` for Node `pg` connections that use `sslmode=require` to RDS.
