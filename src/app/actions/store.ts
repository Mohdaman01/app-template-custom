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
      // CRITICAL: Must include options array - variants choices must reference existing options

      // First, query to get product IDs
      const queryResult = await sdk.productsV3.queryProducts().find();
      const productIds = queryResult.items.map((item) => item._id).filter(Boolean) as string[];

      console.log('Fetched V3 product IDs:', productIds.length);

      // Fetch full product details using getProduct() to get variantsInfo AND options
      // Request VARIANT_OPTION_CHOICE_NAMES to get complete choice structure
      const fullProducts = await Promise.all(
        productIds.map(async (productId) => {
          try {
            const productData = await sdk.productsV3.getProduct(productId, {
              fields: ['VARIANT_OPTION_CHOICE_NAMES'],
            });
            return productData;
          } catch (error) {
            console.error(`Failed to fetch product ${productId}:`, error);
            return null;
          }
        }),
      );

      // Filter out null results
      const validProducts = fullProducts.filter(Boolean);
      console.log('Fetched full V3 products:', validProducts);

      // Prepare products for bulk update with correct structure
      const productsToUpdate = validProducts.map((product) => {
        // Get all variants for this product
        const variants = product?.variantsInfo?.variants || [];

        // Update each variant's price with correct structure
        const updatedVariants = variants.map((variant) => {
          const currentPrice = parseFloat(variant.price?.actualPrice?.amount || '0');
          const newPrice = currentPrice + totalPriceIncrement;

          return {
            _id: variant._id,
            // Preserve the complete choices structure with both IDs and names
            choices: variant.choices?.map((choice) => ({
              optionChoiceIds: {
                optionId: choice.optionChoiceIds?.optionId,
                choiceId: choice.optionChoiceIds?.choiceId,
              },
              optionChoiceNames: {
                optionName: choice.optionChoiceNames?.optionName,
                choiceName: choice.optionChoiceNames?.choiceName,
                renderType: choice.optionChoiceNames?.renderType,
              },
            })),
            price: {
              actualPrice: {
                amount: newPrice.toFixed(2).toString(), // Must be string format
              },
            },
            // Preserve other variant properties
            ...(variant.sku && { sku: variant.sku }),
            ...(variant.barcode && { barcode: variant.barcode }),
            ...(variant.visible !== undefined && { visible: variant.visible }),
          };
        });

        // CRITICAL: Include the complete options array
        // Every variant's choices.optionId must exist in options.id
        // Options must include _id, name, and choicesSettings with all choices
        return {
          product: {
            _id: product?._id,
            revision: product?.revision,
            // Include complete options structure - required for variant choices validation
            options:
              product?.options?.map((option) => ({
                _id: option._id,
                name: option.name,
                optionRenderType: option.optionRenderType,
                choicesSettings: {
                  choices: option.choicesSettings?.choices?.map((choice) => ({
                    choiceId: choice.choiceId,
                    name: choice.name,
                    choiceType: choice.choiceType,
                    ...(choice.colorCode && { colorCode: choice.colorCode }),
                    ...(choice.linkedMedia && { linkedMedia: choice.linkedMedia }),
                  })),
                },
              })) || [],
            variantsInfo: {
              variants: updatedVariants,
            },
          },
        };
      });

      console.log('Prepared products for bulk update:', productsToUpdate);

      // Use bulkUpdateProductsWithInventory to update all products
      // Process in batches of 100 (API limit)
      const batchSize = 100;
      const results = [];

      for (let i = 0; i < productsToUpdate.length; i += batchSize) {
        const batch = productsToUpdate.slice(i, i + batchSize);

        // Call with correct signature: array and empty options object
        const batchResult = await sdk.productsV3.bulkUpdateProductsWithInventory(batch, {});
        results.push(...(batchResult?.productResults?.results || []));
      }

      // Extract updated products from results
      const updatedProducts = results.filter((result) => result.item).map((result) => result.item);

      console.log('Successfully updated V3 products:', updatedProducts);
      return updatedProducts;
    }

    return [];
  } catch (e) {
    console.error('Failed to update store item prices:', e);
    throw e;
  }
}
