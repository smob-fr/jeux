#!/usr/bin/env node
// Ajoute la configuration AdMob aux projets natifs générés par Capacitor (android/ et ios/ du jeu).
// À lancer depuis le dossier du jeu, après `npx cap add android` / `npx cap add ios` :
//   node ../../kit/outils/configure-admob.mjs        (ou : npm run admob:config)
// Les identifiants d'APPLICATION AdMob viennent de jeu.json › admob.android.appli et admob.ios.appli.
// Le message ATT d'iOS est écrit à partir du nom du jeu.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const jeu = JSON.parse(readFileSync("jeu.json", "utf8"));
const ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID || jeu.admob?.android?.appli;
const IOS_APP_ID = process.env.ADMOB_IOS_APP_ID || jeu.admob?.ios?.appli;
if (!ANDROID_APP_ID || !IOS_APP_ID) { console.error("jeu.json › admob.android.appli et admob.ios.appli sont nécessaires"); process.exit(1); }

// ---------- Android ----------
const manifest = "android/app/src/main/AndroidManifest.xml";
if (existsSync(manifest)) {
  let xml = readFileSync(manifest, "utf8");
  if (!xml.includes("com.google.android.gms.ads.APPLICATION_ID")) {
    xml = xml.replace(
      /<application([^>]*)>/,
      `<application$1>\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${ANDROID_APP_ID}"/>`
    );
  } else {
    xml = xml.replace(/(APPLICATION_ID" android:value=")[^"]*/, `$1${ANDROID_APP_ID}`);
  }
  if (!xml.includes("com.google.android.gms.permission.AD_ID")) {
    xml = xml.replace(/<\/manifest>/, `    <uses-permission android:name="com.google.android.gms.permission.AD_ID"/>\n</manifest>`);
  }
  writeFileSync(manifest, xml);
  console.log("✓ Android : AndroidManifest.xml configuré");
}

// ---------- iOS ----------
const plist = "ios/App/App/Info.plist";
if (existsSync(plist)) {
  let x = readFileSync(plist, "utf8");
  const add = (k, v) => {
    if (!x.includes(`<key>${k}</key>`)) x = x.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t${v}\n</dict>\n</plist>\n`);
  };
  if (x.includes("<key>GADApplicationIdentifier</key>")) {
    x = x.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*/, `$1${IOS_APP_ID}`);
  } else add("GADApplicationIdentifier", `<string>${IOS_APP_ID}</string>`);
  add("NSUserTrackingUsageDescription",
    `<string>Ton identifiant sert uniquement à afficher des publicités plus pertinentes dans ${jeu.nom}.</string>`);
  // Réseaux publicitaires SKAdNetwork (Google). Liste complète : https://developers.google.com/admob/ios/3p-skadnetworks
  add("SKAdNetworkItems", `<array>
\t\t<dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict>
\t</array>`);
  writeFileSync(plist, x);
  console.log("✓ iOS : Info.plist configuré");
}
if (!existsSync(manifest) && !existsSync(plist)) console.log("Aucun projet natif : lance d'abord npm run add:android ou npm run add:ios.");
