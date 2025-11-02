import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { users, chats, images, videos, subscriptions, usageTracking, sessions, accounts, authenticators } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { StripeService } from '$lib/server/stripe.js';
import { storageService } from '$lib/server/storage.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	
	if (!session?.user?.id) {
		return error(401, 'Unauthorized');
	}

	const { password } = await request.json();

	// Get user from database
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, session.user.id))
		.limit(1);

	if (!user) {
		return error(404, 'User not found');
	}

	// Verify password for credential-based users
	if (user.password) {
		if (!password) {
			return error(400, 'Password is required for account deletion');
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return error(400, 'Invalid password');
		}
	}

	// Now proceed with actual deletion operations in try-catch
	try {

		console.log(`Starting account deletion process for user: ${session.user.id}`);

		// Step 1: Cancel active Stripe subscriptions
		try {
			const activeSubscription = await StripeService.getActiveSubscription(session.user.id);
			if (activeSubscription) {
				console.log('Canceling active subscription:', activeSubscription.subscription.stripeSubscriptionId);
				await StripeService.cancelSubscriptionAtPeriodEnd(session.user.id);
				
				// Immediately cancel the subscription instead of waiting for period end
				// since the user is deleting their account
				const { getStripe } = await import('$lib/server/stripe.js');
				const stripe = await getStripe();
				await stripe.subscriptions.cancel(activeSubscription.subscription.stripeSubscriptionId);
			}
		} catch (stripeError) {
			console.warn('Error canceling Stripe subscription during account deletion:', stripeError);
			// Continue with deletion even if Stripe operations fail
		}

		// Step 2: Delete all user files from storage (images and videos)
		try {
			// Get all user images
			const userImages = await db
				.select()
				.from(images)
				.where(eq(images.userId, session.user.id));

			// Get all user videos  
			const userVideos = await db
				.select()
				.from(videos)
				.where(eq(videos.userId, session.user.id));

			// Delete image files from storage
			for (const image of userImages) {
				try {
					if (image.storageLocation === 'local') {
						await storageService.delete(image.filename);
					} else if (image.storageLocation === 'r2' && image.cloudPath) {
						await storageService.delete(image.cloudPath);
					}
				} catch (fileError) {
					console.warn(`Error deleting image file ${image.filename}:`, fileError);
					// Continue with other files even if one fails
				}
			}

			// Delete video files from storage
			for (const video of userVideos) {
				try {
					if (video.storageLocation === 'local') {
						await storageService.delete(video.filename);
					} else if (video.storageLocation === 'r2' && video.cloudPath) {
						await storageService.delete(video.cloudPath);
					}
				} catch (fileError) {
					console.warn(`Error deleting video file ${video.filename}:`, fileError);
					// Continue with other files even if one fails
				}
			}

			console.log(`Deleted ${userImages.length} images and ${userVideos.length} videos from storage`);
		} catch (storageError) {
			console.warn('Error during file cleanup:', storageError);
			// Continue with database deletion even if file cleanup fails
		}

		// Step 3: Delete user data from database
		// Note: Most tables have onDelete: "cascade" for userId foreign keys,
		// so deleting the user will automatically clean up related records
		
		// However, we'll explicitly clean up some tables for better logging
		const deletedChats = await db
			.delete(chats)
			.where(eq(chats.userId, session.user.id))
			.returning({ id: chats.id });

		const deletedImages = await db
			.delete(images)
			.where(eq(images.userId, session.user.id))
			.returning({ id: images.id });

		const deletedVideos = await db
			.delete(videos)
			.where(eq(videos.userId, session.user.id))
			.returning({ id: videos.id });

		const deletedSubscriptions = await db
			.delete(subscriptions)
			.where(eq(subscriptions.userId, session.user.id))
			.returning({ id: subscriptions.id });

		const deletedUsageTracking = await db
			.delete(usageTracking)
			.where(eq(usageTracking.userId, session.user.id))
			.returning({ id: usageTracking.id });

		// Clean up Auth.js related tables (these should cascade, but let's be explicit)
		await db
			.delete(sessions)
			.where(eq(sessions.userId, session.user.id));

		await db
			.delete(accounts)
			.where(eq(accounts.userId, session.user.id));

		await db
			.delete(authenticators)
			.where(eq(authenticators.userId, session.user.id));

		// Finally, delete the user record
		await db
			.delete(users)
			.where(eq(users.id, session.user.id));

		console.log('Account deletion completed:', {
			userId: session.user.id,
			deletedChats: deletedChats.length,
			deletedImages: deletedImages.length,
			deletedVideos: deletedVideos.length,
			deletedSubscriptions: deletedSubscriptions.length,
			deletedUsageTracking: deletedUsageTracking.length,
		});

		// Note: paymentHistory records are intentionally kept for audit/legal purposes
		// They contain transaction records that may be needed for accounting

		return json({
			success: true,
			message: 'Account successfully deleted'
		});

	} catch (err) {
		console.error('Error deleting account:', err);
		
		let errorMessage = 'Failed to delete account';
		if (err instanceof Error) {
			errorMessage = err.message;
		}
		
		return error(500, errorMessage);
	}
};