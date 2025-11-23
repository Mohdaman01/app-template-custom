import { useState } from 'react';
import { Box, Card, Cell, FormField, NumberInput, Layout, Text, Button, Input, Divider } from '@wix/design-system';

export function AdditionalCostForm({
  title,
  prefix,
  disabled,
  addAdditionalCost,
  additionalCosts,
}: {
  title: string;
  prefix?: string;
  disabled: boolean;
  addAdditionalCost?: (costName: string, cost: number | string) => void;
  additionalCosts?: any[];
}) {
  const [newCostName, setNewCostName] = useState('');
  const [newCostValue, setNewCostValue] = useState(0);

  return (
    <Card>
      <Card.Header
        title={title}
        suffix={
          <Box gap='SP2' align='center'>
            <Button onClick={() => addAdditionalCost && addAdditionalCost(newCostName, newCostValue)}>Add Cost</Button>
          </Box>
        }
      />
      <Card.Divider />
      <Card.Content>
        <Box direction='vertical' gap='SP7'>
          {/* Input Form Section */}
          <Layout>
            <Cell span={7}>
              <FormField label='Set Additional Cost Name'>
                <Input
                  placeholder='Enter Cost Name'
                  onChange={(e) => setNewCostName(e.target.value)}
                  disabled={disabled}
                />
              </FormField>
            </Cell>
            <Cell span={5}>
              <FormField label='Set Cost'>
                <NumberInput
                  prefix={prefix}
                  placeholder='Enter Price'
                  onChange={(value) => setNewCostValue(Number(value))}
                  disabled={disabled}
                />
              </FormField>
            </Cell>
          </Layout>

          {/* Display Existing Costs Section */}
          <Box direction='vertical' gap='SP4' scrollBehavior='auto' maxHeight='50vh' overflow='auto'>
            {additionalCosts && additionalCosts.length > 0 ? (
              additionalCosts.map((cost, index) => (
                <Box
                  key={index}
                  direction='vertical'
                  gap='SP2'
                  backgroundColor='D70'
                  padding='SP3'
                  borderRadius='6px'
                  height='60px'
                >
                  <Layout>
                    <Cell span={8}>
                      <Text weight='normal'>{cost.name}</Text>
                    </Cell>
                    <Cell span={3}>
                      <Text weight='bold'>
                        {prefix}
                        {cost.value}
                      </Text>
                    </Cell>
                  </Layout>
                  {index < additionalCosts.length - 1 && <Divider />}
                </Box>
              ))
            ) : (
              <Text>No Additional Costs Added</Text>
            )}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}
