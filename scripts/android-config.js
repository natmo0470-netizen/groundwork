// Adjusts the generated Android project (android/) after `npx cap add android`.
// Usage: node scripts/android-config.js <versionCode>
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), A = path.join(root, 'android');
const version = require(path.join(root, 'package.json')).version;
const code = process.argv[2] || '1';
const edit = (f, fn) => { const p = path.join(A, f); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };

// Health Connect needs Android 8.0 (API 26) or later.
edit('variables.gradle', s => s.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26'));
// Version numbers for the stores.
edit('app/build.gradle', s => s.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${version}"`));
// Privacy policy link that Health Connect shows to users.
edit('app/src/main/res/values/strings.xml', s => s.includes('health_connect_privacy_policy_url') ? s :
  s.replace('</resources>', '    <string name="health_connect_privacy_policy_url">https://movla.app/privacy.html</string>\n</resources>'));
// Permissions: camera for barcode scanning; Health Connect trimmed to only what Movla reads and writes,
// because the Play Console asks you to justify every declared health permission.
const KEEP = ['READ_STEPS', 'READ_ACTIVE_CALORIES_BURNED', 'READ_SLEEP', 'READ_RESTING_HEART_RATE', 'READ_WEIGHT', 'WRITE_WEIGHT', 'READ_BODY_FAT', 'READ_EXERCISE'];
const REMOVE = ['WRITE_STEPS', 'WRITE_BODY_FAT', 'READ_DISTANCE', 'WRITE_DISTANCE', 'WRITE_ACTIVE_CALORIES_BURNED', 'READ_HEART_RATE', 'WRITE_HEART_RATE', 'WRITE_SLEEP',
  'READ_RESPIRATORY_RATE', 'WRITE_RESPIRATORY_RATE', 'READ_OXYGEN_SATURATION', 'WRITE_OXYGEN_SATURATION', 'WRITE_RESTING_HEART_RATE',
  'READ_HEART_RATE_VARIABILITY', 'WRITE_HEART_RATE_VARIABILITY', 'READ_HEALTH_DATA_HISTORY'];
edit('app/src/main/AndroidManifest.xml', s => {
  if (!s.includes('xmlns:tools')) s = s.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
  const lines = ['    <uses-permission android:name="android.permission.CAMERA" />']
    .concat(KEEP.map(p => `    <uses-permission android:name="android.permission.health.${p}" />`))
    .concat(REMOVE.map(p => `    <uses-permission android:name="android.permission.health.${p}" tools:node="remove" />`));
  return s.replace('</manifest>', lines.join('\n') + '\n</manifest>');
});
// Invite links: movla://join/CODE (coach, and the older groundwork://join/CODE) and movla://group/CODE (family or challenge) open the app.
edit('app/src/main/AndroidManifest.xml', s => s.includes('android:scheme="movla"') ? s : s.replace('</activity>',
  `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="movla" android:host="join" />
                <data android:scheme="movla" android:host="group" />
                <data android:scheme="groundwork" android:host="join" />
            </intent-filter>
        </activity>`));
console.log(`Android configured: version ${version} (${code}), minSdk 26, health permissions trimmed, invite links`);
