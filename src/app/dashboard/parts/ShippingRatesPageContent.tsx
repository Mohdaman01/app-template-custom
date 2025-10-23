'use client';
import { Box, Breadcrumbs, Button, Cell, Layout, Loader, Page } from '@wix/design-system';
import { useSDK } from '@/app/utils/wix-sdk.client-only';
import { useCallback, useEffect, useState } from 'react';
import { useAccessToken } from '@/app/client-hooks/access-token';
import { ShippingAppData, ShippingCosts, ShippingUnitOfMeasure } from '@/app/types/app-data.model';
import { WixPageId } from '@/app/utils/navigation.const';
import { useShippingAppData } from '@/app/client-hooks/app-data';
import { updateStoreItemPrice } from '@/app/actions/store';
import { getAppInstance } from '@/app/actions/app-data';
import testIds from '@/app/utils/test-ids';
import { UpdatePriceForm } from './UpdatePriceForm';
import { createClient } from '@/app/utils/supabase/client';
import { AuthSignIn } from './AuthSignIn';

export const ShippingRatesPageContent = ({}: {}) => {
  const {
    dashboard: { showToast, navigate },
  } = useSDK();

  const { data: persistedShippingAppData, isLoading: isLoadingAppData } = useShippingAppData();
  const [currentShippingAppData, setCurrentShippingAppData] = useState<ShippingAppData | undefined>(
    persistedShippingAppData,
  );

  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [silverPrice, setSilverPrice] = useState<number | null>(null);
  const [platinumPrice, setPlatinumPrice] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
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
    } catch (e) {
      console.error('Error loading dashboard data', e);
    }
  }, [accessTokenPromise]);

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

        await updateStoreItemPrice({
          accessToken,
          goldPrice: goldPrice!,
          silverPrice: silverPrice!,
          platinumPrice: platinumPrice!,
        });
        showToast({ message: 'Prices updated successfully.', type: 'success' });
      } catch (e) {
        console.error('Error updating prices:', e);
        showToast({ message: 'Failed to update Prices.', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [accessTokenPromise, goldPrice, silverPrice, platinumPrice, showToast]);

  // initial auth check and data load
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setIsSignedIn(Boolean(data?.user));
      } catch (e) {
        console.error('Error checking auth state:', e);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // when signed in, load dashboard data
  useEffect(() => {
    if (isSignedIn) void loadDashboardData();
  }, [isSignedIn, loadDashboardData]);

  const setUomForMethod = useCallback(
    (code: string) => (type: ShippingUnitOfMeasure) => {
      setCurrentShippingAppData((prev) => ({
        ...(prev as ShippingAppData),
        shippingMethods: (prev!.shippingMethods || []).map((m) =>
          m.code === code ? { ...m, unitOfMeasure: type } : m,
        ),
      }));
    },
    [],
  );

  const setCostsForMethod = useCallback(
    (code: string) => (costs: ShippingCosts) => {
      setCurrentShippingAppData((prev) => ({
        ...(prev as ShippingAppData),
        shippingMethods: (prev!.shippingMethods || []).map((m) => (m.code === code ? { ...m, costs } : m)),
      }));
    },
    [],
  );

  const setUpdatedGoldPriceForMethod = useCallback((newPrice: number) => setGoldPrice(newPrice), []);
  const setUpdatedSilverPriceForMethod = useCallback((newPrice: number) => setSilverPrice(newPrice), []);
  const setUpdatedPlatinumPriceForMethod = useCallback((newPrice: number) => setPlatinumPrice(newPrice), []);

  const ButtonsBar = useCallback(
    () => (
      <Box gap='SP2'>
        {isSignedIn ? (
          <>
            <Button onClick={onSave}>{loading ? <Loader size='tiny' /> : 'Save'}</Button>
            <Button
              skin='standard'
              onClick={async () => {
                try {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setIsSignedIn(false);
                  showToast({ message: 'Signed out', type: 'success' });
                } catch (e) {
                  console.error('Error signing out:', e);
                  showToast({ message: 'Failed to sign out', type: 'error' });
                }
              }}
            >
              Sign out
            </Button>
          </>
        ) : null}
      </Box>
    ),
    [isSignedIn, onSave, loading, showToast],
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
            {!authChecked ? (
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
                      setIsSignedIn(true);
                      showToast({ message: 'Signed in', type: 'success' });
                    }}
                  />
                </Cell>
              </Layout>
            ) : isLoadingAppData ? (
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
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedGoldPriceForMethod(newPrice);
                    }}
                  />
                </Cell>
                <Cell key={2}>
                  <UpdatePriceForm
                    title='Silver Price'
                    price={silverPrice ?? 0}
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedSilverPriceForMethod(newPrice);
                    }}
                  />
                </Cell>
                <Cell key={3}>
                  <UpdatePriceForm
                    title='Platinum Price'
                    price={platinumPrice ?? 0}
                    unitOfMeasure={ShippingUnitOfMeasure.NUM_OF_ITEMS}
                    onUnitOfMeasureSelected={setUomForMethod('1')}
                    shippingCosts={{ gold: 0, silver: 0, platinum: 0 }}
                    onShippingCostsChanged={setCostsForMethod('1')}
                    updateStoreItemPrice={async (newPrice: number) => {
                      setUpdatedPlatinumPriceForMethod(newPrice);
                    }}
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
