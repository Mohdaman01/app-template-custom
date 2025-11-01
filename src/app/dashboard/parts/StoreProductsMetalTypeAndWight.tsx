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
  Input,
} from '@wix/design-system';
// import { ChevronDown, ChevronUp } from '@wix/wix-ui-icons-common';
import testIds from '@/app/utils/test-ids';

export function StoreProductsMetalTypeAndWeight({ title, productsToSet }: { title: string; productsToSet: any[] }) {
  return (
    <Card dataHook={testIds.DASHBOARD.SHIPPING_METHOD}>
      <Card.Header title={title} />
      <Card.Divider />
      <Card.Content dataHook={testIds.DASHBOARD.SHIPPING_METHOD_FORM}>
        <Box direction='vertical' gap='SP7'>
          {productsToSet && productsToSet.length > 0 ? (
            productsToSet.map((product, index) => (
              <Box key={index} direction='vertical' gap='SP4'>
                <Text>{product.name}</Text>
                <Layout>
                  <Cell span={8}>
                    <FormField label={`Product Metal Type`}>
                      <Input
                        value={product.extendedFields.namespaces['@wixfreaks/test-shipping-example'].MetalType}
                        // onChange={(e) => product.setMetalType(e.target.value)}
                      />
                    </FormField>
                  </Cell>
                  {/* <Cell span={8}>
                    <FormField label={`Enter Price`}>
                      <NumberInput value={product.price} onChange={(value) => product.setPrice(value)} />
                    </FormField>
                  </Cell> */}
                </Layout>
              </Box>
            ))
          ) : (
            <Text>No products to set prices for</Text>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
}
