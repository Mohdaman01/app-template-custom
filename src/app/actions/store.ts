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
  console.log('Updating store item prices based on metal type and weight:', { goldPrice, silverPrice, platinumPrice });

  // Helper function to calculate price based on metal type and weight
  const calculatePrice = (metalType: string, metalWeight: number): number => {
    const normalizedMetalType = metalType?.toUpperCase();

    if (normalizedMetalType === 'GOLD') {
      return goldPrice * metalWeight;
    } else if (normalizedMetalType === 'SILVER') {
      return silverPrice * metalWeight;
    } else if (normalizedMetalType === 'PLATINUM') {
      return platinumPrice * metalWeight;
    }

    // Default to 0 if metal type is not recognized
    return 0;
  };

  try {
    const sdk = createSdk(accessToken);
    const version = await sdk.catalogVersioning.getCatalogVersion();

    if (version.catalogVersion === 'V1_CATALOG') {
      // V1 Catalog: Update priceData at product level
      const storeProducts = await sdk.products
        .queryProducts()
        .find()
        .then((res) => res.items);

      console.log('Fetched V1 store products:', storeProducts);

      // Filter and map products that have valid MetalType
      const productsToUpdate = storeProducts
        .map((product) => {
          // Type assertion to access extendedFields (V1 catalog may have extended fields as any)
          const productWithExtendedFields = product as any;
          const metalType =
            productWithExtendedFields.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType || '';
          const metalWeight =
            productWithExtendedFields.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight ||
            0;

          // Skip products without a valid metal type
          const normalizedMetalType = metalType?.toUpperCase();
          if (!normalizedMetalType || !['GOLD', 'SILVER', 'PLATINUM'].includes(normalizedMetalType)) {
            return null;
          }

          const newPrice = calculatePrice(metalType, metalWeight);

          return {
            ...product,
            priceData: {
              ...product.priceData,
              price: newPrice,
            },
            lastUpdated: new Date(),
          };
        })
        .filter((product): product is NonNullable<typeof product> => product !== null);

      console.log(
        `Updating ${productsToUpdate.length} out of ${storeProducts.length} V1 products with valid MetalType`,
      );

      await Promise.all(
        productsToUpdate.map((product) =>
          sdk.products.updateProduct(product._id!, {
            priceData: product.priceData,
          }),
        ),
      );

      return productsToUpdate;
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
      const productsToUpdate = validProducts
        .map((product) => {
          // Get metal type and weight from extended fields
          const metalType = product?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType || '';
          const metalWeight =
            product?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight || 0;

          // Skip products without a valid metal type
          const normalizedMetalType = (metalType as string)?.toUpperCase();
          if (!normalizedMetalType || !['GOLD', 'SILVER', 'PLATINUM'].includes(normalizedMetalType)) {
            return null;
          }

          const newPrice = calculatePrice(metalType as string, metalWeight as number);

          // Get all variants for this product
          const variants = product?.variantsInfo?.variants || [];

          // Update each variant's price with calculated price based on metal type and weight
          const updatedVariants = variants.map((variant) => {
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
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      console.log(
        `Prepared ${productsToUpdate.length} out of ${validProducts.length} V3 products for bulk update with valid MetalType`,
      );

      // If no products to update, return empty array
      if (productsToUpdate.length === 0) {
        console.log('No V3 products with valid MetalType to update');
        return [];
      }

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

export async function updateProductExtendedFields({
  accessToken,
  productId,
  metalType,
  metalWeight,
}: {
  accessToken: string;
  productId: string;
  metalType: string;
  metalWeight: number;
}) {
  console.log('Updating product extended fields:', { productId, metalType, metalWeight });

  try {
    const sdk = createSdk(accessToken);
    const version = await sdk.catalogVersioning.getCatalogVersion();

    if (version.catalogVersion !== 'V3_CATALOG') {
      throw new Error('Extended fields are only supported in V3_CATALOG');
    }

    // Fetch the product to get current revision
    const product = await sdk.productsV3.getProduct(productId);

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Update product with extended fields
    const updatedProduct = await sdk.productsV3.updateProduct(productId, {
      revision: product.revision,
      extendedFields: {
        namespaces: {
          '@wixfreaks/test-shipping-example': {
            MetalType: metalType,
            MetalWeight: metalWeight,
          },
        },
      },
    });

    console.log('Successfully updated product extended fields:', updatedProduct);
    return updatedProduct;
  } catch (e) {
    console.error('Failed to update product extended fields:', e);
    throw e;
  }
}

function updateMetaTags(tags: any[], metalType: string, metalWeight: number | string) {
  return tags.map((tag) => {
    if (tag.type === 'meta' && tag.props?.name === 'MetalType') {
      return {
        ...tag,
        props: {
          ...tag.props,
          content: metalType,
        },
      };
    }
    if (tag.type === 'meta' && tag.props?.name === 'MetalWeight') {
      return {
        ...tag,
        props: {
          ...tag.props,
          content: metalWeight,
        },
      };
    }
    return tag;
  });
}

export async function bulkUpdateProductExtendedFields({
  accessToken,
  updates,
}: {
  accessToken: string;
  updates: Array<{
    productId: string;
    metalType: string;
    metalWeight: number | string;
  }>;
}) {
  console.log('Bulk updating product extended fields for', updates.length, 'products');

  try {
    const sdk = createSdk(accessToken);
    const version = await sdk.catalogVersioning.getCatalogVersion();
    const productIds = updates.map((u) => u.productId);

    if (version.catalogVersion !== 'V3_CATALOG') {
      const products = await Promise.all(
        productIds.map(async (productId) => {
          try {
            return await sdk.products.getProduct(productId);
          } catch (error) {
            console.error(`Failed to fetch product ${productId}:`, error);
            return null;
          }
        }),
      );

      // Filter out null results and prepare updates
      const validProducts = products.filter(Boolean);

      const updatedProducts = validProducts.map(async (product, index) => {
        const update = updates.find((u) => u.productId === product?.product?._id);
        if (!update || !product?.product?._id) return null;

        const productUpdatePayload = {
          ...product.product,
          seoData: {
            ...product.product.seoData,
            tags: updateMetaTags(product.product.seoData?.tags || [], update.metalType, update.metalWeight),
          },
        };
        const res = await sdk.products.updateProduct(product.product._id!, productUpdatePayload);
        return res;
      });

      console.log('Prepared products for bulk SEO tags update:', updatedProducts);
      return;
      // throw new Error('Extended fields are only supported in V3_CATALOG');
    }

    // Fetch all products to get their revisions
    const products = await Promise.all(
      productIds.map(async (productId) => {
        try {
          return await sdk.productsV3.getProduct(productId);
        } catch (error) {
          console.error(`Failed to fetch product ${productId}:`, error);
          return null;
        }
      }),
    );

    // Filter out null results and prepare bulk update payload
    const validProducts = products.filter(Boolean);
    const productsToUpdate = validProducts
      .map((product, index) => {
        const update = updates.find((u) => u.productId === product?._id);
        if (!update || !product?._id || !product?.revision) return null;

        return {
          product: {
            _id: product._id,
            revision: product.revision,
            extendedFields: {
              namespaces: {
                '@wixfreaks/test-shipping-example': {
                  MetalType: update.metalType,
                  MetalWeight: update.metalWeight,
                },
              },
            },
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    console.log('Prepared products for bulk extended fields update:', productsToUpdate);

    // Use bulkUpdateProductsWithInventory in batches of 100
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < productsToUpdate.length; i += batchSize) {
      const batch = productsToUpdate.slice(i, i + batchSize);
      const batchResult = await sdk.productsV3.bulkUpdateProductsWithInventory(batch, {});
      results.push(...(batchResult?.productResults?.results || []));
    }

    const updatedProducts = results.filter((result) => result.item).map((result) => result.item);

    console.log('Successfully bulk updated extended fields for', updatedProducts.length, 'products');
    return updatedProducts;
  } catch (e) {
    console.error('Failed to bulk update product extended fields:', e);
    throw e;
  }
}
