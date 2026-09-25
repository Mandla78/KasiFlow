/**
 * MOCK catalogue: realistic products per category with South African
 * prices (docs/supplier/03). Each supplier gets the products of the
 * categories it sells, with its own small price differences, so the same
 * item costs a little more or less at different suppliers -- like real
 * life. Generic names, never a real brand as the product's identity.
 */
import type { CategoryCode } from '@/constants/categories';

import { MOCK_SUPPLIERS } from '../../suppliers/api/mockSupplierData';
import type { Product, StockLevel } from '../types';

type Template = { name: string; brand: string; unit: string; packSize: string; rands: number; description: string; photos: number };

const T = (name: string, brand: string, unit: string, packSize: string, rands: number, description: string, photos = 1): Template => ({
  name, brand, unit, packSize, rands, description, photos,
});

const TEMPLATES: Partial<Record<CategoryCode, Template[]>> = {
  food_grocery: [
    T('Maize meal', 'Kasi Gold', 'bag', '10 kg', 89.99, 'Super maize meal for pap. Fine, white, no additives.', 3),
    T('Long grain rice', 'Kasi Gold', 'bag', '10 kg', 169.99, 'Parboiled long grain rice.', 2),
    T('Cake flour', 'Mill Street', 'bag', '10 kg', 139.99, 'White cake flour for baking and vetkoek.', 1),
    T('White sugar', 'Sweet Valley', 'bag', '10 kg', 219.99, 'Refined white sugar.', 1),
    T('Sunflower oil', 'Golden Fry', 'bottle', '5 litre', 149.99, 'Pure sunflower cooking oil.', 2),
    T('Baked beans in tomato sauce', 'Harvest Tin', 'case', '24 x 410 g', 299.99, 'A case of 24 tins.', 1),
    T('Instant noodles, chicken', 'Quick Bowl', 'case', '40 x 73 g', 199.99, 'Chicken-flavoured instant noodles.', 2),
    T('Tea bags', 'Morning Cup', 'pack', '100 bags', 54.99, 'Black tea, 100 tagless bags.', 1),
  ],
  beverages: [
    T('Cola soft drink', 'Fizz Co', 'case', '24 x 330 ml cans', 189.99, 'Cold drink cans, a case of 24.', 3),
    T('Orange soft drink', 'Fizz Co', 'case', '12 x 2 litre', 239.99, 'Two-litre bottles, a case of 12.', 2),
    T('Still water', 'Clear Spring', 'case', '24 x 500 ml', 99.99, 'Still mineral water.', 1),
    T('Fruit juice blend', 'Sunny Farm', 'case', '6 x 1 litre', 129.99, '100% fruit juice blend.', 2),
    T('Energy drink', 'Volt', 'case', '24 x 500 ml', 359.99, 'Energy drink cans.', 1),
  ],
  snacks_confectionery: [
    T('Potato chips, salt & vinegar', 'Crunch Kasi', 'case', '48 x 36 g', 239.99, 'Small packets for the counter.', 2),
    T('Maize snacks, cheese', 'Crunch Kasi', 'case', '50 x 25 g', 129.99, 'Cheese-flavoured maize puffs.', 1),
    T('Lollipops', 'Candy Corner', 'pack', '100 pieces', 59.99, 'Assorted fruit lollipops.', 1),
    T('Chocolate bars', 'Cocoa Joy', 'case', '24 x 40 g', 219.99, 'Milk chocolate bars.', 2),
    T('Chewing gum', 'Fresh Pop', 'pack', '100 pieces', 49.99, 'Mint chewing gum, single pieces.', 1),
  ],
  dairy_chilled: [
    T('Long-life full cream milk', 'Farm Fresh', 'case', '6 x 1 litre', 109.99, 'UHT milk, no fridge needed until opened.', 2),
    T('Maas (fermented milk)', 'Farm Fresh', 'case', '6 x 2 litre', 199.99, 'Thick amasi.', 1),
    T('Margarine brick', 'Golden Spread', 'case', '12 x 500 g', 299.99, 'Margarine bricks for bread.', 1),
    T('Cheese slices', 'Dairy Best', 'pack', '10 x 200 g', 399.99, 'Processed cheese slices.', 1),
  ],
  bakery: [
    T('White bread, sliced', 'Kasi Bakers', 'crate', '10 x 700 g', 159.99, 'Fresh daily, sliced.', 3),
    T('Brown bread, sliced', 'Kasi Bakers', 'crate', '10 x 700 g', 149.99, 'Fresh daily, sliced.', 2),
    T('Hot dog rolls', 'Kasi Bakers', 'pack', '6 x 6 rolls', 89.99, 'Soft rolls.', 1),
    T('Vetkoek', 'Kasi Bakers', 'tray', '24 pieces', 72.0, 'Made fresh every morning.', 2),
  ],
  household_cleaning: [
    T('Dishwashing liquid', 'Sparkle', 'case', '12 x 750 ml', 239.99, 'Lemon dishwashing liquid.', 2),
    T('Washing powder', 'Bright Wash', 'bag', '5 kg', 169.99, 'Hand-wash powder.', 1),
    T('Bleach', 'Pure White', 'case', '12 x 750 ml', 179.99, 'Thick bleach.', 1),
    T('Bath soap bars', 'Clean Kasi', 'case', '48 x 150 g', 329.99, 'Family soap bars.', 1),
    T('Toilet paper, 1-ply', 'Soft Roll', 'pack', '48 rolls', 189.99, 'Single-ply toilet rolls.', 1),
  ],
  personal_care: [
    T('Petroleum jelly', 'Skin Guard', 'case', '12 x 250 ml', 199.99, 'Pure petroleum jelly.', 1),
    T('Body lotion', 'Skin Guard', 'case', '6 x 400 ml', 219.99, 'Aqueous body lotion.', 2),
    T('Toothpaste', 'Bright Smile', 'case', '24 x 100 ml', 299.99, 'Fluoride toothpaste.', 1),
    T('Roll-on deodorant', 'Fresh Day', 'case', '12 x 50 ml', 239.99, 'Roll-on, 48-hour.', 1),
  ],
  baby_family: [
    T('Disposable nappies, size 3', 'Little Steps', 'pack', '4 x 44', 599.99, 'Size 3 nappies.', 2),
    T('Baby wipes', 'Little Steps', 'case', '12 x 80', 299.99, 'Alcohol-free wipes.', 1),
  ],
  packaging_disposable: [
    T('Plastic carry bags', 'Pack It', 'bundle', '1000 bags', 189.99, 'Size 24 carry bags.', 1),
    T('Bread bags', 'Pack It', 'bundle', '1000 bags', 99.99, 'Clear bread bags.', 1),
  ],
  building_materials: [
    T('Cement, 42.5N', 'Rock Build', 'bag', '50 kg', 109.99, 'General-purpose cement.', 3),
    T('Building sand', 'Rock Build', 'cube', '1 m³', 649.99, 'Delivered by truck.', 1),
    T('Stone, 19 mm', 'Rock Build', 'cube', '1 m³', 749.99, 'Concrete stone.', 1),
    T('Maxi bricks', 'Clay Works', 'pallet', '500 bricks', 1699.99, 'Stock bricks, a pallet of 500.', 2),
    T('IBR roof sheet, 0.47 mm', 'Steel Line', 'sheet', '3.6 m', 289.99, 'Galvanised IBR sheet.', 2),
  ],
  tools_hardware: [
    T('Wheelbarrow, 65 L', 'Site Pro', 'each', '65 litre', 899.99, 'Heavy-duty builder wheelbarrow.', 3),
    T('Spade', 'Site Pro', 'each', 'Round mouth', 179.99, 'Steel spade, wooden handle.', 1),
    T('Claw hammer', 'Site Pro', 'each', '500 g', 149.99, 'Fibreglass handle.', 1),
    T('Wire nails, 75 mm', 'Fixit', 'box', '5 kg', 229.99, 'Round wire nails.', 1),
    T('Tape measure', 'Fixit', 'each', '8 m', 99.99, 'Metric tape measure.', 1),
  ],
  paint_finishes: [
    T('PVA paint, white', 'Colour Kasi', 'tin', '20 litre', 899.99, 'Interior/exterior PVA.', 2),
    T('Roof paint, red', 'Colour Kasi', 'tin', '20 litre', 1299.99, 'Roof and wall paint.', 1),
    T('Paint roller set', 'Colour Kasi', 'each', '225 mm', 119.99, 'Roller, tray and extension.', 1),
  ],
  plumbing: [
    T('PVC pipe, 110 mm', 'Flow Line', 'length', '6 m', 349.99, 'Sewer pipe, class 34.', 2),
    T('Toilet suite, close-coupled', 'Flow Line', 'each', 'White', 1399.99, 'Pan, cistern and seat.', 3),
    T('Geyser, 150 L', 'Hot Flow', 'each', '150 litre', 5499.99, 'Electric geyser, SABS approved.', 2),
    T('Tap, pillar', 'Flow Line', 'each', '15 mm', 189.99, 'Chrome pillar tap.', 1),
  ],
  electrical: [
    T('Surfix cable, 2.5 mm', 'Wire Co', 'roll', '100 m', 1499.99, 'Twin and earth cable.', 2),
    T('LED bulb, 9 W', 'Bright Home', 'pack', '10 bulbs', 179.99, 'Cool white, B22.', 1),
    T('Plug socket, double', 'Wire Co', 'each', '100 x 100 mm', 69.99, 'Double switched socket.', 1),
    T('Distribution board, 8-way', 'Wire Co', 'each', '8 way', 599.99, 'Surface-mount DB.', 1),
  ],
};

/** Stable "random" per id, so everyone sees the same mock data. */
function seeded(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function build(): Product[] {
  const products: Product[] = [];
  for (const s of MOCK_SUPPLIERS) {
    for (const category of s.categories) {
      (TEMPLATES[category] ?? []).forEach((t, i) => {
        const id = `${s.id}-${category}-${i}`;
        const r = seeded(id);
        const priceCents = Math.round(t.rands * (0.95 + r * 0.1) * 100); // +/- 5% per supplier
        const stock: StockLevel = r < 0.08 ? 'out' : r < 0.2 ? 'low' : 'in_stock';
        const onSale = r > 0.78; // about one in five
        const compareAtPriceCents = onSale ? Math.round((priceCents * 1.15) / 100) * 100 - 1 : null;
        products.push({
          id, supplierId: s.id, name: t.name, brand: t.brand, category, unit: t.unit, packSize: t.packSize,
          priceCents, compareAtPriceCents, vatIncluded: true, stock, minQty: 1, maxQty: 50, description: t.description,
          images: Array.from({ length: t.photos }, () => null),
        });
      });
    }
  }
  return products;
}

export const MOCK_PRODUCTS: Product[] = build();

export function findMockProduct(id: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}
