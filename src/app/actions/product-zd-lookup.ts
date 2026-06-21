"use server";

import { requireSubiektLookup } from "@/lib/auth";
import {
  lookupProductZdDelivery,
  type ProductZdLookupResult,
} from "@/lib/subiekt/product-zd-lookup";
import type { SubiektProduct } from "@/lib/subiekt/types";

export async function actionLookupProductZdDelivery(
  product: SubiektProduct
): Promise<ProductZdLookupResult> {
  await requireSubiektLookup();
  return lookupProductZdDelivery(product);
}
