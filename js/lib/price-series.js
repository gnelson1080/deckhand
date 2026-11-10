// Turn a price shard into a chartable series. Pure.
const DAYS = { '7d': 7, '30d': 30 };

export function priceSeries(shard, id, range = 'all') {
  const row = shard?.p?.[id];
  if (!row || !Array.isArray(shard.dates) || !shard.dates.length) return [];
  let start = 0;
  if (DAYS[range]) {
    const last = Date.parse(shard.dates.at(-1) + 'T00:00:00Z');
    const from = new Date(last - (DAYS[range] - 1) * 864e5).toISOString().slice(0, 10);
    start = shard.dates.findIndex(d => d >= from);
    if (start < 0) return [];
  }
  const out = [];
  for (let i = start; i < shard.dates.length; i++) if (typeof row[i] === 'number') out.push({ date: shard.dates[i], price: row[i] });
  return out;
}

export function pctChange(series) {
  if (!series || series.length < 2 || !series[0].price) return null;
  return Math.round(((series.at(-1).price - series[0].price) / series[0].price) * 1000) / 10;
}
