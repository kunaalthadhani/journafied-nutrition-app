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
		lightBorder: string;
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
		primary: string;
		primaryForeground: string;
		secondaryBg: string;
		successBg: string;
	};
	radii: {
		sm: number;
		md: number;
		lg: number;
		xl: number;
		pill: number;
	};
	elevation: {
		none: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
		sm: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
		md: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
	};
}

const lightTheme: Theme = {
	mode: 'light',
	colors: {
		background: '#FFFFFF', // Clean white
		card: '#FFFFFF',
		input: '#FFFFFF',      // Inputs often white with border in shadcn
		border: '#E4E4E7',     // zinc-200
		lightBorder: '#F4F4F5', // zinc-100
		ring: '#18181B',       // zinc-900
		textPrimary: '#09090B', // zinc-950
		textSecondary: '#71717A', // zinc-500
		textTertiary: '#A1A1AA', // zinc-400
		accentBg: '#F4F4F5',   // zinc-100 (hover state/secondary)
		accent: '#18181B',     // zinc-900 (primary action)
		shadow: 'rgba(0, 0, 0, 0.04)',
		success: '#10B981',
		warning: '#F59E0B',
		error: '#EF4444',
		info: '#3B82F6',
		overlay: 'rgba(0,0,0,0.40)', // lighter overlay for cleaner feel
		primary: '#18181B',
		primaryForeground: '#FAFAFA',
		secondaryBg: '#F4F4F5',
		successBg: '#ECFDF5',
	},
	radii: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 }, // slightly tighter radii (0.5rem = 8px usually)
	elevation: {
		none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
		sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
		md: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
	}
};

const darkTheme: Theme = {
	mode: 'dark',
	colors: {
		background: '#09090B', // zinc-950
		card: '#09090B',       // zinc-950 (often same as bg, separated by border)
		input: '#09090B',
		border: '#27272A',     // zinc-800
		lightBorder: '#3F3F46', // zinc-700
		ring: '#D4D4D8',       // zinc-300
		textPrimary: '#FAFAFA', // zinc-50
		textSecondary: '#A1A1AA', // zinc-400
		textTertiary: '#52525B', // zinc-600
		accentBg: '#27272A',   // zinc-800
		accent: '#FAFAFA',     // zinc-50
		shadow: 'rgba(0,0,0,0.5)',
		success: '#34D399',
		warning: '#FBBF24',
		error: '#F87171',
		info: '#60A5FA',
		overlay: 'rgba(0,0,0,0.80)',
		primary: '#FAFAFA',
		primaryForeground: '#09090B',
		secondaryBg: '#27272A',
		successBg: 'rgba(52, 211, 153, 0.2)',
	},
	radii: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
	elevation: {
		none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
		sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 },
		md: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
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

const ThemeContext = React.createContext<ThemeContextValue>({ theme: lightTheme, currentMode: 'light', setMode: () => { } });

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
