"use server";

import { requireSubiektLookup } from "@/lib/auth";
import {
  lookupProductZdDelivery,
  type ProductZdLookupOptions,
  type ProductZdLookupResult,
} from "@/lib/subiekt/product-zd-lookup";
import type { SubiektProduct } from "@/lib/subiekt/types";

export async function actionLookupProductZdDelivery(
  product: SubiektProduct,
  options?: ProductZdLookupOptions
): Promise<ProductZdLookupResult> {
  await requireSubiektLookup();
  return lookupProductZdDelivery(product, options);
}
