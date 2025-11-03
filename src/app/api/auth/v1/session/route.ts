import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { decodeJwt } from '@/app/utils/jwt-verify';

// Expected shape of the Wix JWT payload
interface WixPayload {
  instanceId: string;
  userId?: string;
  vendorId?: string;
  iat: number;
  exp: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const wixAppJwtKey = process.env.WIX_APP_JWT_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get the Wix access token from the request
    const wixAccessToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!wixAccessToken) {
      console.error('[Session API] No access token in request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Session API] Received token, attempting to decode...');
    console.log('[Session API] Token preview:', wixAccessToken.substring(0, 50) + '...');

    // Check if this is a development bypass token
    const isDevelopmentBypass = wixAccessToken === 'dev-bypass-token';

    let instanceId: string;

    if (isDevelopmentBypass) {
      console.log('[Session API] Using development bypass token');
      instanceId = 'dev-instance-local';
    } else {
      // Verify and decode the Wix JWT
      let wixPayload: WixPayload | null;
      try {
        wixPayload = decodeJwt<WixPayload>(wixAccessToken);
        if (!wixPayload) {
          console.error('[Session API] decodeJwt returned null');
          return NextResponse.json({ error: 'Invalid token format - could not decode' }, { status: 401 });
        }
      } catch (decodeError) {
        console.error('[Session API] Failed to decode JWT:', decodeError);
        return NextResponse.json(
          {
            error: 'Invalid token format',
            details: decodeError instanceof Error ? decodeError.message : String(decodeError),
          },
          { status: 401 },
        );
      }

      if (!wixPayload.instanceId) {
        console.error('[Session API] No instanceId in decoded token. Payload:', JSON.stringify(wixPayload));
        return NextResponse.json({ error: 'Invalid token - missing instanceId' }, { status: 401 });
      }

      instanceId = wixPayload.instanceId;
    }

    console.log('[Session API] Token decoded successfully, instanceId:', instanceId);

    // Create a response to set cookies properly
    let cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

    // Create a Supabase server client with proper cookie handling
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSetArray) {
          cookiesToSet = cookiesToSetArray;
        },
      },
    });

    // Generate a unique email/password for this Wix instance
    const email = `wix-instance-${instanceId}@app.local`;
    const password = `wix-${instanceId}-${wixAppJwtKey.substring(0, 8)}`;

    console.log('[Session API] Attempting to sign in with instance credentials...');

    // Try to sign in with the generated credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError?.message?.includes('Invalid login credentials')) {
      console.log('[Session API] User not found, creating new account...');
      // If sign in fails, create the account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            wix_instance_id: instanceId,
            wix_user_id: isDevelopmentBypass ? 'dev-user' : undefined,
            wix_vendor_id: isDevelopmentBypass ? 'dev-vendor' : undefined,
          },
        },
      });

      if (signUpError) {
        console.error('[Session API] Error creating instance account:', signUpError);
        return NextResponse.json({ error: 'Error creating session', details: signUpError.message }, { status: 500 });
      }

      console.log('[Session API] Account created successfully');

      // Create response with session and set cookies
      const response = NextResponse.json({
        session: signUpData.session,
      });

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });

      return response;
    }

    if (signInError) {
      console.error('[Session API] Error signing in:', signInError);
      return NextResponse.json({ error: 'Error creating session', details: signInError.message }, { status: 500 });
    }

    console.log('[Session API] Sign in successful');

    // Create response with session and set cookies
    const response = NextResponse.json({
      session: signInData.session,
    });

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    console.error('[Session API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
