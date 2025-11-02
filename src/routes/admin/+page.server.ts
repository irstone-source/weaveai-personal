import type { PageServerLoad } from './$types'
import { db, users, chats, images, videos, subscriptions, paymentHistory } from '$lib/server/db'
import { count, desc, sql, sum, eq } from 'drizzle-orm'
import { timeAgo } from '$lib/utils'

export const load: PageServerLoad = async () => {
  // Get total count of users
  const totalUsersResult = await db
    .select({ count: count() })
    .from(users)
  
  // Get total count of chats
  const totalChatsResult = await db
    .select({ count: count() })
    .from(chats)
  
  // Get total count of images generated
  const totalImagesResult = await db
    .select({ count: count() })
    .from(images)
  
  // Get total count of videos generated
  const totalVideosResult = await db
    .select({ count: count() })
    .from(videos)
  
  // Get total revenue from successful payments
  const totalRevenueResult = await db
    .select({ total: sum(paymentHistory.amount) })
    .from(paymentHistory)
    .where(eq(paymentHistory.status, 'succeeded'))
  
  // Get count of active subscriptions
  const activeSubscriptionsResult = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'))
  
  // Get recent activity - combine multiple types of activities
  const recentChats = await db
    .select({
      userEmail: users.email,
      action: sql<string>`'Started new chat with ' || ${chats.model}`,
      createdAt: chats.createdAt,
      type: sql<string>`'chat'`
    })
    .from(chats)
    .innerJoin(users, sql`${chats.userId} = ${users.id}`)
    .orderBy(desc(chats.createdAt))
    .limit(5)
  
  const recentImages = await db
    .select({
      userEmail: users.email,
      action: sql<string>`'Generated image'`,
      createdAt: images.createdAt,
      type: sql<string>`'image'`
    })
    .from(images)
    .innerJoin(users, sql`${images.userId} = ${users.id}`)
    .orderBy(desc(images.createdAt))
    .limit(5)
  
  const recentVideos = await db
    .select({
      userEmail: users.email,
      action: sql<string>`'Generated video'`,
      createdAt: videos.createdAt,
      type: sql<string>`'video'`
    })
    .from(videos)
    .innerJoin(users, sql`${videos.userId} = ${users.id}`)
    .orderBy(desc(videos.createdAt))
    .limit(5)
  
  const recentSubscriptions = await db
    .select({
      userEmail: users.email,
      action: sql<string>`'Upgraded to ' || ${subscriptions.planTier} || ' plan'`,
      createdAt: subscriptions.createdAt,
      type: sql<string>`'subscription'`
    })
    .from(subscriptions)
    .innerJoin(users, sql`${subscriptions.userId} = ${users.id}`)
    .orderBy(desc(subscriptions.createdAt))
    .limit(3)
  
  // Combine all activities and sort by date
  const allActivities = [
    ...recentChats,
    ...recentImages,
    ...recentVideos,
    ...recentSubscriptions
  ]
  
  const sortedActivities = allActivities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5) // Show top 5 most recent activities
    .map(activity => ({
      user: activity.userEmail,
      action: activity.action,
      time: timeAgo(activity.createdAt)
    }))
  
  const totalUsers = totalUsersResult[0].count
  const totalChats = totalChatsResult[0].count
  const totalImages = totalImagesResult[0].count
  const totalVideos = totalVideosResult[0].count
  const totalRevenue = totalRevenueResult[0].total || 0 // Default to 0 if no payments
  const activeSubscriptions = activeSubscriptionsResult[0].count
  
  return {
    totalUsers,
    totalChats,
    totalImages,
    totalVideos,
    totalRevenue,
    activeSubscriptions,
    recentActivity: sortedActivities
  }
}