import { createSdk } from '@/app/utils/wix-sdk';

// 'use server';
// If you intend to run these as server actions, uncomment the line above.

export async function getStoreItemsPrices({ accessToken }: { accessToken: string }) {
  try {
    const sdk = createSdk(accessToken);
    const version = await sdk.catalogVersioning.getCatalogVersion();
    let items;
    if (version.catalogVersion === 'V1_CATALOG') {
      items = await sdk.products
        .queryProducts()
        .find()
        .then((res) => res.items);
    } else if (version.catalogVersion === 'V3_CATALOG') {
      items = await sdk.productsV3
        .queryProducts()
        .find()
        .then((res) => res.items);
    }
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
    const sdk = createSdk(accessToken);
    const version = await sdk.catalogVersioning.getCatalogVersion();
    const totalPriceIncrement = goldPrice + silverPrice + platinumPrice;

    if (version.catalogVersion === 'V1_CATALOG') {
      // V1 Catalog: Update priceData at product level
      const storeProducts = await sdk.products
        .queryProducts()
        .find()
        .then((res) => res.items);

      console.log('Fetched V1 store products:', storeProducts);

      const updatedProducts = storeProducts.map((product) => ({
        ...product,
        priceData: {
          ...product.priceData,
          price: (product.priceData?.price ?? 0) + totalPriceIncrement,
        },
        lastUpdated: new Date(),
      }));

      await Promise.all(
        updatedProducts.map((product) =>
          sdk.products.updateProduct(product._id!, {
            priceData: product.priceData,
          }),
        ),
      );

      return updatedProducts;
    } else if (version.catalogVersion === 'V3_CATALOG') {
      // V3 Catalog: Update price at variant level using bulkUpdateProductsWithInventory
      // In V3, prices are stored in variants, not at product level
      const storeProducts = await sdk.productsV3
        .queryProducts()
        .find()
        .then((res) => res.items);

      console.log('Fetched V3 store products:', storeProducts);

      // Prepare products for bulk update with correct structure
      const productsToUpdate = storeProducts.map((product) => {
        // Get all variants for this product
        const variants = product.variantsInfo?.variants || [];

        // Update each variant's price with correct structure
        const updatedVariants = variants.map((variant) => {
          const currentPrice = parseFloat(variant.price?.actualPrice?.amount || '0');
          const newPrice = currentPrice + totalPriceIncrement;

          return {
            _id: variant._id,
            price: {
              actualPrice: {
                amount: newPrice.toFixed(2).toString(), // Must be string format
              },
            },
          };
        });

        return {
          product: {
            _id: product._id,
            revision: String((Number(product.revision) || 0) + 1), // Increment revision
            variantsInfo: {
              variants: updatedVariants,
            },
          },
        };
      });

      // Use bulkUpdateProductsWithInventory to update all products
      // Process in batches of 100 (API limit)
      const batchSize = 100;
      const results = [];

      for (let i = 0; i < productsToUpdate.length; i += batchSize) {
        const batch = productsToUpdate.slice(i, i + batchSize);

        // Call with correct signature: array and empty options object
        const batchResult = await sdk.productsV3.bulkUpdateProductsWithInventory(batch, {});

        results.push(...(batchResult.productResults?.results || []));
      }

      // Extract updated products from results
      const updatedProducts = results.filter((result) => result.item).map((result) => result.item);

      console.log('Successfully updated V3 products:', updatedProducts.length);
      return updatedProducts;
    }

    return [];
  } catch (e) {
    console.error('Failed to update store item prices:', e);
    throw e;
  }
}
