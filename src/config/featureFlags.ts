
import { AccountInfo } from '../services/dataStorage';

// Hardcoded Admin IDs for testing
const ADMIN_EMAILS = ['admin@trackkcal.com', 'hulexo@trackkcal.com', 'test@trackkcal.com']; // Add relevant emails
const ADMIN_IDS = ['admin-user-id'];

// Launch mode. When true, every signed-in user gets premium features (no paywall).
// Set to false when paid tiers + RevenueCat go live. The downstream isPremium check
// still requires a signed-in account with email, so signed-out users are unaffected.
export const FREE_PREMIUM_LAUNCH = true;

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
