// Assina as chamadas da API de Afiliados da Shopee.
// Credenciais vêm das variáveis de ambiente SHOPEE_APP_ID e SHOPEE_SECRET (configuradas no painel da Netlify).
import { createHash } from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

function buildQuery({ keyword, sort, page }: { keyword: string; sort: number; page: number }) {
  const kw = keyword ? `keyword: ${JSON.stringify(keyword)},` : "";
  return `{
    productOfferV2(${kw} sortType: ${sort}, page: ${page}, limit: 24) {
      nodes {
        itemId productName imageUrl price priceMin priceMax
        priceDiscountRate ratingStar sales shopName offerLink productLink
      }
      pageInfo { page limit hasNextPage }
    }
  }`;
}

export default async (req: Request) => {
  const appId = Netlify.env.get("SHOPEE_APP_ID");
  const secret = Netlify.env.get("SHOPEE_SECRET");
  if (!appId || !secret) {
    return Response.json(
      { errors: [{ message: "Defina SHOPEE_APP_ID e SHOPEE_SECRET nas variáveis de ambiente." }] },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const keyword = (url.searchParams.get("q") || "").slice(0, 80);
  const sortParam = Number(url.searchParams.get("sort"));
  const sort = [1, 2, 3, 4, 5].includes(sortParam) ? sortParam : 2;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "") || 1);

  const payload = JSON.stringify({ query: buildQuery({ keyword, sort, page }) });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256")
    .update(appId + timestamp + payload + secret)
    .digest("hex");

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });
    const data = await res.json();

    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
    // cache de 5 minutos na CDN para não estourar o limite da API
    if (!data.errors) headers["Netlify-CDN-Cache-Control"] = "public, s-maxage=300, durable";
    return new Response(JSON.stringify(data), { headers });
  } catch {
    return Response.json({ errors: [{ message: "Falha ao falar com a Shopee." }] }, { status: 502 });
  }
};

export const config = { path: "/api/achadinhos" };
