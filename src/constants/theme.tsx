import { useColorScheme } from 'react-native';
import React from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
	mode: ThemeMode;
	colors: {
		background: string;
		card: string;
		input: string;
		border: string;
		ring: string;
		textPrimary: string;
		textSecondary: string;
		textTertiary: string;
		accentBg: string;
		accent: string;
		shadow: string;
		success: string;
		warning: string;
		error: string;
		info: string;
		overlay: string;
	};
	radii: {
		sm: number;
		md: number;
		lg: number;
		xl: number;
		pill: number;
	};
	elevation: {
		none: { shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
		sm: { shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
		md: { shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
	};
}

const lightTheme: Theme = {
	mode: 'light',
	colors: {
		background: '#F8FAFC',
		card: '#FFFFFF',
		input: '#F1F5F9',
		border: '#E5E7EB',
		ring: '#94A3B8',
		textPrimary: '#475569',
		textSecondary: '#475569',
		textTertiary: '#94A3B8',
		accentBg: '#ECFDF5',
		accent: '#10B981',
		shadow: 'rgba(2, 6, 23, 0.08)',
		success: '#10B981',
		warning: '#F59E0B',
		error: '#EF4444',
		info: '#3B82F6',
		overlay: 'rgba(0,0,0,0.80)'
	},
	radii: { sm: 6, md: 12, lg: 16, xl: 20, pill: 9999 },
	elevation: {
		none: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
		sm: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
		md: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
	}
};

const darkTheme: Theme = {
	mode: 'dark',
	colors: {
		background: '#0B1220', // slate-950-ish
		card: '#0F172A', // slate-900
		input: '#111827', // gray-900
		border: '#1F2937', // gray-800
		ring: '#64748B', // slate-500
		textPrimary: '#E5E7EB', // gray-200
		textSecondary: '#9CA3AF', // gray-400
		textTertiary: '#6B7280', // gray-500
		accentBg: '#052e21',
		accent: '#34D399', // emerald-400 for dark
		shadow: 'rgba(0,0,0,0.5)',
		success: '#34D399',
		warning: '#FBBF24',
		error: '#F87171',
		info: '#60A5FA',
		overlay: 'rgba(0,0,0,0.9)'
	},
	radii: { sm: 6, md: 12, lg: 16, xl: 20, pill: 9999 },
	elevation: {
		none: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
		sm: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
		md: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
	}
};

export function getTheme(mode: ThemeMode): Theme {
	return mode === 'dark' ? darkTheme : lightTheme;
}

type ThemeContextValue = {
	theme: Theme;
	currentMode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({ theme: lightTheme, currentMode: 'light', setMode: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode; mode?: ThemeMode }> = ({ children, mode }) => {
	const system = useColorScheme();
	const [currentMode, setCurrentMode] = React.useState<ThemeMode>(mode || 'system');

	const resolvedMode = currentMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : currentMode;
	const valueTheme = resolvedMode === 'dark' ? darkTheme : lightTheme;

	const setMode = (m: ThemeMode) => setCurrentMode(m);

	const contextValue = React.useMemo(() => ({ theme: valueTheme, currentMode, setMode }), [valueTheme, currentMode]);

	return (
		<ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
	);
};

export function useTheme(): Theme {
	return React.useContext(ThemeContext).theme;
}

export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
	const ctx = React.useContext(ThemeContext);
	return { mode: ctx.currentMode, setMode: ctx.setMode };
}
