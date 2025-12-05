import { useState, useCallback } from 'react';
import { Box, Card, Cell, FormField, NumberInput, Layout, Text, Button, Input, Divider } from '@wix/design-system';

export function AdditionalCostForm({
  title,
  prefix,
  disabled,
  addAdditionalCost,
  additionalCosts,
  maxAdditionalCosts,
  deleteAdditionalCost,
}: {
  title: string;
  prefix?: string;
  disabled: boolean;
  addAdditionalCost?: (costName: string, cost: number | string) => void;
  additionalCosts?: any[];
  maxAdditionalCosts?: number;
  deleteAdditionalCost?: (costId: number) => void;
}) {
  const [newCostName, setNewCostName] = useState('');
  const [newCostValue, setNewCostValue] = useState<number | ''>('');

  const handleAddCost = useCallback(() => {
    if (addAdditionalCost && newCostName.trim() && typeof newCostValue === 'number' && newCostValue > 0) {
      addAdditionalCost(newCostName.trim(), newCostValue);
      setNewCostName('');
      setNewCostValue('');
    }
  }, [addAdditionalCost, newCostName, newCostValue]);

  const isAddButtonDisabled =
    disabled ||
    !newCostName.trim() ||
    !newCostValue ||
    newCostValue <= 0 ||
    (additionalCosts && maxAdditionalCosts !== undefined && additionalCosts.length >= maxAdditionalCosts);

  return (
    <Card>
      <Card.Header
        title={title}
        suffix={
          <Box gap='SP2' align='center'>
            <Text>
              {additionalCosts ? additionalCosts.length : 0} / {maxAdditionalCosts}
            </Text>
            <Button onClick={handleAddCost} disabled={isAddButtonDisabled}>
              Add Cost
            </Button>
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
                  value={newCostName}
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
                  value={newCostValue}
                  onChange={(value) => setNewCostValue(value === null ? '' : value)}
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
                  key={cost.id}
                  direction='vertical'
                  gap='SP2'
                  backgroundColor='D70'
                  padding='SP3'
                  borderRadius='6px'
                  height='60px'
                >
                  <Layout>
                    <Cell span={6}>
                      <Text weight='normal'>{cost.cost_name}</Text>
                    </Cell>
                    <Cell span={4}>
                      <Text weight='bold'>
                        {prefix}
                        {cost.cost}
                      </Text>
                    </Cell>
                    <Cell span={2}>
                      <Button
                        skin='destructive'
                        size='small'
                        onClick={() => deleteAdditionalCost && deleteAdditionalCost(cost.id)}
                      >
                        Delete
                      </Button>
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
