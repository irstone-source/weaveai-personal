import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  // Set language cookie to English (using Paraglide's expected cookie name)
  cookies.set('PARAGLIDE_LOCALE', 'en', {
    path: '/',
    maxAge: 34560000, // Use Paraglide's default maxAge (about 400 days)
    sameSite: 'lax',
    httpOnly: false, // Allow client-side access
    secure: false // Allow on non-HTTPS for development
  });
  
  // Redirect to home page with clean URL
  throw redirect(302, '/');
};