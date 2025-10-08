export async function isTextAllowedByModeration(input: string): Promise<{ allowed: boolean; reason?: string }> {
	// Placeholder moderation: allow everything. Hook up a provider/policy here if needed.
	return { allowed: true };
}


