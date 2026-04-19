# Cognito email delivery: default limits vs Amazon SES

GlossaDocs triggers password reset and related flows through the **Cognito User Pool** APIs (`ForgotPassword`, `ConfirmForgotPassword`, etc.). Cognito is responsible for **sending** the actual email messages; the application does not call SES directly for those messages.

This note explains **when the built-in Cognito email is enough**, the **exact default quota** (as documented by AWS), and a **high-level path** to wire **Amazon SES** when you outgrow the default or want a custom sending domain.

## Default Cognito email (no SES configuration)

If the user pool uses Cognito’s **default email configuration** (you have not configured the pool to use your own Amazon SES resources), AWS applies a **daily email quota at the AWS account level**.

Per **[Quotas in Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html)** (resource quotas table):

| Quota | Value | Notes |
|--------|--------|--------|
| **Email messages sent daily per AWS account** | **50** | Applies **only** when using the **default email** feature for user pools in that account. |

Important details from the same documentation:

- The limit is **per AWS account** (not per user pool): all Cognito user pools in that account that use the default email feature **share** this quota.
- The count **resets daily at 09:00 UTC**.
- For **higher** delivery volume, AWS directs you to configure your user pool to use your own **[Amazon SES email configuration](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)**.

**Practical takeaway for GlossaDocs:** If you expect **well under ~50** Cognito-sent emails **per day** across **all** pools and message types in the account (sign-up verification, password reset, admin messages, etc.), the default option is often acceptable until you want custom branding, stricter deliverability, or more headroom. **20 per day** is safely below this cap **if** nothing else in the account consumes the same quota.

AWS may change quotas; always confirm the current **“Email messages sent daily per AWS account”** row in the official **Quotas** page linked above.

## When to move to Amazon SES

Consider configuring SES when you:

- Need **more than** the default daily cap, or want predictable limits driven by **SES** quotas instead.
- Want a **custom FROM** address on **your domain** (SPF/DKIM, reputation).
- Need **operational control** (suppression lists, sending statistics, sandbox vs production sending).

After SES is configured for the user pool, **email delivery limits follow your SES account** for that configuration, not the Cognito default **50/day** cap above.

## High-level steps to wire Cognito to SES (later)

Do this in the **same AWS Region** as your user pool (and align SES identities accordingly). Order may vary slightly with console updates.

1. **Amazon SES**
   - Open SES in the **same region** as the Cognito user pool (or follow [Cognito’s regional rules](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html) for SES identities).
   - **Verify** at least one identity:
     - **Domain** (recommended for production branding), or  
     - **Single email address** (no domain purchase required; you verify by clicking a link AWS sends).
   - If SES is in **sandbox**, you can only send to **verified** recipient addresses until you [request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

2. **IAM**
   - Cognito needs permission to send email through **your** SES identity. The Cognito console often helps create or select an IAM role when you enable SES; otherwise create a role whose trust policy allows `cognito-idp.amazonaws.com` and grants the needed `ses:` actions on your verified identity (see AWS guides for the exact policy for your setup).

3. **Cognito User Pool**
   - In the pool’s **email / messaging** settings, switch from the default configuration to **Amazon SES**.
   - Set the **FROM** address to an address (or domain) **verified in SES**, the **SES region**, and the **IAM role** from step 2.

4. **Verify**
   - Trigger a test **forgot password** (or a flow that sends mail) and confirm receipt; check **SES** sending metrics and **CloudWatch** if delivery fails.

Official walkthrough: **[Email settings for Amazon Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)**.

## Cost (brief)

- **Default Cognito email:** No separate SES bill for sending through Cognito’s default path; normal **Cognito** pricing still applies.
- **Your SES configuration:** SES charges for messages sent; see **[Amazon SES pricing](https://aws.amazon.com/ses/pricing/)**. Typical password-reset volume is usually inexpensive compared to fixed infrastructure.

## Related project docs

- Production deploy and env vars: [aws-amplify-apigw-lambda-auth-runbook.md](./aws-amplify-apigw-lambda-auth-runbook.md)
