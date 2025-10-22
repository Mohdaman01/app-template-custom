'use client';
import { Box, Breadcrumbs, Button, Cell, Layout, Loader, Page } from '@wix/design-system';
import { useSDK } from '@/app/utils/wix-sdk.client-only';
import { useCallback, useEffect, useState } from 'react';
import { useAccessToken } from '@/app/client-hooks/access-token';
// import { ActivationDetailsCard } from '@/app/dashboard/parts/ActivationDetailsCard';
// import { ShippingDeliveryMethodForm } from '@/app/dashboard/parts/ShippingDeliveryMethodForm';
import { ShippingAppData, ShippingCosts, ShippingUnitOfMeasure } from '@/app/types/app-data.model';
// import { ShippingMethodSummary } from '@/app/dashboard/parts/ShippingMethodSummary';
import { WixPageId } from '@/app/utils/navigation.const';
import { useShippingAppData } from '@/app/client-hooks/app-data';
import { updateStoreItemPrice } from '@/app/actions/store';
import { getAppInstance } from '@/app/actions/app-data';
import testIds from '@/app/utils/test-ids';
import { UpdatePriceForm } from './UpdatePriceForm';
// import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/client';

export const ShippingRatesPageContent = ({}: {}) => {
  const {
    dashboard: { showToast, navigate },
  } = useSDK();
  // const persistShippingAppData = useSetShippingAppData();
  const { data: persistedShippingAppData, isLoading: isLoadingAppData } = useShippingAppData();
  const [currentShippingAppData, setCurrentShippingAppData] = useState<ShippingAppData | undefined>(
    persistedShippingAppData,
  );

  const [priceAppData, setPriceAppData] = useState(0);
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [silverPrice, setSilverPrice] = useState<number | null>(null);
  const [platinumPrice, setPlatinumPrice] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [currencyPrefix, setCurrencyPrefix] = useState('$');

  const accessTokenPromise = useAccessToken();

  const onSave = useCallback(() => {
    setLoading(true);
    (async () => {
      try {
        const accessToken = (await accessTokenPromise)!;
        console.log('Access Token:', accessToken);
        console.log('Price to update:', priceAppData);

        const appInstance = await getAppInstance({ accessToken });
        console.log('App Instance:', appInstance);
        const instanceId = appInstance?.instance?.instanceId;
        const supabase = createClient();

        if (!instanceId) {
          throw new Error('Missing instanceId when trying to update Dashboard Rules');
        }

        // Build payload only with values that are non-null (avoid setting columns to null accidentally)
        const payload: Record<string, any> = {};
        if (goldPrice !== null) payload.goldPrice = goldPrice;
        if (silverPrice !== null) payload.silverPrice = silverPrice;
        if (platinumPrice !== null) payload.platinumPrice = platinumPrice;

        // Try to update an existing row matching the instance_id
        const { data: rules, error } = await supabase
          .from('Dashboard Rules')
          .update(payload)
          .eq('instance_id', instanceId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Failed to update Dashboard Rules:', error);
          throw error;
        }

        console.log('Updated dashboard rule in Supabase:', rules);

        // If no row was returned, there was no matching record — upsert to create one
        // if (!rules) {
        //   const upsertRecord = { instance_id: instanceId, ...payload };
        //   const { data: upserted, error: upsertError } = await supabase
        //     .from('Dashboard Rules')
        //     .upsert(upsertRecord, { onConflict: 'instance_id' })
        //     .select()
        //     .maybeSingle();
        //   if (upsertError) {
        //     console.error('Failed to upsert Dashboard Rules:', upsertError);
        //     throw upsertError;
        //   }
        //   console.log('Upserted dashboard rule in Supabase:', upserted);
        // } else {
        //   console.log('Updated dashboard rule in Supabase:', rules);
        // }

        // await updateStoreItemPrice({ accessToken, newPrice: priceAppData });
        // showToast({
        //   message: 'Prices updated successfully.',
        //   type: 'success',
        // });
      } catch (e) {
        console.error('Error updating prices:', e);
        showToast({
          message: 'Failed to update Prices.',
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [accessTokenPromise]);

  // read site currency from client SDK when available and map to a symbol
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        // const sdk = useSDK();
        // // sdk.site may be undefined depending on runtime; guard before calling
        // // @ts-ignore
        // const currency = typeof sdk?.site?.currency === 'function' ? await sdk.site.currency() : undefined;
        // const symbolMap: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹' };
        // setCurrencyPrefix(currency && symbolMap[currency] ? symbolMap[currency] : '$');

        const accessToken = (await accessTokenPromise)!;
        const appInstance = await getAppInstance({ accessToken });
        console.log('App Instance:', appInstance);

        const instanceId = appInstance?.instance?.instanceId;

        const supabase = createClient();

        const { data: rules, error } = await supabase
          .from('Dashboard Rules')
          .select('*')
          .eq('instance_id', instanceId)
          .maybeSingle();
        console.log('Fetched dashboard rule from Supabase:', rules);
        if (rules?.goldPrice) {
          setGoldPrice(rules?.goldPrice);
        }
        if (rules?.silverPrice) {
          setSilverPrice(rules?.silverPrice);
        }
        if (rules?.platinumPrice) {
          setPlatinumPrice(rules?.platinumPrice);
        }

        if (error) {
          console.error('Webhook::install - failed to upsert dashboard rule', error);
          throw Error(error.message);
        }
      } catch (e) {
        // keep default
        console.error('Error loading site currency or app instance:', e);
      }
    };
    void loadCurrency();
  }, [accessTokenPromise]);

  const setUomForMethod = useCallback(
    (code: string) => (type: ShippingUnitOfMeasure) => {
      setCurrentShippingAppData({
        ...currentShippingAppData,
        shippingMethods: currentShippingAppData!.shippingMethods.map((m) =>
          m.code === code ? { ...m, unitOfMeasure: type } : m,
        ),
      });
    },
    [currentShippingAppData],
  );
  const setCostsForMethod = useCallback(
    (code: string) => (costs: ShippingCosts) => {
      setCurrentShippingAppData({
        ...currentShippingAppData,
        shippingMethods: currentShippingAppData!.shippingMethods.map((m) => (m.code === code ? { ...m, costs } : m)),
      });
    },
    [currentShippingAppData],
  );
  // Update the global priceAppData directly when UpdatePriceForm calls back with a number
  const setUpdatedGoldPriceForMethod = useCallback((newPrice: number) => {
    setGoldPrice(newPrice);
  }, []);
  const setUpdatedSilverPriceForMethod = useCallback((newPrice: number) => {
    setSilverPrice(newPrice);
  }, []);
  const setUpdatedPlatinumPriceForMethod = useCallback((newPrice: number) => {
    setPlatinumPrice(newPrice);
  }, []);
  const ButtonsBar = useCallback(
    () => (
      <Box gap='SP2'>
        <Button
          skin='standard'
          priority='secondary'
          onClick={() => setCurrentShippingAppData(persistedShippingAppData)}
        >
          Cancel
        </Button>
        <Button onClick={onSave}>{loading ? <Loader size='tiny' /> : 'Save'}</Button>
      </Box>
    ),
    [loading, onSave, persistedShippingAppData],
  );
  return (
    <Page height='100vh' dataHook={testIds.DASHBOARD.WRAPPER}>
      <Page.Header
        actionsBar={<ButtonsBar />}
        breadcrumbs={
          <Breadcrumbs
            activeId='2'
            items={[
              { id: WixPageId.MANAGE_APPS, value: 'Apps' },
              { id: 'shipping-app-page', value: 'Gold Prices App', disabled: true },
            ]}
            onClick={({ id }) => navigate(id as string)}
          />
        }
        title='Metal Prices'
        subtitle='Set Gold, Silver and Platinum prices globally and automatically update all product prices.'
      />
      <Page.Content>
        <Layout>
          <Cell span={8}>
            {isLoadingAppData ? (
              <Layout cols={1} alignItems='center' justifyItems='center'>
                <Cell>
                  <Box width='100%' height='20vh' verticalAlign='middle'>
                    <Loader size='large' />
                  </Box>
                </Cell>
              </Layout>
            ) : (
              <Layout>
                {/* {currentShippingAppData?.shippingMethods.map((method, index) => ( */}
                <Cell key={1}>
                  <UpdatePriceForm
                    price={goldPrice ?? 0}
                    // expandByDefault={0}
                    title='Gold Price'
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      console.log('New Price to set in store:', newPrice);
                      setUpdatedGoldPriceForMethod(newPrice);
                    }}
                    // methodType=
                  />
                </Cell>
                <Cell key={2}>
                  <UpdatePriceForm
                    // expandByDefault={0}
                    title='Silver Price'
                    price={silverPrice ?? 0}
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      console.log('New Price to set in store:', newPrice);
                      setUpdatedSilverPriceForMethod(newPrice);
                    }}
                    // methodType=
                  />
                </Cell>
                <Cell key={3}>
                  <UpdatePriceForm
                    // expandByDefault={0}
                    title='Plantinum Price'
                    price={platinumPrice ?? 0}
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      console.log('New Price to set in store:', newPrice);
                      setUpdatedPlatinumPriceForMethod(newPrice);
                    }}
                    // methodType=
                  />
                </Cell>
                {/* ))} */}
                {/* <Cell>
                  <ActivationDetailsCard />
                </Cell> */}
              </Layout>
            )}
          </Cell>
          {/* <Cell span={4}>
            <Page.Sticky>
              <ShippingMethodSummary />
            </Page.Sticky>
          </Cell> */}
        </Layout>
      </Page.Content>
    </Page>
  );
};
