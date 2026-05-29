/**
 * Web-only shim for React Native's Alert.alert.
 *
 * React Native Web's default behavior is to call window.alert(), which ignores
 * the buttons array. That means destructive confirms (Delete Meal, Delete
 * Account, etc.) silently no-op on the PWA: user sees a basic OK dialog,
 * dismisses it, nothing happens.
 *
 * This shim replaces Alert.alert on web only with a version that:
 *   - 1 button: window.alert(title + message)
 *   - 2+ buttons: window.confirm(title + message), then runs the non-cancel
 *     button's onPress if user confirmed.
 *
 * Importing this file at app startup activates the shim. Native platforms are
 * unaffected.
 */

import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  const originalAlert = Alert.alert;

  Alert.alert = (title, message, buttons, _options) => {
    const text = message ? `${title}\n\n${message}` : title;

    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }

    if (buttons.length === 1) {
      window.alert(text);
      try { buttons[0].onPress?.(); } catch (e) { console.error(e); }
      return;
    }

    // 2+ buttons: use confirm. Find the "action" button (non-cancel) and
    // the cancel button. If user confirms, run the action's onPress.
    const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
    const actionBtn = buttons.find(b => b !== cancelBtn) || buttons[buttons.length - 1];

    const confirmed = window.confirm(text);
    try {
      if (confirmed) {
        actionBtn.onPress?.();
      } else {
        cancelBtn.onPress?.();
      }
    } catch (e) {
      console.error('Alert action onPress threw:', e);
    }
  };

  // Reference originalAlert so eslint/no-unused-vars stays happy if we ever
  // want to restore it for testing.
  void originalAlert;
}

export {};
