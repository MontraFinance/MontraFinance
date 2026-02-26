/**
 * CEX Trade Execution
 * Per-exchange market order placement and status polling.
 * Auth patterns mirror testExchangeConnection() in /api/exchange-keys/[action].ts
 */
import crypto from "crypto";

export interface CexCredentials {
  apiKey: string;
  secret: string;
  passphrase?: string;
}

export interface CexOrderResult {
  orderId: string;
  status: "new" | "partially_filled" | "filled" | "cancelled" | "rejected" | "unknown";
  filledQty?: string;
  avgPrice?: string;
  raw?: any;
}

const TIMEOUT = 15_000;

// ═══════════════════════════════════════════════════════════════════
//  ORDER PLACEMENT
// ═══════════════════════════════════════════════════════════════════

export async function placeCexMarketOrder(
  exchange: string,
  creds: CexCredentials,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
): Promise<CexOrderResult> {
  switch (exchange) {
    case "binance":  return placeBinanceOrder(creds, symbol, side, quantity);
    case "coinbase": return placeCoinbaseOrder(creds, symbol, side, quantity);
    case "bybit":    return placeBybitOrder(creds, symbol, side, quantity);
    case "okx":      return placeOkxOrder(creds, symbol, side, quantity);
    default:
      throw new Error(`Unsupported exchange: ${exchange}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ORDER STATUS
// ═══════════════════════════════════════════════════════════════════

export async function getCexOrderStatus(
  exchange: string,
  creds: CexCredentials,
  orderId: string,
  symbol: string,
): Promise<CexOrderResult> {
  switch (exchange) {
    case "binance":  return getBinanceOrderStatus(creds, orderId, symbol);
    case "coinbase": return getCoinbaseOrderStatus(creds, orderId);
    case "bybit":    return getBybitOrderStatus(creds, orderId, symbol);
    case "okx":      return getOkxOrderStatus(creds, orderId, symbol);
    default:
      throw new Error(`Unsupported exchange: ${exchange}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BINANCE — HMAC-SHA256 signed REST
//  Docs: https://binance-docs.github.io/apidocs/spot/en/#new-order-trade
// ═══════════════════════════════════════════════════════════════════

async function placeBinanceOrder(
  creds: CexCredentials,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
): Promise<CexOrderResult> {
  const timestamp = Date.now();
  // For buying, use quoteOrderQty (spend X USDC); for selling, use quantity (sell X ETH)
  const isBuy = side === "buy";
  const params = isBuy
    ? `symbol=${symbol}&side=BUY&type=MARKET&quoteOrderQty=${quantity}&timestamp=${timestamp}`
    : `symbol=${symbol}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;

  const signature = crypto.createHmac("sha256", creds.secret).update(params).digest("hex");

  const resp = await fetch(`https://api.binance.com/api/v3/order?${params}&signature=${signature}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": creds.apiKey },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Binance order failed: ${data.msg || JSON.stringify(data)}`);
  }

  return {
    orderId: String(data.orderId),
    status: normalizeBinanceStatus(data.status),
    filledQty: data.executedQty,
    avgPrice: data.fills?.[0]?.price,
    raw: data,
  };
}

async function getBinanceOrderStatus(
  creds: CexCredentials,
  orderId: string,
  symbol: string,
): Promise<CexOrderResult> {
  const timestamp = Date.now();
  const params = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = crypto.createHmac("sha256", creds.secret).update(params).digest("hex");

  const resp = await fetch(`https://api.binance.com/api/v3/order?${params}&signature=${signature}`, {
    headers: { "X-MBX-APIKEY": creds.apiKey },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(`Binance status check failed: ${data.msg || resp.status}`);

  return {
    orderId: String(data.orderId),
    status: normalizeBinanceStatus(data.status),
    filledQty: data.executedQty,
    avgPrice: data.price !== "0.00000000" ? data.price : undefined,
    raw: data,
  };
}

function normalizeBinanceStatus(s: string): CexOrderResult["status"] {
  const map: Record<string, CexOrderResult["status"]> = {
    NEW: "new", PARTIALLY_FILLED: "partially_filled", FILLED: "filled",
    CANCELED: "cancelled", REJECTED: "rejected", EXPIRED: "cancelled",
  };
  return map[s] || "unknown";
}

// ═══════════════════════════════════════════════════════════════════
//  COINBASE — CB-ACCESS signed REST
//  Docs: https://docs.cdp.coinbase.com/advanced-trade/reference/retailbrokerageapi_postorder
// ═══════════════════════════════════════════════════════════════════

async function placeCoinbaseOrder(
  creds: CexCredentials,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
): Promise<CexOrderResult> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = "/api/v3/brokerage/orders";
  const clientOrderId = crypto.randomUUID();

  const isBuy = side === "buy";
  const body = JSON.stringify({
    client_order_id: clientOrderId,
    product_id: symbol,
    side: isBuy ? "BUY" : "SELL",
    order_configuration: isBuy
      ? { market_market_ioc: { quote_size: quantity } }   // spend X USDC
      : { market_market_ioc: { base_size: quantity } },    // sell X ETH
  });

  const message = timestamp + "POST" + path + body;
  const signature = crypto.createHmac("sha256", creds.secret).update(message).digest("base64");

  const resp = await fetch(`https://api.coinbase.com${path}`, {
    method: "POST",
    headers: {
      "CB-ACCESS-KEY": creds.apiKey,
      "CB-ACCESS-SIGN": signature,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "CB-ACCESS-PASSPHRASE": creds.passphrase || "",
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(`Coinbase order failed: ${data.error || data.message || JSON.stringify(data)}`);
  }

  return {
    orderId: data.order_id || data.success_response?.order_id || clientOrderId,
    status: "new",
    raw: data,
  };
}

async function getCoinbaseOrderStatus(
  creds: CexCredentials,
  orderId: string,
): Promise<CexOrderResult> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = `/api/v3/brokerage/orders/historical/${orderId}`;
  const message = timestamp + "GET" + path;
  const signature = crypto.createHmac("sha256", creds.secret).update(message).digest("base64");

  const resp = await fetch(`https://api.coinbase.com${path}`, {
    headers: {
      "CB-ACCESS-KEY": creds.apiKey,
      "CB-ACCESS-SIGN": signature,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "CB-ACCESS-PASSPHRASE": creds.passphrase || "",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(`Coinbase status check failed: ${data.message || resp.status}`);

  const order = data.order || data;
  const statusMap: Record<string, CexOrderResult["status"]> = {
    OPEN: "new", PENDING: "new", FILLED: "filled", CANCELLED: "cancelled",
    EXPIRED: "cancelled", FAILED: "rejected",
  };

  return {
    orderId: order.order_id || orderId,
    status: statusMap[order.status] || "unknown",
    filledQty: order.filled_size,
    avgPrice: order.average_filled_price,
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  BYBIT — V5 HMAC signed REST
//  Docs: https://bybit-exchange.github.io/docs/v5/order/create-order
// ═══════════════════════════════════════════════════════════════════

async function placeBybitOrder(
  creds: CexCredentials,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
): Promise<CexOrderResult> {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";

  const body = JSON.stringify({
    category: "spot",
    symbol,
    side: side === "buy" ? "Buy" : "Sell",
    orderType: "Market",
    qty: quantity,
    marketUnit: side === "buy" ? "quoteCoin" : "baseCoin",
  });

  const preSign = timestamp + creds.apiKey + recvWindow + body;
  const signature = crypto.createHmac("sha256", creds.secret).update(preSign).digest("hex");

  const resp = await fetch("https://api.bybit.com/v5/order/create", {
    method: "POST",
    headers: {
      "X-BAPI-API-KEY": creds.apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (data.retCode !== 0) {
    throw new Error(`Bybit order failed: ${data.retMsg || JSON.stringify(data)}`);
  }

  return {
    orderId: data.result?.orderId || "",
    status: "new",
    raw: data,
  };
}

async function getBybitOrderStatus(
  creds: CexCredentials,
  orderId: string,
  symbol: string,
): Promise<CexOrderResult> {
  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const queryString = `category=spot&orderId=${orderId}&symbol=${symbol}`;
  const preSign = timestamp + creds.apiKey + recvWindow + queryString;
  const signature = crypto.createHmac("sha256", creds.secret).update(preSign).digest("hex");

  const resp = await fetch(`https://api.bybit.com/v5/order/realtime?${queryString}`, {
    headers: {
      "X-BAPI-API-KEY": creds.apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (data.retCode !== 0) throw new Error(`Bybit status check failed: ${data.retMsg}`);

  const order = data.result?.list?.[0];
  if (!order) return { orderId, status: "unknown" };

  const statusMap: Record<string, CexOrderResult["status"]> = {
    New: "new", PartiallyFilled: "partially_filled", Filled: "filled",
    Cancelled: "cancelled", Rejected: "rejected", Deactivated: "cancelled",
  };

  return {
    orderId: order.orderId,
    status: statusMap[order.orderStatus] || "unknown",
    filledQty: order.cumExecQty,
    avgPrice: order.avgPrice !== "0" ? order.avgPrice : undefined,
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  OKX — HMAC-SHA256 base64 signed REST
//  Docs: https://www.okx.com/docs-v5/en/#order-book-trading-trade-post-place-order
// ═══════════════════════════════════════════════════════════════════

async function placeOkxOrder(
  creds: CexCredentials,
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
): Promise<CexOrderResult> {
  const timestamp = new Date().toISOString();
  const path = "/api/v5/trade/order";

  const body = JSON.stringify({
    instId: symbol,
    tdMode: "cash",
    side: side,
    ordType: "market",
    sz: quantity,
    tgtCcy: side === "buy" ? "quote_ccy" : "base_ccy",
  });

  const preSign = timestamp + "POST" + path + body;
  const signature = crypto.createHmac("sha256", creds.secret).update(preSign).digest("base64");

  const resp = await fetch(`https://www.okx.com${path}`, {
    method: "POST",
    headers: {
      "OK-ACCESS-KEY": creds.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": creds.passphrase || "",
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (data.code !== "0") {
    const errMsg = data.data?.[0]?.sMsg || data.msg || JSON.stringify(data);
    throw new Error(`OKX order failed: ${errMsg}`);
  }

  return {
    orderId: data.data?.[0]?.ordId || "",
    status: "new",
    raw: data,
  };
}

async function getOkxOrderStatus(
  creds: CexCredentials,
  orderId: string,
  symbol: string,
): Promise<CexOrderResult> {
  const timestamp = new Date().toISOString();
  const path = `/api/v5/trade/order?ordId=${orderId}&instId=${symbol}`;
  const preSign = timestamp + "GET" + path;
  const signature = crypto.createHmac("sha256", creds.secret).update(preSign).digest("base64");

  const resp = await fetch(`https://www.okx.com${path}`, {
    headers: {
      "OK-ACCESS-KEY": creds.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": creds.passphrase || "",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });

  const data = await resp.json();
  if (data.code !== "0") throw new Error(`OKX status check failed: ${data.msg}`);

  const order = data.data?.[0];
  if (!order) return { orderId, status: "unknown" };

  const statusMap: Record<string, CexOrderResult["status"]> = {
    live: "new", partially_filled: "partially_filled", filled: "filled",
    canceled: "cancelled", mmp_canceled: "cancelled",
  };

  return {
    orderId: order.ordId,
    status: statusMap[order.state] || "unknown",
    filledQty: order.accFillSz,
    avgPrice: order.avgPx !== "0" ? order.avgPx : undefined,
    raw: data,
  };
}
