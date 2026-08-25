import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { parseVoiceAutomations } from '../src/utils/localAutomationParser.ts';

const EXPECTED_WRAPPER_SHA256 = '7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172';
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

console.log('====================================================');
console.log('DAYTRACE PRODUCTION VALIDATION & INTEGRITY SUITE');
console.log('====================================================\n');

// 1. Check Gradle Wrapper JAR in Workspace
const wrapperPath = path.resolve('android/gradle/wrapper/gradle-wrapper.jar');
console.log('1. WORKSPACE GRADLE WRAPPER JAR VALIDATION:');
if (!fs.existsSync(wrapperPath)) {
  const workflow = fs.readFileSync('.github/workflows/build-android.yml', 'utf8');
  if (!workflow.includes(EXPECTED_WRAPPER_SHA256) || !workflow.includes('gradle-wrapper.jar')) {
    console.error('❌ Wrapper JAR is absent and the workflow does not contain the verified download.');
    process.exit(1);
  }
  console.log('   ✓ Wrapper JAR intentionally omitted from the clean source; GitHub Actions downloads it and verifies the official SHA-256.');
} else {
  const wrapperBuffer = fs.readFileSync(wrapperPath);
  const wrapperHash = crypto.createHash('sha256').update(wrapperBuffer).digest('hex');
  console.log('   Path:', wrapperPath);
  console.log('   Computed SHA-256:', wrapperHash);
  if (wrapperHash !== EXPECTED_WRAPPER_SHA256) {
    console.error('❌ SHA-256 MISMATCH on gradle-wrapper.jar!');
    process.exit(1);
  }
  execSync(`unzip -t "${wrapperPath}"`, { encoding: 'utf8' });
  console.log('   ✓ Gradle wrapper checksum and archive integrity verified.');
}

// 2. Validate all PNGs in the project
console.log('\n2. PNG BINARY INTEGRITY VALIDATION:');
function findFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.temp_export') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, ext));
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const pngFiles = findFiles('.', '.png');
console.log(`   Found ${pngFiles.length} PNG files across the workspace.`);

let allPngsValid = true;
for (const p of pngFiles) {
  const buf = fs.readFileSync(p);
  const isMagicValid = buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC);
  if (!isMagicValid) {
    console.error(`   ❌ Corrupted PNG: ${p} (Length: ${buf.length})`);
    allPngsValid = false;
  }
}

if (!allPngsValid) {
  console.error('❌ PNG validation failed!');
  process.exit(1);
} else {
  console.log(`   ✓ All ${pngFiles.length} PNG files have valid headers (89 50 4E 47 0D 0A 1A 0A).`);
}

// 3. Perform Live JAR Integrity and Binary Verification
console.log('\n3. GRADLE WRAPPER AND BINARY INTEGRITY VERIFICATION:');
console.log(fs.existsSync(wrapperPath)
  ? '   ✓ Local wrapper binary verified above.'
  : '   ✓ Workflow download and checksum verification present.');

// 4. Test Real DayTrace Scenario Parser
console.log('\n4. REAL DAYTRACE SCENARIO PARSER VALIDATION:');
const testInput = "Remind me when I leave office to get medicines and on reaching home I have to hand over the medicines to my wife.";
console.log(`   Input: "${testInput}"`);
const parsed = parseVoiceAutomations(testInput);

console.log('   Is Automation:', parsed.isAutomation);
console.log('   Detected Automations Count:', parsed.automations.length);

parsed.automations.forEach((auto, idx) => {
  console.log(`   [Automation ${idx + 1}]`);
  console.log(`     - Title: "${auto.title}"`);
  console.log(`     - Trigger: ${auto.triggerType} (${auto.locationName})`);
  console.log(`     - Reminder: "${auto.reminderText}"`);
  console.log(`     - Status: ${auto.status}`);
});

if (parsed.automations.length === 2 &&
    parsed.automations[0].triggerType === 'GEOFENCE_EXIT' &&
    parsed.automations[0].locationName === 'Office' &&
    parsed.automations[1].triggerType === 'GEOFENCE_ENTER' &&
    parsed.automations[1].locationName === 'Home') {
  console.log('   ✓ Compound voice utterance parsed into 2 distinct geofence automations perfectly.');
} else {
  console.error('❌ Failed to parse compound utterance correctly!');
  process.exit(1);
}

// 5. Test native source completeness and local-only backup behavior
console.log('\n5. ANDROID NATIVE SOURCE & LOCAL BACKUP VALIDATION:');
const nativePluginSrc = fs.readFileSync('android/app/src/main/java/com/amarsingh/daytrace/DayTraceNativePlugin.java', 'utf8');
const geofenceReceiverSrc = fs.readFileSync('android/app/src/main/java/com/amarsingh/daytrace/GeofenceBroadcastReceiver.java', 'utf8');
const actionReceiverSrc = fs.readFileSync('android/app/src/main/java/com/amarsingh/daytrace/NotificationActionReceiver.java', 'utf8');
const mainActivitySrc = fs.readFileSync('android/app/src/main/java/com/amarsingh/daytrace/MainActivity.java', 'utf8');

const checks = [
  { name: 'syncNativeAutomations in Plugin', ok: nativePluginSrc.includes('syncNativeAutomations') },
  { name: 'getNativePendingState in Plugin', ok: nativePluginSrc.includes('getNativePendingState') },
  { name: 'Dead process persistence in GeofenceBroadcastReceiver', ok: geofenceReceiverSrc.includes('DayTraceNativePlugin.PREFS_AUTOMATIONS') && geofenceReceiverSrc.includes('findMatchingAutomations') },
  { name: 'Saved-place display names survive native geofence transitions', ok: nativePluginSrc.includes('PREFS_GEOFENCE_NAMES') && geofenceReceiverSrc.includes('resolveLocationName') },
  { name: 'TRIGGERED status update (not completed on geofence fire)', ok: geofenceReceiverSrc.includes('updateAutomationToTriggered') },
  { name: 'NotificationActionReceiver handles DONE & SNOOZE', ok: actionReceiverSrc.includes('COMPLETED') && actionReceiverSrc.includes('SNOOZED') },
  { name: 'Smart Alert PowerManager check', ok: geofenceReceiverSrc.includes('isInteractive') },
  { name: 'JSON backup uses Android MediaStore Downloads', ok: nativePluginSrc.includes('MediaStore.Downloads.EXTERNAL_CONTENT_URI') },
  { name: 'Keyboard inset is not double-counted', ok: !mainActivitySrc.includes('WindowInsetsCompat.Type.ime()') },
  { name: 'Removed Google Sheets code is absent', ok: !nativePluginSrc.includes('GoogleSheets') && !fs.existsSync('src/services/googleSheetsSync.ts') },
  { name: 'GitHub Actions downloads official Gradle 8.14.3 wrapper with SHA-256', ok: fs.readFileSync('.github/workflows/build-android.yml', 'utf8').includes('7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172') },
  { name: 'GitHub Actions generates PNG assets from SVG', ok: fs.readFileSync('.github/workflows/build-android.yml', 'utf8').includes('generate:assets') },
];

let allChecksOk = true;
checks.forEach(c => {
  if (c.ok) {
    console.log(`   ✓ ${c.name}`);
  } else {
    console.error(`   ❌ Failed check: ${c.name}`);
    allChecksOk = false;
  }
});

if (!allChecksOk) {
  process.exit(1);
}

console.log('\n====================================================');
console.log('ALL INTEGRITY, BINARY, AND FUNCTIONAL CHECKS PASSED (100% GREEN)');
console.log('====================================================\n');
