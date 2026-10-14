// Servidor simples (sem dependências) — Node 18+
// Assina as chamadas da API de Afiliados da Shopee e serve a página.
// Uso:  SHOPEE_APP_ID=seu_app_id 

SHOPEE_APP_ID=18353300004 
SHOPEE_SECRET=NG5U42PVHX6FNUFUOO3GWGQKTT2BXBFY

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const APP_ID = process.env.SHOPEE_APP_ID;
const SECRET = process.env.SHOPEE_SECRET;
const PORT = process.env.PORT || 3000;
const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

if (!APP_ID || !SECRET) {
  console.error("Defina SHOPEE_APP_ID e SHOPEE_SECRET antes de iniciar.");
  process.exit(1);
}

async function shopee(query) {
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha256")
    .update(APP_ID + timestamp + payload + SECRET)
    .digest("hex");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });
  return res.json();
}

// cache curto para não estourar o limite da API
const cache = new Map();
const TTL = 5 * 60 * 1000;

function buildQuery({ keyword, sort, page }) {
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/achadinhos") {
    const keyword = (url.searchParams.get("q") || "").slice(0, 80);
    const sort = [1, 2, 3, 4, 5].includes(+url.searchParams.get("sort")) ? +url.searchParams.get("sort") : 2;
    const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
    const key = `${keyword}|${sort}|${page}`;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return res.end(hit.body);

    try {
      const data = await shopee(buildQuery({ keyword, sort, page }));
      const body = JSON.stringify(data);
      if (!data.errors) cache.set(key, { t: Date.now(), body });
      res.end(body);
    } catch (e) {
      res.statusCode = 502;
      res.end(JSON.stringify({ errors: [{ message: "Falha ao falar com a Shopee." }] }));
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  }

  res.statusCode = 404;
  res.end("Não encontrado");
});

server.listen(PORT, () => console.log(`Achadinhos rodando em http://localhost:${PORT}`));
