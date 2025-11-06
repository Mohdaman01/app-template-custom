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
  // TextButton,
} from '@wix/design-system';
// import { ChevronDown, ChevronUp } from '@wix/wix-ui-icons-common';

export function UpdatePriceForm({
  title,
  price,
  updateStoreItemPriceGold,
  updateStoreItemPriceSilver,
  updateStoreItemPricePlatinum,
  prefix,
}: {
  title: string;
  price: number;
  updateStoreItemPriceGold: (newPrice: number) => void;
  updateStoreItemPriceSilver: (newPrice: number) => void;
  updateStoreItemPricePlatinum: (newPrice: number) => void;
  prefix?: string;
}) {
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
                    prefix={typeof prefix === 'string' ? prefix : '$'}
                    suffix='per gram'
                    placeholder='Enter Price'
                    type='number'
                    value={price}
                    onChange={(value) => {
                      updateStoreItemPriceGold(value ?? 0);
                    }}
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
                    prefix={typeof prefix === 'string' ? prefix : '$'}
                    suffix='per gram'
                    placeholder='Select totalPrice'
                    type='number'
                    value={price}
                    onChange={(value) => {
                      updateStoreItemPriceSilver(value ?? 0);
                    }}
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
                    prefix={typeof prefix === 'string' ? prefix : '$'}
                    suffix='per gram'
                    placeholder='Select totalPrice'
                    type='number'
                    value={price}
                    onChange={(value) => {
                      updateStoreItemPricePlatinum(value ?? 0);
                    }}
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
