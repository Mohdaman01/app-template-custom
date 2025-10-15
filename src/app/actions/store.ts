import { products } from '@wix/stores';
import { wixAppClient } from '../utils/wix-sdk.app';

export async function getStoreItemsPrices() {
  const items = await wixAppClient.products
    .queryProducts()
    .find()
    .then((res) => res.items);
  return items;
}

export async function updateStoreItemPrice(newPrice: number) {
  console.log('Updating store item prices with increment:', newPrice);
  const storeProducts = await getStoreItemsPrices();
  console.log('Fetched store products:', storeProducts);
  const updatedProducts = storeProducts.map((product) => ({
    ...product,
    priceData: {
      ...product.priceData,
      price: (product.priceData?.price ?? 0) + newPrice,
    },
    lastUpdated: new Date(),
  }));

  await Promise.all(
    updatedProducts.map((product) =>
      wixAppClient.products.updateProduct(product._id!, {
        priceData: product.priceData,
      }),
    ),
  );

  return updatedProducts;
}
