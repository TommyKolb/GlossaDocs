import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";
import { GlossaDocsStack } from "../lib/glossadocs-stack.js";
import { loadStackConfig } from "../lib/stack-config.js";

const app = new cdk.App();
const config = loadStackConfig(app);

new GlossaDocsStack(app, "GlossaDocsPublicStack", {
  env: {
    account: config.account,
    region: config.region
  },
  config
});
