import { createClient } from '@wix/sdk/client';
import { orders } from '@wix/ecom';
import { products, productsV3, catalogVersioning } from '@wix/stores';
import { appInstances } from '@wix/app-management';

// This utility function initializes and returns a Wix SDK client for in server and client components.
// It is intended for scenarios where an HTTP request contains a valid authorization header,
// or an access token is explicitly provided to the function.
export const createSdk = (accessToken: string) =>
  createClient({
    auth: {
      getAuthHeaders: async () => ({
        headers: {
          Authorization: accessToken,
        },
      }),
    },
    modules: {
      orders,
      products,
      appInstances,
      productsV3,
      catalogVersioning,
    },
  });
