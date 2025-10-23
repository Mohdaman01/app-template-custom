import { type NextRequest } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
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
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify and decode the Wix JWT
    const wixPayload = decodeJwt<WixPayload>(wixAccessToken);
    if (!wixPayload?.instanceId) {
      return new Response('Invalid token', { status: 401 });
    }

    // Create a Supabase admin client for server operations
    const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
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
        return new Response('Error creating session', { status: 500 });
      }

      return new Response(
        JSON.stringify({
          session: signUpData.session,
        }),
      );
    }

    if (signInError) {
      console.error('Error signing in:', signInError);
      return new Response('Error creating session', { status: 500 });
    }

    // Return the Supabase session
    return new Response(
      JSON.stringify({
        session: signInData.session,
      }),
    );
  } catch (error) {
    console.error('Session exchange error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
