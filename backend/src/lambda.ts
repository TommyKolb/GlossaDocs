/**
 * AWS Lambda entrypoint for GlossaDocs API.
 * Use this handler with API Gateway HTTP API or REST API (Lambda proxy integration).
 * Config is read from Lambda environment variables (same as getConfig()).
 */
import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app.js";
import { getConfig } from "./shared/config.js";

const config = getConfig();
const app = buildApp(config);
const proxy = awsLambdaFastify(app, {
  callbackWaitsForEmptyEventLoop: false
});

await app.ready();

export const handler = proxy;
