import { buildApp } from "./app.js";
import { getConfig } from "./shared/config.js";

async function main() {
  const config = getConfig();
  const app = buildApp(config);

  try {
    await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
