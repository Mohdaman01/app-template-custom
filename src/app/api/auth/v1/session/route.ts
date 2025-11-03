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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify and decode the Wix JWT
    const wixPayload = decodeJwt<WixPayload>(wixAccessToken);
    if (!wixPayload?.instanceId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
    const email = `wix-instance-${wixPayload.instanceId}@app.local`;
    const password = `wix-${wixPayload.instanceId}-${wixAppJwtKey.substring(0, 8)}`;

    // Try to sign in with the generated credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError?.message?.includes('Invalid login credentials')) {
      // If sign in fails, create the account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            wix_instance_id: wixPayload.instanceId,
            wix_user_id: wixPayload.userId,
            wix_vendor_id: wixPayload.vendorId,
          },
        },
      });

      if (signUpError) {
        console.error('Error creating instance account:', signUpError);
        return NextResponse.json({ error: 'Error creating session' }, { status: 500 });
      }

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
      console.error('Error signing in:', signInError);
      return NextResponse.json({ error: 'Error creating session' }, { status: 500 });
    }

    // Create response with session and set cookies
    const response = NextResponse.json({
      session: signInData.session,
    });

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    console.error('Session exchange error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
