const backendBaseUrl =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/rpc\/?$/, "")
    : "http://localhost:3000");

async function readResponse(response) {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed");
  }

  return body;
}

export async function listShops() {
  const response = await fetch(`${backendBaseUrl}/api/shops`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readResponse(response);
  return body.shops ?? [];
}

export async function createShop(input) {
  const response = await fetch(`${backendBaseUrl}/api/shops`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await readResponse(response);
  return body.shop;
}

export async function updateShopBasicSettings(shopId, input) {
  const response = await fetch(
    `${backendBaseUrl}/api/shops/${encodeURIComponent(shopId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  const body = await readResponse(response);
  return body.shop;
}
