import { PRODUCTS } from './manifest';

let failures = 0;
for (const [id, product] of Object.entries(PRODUCTS)) {
  try {
    const res = await fetch(product.url, { method: 'HEAD', redirect: 'follow' });
    const bytes = Number(res.headers.get('content-length') ?? 0);
    const ok = res.ok;
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${res.status} ${(bytes / 1e6).toFixed(1).padStart(8)} MB  ${id}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ---         -   ${id}: ${String(error)}`);
  }
}
if (failures > 0) {
  console.error(`${failures} product(s) unavailable`);
  process.exit(1);
}
