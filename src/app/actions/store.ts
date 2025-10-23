import { createSdk } from '@/app/utils/wix-sdk';

// 'use server';
// If you intend to run these as server actions, uncomment the line above.

export async function getStoreItemsPrices({ accessToken }: { accessToken: string }) {
  try {
    const sdk = createSdk(accessToken);
    const items = await sdk.products
      .queryProducts()
      .find()
      .then((res) => res.items);
    return items;
  } catch (e) {
    console.error('Failed to fetch store items:', e);
    return [];
  }
}

export async function updateStoreItemPrice({
  accessToken,
  goldPrice,
  silverPrice,
  platinumPrice,
}: {
  accessToken: string;
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
}) {
  console.log('Updating store item prices with increment:', { goldPrice, silverPrice, platinumPrice });
  try {
    const storeProducts = await getStoreItemsPrices({ accessToken });
    console.log('Fetched store products:', storeProducts);
    const updatedProducts = storeProducts.map((product) => ({
      ...product,
      priceData: {
        ...product.priceData,
        price: (product.priceData?.price ?? 0) + goldPrice + silverPrice + platinumPrice,
      },
      lastUpdated: new Date(),
    }));

    const sdk = createSdk(accessToken);
    await Promise.all(
      updatedProducts.map((product) =>
        sdk.products.updateProduct(product._id!, {
          priceData: product.priceData,
        }),
      ),
    );

    return updatedProducts;
  } catch (e) {
    console.error('Failed to update store item prices:', e);
    return [];
  }
}
