/**
 * Linear OAuth Authorization Endpoint
 * Handles OAuth flow: redirect to Linear → callback → store tokens
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getLinearAuthUrl,
	exchangeCodeForToken,
	getLinearUser,
	getLinearTeams
} from '$lib/server/integrations/linear';
import { db } from '$lib/server/db';
import { linearIntegrations } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	// If no code, redirect to Linear OAuth
	if (!code && !error) {
		const redirectUri = `${url.origin}/api/integrations/linear/auth`;
		const authUrl = await getLinearAuthUrl(redirectUri);
		throw redirect(302, authUrl);
	}

	// Handle OAuth error
	if (error) {
		const errorDescription = url.searchParams.get('error_description');
		console.error('Linear OAuth error:', error, errorDescription);
		throw redirect(302, '/settings?error=linear_auth_failed');
	}

	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login?redirect=/api/integrations/linear/auth');
	}

	try {
		// Exchange code for access token
		const redirectUri = `${url.origin}/api/integrations/linear/auth`;
		const tokenResponse = await exchangeCodeForToken(code, redirectUri);

		// Get Linear user info
		const linearUser = await getLinearUser(tokenResponse.access_token);
		const teams = await getLinearTeams(tokenResponse.access_token);

		// Use first team by default (or let user select later)
		const primaryTeam = teams.teams.nodes[0];

		if (!primaryTeam) {
			throw new Error('No Linear team found for user');
		}

		// Calculate token expiration
		const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

		// Check if integration already exists
		const existing = await db.query.linearIntegrations.findFirst({
			where: (integrations, { eq }) => eq(integrations.userId, locals.user.id)
		});

		if (existing) {
			// Update existing integration
			await db.update(linearIntegrations)
				.set({
					accessToken: tokenResponse.access_token,
					teamId: primaryTeam.id,
					teamName: primaryTeam.name,
					expiresAt,
					lastSyncAt: null,
					updatedAt: new Date()
				})
				.where((integrations, { eq }) => eq(integrations.id, existing.id));
		} else {
			// Create new integration
			await db.insert(linearIntegrations).values({
				userId: locals.user.id,
				accessToken: tokenResponse.access_token,
				teamId: primaryTeam.id,
				teamName: primaryTeam.name,
				expiresAt,
				lastSyncAt: null
			});
		}

		// Redirect to success page
		throw redirect(302, '/projects?linear_connected=true');
	} catch (error) {
		console.error('Failed to complete Linear OAuth:', error);
		throw redirect(302, '/settings?error=linear_auth_error');
	}
};
