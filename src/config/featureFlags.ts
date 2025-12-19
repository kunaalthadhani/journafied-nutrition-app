
import { AccountInfo } from '../services/dataStorage';

// Hardcoded Admin IDs for testing
const ADMIN_EMAILS = ['admin@journafied.com', 'hulexo@journafied.com', 'test@journafied.com']; // Add relevant emails
const ADMIN_IDS = ['admin-user-id'];

export const featureFlags = {
    grocerySuggestions: {
        isEnabled: (user?: AccountInfo | null) => {
            if (!user) return false;
            // Allow if email is in admin list
            if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
            // Allow if ID is in admin list
            if (user.supabaseUserId && ADMIN_IDS.includes(user.supabaseUserId)) return true;

            return false; // Default false
        }
    }
};
