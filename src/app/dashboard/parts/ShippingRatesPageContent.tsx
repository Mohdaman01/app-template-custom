'use client';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  Cell,
  FormField,
  Layout,
  Loader,
  Page,
  Text,
  ToggleSwitch,
  Dropdown,
} from '@wix/design-system';
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
import { useMetalPrices } from '@/app/client-hooks/metal-prices';
import { AdditionalCostForm } from './AdditionalCostForm';
// import { AuthSignIn } from './AuthSignIn';
// import { useSupabaseAuth } from '@/app/client-hooks/useSupabaseAuth';

const CURRENCY_OPTIONS = [
  { id: 'USD', value: 'USD - US Dollar' },
  { id: 'EUR', value: 'EUR - Euro' },
  { id: 'GBP', value: 'GBP - British Pound' },
  { id: 'INR', value: 'INR - Indian Rupee' },
  { id: 'AUD', value: 'AUD - Australian Dollar' },
  { id: 'CAD', value: 'CAD - Canadian Dollar' },
  { id: 'JPY', value: 'JPY - Japanese Yen' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
};

export const ShippingRatesPageContent = ({}: {}) => {
  const {
    dashboard: { showToast, navigate },
  } = useSDK();

  const [mainLoading, setMainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appInstance, setAppInstance] = useState<any>(null);
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [silverPrice, setSilverPrice] = useState<number | null>(null);
  const [platinumPrice, setPlatinumPrice] = useState<number | null>(null);
  const [productsToSet, setProductsToSet] = useState<any[]>([]);
  const [productUpdates, setProductUpdates] = useState<
    Array<{ productId: string; metalType: string; metalWeight: number | string }>
  >([]);
  const [additionalCosts, setAdditionalCosts] = useState<any[]>([]);
  const [isProUser, setIsProUser] = useState(false);

  const [loading, setLoading] = useState(false);
  const [extendedFieldsLoading, setExtendedFieldsLoading] = useState(false);
  const [saveExtendedFieldsBtnDisabled, setSaveExtendedFieldsBtnDisabled] = useState(true);
  const [useAutoPricing, setUseAutoPricing] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [lastApiUpdate, setLastApiUpdate] = useState<string | null>(null);
  const [currencyPrefix, setCurrencyPrefix] = useState('$');
  // const { isSignedIn, loading: authLoading, signOut } = useSupabaseAuth();
  // const [currencyPrefix, setCurrencyPrefix] = useState('$');

  const accessTokenPromise = useAccessToken();
  const { fetchPrices, loading: pricesLoading, error: pricesError, lastFetch, isFromCache } = useMetalPrices();

  const loadDashboardData = useCallback(async () => {
    try {
      const supabase = createClient();
      const accessToken = (await accessTokenPromise)!;
      const appInstance = await getAppInstance({ accessToken });

      if (!appInstance || !appInstance.instance?.instanceId) {
        setError('Failed to get app instance. Please ensure the app is installed correctly.');
        setMainLoading(false);
        return;
      }

      const sitePaymentCurrency = appInstance.site?.paymentCurrency || 'USD';
      console.log('Site payment currency: ', sitePaymentCurrency, ' and Symbol', CURRENCY_SYMBOLS[sitePaymentCurrency]);
      const instanceId = appInstance.instance.instanceId;
      setAppInstance(appInstance);

      const { data: rules, error: dbError } = await supabase
        .from('Dashboard Rules')
        .select('*, "Additional Costs"(*)')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (dbError) {
        console.error('Failed to fetch dashboard rules', dbError);
        setError(`Failed to fetch app settings: ${dbError.message}`);
        setMainLoading(false);
        return;
      }

      console.log('Loaded dashboard rules:', rules);

      if (rules && !rules.currency) {
        const { error: updateError } = await supabase
          .from('Dashboard Rules')
          .update({ currency: sitePaymentCurrency })
          .eq('instance_id', instanceId)
          .select()
          .maybeSingle();
        if (updateError) {
          console.warn('Failed to update currency automatically', updateError);
        } else {
          console.log('Updated currency to site currency');
          setSelectedCurrency(sitePaymentCurrency);
          setCurrencyPrefix(CURRENCY_SYMBOLS[sitePaymentCurrency] || '$');
        }
      }

      if (rules) {
        if (rules.goldPrice) setGoldPrice(rules.goldPrice);
        if (rules.silverPrice) setSilverPrice(rules.silverPrice);
        if (rules.platinumPrice) setPlatinumPrice(rules.platinumPrice);
        if (rules.pro_user) setIsProUser(rules.pro_user);
        if (rules.currency) setSelectedCurrency(rules.currency);
        if (rules['Additional Costs'] && rules['Additional Costs'].length > 0) {
          setAdditionalCosts(rules['Additional Costs']);
        }
        setUseAutoPricing(!!rules.use_auto_pricing);
        if (rules.last_api_update) setLastApiUpdate(rules.last_api_update);
        const currency = rules.currency || sitePaymentCurrency;
        setSelectedCurrency(currency);
        setCurrencyPrefix(CURRENCY_SYMBOLS[currency] || '$');
      } else {
        setSelectedCurrency(sitePaymentCurrency);
        setCurrencyPrefix(CURRENCY_SYMBOLS[sitePaymentCurrency] || '$');
      }

      const products = await getStoreItemsPrices({ accessToken });
      console.log('Fetched store products for dashboard:', products);
      if (products) {
        setProductsToSet(products);
      } else {
        setError(
          'Could not fetch store products. Please ensure the Wix Stores app is installed and you have products in your store.',
        );
        setMainLoading(false);
        return;
      }
      setMainLoading(false);
    } catch (e) {
      console.error('Error loading dashboard data', e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred while loading data.');
      setMainLoading(false);
    }
  }, [accessTokenPromise]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleFetchLivePrices = async (autoPricingEnabled: boolean) => {
    // Pass useDatabase=true when auto-pricing is enabled
    console.log('Selected Currency: ', selectedCurrency);

    if (!autoPricingEnabled) {
      console.log('autoPriceingEnabled inside of if : ', autoPricingEnabled);

      const accessToken = (await accessTokenPromise)!;
      const appInstance = await getAppInstance({ accessToken });
      const instanceId = appInstance?.instance?.instanceId;
      const supabase = createClient();

      await supabase
        .from('Dashboard Rules')
        .update({
          use_auto_pricing: false,
        })
        .eq('instance_id', instanceId);

      showToast({ message: 'Automatic Pricing is disabled.', type: 'success' });
      return;
    }

    console.log('autoPriceingEnabled outside of if : ', autoPricingEnabled);

    const prices = await fetchPrices(selectedCurrency, useAutoPricing);
    if (prices) {
      setGoldPrice(prices.goldPrice);
      setSilverPrice(prices.silverPrice);
      setPlatinumPrice(prices.platinumPrice);
      setLastApiUpdate(new Date().toISOString());

      let message = '';
      if (prices.fromDatabase) {
        message = `Prices loaded from database (${prices.currency}). Last updated ${prices.ageHours} hours ago. Next automatic update in ${prices.nextUpdateIn}.`;
      } else if (prices.fromCache) {
        message = `Prices loaded from cache (${prices.currency}). Next API call available after ${new Date(prices.expiresAt!).toLocaleTimeString()}`;
      } else {
        message = `Fresh prices fetched from API (${prices.currency}). Valid for 1 hour.`;
      }

      showToast({
        message,
        type: 'success',
      });

      // Save to Dashboard Rules
      const accessToken = (await accessTokenPromise)!;
      const appInstance = await getAppInstance({ accessToken });
      const instanceId = appInstance?.instance?.instanceId;
      const supabase = createClient();

      const { data: rules, error } = await supabase
        .from('Dashboard Rules')
        .update({
          goldPrice: prices.goldPrice,
          silverPrice: prices.silverPrice,
          platinumPrice: prices.platinumPrice,
          // currency: selectedCurrency,
          use_auto_pricing: true,
          last_api_update: new Date().toISOString(),
        })
        .eq('instance_id', instanceId)
        .select('*, "Additional Costs"(*)')
        .maybeSingle();

      if (error) {
        console.error('Failed to update Dashboard Rules with live prices:', error);
        showToast({ message: `Error saving prices: ${error.message}`, type: 'error' });
        return;
      }

      if (!rules) {
        showToast({ message: 'Could not find dashboard rules to update.', type: 'error' });
        return;
      }

      console.log('Updated Dashboard Rules with live prices:', rules);

      const result = await updateStoreItemPrice({
        accessToken,
        goldPrice: prices.goldPrice,
        silverPrice: prices.silverPrice,
        platinumPrice: prices.platinumPrice,
        additionalCosts: rules['Additional Costs'],
      });

      console.log('Updated store item prices with live prices:', result);
      showToast({ message: 'Prices and product details updated successfully.', type: 'success' });
    } else if (pricesError) {
      showToast({
        message: `Failed to update live prices: ${pricesError}`,
        type: 'error',
      });
    }
  };

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
        // if (lastApiUpdate) payload.last_api_update = lastApiUpdate;

        const { data: rules, error } = await supabase
          .from('Dashboard Rules')
          .update(payload)
          .eq('instance_id', instanceId)
          .select('*, "Additional Costs"(*)')
          .maybeSingle();

        if (error) throw error;

        console.log('Data from updated row: ', rules);

        // Update store item prices
        await updateStoreItemPrice({
          accessToken,
          goldPrice: goldPrice!,
          silverPrice: silverPrice!,
          platinumPrice: platinumPrice!,
          additionalCosts: rules['Additional Costs'],
        });

        const products = await getStoreItemsPrices({ accessToken });
        console.log('Fetched store products for dashboard:', products);
        if (products) {
          setProductsToSet(products);
        }

        showToast({ message: 'Prices and product details updated successfully.', type: 'success' });
      } catch (e) {
        console.error('Error updating prices:', e);
        showToast({ message: 'Failed to update Prices.', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [
    accessTokenPromise,
    goldPrice,
    silverPrice,
    platinumPrice,
    productUpdates,
    showToast,
    selectedCurrency,
    useAutoPricing,
    lastApiUpdate,
  ]);

  const saveExtendedFields = useCallback(async () => {
    setExtendedFieldsLoading(true);
    (async () => {
      try {
        const accessToken = (await accessTokenPromise)!;
        // Bulk update product extended fields
        if (productUpdates.length > 0) {
          await bulkUpdateProductExtendedFields({
            accessToken,
            updates: productUpdates,
          });
        }
        setSaveExtendedFieldsBtnDisabled(true);
        showToast({ message: 'Product details updated successfully.', type: 'success' });
      } catch (e) {
        console.error('Error updating product details:', e);
        showToast({ message: 'Failed to update product details.', type: 'error' });
      } finally {
        setExtendedFieldsLoading(false);
      }
    })();
  }, [accessTokenPromise, productUpdates, showToast]);

  // auth is handled by useSupabaseAuth hook which subscribes to auth state and visibility

  // when signed in, load dashboard data
  // useEffect(() => {
  //   if (isSignedIn) void loadDashboardData();
  // }, [isSignedIn, loadDashboardData]);

  const setUpdatedGoldPriceForMethod = useCallback((newPrice: number) => setGoldPrice(newPrice), []);
  const setUpdatedSilverPriceForMethod = useCallback((newPrice: number) => setSilverPrice(newPrice), []);
  const setUpdatedPlatinumPriceForMethod = useCallback((newPrice: number) => setPlatinumPrice(newPrice), []);

  const handleProductUpdatesChanged = useCallback(
    (updates: Array<{ productId: string; metalType: string; metalWeight: number | string }>) => {
      setProductUpdates(updates);
      setSaveExtendedFieldsBtnDisabled(false);
    },
    [],
  );

  const ButtonsBar = useCallback(
    () => (
      <Box gap='SP3'>
        {/* {isSignedIn ? ( */}
        {!error && !mainLoading && (
          <>
            {!isProUser && <Button onClick={() => navigate(WixPageId.MANAGE_APPS)}>Upgrade to Pro</Button>}
            <Button onClick={onSave} disabled={useAutoPricing}>
              {loading ? <Loader size='tiny' /> : 'Save'}
            </Button>
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
        )}
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

  const addAdditionalCost = (costName: string, cost: number | string) => {
    // Handle additional costs change
    const instanceId = appInstance?.instance?.instanceId;
    console.log('Additional cost changed for ', instanceId, ' costName: ', costName, ' cost: ', cost);

    const supabase = createClient();
    // Update additional costs in Dashboard Rules
    (async () => {
      const { data: rules, error } = await supabase
        .from('Additional Costs')
        .upsert({
          cost: cost,
          cost_name: costName,
          instance_id: instanceId,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Failed to update additional cost', error);
        showToast({ message: `Failed to add cost: ${error.message}`, type: 'error' });
        return;
      }
      console.log('Updated additional cost:', rules);
      setAdditionalCosts((prevCosts) => (prevCosts ? [rules, ...prevCosts] : [rules]));
    })();
  };

  const deleteAdditionalCost = (costId: number) => {
    const instanceId = appInstance?.instance?.instanceId;
    console.log('Deleting additional cost for ', instanceId, ' costId: ', costId);

    const supabase = createClient();
    // Delete additional cost in Dashboard Rules
    (async () => {
      const { error } = await supabase.from('Additional Costs').delete().eq('id', costId).eq('instance_id', instanceId);

      if (error) {
        console.error('Failed to delete additional cost', error);
        showToast({ message: `Failed to delete cost: ${error.message}`, type: 'error' });
        return;
      }
      console.log('Deleted additional cost with id:', costId);
      setAdditionalCosts((prevCosts) => prevCosts.filter((cost) => cost.id !== costId));
    })();
  };

  return (
    <Page height='100vh'>
      <Page.Header
        actionsBar={<ButtonsBar />}
        breadcrumbs={
          <Breadcrumbs
            activeId='2'
            items={[
              { id: WixPageId.MANAGE_APPS, value: 'Apps' },
              { id: 'gold-price-pro', value: 'Gold Prices App', disabled: true },
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
            {error && (
              <Layout>
                <Cell>
                  <Box direction='vertical' gap='SP2'>
                    <Text weight='bold' skin='error'>
                      {error}
                    </Text>
                    <Text>
                      If the problem persists, ensure the Wix Stores app is installed and try reinstalling this app.
                    </Text>
                  </Box>
                </Cell>
              </Layout>
            )}
            {!error && mainLoading && (
              <Layout cols={1} alignItems='center' justifyItems='center'>
                <Cell>
                  <Box width='100%' height='20vh' verticalAlign='middle'>
                    <Loader size='large' />
                  </Box>
                </Cell>
              </Layout>
            )}
            {!error && !mainLoading && (
              <Layout>
                {/* Live Price Fetching Card */}
                {isProUser && (
                  <Cell>
                    <Card>
                      <Card.Header title='Automatic Price Updates' />
                      <Card.Divider />
                      <Card.Content>
                        <Box direction='vertical' gap='SP4'>
                          <FormField
                            label='Enable Automatic Pricing'
                            infoContent='When enabled, you can fetch live metal prices.'
                          >
                            <ToggleSwitch
                              checked={useAutoPricing}
                              onChange={async () => {
                                const newValue = !useAutoPricing;
                                setUseAutoPricing(newValue);
                                console.log('Toggled newValue outside if: ', newValue);
                                await handleFetchLivePrices(newValue);
                              }}
                            />
                          </FormField>

                          {useAutoPricing && (
                            <>
                              <Layout>
                                <Cell span={6}>
                                  <FormField label='Currency'>
                                    <Dropdown
                                      disabled={true}
                                      options={CURRENCY_OPTIONS}
                                      selectedId={selectedCurrency}
                                      onSelect={(option) => setSelectedCurrency(option.id as string)}
                                    />
                                  </FormField>
                                </Cell>
                                {/* <Cell span={6}>
                                <FormField label='Fetch Live Prices'>
                                  <Button
                                    onClick={handleFetchLivePrices}
                                    disabled={pricesLoading}
                                    prefixIcon={pricesLoading ? <Loader size='tiny' /> : undefined}
                                  >
                                    {pricesLoading ? 'Fetching...' : 'Fetch Now'}
                                  </Button>
                                </FormField>
                              </Cell> */}
                              </Layout>

                              {lastApiUpdate && (
                                <Box direction='vertical' gap='SP1'>
                                  <Text size='small' secondary>
                                    Last fetched: {new Date(lastApiUpdate).toLocaleString()}
                                  </Text>
                                  {isFromCache && (
                                    <Text size='small' skin='success'>
                                      ✓ Loaded from cache (API calls limited to once per hour)
                                    </Text>
                                  )}
                                </Box>
                              )}

                              {pricesError && (
                                <Text size='small' skin='error'>
                                  Error: {pricesError}
                                </Text>
                              )}
                            </>
                          )}
                        </Box>
                      </Card.Content>
                    </Card>
                  </Cell>
                )}
                {/* Manual Price Entry Forms */}
                <Cell key={1}>
                  <UpdatePriceForm
                    goldPrice={goldPrice ?? 0}
                    silverPrice={silverPrice ?? 0}
                    platinumPrice={platinumPrice ?? 0}
                    title='Set Metal Prices'
                    updateStoreItemPriceGold={async (newPrice: number) => {
                      setUpdatedGoldPriceForMethod(newPrice);
                    }}
                    updateStoreItemPriceSilver={async (newPrice: number) => {
                      setUpdatedSilverPriceForMethod(newPrice);
                    }}
                    updateStoreItemPricePlatinum={async (newPrice: number) => {
                      setUpdatedPlatinumPriceForMethod(newPrice);
                    }}
                    prefix={currencyPrefix}
                    disabled={useAutoPricing ? true : false}
                  />
                </Cell>
                {isProUser && (
                  <Cell key={2}>
                    <AdditionalCostForm
                      title='Set Additional Costs to Include in Product Price Calculation'
                      prefix={currencyPrefix}
                      disabled={false}
                      addAdditionalCost={addAdditionalCost}
                      additionalCosts={additionalCosts}
                      deleteAdditionalCost={deleteAdditionalCost}
                    />
                  </Cell>
                )}
                <Cell key={3}>
                  <StoreProductsMetalTypeAndWeight
                    title='Set Current Products (Metal type/Weight in grams)'
                    productsToSet={productsToSet}
                    onProductUpdatesChanged={handleProductUpdatesChanged}
                    saveExtendedFields={saveExtendedFields}
                    extendedFieldsLoading={extendedFieldsLoading}
                    prefix={currencyPrefix}
                    saveExtendedFieldsBtnDisabled={saveExtendedFieldsBtnDisabled}
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
