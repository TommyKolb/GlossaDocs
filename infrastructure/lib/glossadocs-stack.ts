import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, SecretValue } from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import type { StackConfig } from "./stack-config.js";

type GlossaDocsStackProps = cdk.StackProps & {
  config: StackConfig;
};

export class GlossaDocsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GlossaDocsStackProps) {
    super(scope, id, props);
    const backendAssetPath = path.resolve(process.cwd(), "../backend");

    const { config } = props;

    const vpc = new ec2.Vpc(this, "AppVpc", {
      availabilityZones: [`${config.region}a`, `${config.region}b`],
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          name: "app",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        {
          name: "data",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    });

    const lambdaSg = new ec2.SecurityGroup(this, "LambdaSg", {
      vpc,
      description: "Lambda access to RDS proxy and Redis",
      allowAllOutbound: true
    });

    const dbSg = new ec2.SecurityGroup(this, "DatabaseSg", {
      vpc,
      description: "RDS PostgreSQL security group",
      allowAllOutbound: false
    });

    const redisSg = new ec2.SecurityGroup(this, "RedisSg", {
      vpc,
      description: "Redis security group",
      allowAllOutbound: false
    });

    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), "Lambda to PostgreSQL");
    redisSg.addIngressRule(lambdaSg, ec2.Port.tcp(6379), "Lambda to Redis");

    const dbCredentials = new secretsmanager.Secret(this, "DbCredentialsSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "glossadocs_app" }),
        generateStringKey: "password",
        excludePunctuation: true
      }
    });

    const db = new rds.DatabaseInstance(this, "PrimaryDatabase", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_10
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: "glossadocs",
      backupRetention: Duration.days(7),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false
    });

    const dbProxy = db.addProxy("DatabaseProxy", {
      vpc,
      securityGroups: [dbSg],
      dbProxyName: "glossadocs-rds-proxy",
      secrets: [dbCredentials],
      iamAuth: false,
      requireTLS: true,
      maxConnectionsPercent: 90
    });

    const redisAuthToken = new secretsmanager.Secret(this, "RedisAuthToken", {
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48
      }
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
      cacheSubnetGroupName: "glossadocs-redis-subnets",
      description: "Private subnets for ElastiCache Redis",
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds
    });

    const redis = new elasticache.CfnReplicationGroup(this, "RedisReplicationGroup", {
      replicationGroupDescription: "GlossaDocs auth sessions",
      replicationGroupId: "glossadocs-sessions",
      cacheNodeType: "cache.t4g.micro",
      engine: "redis",
      engineVersion: "7.1",
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      numNodeGroups: 1,
      replicasPerNodeGroup: 0,
      securityGroupIds: [redisSg.securityGroupId],
      transitEncryptionEnabled: true,
      atRestEncryptionEnabled: true,
      authToken: redisAuthToken.secretValue.toString(),
      automaticFailoverEnabled: false
    });

    const amplifyApp = new amplify.CfnApp(this, "FrontendAmplifyApp", {
      name: "glossadocs",
      description: "GlossaDocs public frontend",
      repository: `https://github.com/${config.githubOwner}/${config.githubRepository}`,
      accessToken: SecretValue.secretsManager(config.githubTokenSecretArn).toString(),
      enableBranchAutoDeletion: true
    });

    const mainBranch = new amplify.CfnBranch(this, "FrontendMainBranch", {
      appId: amplifyApp.attrAppId,
      branchName: "main",
      stage: "PRODUCTION",
      enableAutoBuild: true
    });

    const callbackUrl = cdk.Fn.join("", [
      "https://",
      mainBranch.branchName,
      ".",
      amplifyApp.attrDefaultDomain,
      config.frontendCallbackPath
    ]);
    const logoutUrl = cdk.Fn.join("", [
      "https://",
      mainBranch.branchName,
      ".",
      amplifyApp.attrDefaultDomain,
      config.frontendLogoutPath
    ]);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "glossadocs-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true }
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN
    });

    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: {
        userPassword: true,
        adminUserPassword: false,
        userSrp: true
      },
      oAuth: {
        callbackUrls: [callbackUrl],
        logoutUrls: [logoutUrl],
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE]
      },
      preventUserExistenceErrors: true
    });

    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: {
        domainPrefix: `${cdk.Names.uniqueId(this).toLowerCase()}-auth`
      }
    });

    const databaseUrl = cdk.Fn.join("", [
      "postgresql://",
      dbCredentials.secretValueFromJson("username").toString(),
      ":",
      dbCredentials.secretValueFromJson("password").toString(),
      "@",
      dbProxy.endpoint,
      ":5432/glossadocs"
    ]);

    const redisUrl = cdk.Fn.join("", [
      "rediss://:",
      redisAuthToken.secretValue.toString(),
      "@",
      redis.attrPrimaryEndPointAddress,
      ":",
      redis.attrPrimaryEndPointPort
    ]);

    const apiLambda = new lambda.Function(this, "BackendLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "dist/lambda.handler",
      code: lambda.Code.fromAsset(backendAssetPath, {
        exclude: ["node_modules", "coverage", "test", "src", "*.tsbuildinfo"]
      }),
      timeout: Duration.seconds(30),
      memorySize: 1024,
      vpc,
      securityGroups: [lambdaSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        APP_ENV: config.appEnv,
        NODE_ENV: "production",
        AUTH_PROVIDER: "cognito",
        AUTH_SESSION_STORE: "redis",
        AUTH_SESSION_SECURE_COOKIE: "true",
        CORS_ALLOWED_ORIGINS: config.backendCorsOrigin,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        COGNITO_REGION: this.region,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_PUBLIC_DOMAIN: cdk.Fn.join("", ["https://", userPoolDomain.domainName]),
        OIDC_PUBLIC_REDIRECT_URI: callbackUrl
      }
    });

    const api = new apigateway.LambdaRestApi(this, "RestApi", {
      restApiName: "glossadocs-api",
      handler: apiLambda,
      proxy: true,
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        metricsEnabled: true,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [config.backendCorsOrigin],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        allowCredentials: true
      }
    });

    if (config.enableWaf) {
      const webAcl = new wafv2.CfnWebACL(this, "ApiWebAcl", {
        defaultAction: { allow: {} },
        scope: "REGIONAL",
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: "glossadocsApiAcl",
          sampledRequestsEnabled: true
        },
        rules: [
          {
            name: "AWSManagedRulesCommonRuleSet",
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: "AWS",
                name: "AWSManagedRulesCommonRuleSet"
              }
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: "commonRuleSet",
              sampledRequestsEnabled: true
            }
          }
        ]
      });

      new wafv2.CfnWebACLAssociation(this, "ApiWebAclAssociation", {
        webAclArn: webAcl.attrArn,
        resourceArn: cdk.Fn.join("", [
          "arn:aws:apigateway:",
          this.region,
          "::/restapis/",
          api.restApiId,
          "/stages/",
          api.deploymentStage.stageName
        ])
      });
    }

    new cloudwatch.Alarm(this, "LambdaErrorsAlarm", {
      metric: apiLambda.metricErrors({ period: Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "Api5xxAlarm", {
      metric: api.metricServerError({ period: Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "DatabaseCpuAlarm", {
      metric: db.metricCPUUtilization({ period: Duration.minutes(5) }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "RedisCpuAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/ElastiCache",
        metricName: "CPUUtilization",
        dimensionsMap: {
          ReplicationGroupId: redis.ref
        },
        period: Duration.minutes(5)
      }),
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cdk.CfnOutput(this, "ApiBaseUrl", {
      value: api.url,
      exportName: "GlossaDocsApiBaseUrl"
    });

    new cdk.CfnOutput(this, "AmplifyDefaultDomain", {
      value: cdk.Fn.join("", ["https://", mainBranch.branchName, ".", amplifyApp.attrDefaultDomain]),
      exportName: "GlossaDocsAmplifyDefaultDomain"
    });

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: userPool.userPoolId,
      exportName: "GlossaDocsCognitoUserPoolId"
    });

    new cdk.CfnOutput(this, "CognitoClientId", {
      value: userPoolClient.userPoolClientId,
      exportName: "GlossaDocsCognitoClientId"
    });

    new cdk.CfnOutput(this, "CognitoHostedDomain", {
      value: cdk.Fn.join("", ["https://", userPoolDomain.domainName]),
      exportName: "GlossaDocsCognitoHostedDomain"
    });

    new cdk.CfnOutput(this, "RdsProxyEndpoint", {
      value: dbProxy.endpoint,
      exportName: "GlossaDocsRdsProxyEndpoint"
    });

    new cdk.CfnOutput(this, "RedisEndpoint", {
      value: redis.attrPrimaryEndPointAddress,
      exportName: "GlossaDocsRedisEndpoint"
    });

    new cdk.CfnOutput(this, "DatabaseCredentialsSecretArn", {
      value: dbCredentials.secretArn,
      exportName: "GlossaDocsDatabaseCredentialsSecretArn"
    });
  }
}
