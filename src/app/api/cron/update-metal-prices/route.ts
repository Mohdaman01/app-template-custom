// src/app/api/cron/update-metal-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createClient } from '@/app/utils/supabase/server';
import { createClient as wixClient } from '@wix/sdk/client';
import { AppStrategy } from '@wix/sdk';
import { products, productsV3, catalogVersioning } from '@wix/stores';

async function getAllProducts(myClient: any) {
  let allProducts: any[] = [];
  let queryResult = await myClient.productsV3.queryProducts().find();

  allProducts = allProducts.concat(queryResult.items);

  while (queryResult.hasNext()) {
    queryResult = await queryResult.next();
    allProducts = allProducts.concat(queryResult.items);
  }

  return allProducts;
}

const calculatePrice = (
  metalType: string,
  metalWeight: number,
  goldPrice: number,
  silverPrice: number,
  platinumPrice: number,
  additionalCosts: any[],
): number => {
  const normalizedMetalType = metalType?.toUpperCase();

  const totalAdditonalCost = additionalCosts.reduce((sum, cost) => sum + Number(cost.cost || 0), 0);
  console.log('TotalAdditonalCost: ', totalAdditonalCost);

  if (normalizedMetalType === 'GOLD') {
    return goldPrice * metalWeight + totalAdditonalCost;
  } else if (normalizedMetalType === 'SILVER') {
    return silverPrice * metalWeight + totalAdditonalCost;
  } else if (normalizedMetalType === 'PLATINUM') {
    return platinumPrice * metalWeight + totalAdditonalCost;
  }

  return 0;
};

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.METAL_PRICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Metal price API not configured' }, { status: 503 });
    }

    console.log('[CRON] Starting metal prices update job');

    const baseCurrency = 'INR';
    console.log(`[CRON] Fetching prices in ${baseCurrency} with all currency rates`);

    const response = await fetch(`https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=${baseCurrency}&unit=g`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('API request failed');
    }

    const baseGoldPrice = data.metals.gold;
    const baseSilverPrice = data.metals.silver;
    const basePlatinumPrice = data.metals.platinum;
    const currencyRates = data.currencies;
    const apiTimestamp = data.timestamps.metal;
    const fetchedAt = new Date().toISOString();

    const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY'];
    const cookieStore = await cookies();
    const supabase = createServiceClient ? createServiceClient(cookieStore) : createClient(cookieStore);

    const results = await Promise.allSettled(
      currencies.map(async (currency) => {
        try {
          console.log(`[CRON] Calculating prices for ${currency}`);

          const conversionRate = currency === baseCurrency ? 1 : currencyRates[currency] || 1;

          const goldPrice = Number((baseGoldPrice / conversionRate).toFixed(2));
          const silverPrice = Number((baseSilverPrice / conversionRate).toFixed(2));
          const platinumPrice = Number((basePlatinumPrice / conversionRate).toFixed(2));

          const priceRecord = {
            currency,
            gold_price: goldPrice,
            silver_price: silverPrice,
            platinum_price: platinumPrice,
            api_timestamp: apiTimestamp,
            fetched_at: fetchedAt,
          };

          const { error: upsertError } = await supabase
            .from('metal_prices')
            .upsert(priceRecord, { onConflict: 'currency' });

          if (upsertError) {
            throw new Error(`Failed to store prices for ${currency}: ${upsertError.message}`);
          }

          const updateUserPrices = await supabase
            .from('Dashboard Rules')
            .update({
              goldPrice: priceRecord.gold_price,
              silverPrice: priceRecord.silver_price,
              platinumPrice: priceRecord.platinum_price,
              last_api_update: priceRecord.fetched_at,
            })
            .eq('use_auto_pricing', true)
            .eq('pro_user', true)
            .eq('currency', currency);

          if (updateUserPrices.error) {
            throw new Error(`Failed to update user prices for ${currency}: ${updateUserPrices.error.message}`);
          }

          console.log(`[CRON] Successfully updated prices for ${currency}`);
          return { currency, success: true };
        } catch (error) {
          console.error(`[CRON] Failed to update prices for ${currency}:`, error);
          return { currency, success: false, error: String(error) };
        }
      }),
    );

    // Updating product prices for pro users with auto pricing enabled
    const productUpdateResults: { userId: string; success: boolean; error?: string; productsUpdated?: number }[] = [];

    try {
      const { data: proUsers, error: err } = await supabase
        .from('Dashboard Rules')
        .select('*,"Additional Costs"(*)')
        .eq('pro_user', true)
        .eq('use_auto_pricing', true);

      if (err) {
        console.error('Error fetching pro users:', err);
      } else {
        console.log(`[CRON] Found ${proUsers?.length || 0} pro users with auto pricing enabled`);

        for (const user of proUsers || []) {
          try {
            const instanceId = user.instance_id;
            console.log(`[CRON] Processing user: ${instanceId}`);

            const tempAppClient = wixClient({
              auth: AppStrategy({
                appId: process.env.WIX_APP_ID!,
                appSecret: process.env.WIX_APP_SECRET!,
                publicKey: process.env.WIX_APP_JWT_KEY,
                instanceId: instanceId,
              }),
              modules: { products, productsV3, catalogVersioning },
            });

            const allProducts = await getAllProducts(tempAppClient);
            const { catalogVersion } = await tempAppClient.catalogVersioning.getCatalogVersion();

            console.log(`[CRON] User ${instanceId} has catalog version: ${catalogVersion}`);

            if (catalogVersion === 'V1_CATALOG') {
              const productsToUpdate = allProducts
                .map((product) => {
                  try {
                    const productWithExtendedFields = product as any;
                    const tags = productWithExtendedFields.seoData?.tags || [];

                    const metalTypeTag = tags.find((tag: any) => tag.props?.name === 'MetalType');
                    const metalWeightTag = tags.find((tag: any) => tag.props?.name === 'MetalWeight');

                    const metalType = metalTypeTag?.props?.content || '';
                    const metalWeight = parseFloat(metalWeightTag?.props?.content) || 0;

                    const normalizedMetalType = metalType?.toUpperCase();
                    if (!normalizedMetalType || !['GOLD', 'SILVER', 'PLATINUM'].includes(normalizedMetalType)) {
                      return null;
                    }

                    const newPrice = calculatePrice(
                      metalType,
                      metalWeight,
                      user.goldPrice,
                      user.silverPrice,
                      user.platinumPrice,
                      user['Additional Costs'] || [],
                    );

                    return {
                      ...product,
                      priceData: {
                        ...product.priceData,
                        price: newPrice,
                      },
                      lastUpdated: new Date(),
                    };
                  } catch (error) {
                    console.error(`[CRON] Error processing V1 product ${product._id}:`, error);
                    return null;
                  }
                })
                .filter((product): product is NonNullable<typeof product> => product !== null);

              console.log(
                `[CRON] Updating ${productsToUpdate.length} out of ${allProducts.length} V1 products with valid MetalType`,
              );

              await Promise.all(
                productsToUpdate.map((product) =>
                  tempAppClient.products.updateProduct(product._id!, {
                    priceData: product.priceData,
                  }),
                ),
              );

              productUpdateResults.push({
                userId: instanceId,
                success: true,
                productsUpdated: productsToUpdate.length,
              });

              console.log(`[CRON] Updated ${productsToUpdate.length} V1 products for user ${instanceId}`);
            } else if (catalogVersion === 'V3_CATALOG') {
              const items = await getAllProducts(tempAppClient);
              const productIds = items.map((item) => item._id).filter(Boolean) as string[];

              console.log(`[CRON] Fetched ${productIds.length} V3 product IDs`);

              const fullProducts = await Promise.all(
                productIds.map(async (productId) => {
                  try {
                    const productData = await tempAppClient.productsV3.getProduct(productId, {
                      fields: ['VARIANT_OPTION_CHOICE_NAMES'],
                    });
                    return productData;
                  } catch (error) {
                    console.error(`[CRON] Failed to fetch product ${productId}:`, error);
                    return null;
                  }
                }),
              );

              const validProducts = fullProducts.filter(Boolean);
              console.log(`[CRON] Fetched ${validProducts.length} full V3 products`);

              const productsToUpdate = validProducts
                .map((product) => {
                  try {
                    const metalType =
                      product?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType || '';
                    const metalWeight =
                      parseFloat(
                        product?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight,
                      ) || 0;

                    const normalizedMetalType = (metalType as string)?.toUpperCase();
                    if (!normalizedMetalType || !['GOLD', 'SILVER', 'PLATINUM'].includes(normalizedMetalType)) {
                      return null;
                    }

                    const newPrice = calculatePrice(
                      metalType as string,
                      metalWeight,
                      user.goldPrice,
                      user.silverPrice,
                      user.platinumPrice,
                      user['Additional Costs'] || [],
                    );

                    const variants = product?.variantsInfo?.variants || [];

                    const updatedVariants = variants.map((variant) => {
                      return {
                        _id: variant._id,
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
                            amount: newPrice.toFixed(2).toString(),
                          },
                        },
                        ...(variant.sku && { sku: variant.sku }),
                        ...(variant.barcode && { barcode: variant.barcode }),
                        ...(variant.visible !== undefined && { visible: variant.visible }),
                      };
                    });

                    return {
                      product: {
                        _id: product?._id,
                        revision: product?.revision,
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
                  } catch (error) {
                    console.error(`[CRON] Error processing V3 product ${product?._id}:`, error);
                    return null;
                  }
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

              console.log(
                `[CRON] Prepared ${productsToUpdate.length} out of ${validProducts.length} V3 products for bulk update`,
              );

              if (productsToUpdate.length === 0) {
                console.log('[CRON] No V3 products with valid MetalType to update');
                productUpdateResults.push({
                  userId: instanceId,
                  success: true,
                  productsUpdated: 0,
                });
                continue;
              }

              const batchSize = 100;
              const batchResults = [];

              for (let i = 0; i < productsToUpdate.length; i += batchSize) {
                const batch = productsToUpdate.slice(i, i + batchSize);
                const batchResult = await tempAppClient.productsV3.bulkUpdateProductsWithInventory(batch, {});
                batchResults.push(...(batchResult?.productResults?.results || []));
              }

              const updatedProducts = batchResults.filter((result) => result.item).map((result) => result.item);

              productUpdateResults.push({
                userId: instanceId,
                success: true,
                productsUpdated: updatedProducts.length,
              });

              console.log(`[CRON] Successfully updated ${updatedProducts.length} V3 products for user ${instanceId}`);
            }
          } catch (error) {
            console.error(`[CRON] Error updating products for user ${user.instance_id}:`, error);
            productUpdateResults.push({
              userId: user.instance_id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (err) {
      console.error('[CRON] Error in product update section:', err);
    }

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    const productsUpdatedCount = productUpdateResults.reduce((sum, r) => sum + (r.productsUpdated || 0), 0);
    const usersUpdated = productUpdateResults.filter((r) => r.success).length;

    console.log(`[CRON] Metal prices update completed: ${successful} successful, ${failed} failed`);
    console.log(`[CRON] Product updates: ${productsUpdatedCount} products updated for ${usersUpdated} users`);

    return NextResponse.json({
      success: true,
      message: `Updated prices for ${successful}/${results.length} currencies`,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason })),
      productUpdates: {
        usersProcessed: productUpdateResults.length,
        usersSuccessful: usersUpdated,
        totalProductsUpdated: productsUpdatedCount,
        details: productUpdateResults,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Fatal error in metal prices update:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update metal prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
