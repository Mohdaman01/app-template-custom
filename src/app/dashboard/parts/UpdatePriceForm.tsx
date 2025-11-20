// import { useState } from 'react';
import {
  Box,
  Card,
  Cell,
  // Collapse,
  // Dropdown,
  FormField,
  NumberInput,
  Layout,
  Text,
  // ToggleSwitch,
  // TextButton,
} from '@wix/design-system';
// import { ChevronDown, ChevronUp } from '@wix/wix-ui-icons-common';

export function UpdatePriceForm({
  title,
  goldPrice,
  silverPrice,
  platinumPrice,
  updateStoreItemPriceGold,
  updateStoreItemPriceSilver,
  updateStoreItemPricePlatinum,
  prefix,
  disabled,
}: {
  title: string;
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
  updateStoreItemPriceGold: (newPrice: number) => void;
  updateStoreItemPriceSilver: (newPrice: number) => void;
  updateStoreItemPricePlatinum: (newPrice: number) => void;
  prefix?: string;
  disabled: boolean;
}) {
  // console.log('UpdatePriceForm rendered with prefix: ', prefix);
  // const [checked, setChecked] = useState(false);
  // const uomName =
  //   unitOfMeasure === ShippingUnitOfMeasure.NUM_OF_ITEMS
  //     ? 'item'
  //     : unitOfMeasure === ShippingUnitOfMeasure.WEIGHT_IN_LB
  //       ? 'lb'
  //       : 'kg';
  // const [isOpen, setIsOpen] = useState(expandByDefault);

  return (
    <Card>
      <Card.Header
        title={title}
        // suffix={
        //   <Box gap='SP2' align='center'>
        //     <Text>{checked ? 'Disabled Auto Set Price' : 'Enabled Auto Set Price'}</Text>
        //     <ToggleSwitch checked={checked} onChange={() => setChecked(!checked)} />
        //   </Box>
        // }
        // suffix={
        //   <TextButton dataHook={testIds.DASHBOARD.SHIPPING_METHOD_EXPAND} onClick={() => setIsOpen(!isOpen)}>
        //     {isOpen ? <ChevronUp /> : <ChevronDown />}
        //   </TextButton>
        // }
      />
      <Card.Divider />
      <Card.Content>
        <Box direction='vertical' gap='SP7'>
          <Box direction='vertical' gap='SP4'>
            <Layout>
              <Cell span={8}>
                <Text>Gold Price</Text>
                <FormField>
                  <NumberInput
                    prefix={prefix}
                    suffix='per gram'
                    placeholder='Enter Price'
                    type='number'
                    value={goldPrice}
                    onChange={(value) => {
                      updateStoreItemPriceGold(value ?? 0);
                    }}
                    disabled={disabled}
                  />
                </FormField>
              </Cell>
            </Layout>
          </Box>
          <Box direction='vertical' gap='SP4'>
            <Layout>
              <Cell span={8}>
                <Text>Silver Price</Text>
                <FormField>
                  <NumberInput
                    prefix={prefix}
                    suffix='per gram'
                    placeholder='Select totalPrice'
                    type='number'
                    value={silverPrice}
                    onChange={(value) => {
                      updateStoreItemPriceSilver(value ?? 0);
                    }}
                    disabled={disabled}
                  />
                </FormField>
              </Cell>
            </Layout>
          </Box>
          <Box direction='vertical' gap='SP4'>
            <Layout>
              <Cell span={8}>
                <Text>Platinum Price</Text>
                <FormField>
                  <NumberInput
                    prefix={prefix}
                    suffix='per gram'
                    placeholder='Select totalPrice'
                    type='number'
                    value={platinumPrice}
                    onChange={(value) => {
                      updateStoreItemPricePlatinum(value ?? 0);
                    }}
                    disabled={disabled}
                  />
                </FormField>
              </Cell>
            </Layout>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}
