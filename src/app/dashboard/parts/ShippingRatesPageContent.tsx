'use client';
import { Box, Breadcrumbs, Button, Cell, Layout, Loader, Page } from '@wix/design-system';
import { useSDK } from '@/app/utils/wix-sdk.client-only';
import { useCallback, useEffect, useState } from 'react';
import { ActivationDetailsCard } from '@/app/dashboard/parts/ActivationDetailsCard';
import { ShippingDeliveryMethodForm } from '@/app/dashboard/parts/ShippingDeliveryMethodForm';
import { ShippingAppData, ShippingCosts, ShippingUnitOfMeasure } from '@/app/types/app-data.model';
import { ShippingMethodSummary } from '@/app/dashboard/parts/ShippingMethodSummary';
import { WixPageId } from '@/app/utils/navigation.const';
import { useSetShippingAppData, useShippingAppData } from '@/app/client-hooks/app-data';
import { updateStoreItemPrice } from '@/app/actions/store';
import testIds from '@/app/utils/test-ids';
import { UpdatePriceForm } from './UpdatePriceForm';

export const ShippingRatesPageContent = ({}: {}) => {
  const {
    dashboard: { showToast, navigate },
  } = useSDK();
  const persistShippingAppData = useSetShippingAppData();
  const { data: persistedShippingAppData, isLoading: isLoadingAppData } = useShippingAppData();
  const [currentShippingAppData, setCurrentShippingAppData] = useState<ShippingAppData | undefined>(
    persistedShippingAppData,
  );

  const [priceAppData, setPriceAppData] = useState(0);

  const [loading, setLoading] = useState(false);

  const onSave = useCallback(() => {
    setLoading(true);
    updateStoreItemPrice(priceAppData)
      .then(() => {
        showToast({
          message: 'Prices updated successfully.',
          type: 'success',
        });
      })
      .catch(() => {
        showToast({
          message: 'Failed to update Prices.',
          type: 'error',
        });
      })
      .finally(() => setLoading(false));
  }, [priceAppData]);

  // const onSave = useCallback(() => {
  //   setLoading(true);
  //   persistShippingAppData(currentShippingAppData!)
  //     .then(() => {
  //       showToast({
  //         message: 'Shipping rates saved successfully.',
  //         type: 'success',
  //       });
  //     })
  //     .catch(() => {
  //       showToast({
  //         message: 'Failed to save shipping rates.',
  //         type: 'error',
  //       });
  //     })
  //     .finally(() => setLoading(false));
  // }, [persistShippingAppData, currentShippingAppData, showToast]);

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
  const setUpdatedPriceForMethod = useCallback(
    (code: number) => (newPrice: number) => {
      setPriceAppData(newPrice);
    },
    [priceAppData],
  );
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
    [loading, onSave],
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
        title='Gold Prices'
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
                {currentShippingAppData?.shippingMethods.map((method, index) => (
                  <Cell key={method.code}>
                    <UpdatePriceForm
                      expandByDefault={index === 0}
                      title={method.title}
                      unitOfMeasure={method.unitOfMeasure}
                      onUnitOfMeasureSelected={setUomForMethod(method.code)}
                      shippingCosts={method.costs}
                      onShippingCostsChanged={setCostsForMethod(method.code)}
                      updateStoreItemPrice={async (newPrice: number) => {
                        console.log('New Price to set in store:', newPrice);
                        setUpdatedPriceForMethod(newPrice);
                      }}
                      methodType={method.type}
                    />
                  </Cell>
                ))}
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
