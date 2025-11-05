'use client';
import { Box, Breadcrumbs, Button, Cell, Layout, Loader, Page } from '@wix/design-system';
import { useSDK } from '@/app/utils/wix-sdk.client-only';
import { useCallback, useEffect, useState } from 'react';
import { useAccessToken } from '@/app/client-hooks/access-token';
import { WixPageId } from '@/app/utils/navigation.const';
import { useShippingAppData } from '@/app/client-hooks/app-data';
import { getStoreItemsPrices, updateStoreItemPrice, bulkUpdateProductExtendedFields } from '@/app/actions/store';
import { getAppInstance } from '@/app/actions/app-data';
import testIds from '@/app/utils/test-ids';
import { UpdatePriceForm } from './UpdatePriceForm';
import { StoreProductsMetalTypeAndWeight } from './StoreProductsMetalTypeAndWight';
import { createClient } from '@/app/utils/supabase/client';
import { AuthSignIn } from './AuthSignIn';
import { useSupabaseAuth } from '@/app/client-hooks/useSupabaseAuth';

export const ShippingRatesPageContent = ({}: {}) => {
  const {
    dashboard: { showToast, navigate },
  } = useSDK();

  const { isLoading: isLoadingAppData } = useShippingAppData();

  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [silverPrice, setSilverPrice] = useState<number | null>(null);
  const [platinumPrice, setPlatinumPrice] = useState<number | null>(null);
  const [productsToSet, setProductsToSet] = useState<any[]>([]);
  const [productUpdates, setProductUpdates] = useState<
    Array<{ productId: string; metalType: string; metalWeight: number }>
  >([]);

  const [loading, setLoading] = useState(false);
  // const { isSignedIn, loading: authLoading, signOut } = useSupabaseAuth();
  // const [currencyPrefix, setCurrencyPrefix] = useState('$');

  const accessTokenPromise = useAccessToken();

  const loadDashboardData = useCallback(async () => {
    try {
      const accessToken = (await accessTokenPromise)!;
      const appInstance = await getAppInstance({ accessToken });
      const instanceId = appInstance?.instance?.instanceId;
      const supabase = createClient();
      const { data: rules, error } = await supabase
        .from('Dashboard Rules')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch dashboard rules', error);
        return;
      }

      if (rules?.goldPrice) setGoldPrice(rules.goldPrice);
      if (rules?.silverPrice) setSilverPrice(rules.silverPrice);
      if (rules?.platinumPrice) setPlatinumPrice(rules.platinumPrice);

      const products = await getStoreItemsPrices({ accessToken });
      console.log('Fetched store products for dashboard:', products);
      if (products) {
        setProductsToSet(products);
      }
    } catch (e) {
      console.error('Error loading dashboard data', e);
    }
  }, [accessTokenPromise]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const onSave = useCallback(() => {
    setLoading(true);
    (async () => {
      try {
        const accessToken = (await accessTokenPromise)!;
        const appInstance = await getAppInstance({ accessToken });
        const instanceId = appInstance?.instance?.instanceId;
        const supabase = createClient();

        if (!instanceId) throw new Error('Missing instanceId when trying to update Dashboard Rules');

        const payload: Record<string, any> = {};
        if (goldPrice !== null) payload.goldPrice = goldPrice;
        if (silverPrice !== null) payload.silverPrice = silverPrice;
        if (platinumPrice !== null) payload.platinumPrice = platinumPrice;

        const { data: rules, error } = await supabase
          .from('Dashboard Rules')
          .update(payload)
          .eq('instance_id', instanceId)
          .select()
          .maybeSingle();

        if (error) throw error;

        // Bulk update product extended fields
        if (productUpdates.length > 0) {
          await bulkUpdateProductExtendedFields({
            accessToken,
            updates: productUpdates,
          });
        }

        // Update store item prices
        await updateStoreItemPrice({
          accessToken,
          goldPrice: goldPrice!,
          silverPrice: silverPrice!,
          platinumPrice: platinumPrice!,
        });

        showToast({ message: 'Prices and product details updated successfully.', type: 'success' });
      } catch (e) {
        console.error('Error updating prices:', e);
        showToast({ message: 'Failed to update Prices.', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [accessTokenPromise, goldPrice, silverPrice, platinumPrice, productUpdates, showToast]);

  // auth is handled by useSupabaseAuth hook which subscribes to auth state and visibility

  // when signed in, load dashboard data
  // useEffect(() => {
  //   if (isSignedIn) void loadDashboardData();
  // }, [isSignedIn, loadDashboardData]);

  const setUpdatedGoldPriceForMethod = useCallback((newPrice: number) => setGoldPrice(newPrice), []);
  const setUpdatedSilverPriceForMethod = useCallback((newPrice: number) => setSilverPrice(newPrice), []);
  const setUpdatedPlatinumPriceForMethod = useCallback((newPrice: number) => setPlatinumPrice(newPrice), []);

  const handleProductUpdatesChanged = useCallback(
    (updates: Array<{ productId: string; metalType: string; metalWeight: number }>) => {
      setProductUpdates(updates);
    },
    [],
  );

  const ButtonsBar = useCallback(
    () => (
      <Box gap='SP2'>
        {/* {isSignedIn ? ( */}
        <>
          <Button onClick={onSave}>{loading ? <Loader size='tiny' /> : 'Save'}</Button>
          {/* <Button
              skin='standard'
              onClick={async () => {
                try {
                  await signOut();
                  showToast({ message: 'Signed out', type: 'success' });
                } catch (e) {
                  console.error('Error signing out:', e);
                  showToast({ message: 'Failed to sign out', type: 'error' });
                }
              }}
            >
              Sign out
            </Button> */}
        </>
        {/* ) : null} */}
      </Box>
    ),
    [
      // isSignedIn,
      onSave,
      loading,
      showToast,
      // signOut
    ],
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
            {/* {authLoading ? (
              <Layout cols={1} alignItems='center' justifyItems='center'>
                <Cell>
                  <Box width='100%' height='20vh' verticalAlign='middle'>
                    <Loader size='large' />
                  </Box>
                </Cell>
              </Layout>
            ) : !isSignedIn ? (
              <Layout cols={1} alignItems='center' justifyItems='center'>
                <Cell>
                  <AuthSignIn
                    onSuccess={() => {
                      // auth hook will pick up new session and update state
                      showToast({ message: 'Signed in', type: 'success' });
                    }}
                  />
                </Cell>
              </Layout>
            ) :  */}
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
                <Cell key={1}>
                  <UpdatePriceForm
                    price={goldPrice ?? 0}
                    title='Gold Price'
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedGoldPriceForMethod(newPrice);
                    }}
                  />
                </Cell>
                <Cell key={2}>
                  <UpdatePriceForm
                    title='Silver Price'
                    price={silverPrice ?? 0}
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedSilverPriceForMethod(newPrice);
                    }}
                  />
                </Cell>
                <Cell key={3}>
                  <UpdatePriceForm
                    title='Platinum Price'
                    price={platinumPrice ?? 0}
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedPlatinumPriceForMethod(newPrice);
                    }}
                  />
                </Cell>
                <Cell key={4}>
                  <StoreProductsMetalTypeAndWeight
                    title='Current Products'
                    productsToSet={productsToSet}
                    onProductUpdatesChanged={handleProductUpdatesChanged}
                  />
                </Cell>
              </Layout>
            )}
          </Cell>
        </Layout>
      </Page.Content>
    </Page>
  );
};
