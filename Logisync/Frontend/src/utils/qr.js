// Ang Shopee QR ay may laman na transaction number. HINDI pa natin alam ang eksaktong format nito,
// kaya tinatanggap natin ang tatlong posibleng hugis:
//   1) plain text:  "TXN123"                       -> "TXN123"
//   2) URL na may query: "https://...?txn=TXN123"   -> "TXN123"
//   3) URL na ang huling bahagi ng path ang number  -> "TXN123"
// Kapag nakita na ang totoong sample ng QR, dito lang natin aayusin.
const QUERY_KEYS = ["transaction_number", "transactionNumber", "txn", "tn", "order_id", "id"];

export function parseTransactionNumber(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      for (const key of QUERY_KEYS) {
        const v = url.searchParams.get(key);
        if (v && v.trim()) return v.trim();
      }
      const last = url.pathname.split("/").filter(Boolean).pop();
      if (last) return decodeURIComponent(last).trim();
    } catch {
      /* hindi valid na URL: gamitin ang buong text */
    }
  }
  return text;
}
