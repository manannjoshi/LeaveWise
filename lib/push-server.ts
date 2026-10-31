import webPush from "web-push";

// Configure VAPID only on the server, so the private key never reaches the browser.
export function getWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID environment variables are missing.");
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return webPush;
}
