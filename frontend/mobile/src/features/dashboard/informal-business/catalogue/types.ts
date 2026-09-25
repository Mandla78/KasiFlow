import type { CategoryCode } from '@/constants/categories';
import type { Cents } from '@/shared/lib/money';

/** How much is left, as the trader sees it (never an exact stock number). */
export type StockLevel = 'in_stock' | 'low' | 'out';

/** A product on a supplier's catalogue (docs/supplier/03: products.csv). */
export type Product = {
  id: string;
  supplierId: string;
  name: string;
  brand: string;
  category: CategoryCode;
  /** each | pack | case | bag | kg | litre | metre | roll */
  unit: string;
  /** e.g. "24 x 500 ml", "50 kg" */
  packSize: string;
  priceCents: Cents;
  /** The usual price when the product is on sale (shown crossed out); null = not on sale. */
  compareAtPriceCents: Cents | null;
  vatIncluded: boolean;
  stock: StockLevel;
  minQty: number;
  maxQty: number;
  description: string;
  /** 1-7 image URLs; null = no photo yet (a category placeholder shows). */
  images: (string | null)[];
};

export type ProductQuery = { category?: CategoryCode; search?: string };

export interface CatalogueApi {
  products(supplierId: string, query?: ProductQuery): Promise<Product[]>;
  product(id: string): Promise<Product>;
}
