const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  console.error("Missing API_BASE_URL for smoke tests.");
  process.exit(1);
}

async function check(pathname, expectedStatus = 200) {
  const normalizedBase = apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = `${normalizedBase}${normalizedPath}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`Smoke check failed for ${url}. Expected ${expectedStatus}, got ${response.status}. Body: ${body}`);
  }
}

async function main() {
  await check("/health", 200);
  await check("/ready", 200);
  console.log("Smoke tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
