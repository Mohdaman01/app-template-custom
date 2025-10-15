// import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Cell,
  Collapse,
  Dropdown,
  FormField,
  NumberInput,
  Layout,
  Text,
  TextButton,
} from '@wix/design-system';
// import { ChevronDown, ChevronUp } from '@wix/wix-ui-icons-common';
import { ShippingCosts, ShippingMethodType, ShippingUnitOfMeasure } from '@/app/types/app-data.model';
import testIds from '@/app/utils/test-ids';

export function UpdatePriceForm({
  title,
  // unitOfMeasure,
  shippingCosts,
  // onUnitOfMeasureSelected,
  onShippingCostsChanged,
  // expandByDefault = false,
  updateStoreItemPrice,
}: {
  title: string;
  methodType: ShippingMethodType;
  unitOfMeasure: ShippingUnitOfMeasure;
  shippingCosts: ShippingCosts;
  onUnitOfMeasureSelected: (type: ShippingUnitOfMeasure) => void;
  onShippingCostsChanged: (shippingCosts: ShippingCosts) => void;
  updateStoreItemPrice: (newPrice: number) => Promise<void>;
  expandByDefault?: boolean;
}) {
  // const uomName =
  //   unitOfMeasure === ShippingUnitOfMeasure.NUM_OF_ITEMS
  //     ? 'item'
  //     : unitOfMeasure === ShippingUnitOfMeasure.WEIGHT_IN_LB
  //       ? 'lb'
  //       : 'kg';
  // const [isOpen, setIsOpen] = useState(expandByDefault);

  return (
    <Card dataHook={testIds.DASHBOARD.SHIPPING_METHOD}>
      <Card.Header
        title={title}
        // suffix={
        //   <TextButton dataHook={testIds.DASHBOARD.SHIPPING_METHOD_EXPAND} onClick={() => setIsOpen(!isOpen)}>
        //     {isOpen ? <ChevronUp /> : <ChevronDown />}
        //   </TextButton>
        // }
      />
      {/* <Collapse open={isOpen}> */}
      <Card.Divider />
      <Card.Content dataHook={testIds.DASHBOARD.SHIPPING_METHOD_FORM}>
        <Box direction='vertical' gap='SP7'>
          {/* <FormField label='Parameter'>
              <Dropdown
                selectedId={unitOfMeasure}
                onSelect={(option, sameOptionWasPicked) =>
                  sameOptionWasPicked ? null : onUnitOfMeasureSelected(option.id as ShippingUnitOfMeasure)
                }
                options={[
                  { id: ShippingUnitOfMeasure.NUM_OF_ITEMS, value: 'Number of items' },
                  { id: ShippingUnitOfMeasure.WEIGHT_IN_KG, value: 'Weight in kg' },
                  { id: ShippingUnitOfMeasure.WEIGHT_IN_LB, value: 'Weight in lb' },
                ]}
                placeholder='Select parameter'
              />
            </FormField> */}

          <Box direction='vertical' gap='SP4'>
            <Text>Set Prices:</Text>
            <Layout>
              <Cell span={4}>
                <FormField label={`Enter Price`}>
                  <NumberInput
                    placeholder='Select totalPrice'
                    type='number'
                    value={shippingCosts.gold}
                    onChange={(value) => {
                      updateStoreItemPrice(value ?? 0);
                    }}
                  />
                </FormField>
              </Cell>
              {/* <Cell span={4}>
                <FormField label={`Silver`}>
                  <Input
                    prefix={<Input.Affix>$</Input.Affix>}
                    suffix={<Input.Affix>per gram</Input.Affix>}
                    placeholder='Select totalPrice'
                    type='number'
                    value={shippingCosts.silver}
                    onChange={(e) => {
                      onShippingCostsChanged({ ...shippingCosts, silver: Number(e.currentTarget.value) });
                    }}
                  />
                </FormField>
              </Cell>
              <Cell span={4}>
                <FormField label={`Platinum`}>
                  <Input
                    prefix={<Input.Affix>$</Input.Affix>}
                    suffix={<Input.Affix>per gram</Input.Affix>}
                    placeholder='Select totalPrice'
                    type='number'
                    value={shippingCosts.platinum}
                    onChange={(e) => {
                      onShippingCostsChanged({ ...shippingCosts, platinum: Number(e.currentTarget.value) });
                    }}
                  />
                </FormField>
              </Cell> */}
              {/* <Cell span={4}>
                  <FormField label={`SetPlatinum`}>
                    <Input
                      prefix={<Input.Affix>$</Input.Affix>}
                      suffix={<Input.Affix>per {uomName}</Input.Affix>}
                      value={shippingCosts.thirdAndUp}
                      onChange={(e) => {
                        onShippingCostsChanged({ ...shippingCosts, thirdAndUp: Number(e.currentTarget.value) });
                      }}
                      placeholder='Select totalPrice'
                      type='number'
                    />
                  </FormField>
                </Cell> */}
            </Layout>
          </Box>
        </Box>
      </Card.Content>
      {/* </Collapse> */}
    </Card>
  );
}
