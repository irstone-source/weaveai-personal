import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  // Redirect /settings to /settings/profile as the default page
  throw redirect(302, '/settings/profile');
};