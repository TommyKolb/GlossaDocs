import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
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
  it("provisions core AWS resources", () => {
    const template = createTemplate();

    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    template.resourceCountIs("AWS::Lambda::Function", 1);
    template.resourceCountIs("AWS::RDS::DBInstance", 1);
    template.resourceCountIs("AWS::RDS::DBProxy", 1);
    template.resourceCountIs("AWS::ElastiCache::ReplicationGroup", 1);
    template.resourceCountIs("AWS::Amplify::App", 1);
  });

  it("sets production security and runtime defaults", () => {
    const template = createTemplate();

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
  });

  it("attaches managed WAF rules when enabled", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::WAFv2::WebACL", {
      Scope: "REGIONAL",
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: "AWSManagedRulesCommonRuleSet"
        })
      ])
    });

    template.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
  });

  it("exports machine-readable deployment outputs", () => {
    const template = createTemplate();
    const outputs = template.toJSON().Outputs;
    const outputKeys = Object.keys(outputs ?? {});

    expect(outputKeys).toEqual(
      expect.arrayContaining([
        "ApiBaseUrl",
        "AmplifyDefaultDomain",
        "CognitoUserPoolId",
        "CognitoClientId",
        "CognitoHostedDomain",
        "RdsProxyEndpoint",
        "RedisEndpoint",
        "DatabaseCredentialsSecretArn"
      ])
    );
  });
});
