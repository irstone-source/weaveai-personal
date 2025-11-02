/**
 * Projects Page - Server Load Function
 * Fetches user's projects and Linear integration status
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get session from parent layout to avoid duplicate auth call
	const { session } = await parent();

	// Check if user is logged in
	if (!session?.user) {
		throw redirect(302, '/login?redirect=/projects');
	}

	// Check if Linear is connected
	const linearIntegration = await db.query.linearIntegrations.findFirst({
		where: (integrations, { eq }) => eq(integrations.userId, session.user.id)
	});

	// Get user's projects
	const projects = await db.query.projects.findMany({
		where: (projects, { eq }) => eq(projects.userId, session.user.id),
		orderBy: (projects, { desc }) => [desc(projects.updatedAt)]
	});

	// Get task counts for each project
	const projectsWithCounts = await Promise.all(
		projects.map(async (project) => {
			const tasks = await db.query.projectTasks.findMany({
				where: (tasks, { eq }) => eq(tasks.projectId, project.id)
			});

			const statusCounts = {
				backlog: tasks.filter((t) => t.status === 'backlog').length,
				todo: tasks.filter((t) => t.status === 'todo').length,
				in_progress: tasks.filter((t) => t.status === 'in_progress').length,
				in_review: tasks.filter((t) => t.status === 'in_review').length,
				done: tasks.filter((t) => t.status === 'done').length,
				total: tasks.length
			};

			return {
				...project,
				taskCounts: statusCounts
			};
		})
	);

	return {
		user: session.user,
		linearConnected: !!linearIntegration,
		linearTeam: linearIntegration?.teamName,
		projects: projectsWithCounts
	};
};
