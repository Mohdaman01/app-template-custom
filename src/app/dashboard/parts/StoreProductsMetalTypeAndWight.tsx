import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Cell,
  FormField,
  NumberInput,
  //   Layout,
  Text,
  //   TextButton,
  Dropdown,
  Button,
  Loader,
} from '@wix/design-system';
// import { ChevronDown, ChevronUp } from '@wix/wix-ui-icons-common';
import { testProducts } from '../../../..//dummy';

interface ProductUpdate {
  productId: string;
  metalType: string;
  metalWeight: number | string;
}

interface StoreProductsMetalTypeAndWeightProps {
  title: string;
  productsToSet: any[];
  onProductUpdatesChanged?: (updates: ProductUpdate[]) => void;
  saveExtendedFields?: () => Promise<void>;
  extendedFieldsLoading?: boolean;
}

export function StoreProductsMetalTypeAndWeight({
  title,
  productsToSet,
  onProductUpdatesChanged,
  saveExtendedFields,
  extendedFieldsLoading,
}: StoreProductsMetalTypeAndWeightProps) {
  // Track local state for each product's metal type and weight
  const [productUpdates, setProductUpdates] = useState<Record<string, ProductUpdate>>({});
  // const [loading, setLoading] = useState(false);

  // Metal type options for dropdown
  const metalTypeOptions = [
    { id: 'GOLD', value: 'Gold' },
    { id: 'SILVER', value: 'Silver' },
    { id: 'PLATINUM', value: 'Platinum' },
  ];

  // Use actual products if available, otherwise fall back to test products in development only
  const isDevelopment = process.env.NODE_ENV === 'development';
  const displayProducts = productsToSet.length > 0 ? productsToSet : isDevelopment ? testProducts : [];

  // Initialize state from products
  useEffect(() => {
    const initialUpdates: Record<string, ProductUpdate> = {};
    displayProducts.forEach((product) => {
      let metalType, metalWeight;
      if (product?.extendedFields) {
        metalType = product.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType || '';
        metalWeight = product.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight || 0;
      } else {
        metalType = product.seoData?.tags?.find((tag: any) => tag.props?.name === 'MetalType')?.props?.content || '';
        metalWeight =
          parseFloat(product.seoData?.tags?.find((tag: any) => tag.props?.name === 'metalWeight')?.props?.content) || 0;
      }

      initialUpdates[product._id] = {
        productId: product._id,
        metalType,
        metalWeight,
      };
    });
    setProductUpdates(initialUpdates);
  }, [displayProducts]);

  // Notify parent whenever updates change
  useEffect(() => {
    if (onProductUpdatesChanged) {
      const updatesArray = Object.values(productUpdates);
      onProductUpdatesChanged(updatesArray);
    }
  }, [productUpdates, onProductUpdatesChanged]);

  const handleMetalTypeChange = (productId: string, metalType: string) => {
    setProductUpdates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        metalType,
      },
    }));
  };

  const handleMetalWeightChange = (productId: string, metalWeight: number | string) => {
    setProductUpdates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        metalWeight,
      },
    }));
  };

  return (
    <Card>
      <Card.Header
        title={title}
        suffix={
          <Button onClick={() => saveExtendedFields && saveExtendedFields()}>
            {extendedFieldsLoading ? <Loader size='tiny' /> : 'Save'}
          </Button>
        }
      />
      <Card.Divider />
      <Card.Content>
        <Box direction='vertical' gap='SP7' scrollBehavior='auto' maxHeight='80vh' overflow='auto'>
          {displayProducts && displayProducts.length > 0 ? (
            displayProducts.map((product, index) => {
              const currentUpdate = productUpdates[product._id];
              return (
                <Box key={product._id || index} direction='vertical' gap='SP4'>
                  <Text>{product.name}</Text>
                  <Box direction='horizontal' gap='SP6'>
                    <Cell span={8}>
                      <FormField label={`Product Metal Type`}>
                        <Dropdown
                          options={metalTypeOptions}
                          selectedId={currentUpdate?.metalType || ''}
                          onSelect={(option) => handleMetalTypeChange(product._id, option.id as string)}
                          placeholder='Select Metal Type'
                        />
                      </FormField>
                    </Cell>
                    <Cell span={8}>
                      <FormField label={`Product Weight (grams)`}>
                        <NumberInput
                          value={currentUpdate?.metalWeight || 0}
                          suffix='g'
                          onChange={(value) => handleMetalWeightChange(product._id, value || 0)}
                        />
                      </FormField>
                    </Cell>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Text>No products to set prices for</Text>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
}
