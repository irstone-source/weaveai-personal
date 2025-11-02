import type { LayoutServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'

export const load: LayoutServerLoad = async ({ locals, parent }) => {
  // Get session from parent layout to avoid duplicate auth call
  const { session } = await parent();
  
  // Check if user is logged in
  if (!session?.user) {
    throw redirect(302, '/login?callbackUrl=/admin')
  }
  
  // Check if user is admin
  if (!session.user.isAdmin) {
    throw redirect(302, '/')
  }
  
  return {
    user: session.user
  }
}