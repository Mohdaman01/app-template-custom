import jwt, { Jwt, JwtPayload } from 'jsonwebtoken';

// Decode the JWT token without secret key verification.
export const decodeJwt = <T = any>(token: string): T | null => {
  try {
    if (!token || typeof token !== 'string') {
      console.error('[decodeJwt] Invalid token input:', typeof token);
      return null;
    }

    const result = jwt.decode(token, { complete: true }) as Jwt | null;

    if (!result) {
      console.error('[decodeJwt] jwt.decode returned null - token is not a valid JWT');
      return null;
    }

    if (!result.payload) {
      console.error('[decodeJwt] No payload in decoded JWT');
      return null;
    }

    const payload = result.payload as JwtPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('[decodeJwt] Token is expired');
      throw new Error('decodeJwt: The token is expired.');
    }

    // Check if token is not yet valid
    if (payload.iat && payload.iat > Math.floor(Date.now() / 1000)) {
      console.error('[decodeJwt] Token is not yet valid');
      throw new Error('decodeJwt: The token is not yet valid.');
    }

    // If there's a data field, parse it, otherwise return the payload directly
    if (payload.data) {
      try {
        return JSON.parse(payload.data);
      } catch (parseError) {
        console.error('[decodeJwt] Failed to parse payload.data:', parseError);
        return null;
      }
    }

    // Return payload directly if no data field
    return payload as T;
  } catch (error) {
    console.error('[decodeJwt] Error decoding token:', error);
    if (error instanceof Error && (error.message.includes('expired') || error.message.includes('not yet valid'))) {
      throw error;
    }
    return null;
  }
};
