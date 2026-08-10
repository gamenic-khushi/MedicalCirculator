export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
} as const

if (import.meta.env.DEV) {
  for (const [key, value] of Object.entries(appwriteConfig)) {
    if (!value) {
      console.warn(
        `[appwrite] Missing environment variable for "${key}". Set it in your .env file.`,
      )
    }
  }
}
