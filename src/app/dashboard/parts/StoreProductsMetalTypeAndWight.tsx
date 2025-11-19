import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Cell,
  FormField,
  NumberInput,
  Text,
  Dropdown,
  Button,
  Loader,
  Divider,
  Badge,
} from '@wix/design-system';

interface ProductVariant {
  variantId: string;
  variantName: string;
  sku: string;
  price: string;
  choices: Array<{
    optionName: string;
    choiceName: string;
  }>;
  inStock: boolean;
}

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
  prefix?: string;
}
export function StoreProductsMetalTypeAndWeight({
  title,
  productsToSet,
  onProductUpdatesChanged,
  saveExtendedFields,
  extendedFieldsLoading,
  prefix,
}: StoreProductsMetalTypeAndWeightProps) {
  const [productUpdates, setProductUpdates] = useState<Record<string, ProductUpdate>>({});
  const [productVariants, setProductVariants] = useState<Record<string, ProductVariant[]>>({});

  const metalTypeOptions = [
    { id: 'GOLD', value: 'Gold' },
    { id: 'SILVER', value: 'Silver' },
    { id: 'PLATINUM', value: 'Platinum' },
  ];

  const displayProducts = productsToSet.length > 0 ? productsToSet : [];

  // Helper function to create variant display name
  const getVariantName = (variant: any, productName: string, catalogVersion: string): string => {
    if (catalogVersion === 'v3') {
      if (!variant.choices || variant.choices.length === 0) {
        return `${productName} (Default)`;
      }

      const choiceNames = variant.choices
        .map((choice: any) => choice.optionChoiceNames?.choiceName)
        .filter(Boolean)
        .join(' / ');

      return choiceNames ? `${productName} - ${choiceNames}` : productName;
    } else {
      return `${productName} (Default)`;
    }
  };

  // Initialize state from products and build variants array
  useEffect(() => {
    const initialUpdates: Record<string, ProductUpdate> = {};
    const allVariants: Record<string, ProductVariant[]> = {};

    displayProducts.forEach((product) => {
      // Extract metal type and weight
      let metalType = '';
      let metalWeight = 0;
      let variants: ProductVariant[] = [];

      if (product?.extendedFields) {
        metalType = product.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType || '';
        metalWeight = product.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight || 0;
        // Build variants array - every product has at least one variant
        variants =
          product?.variantsInfo?.variants?.map((variant: any) => ({
            variantId: variant._id,
            variantName: getVariantName(variant, product.name, 'v3'),
            sku: variant.sku || 'N/A',
            price: variant.price?.actualPrice?.amount || '0',
            choices:
              variant.choices?.map((choice: any) => ({
                optionName: choice.optionChoiceNames?.optionName || '',
                choiceName: choice.optionChoiceNames?.choiceName || '',
              })) || [],
            inStock: variant.inventoryStatus?.inStock || false,
          })) || [];
      } else {
        metalType = product.seoData?.tags?.find((tag: any) => tag.props?.name === 'MetalType')?.props?.content || '';
        metalWeight =
          parseFloat(product.seoData?.tags?.find((tag: any) => tag.props?.name === 'MetalWeight')?.props?.content) || 0;

        // Build variants array - every product has at least one variant
        variants =
          product?.variants?.map((variant: any) => ({
            variantId: variant._id,
            variantName: getVariantName(variant, product.name, 'v1'),
            sku: variant?.variant.sku || 'N/A',
            price: variant?.variant?.priceData?.price || '0',
            choices: [],
            inStock: variant.stock?.inStock || false,
          })) || [];
      }

      initialUpdates[product._id] = {
        productId: product._id,
        metalType,
        metalWeight,
      };

      allVariants[product._id] = variants;
    });

    setProductUpdates(initialUpdates);
    setProductVariants(allVariants);
  }, [displayProducts]);

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
              const variants = productVariants[product._id] || [];

              return (
                <Box key={product._id || index} direction='vertical' gap='SP4'>
                  <Text weight='bold' size='medium'>
                    {product.name}
                  </Text>

                  {/* Variants Section */}
                  {variants.length > 0 && (
                    <Box direction='vertical' gap='SP3' backgroundColor='D70' padding='SP3' borderRadius='6px'>
                      <Text size='small' weight='bold' secondary>
                        Variants ({variants.length})
                      </Text>
                      {variants.map((variant) => (
                        <Box
                          key={variant.variantId}
                          direction='horizontal'
                          gap='SP3'
                          align='center'
                          padding='SP2'
                          backgroundColor='D80'
                          borderRadius='4px'
                        >
                          <Box direction='vertical' gap='SP1' flex={1}>
                            <Text size='small'>{variant.variantName}</Text>
                            <Text size='tiny' secondary>
                              SKU: {variant.sku}
                            </Text>
                          </Box>
                          <Text size='small' weight='bold'>
                            {prefix}
                            {variant.price}
                          </Text>
                          <Badge skin={variant.inStock ? 'success' : 'danger'} size='small'>
                            {variant.inStock ? 'In Stock' : 'Out of Stock'}
                          </Badge>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Product Metal Type & Weight */}
                  <Box direction='horizontal' gap='SP6'>
                    <Cell span={8}>
                      <FormField label='Product Metal Type'>
                        <Dropdown
                          options={metalTypeOptions}
                          selectedId={currentUpdate?.metalType || ''}
                          onSelect={(option) => handleMetalTypeChange(product._id, option.id as string)}
                          placeholder='Select Metal Type'
                        />
                      </FormField>
                    </Cell>
                    <Cell span={8}>
                      <FormField label='Product Weight (grams)'>
                        <NumberInput
                          value={currentUpdate?.metalWeight || 0}
                          suffix='g'
                          onChange={(value) => handleMetalWeightChange(product._id, value || 0)}
                        />
                      </FormField>
                    </Cell>
                  </Box>

                  {index < displayProducts.length - 1 && <Divider skin='dark' />}
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
