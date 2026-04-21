import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { GlossaDocsStack } from "../lib/glossadocs-stack.js";
import type { StackConfig } from "../lib/stack-config.js";

function createTemplate(): Template {
  const app = new cdk.App();
  const config: StackConfig = {
    account: "111111111111",
    region: "us-east-1",
    githubOwner: "example",
    githubRepository: "glossadocs",
    githubTokenSecretArn: "arn:aws:secretsmanager:us-east-1:111111111111:secret:github-token",
    backendCorsOrigin: "https://main.example.amplifyapp.com",
    frontendCallbackPath: "/auth/callback",
    frontendLogoutPath: "/",
    appEnv: "prod",
    enableWaf: true
  };

  const stack = new GlossaDocsStack(app, "TestGlossaDocsStack", {
    env: { account: config.account, region: config.region },
    config
  });

  return Template.fromStack(stack);
}

describe("GlossaDocsStack", () => {
  let template: Template;

  beforeAll(
    () => {
      template = createTemplate();
    },
    120000
  );

  it(
    "provisions core AWS resources",
    () => {
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      LambdaConfig: Match.objectLike({
        PreSignUp: Match.anyValue()
      })
    });
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    template.resourceCountIs("AWS::Lambda::Function", 2);
    template.resourceCountIs("AWS::RDS::DBInstance", 1);
    template.resourceCountIs("AWS::RDS::DBProxy", 0);
    template.resourceCountIs("AWS::ElastiCache::ReplicationGroup", 1);
    template.resourceCountIs("AWS::CodeBuild::Project", 1);
    template.resourceCountIs("AWS::EC2::NatGateway", 1);
    template.resourceCountIs("AWS::Amplify::App", 1);
    },
    30000
  );

  it(
    "sets production security and runtime defaults",
    () => {
    template.hasResourceProperties("AWS::ApiGateway::Stage", {
      MethodSettings: Match.arrayWith([
        Match.objectLike({
          HttpMethod: "*",
          ResourcePath: "/*",
          MetricsEnabled: true
        })
      ]),
      TracingEnabled: true
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs20.x",
      Environment: {
        Variables: Match.objectLike({
          APP_ENV: "prod",
          AUTH_PROVIDER: "cognito",
          AUTH_SESSION_STORE: "redis",
          AUTH_SESSION_SECURE_COOKIE: "true"
        })
      }
    });

    template.hasResourceProperties("AWS::ElastiCache::ReplicationGroup", {
      TransitEncryptionEnabled: true,
      AtRestEncryptionEnabled: true
    });

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Environment: {
        EnvironmentVariables: Match.arrayWith([
          Match.objectLike({ Name: "DB_USERNAME", Type: "SECRETS_MANAGER" }),
          Match.objectLike({ Name: "DB_PASSWORD", Type: "SECRETS_MANAGER" })
        ])
      }
    });
    },
    30000
  );

  it(
    "attaches managed WAF rules when enabled",
    () => {
    template.hasResourceProperties("AWS::WAFv2::WebACL", {
      Scope: "REGIONAL",
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: "AWSManagedRulesCommonRuleSet"
        })
      ])
    });

    template.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
    },
    30000
  );

  it(
    "exports machine-readable deployment outputs",
    () => {
    const outputs = template.toJSON().Outputs;
    const outputKeys = Object.keys(outputs ?? {});

    expect(outputKeys).toEqual(
      expect.arrayContaining([
        "ApiBaseUrl",
        "AmplifyDefaultDomain",
        "AmplifyAppId",
        "CognitoUserPoolId",
        "CognitoClientId",
        "CognitoHostedDomain",
        "MigrationProjectName",
        "MigrationSourceBucketName",
        "RedisEndpoint",
        "DatabaseCredentialsSecretArn"
      ])
    );
    },
    30000
  );

  it(
    "omits WAF resources when disabled",
    () => {
      const app = new cdk.App();
      const config: StackConfig = {
        account: "111111111111",
        region: "us-east-1",
        githubOwner: "example",
        githubRepository: "glossadocs",
        githubTokenSecretArn: "arn:aws:secretsmanager:us-east-1:111111111111:secret:github-token",
        backendCorsOrigin: "https://main.example.amplifyapp.com",
        frontendCallbackPath: "/auth/callback",
        frontendLogoutPath: "/",
        appEnv: "prod",
        enableWaf: false
      };
      const stack = new GlossaDocsStack(app, "TestGlossaDocsStackNoWaf", {
        env: { account: config.account, region: config.region },
        config
      });
      const noWafTemplate = Template.fromStack(stack);
      noWafTemplate.resourceCountIs("AWS::WAFv2::WebACL", 0);
      noWafTemplate.resourceCountIs("AWS::WAFv2::WebACLAssociation", 0);
    },
    60000
  );
});
