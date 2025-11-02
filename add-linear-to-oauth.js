import { readFileSync, writeFileSync } from 'fs';

const file = '/Users/ianstone/weaveai-enterprise/src/routes/admin/settings/oauth-providers/+page.server.ts';
let content = readFileSync(file, 'utf-8');

// Add linearEnabled, linearClientId, linearClientSecret to all return fail() statements
// These need to be added to preserve form state on validation errors

const patterns = [
  // Add to validation error returns
  {
    search: /facebookEnabled,\s+facebookClientId,\s+facebookClientSecret\s+\}/g,
    replace: `facebookEnabled,
          facebookClientId,
          facebookClientSecret,
          linearEnabled,
          linearClientId,
          linearClientSecret
        }`
  },

  // Add Linear validation after Facebook validation (before "try {")
  {
    search: /(}\s+}\s+)(try \{)/,
    replace: `$1
    // Validation for Linear OAuth
    if (linearEnabled) {
      if (!linearClientId || !linearClientSecret) {
        return fail(400, {
          error: 'Linear Client ID and Secret are required when Linear OAuth is enabled',
          googleEnabled,
          googleClientId,
          googleClientSecret,
          appleEnabled,
          appleClientId,
          appleClientSecret,
          twitterEnabled,
          twitterClientId,
          twitterClientSecret,
          facebookEnabled,
          facebookClientId,
          facebookClientSecret,
          linearEnabled,
          linearClientId,
          linearClientSecret
        })
      }

      // Linear Client ID validation - should be at least 10 characters
      if (linearClientId.length < 10) {
        return fail(400, {
          error: 'Invalid Linear Client ID format. It should be at least 10 characters long',
          googleEnabled,
          googleClientId,
          googleClientSecret,
          appleEnabled,
          appleClientId,
          appleClientSecret,
          twitterEnabled,
          twitterClientId,
          twitterClientSecret,
          facebookEnabled,
          facebookClientId,
          facebookClientSecret,
          linearEnabled,
          linearClientId,
          linearClientSecret
        })
      }

      // Linear Client Secret validation - should be at least 10 characters
      if (linearClientSecret.length < 10) {
        return fail(400, {
          error: 'Invalid Linear Client Secret format. It should be at least 10 characters long',
          googleEnabled,
          googleClientId,
          googleClientSecret,
          appleEnabled,
          appleClientId,
          appleClientSecret,
          twitterEnabled,
          twitterClientId,
          twitterClientSecret,
          facebookEnabled,
          facebookClientId,
          facebookClientSecret,
          linearEnabled,
          linearClientId,
          linearClientSecret
        })
      }
    }

    $2`
  },

  // Add Linear to settingsToSave logic (after Facebook enabled value)
  {
    search: /(const facebookEnabledValue = facebookEnabled \? 'true' : 'false';\s+if \(facebookEnabledValue !== \(currentSettings\.facebook_enabled \|\| 'false'\)\) \{\s+settingsToSave\.push\(\{ key: 'facebook_enabled', value: facebookEnabledValue, category: 'oauth', description: 'Enable Facebook OAuth login' \}\);\s+\})/,
    replace: `$1
      const linearEnabledValue = linearEnabled ? 'true' : 'false';
      if (linearEnabledValue !== (currentSettings.linear_enabled || 'false')) {
        settingsToSave.push({ key: 'linear_enabled', value: linearEnabledValue, category: 'oauth', description: 'Enable Linear OAuth for Client Portal' });
      }`
  },

  // Add Linear to credentials saving tracking
  {
    search: /(const facebookCredentialsSaving = shouldSaveValue\(facebookClientId, currentSettings\.facebook_client_id\) \|\| shouldSaveValue\(facebookClientSecret, currentSettings\.facebook_client_secret\);)/,
    replace: `$1
      const linearCredentialsSaving = shouldSaveValue(linearClientId, currentSettings.linear_client_id) || shouldSaveValue(linearClientSecret, currentSettings.linear_client_secret);`
  },

  // Add Linear force save enabled state
  {
    search: /(if \(facebookCredentialsSaving && facebookEnabledValue === \(currentSettings\.facebook_enabled \|\| 'false'\)\) \{\s+settingsToSave\.push\(\{ key: 'facebook_enabled', value: facebookEnabledValue, category: 'oauth', description: 'Enable Facebook OAuth login' \}\);\s+\})/,
    replace: `$1
      if (linearCredentialsSaving && linearEnabledValue === (currentSettings.linear_enabled || 'false')) {
        settingsToSave.push({ key: 'linear_enabled', value: linearEnabledValue, category: 'oauth', description: 'Enable Linear OAuth for Client Portal' });
      }`
  },

  // Add Linear client ID and secret saving
  {
    search: /(if \(shouldSaveValue\(facebookClientSecret, currentSettings\.facebook_client_secret\)\) \{\s+settingsToSave\.push\(\{ key: 'facebook_client_secret', value: facebookClientSecret!\.trim\(\), category: 'oauth', description: 'Facebook OAuth App Secret \(encrypted\)' \}\);\s+\})/,
    replace: `$1
      if (shouldSaveValue(linearClientId, currentSettings.linear_client_id)) {
        settingsToSave.push({ key: 'linear_client_id', value: linearClientId!.trim(), category: 'oauth', description: 'Linear OAuth client ID' });
      }
      if (shouldSaveValue(linearClientSecret, currentSettings.linear_client_secret)) {
        settingsToSave.push({ key: 'linear_client_secret', value: linearClientSecret!.trim(), category: 'oauth', description: 'Linear OAuth client secret (encrypted)' });
      }`
  },

  // Add Linear to success return
  {
    search: /(facebookEnabled: updatedSettings\.facebook_enabled === 'true',\s+facebookClientId: updatedSettings\.facebook_client_id \|\| '',\s+facebookClientSecret: updatedSettings\.facebook_client_secret \|\| ''\s+\})/,
    replace: `facebookEnabled: updatedSettings.facebook_enabled === 'true',
        facebookClientId: updatedSettings.facebook_client_id || '',
        facebookClientSecret: updatedSettings.facebook_client_secret || '',
        linearEnabled: updatedSettings.linear_enabled === 'true',
        linearClientId: updatedSettings.linear_client_id || '',
        linearClientSecret: updatedSettings.linear_client_secret || ''
      }`
  },

  // Add Linear to error return
  {
    search: /(error: 'Failed to save OAuth settings\. Please try again\.',\s+googleEnabled,\s+googleClientId,\s+googleClientSecret,\s+appleEnabled,\s+appleClientId,\s+appleClientSecret,\s+twitterEnabled,\s+twitterClientId,\s+twitterClientSecret,\s+facebookEnabled,\s+facebookClientId,\s+facebookClientSecret\s+\}\))/,
    replace: `error: 'Failed to save OAuth settings. Please try again.',
        googleEnabled,
        googleClientId,
        googleClientSecret,
        appleEnabled,
        appleClientId,
        appleClientSecret,
        twitterEnabled,
        twitterClientId,
        twitterClientSecret,
        facebookEnabled,
        facebookClientId,
        facebookClientSecret,
        linearEnabled,
        linearClientId,
        linearClientSecret
      })`
  }
];

patterns.forEach(({ search, replace }) => {
  content = content.replace(search, replace);
});

writeFileSync(file, content);
console.log('✅ Successfully added Linear OAuth support to server file');
