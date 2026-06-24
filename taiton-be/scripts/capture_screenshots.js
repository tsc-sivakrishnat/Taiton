import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\2f1ebaaf-a5a8-49fc-8ae8-23ba464dd4b8';

async function waitSec(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  try {
    // 1. Capture Login Page
    console.log('Navigating to Login Page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await waitSec(1000);
    const loginPath = path.join(ARTIFACT_DIR, 'login_page_visual.png');
    await page.screenshot({ path: loginPath });
    console.log(`✔ Captured Login Page: ${loginPath}`);

    // 2. Perform Login
    console.log('Logging in as Platform Administrator...');
    await page.type('input[type="email"]', 'rakesht@techtrole.com');
    await page.type('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await waitSec(2000);
    const dashPath = path.join(ARTIFACT_DIR, 'dashboard_page_visual.png');
    await page.screenshot({ path: dashPath });
    console.log(`✔ Captured Dashboard: ${dashPath}`);

    // Extract storage key to inspect org lists if needed
    const storageData = await page.evaluate(() => localStorage.getItem('cpanel.session'));
    const parsed = JSON.parse(storageData || '{}');
    const token = parsed.token;
    console.log(`✔ Authenticated session found. Token exists: ${!!token}`);

    // 3. Capture Onboarding Organizations
    console.log('Navigating to Onboarding Organizations...');
    await page.goto('http://localhost:5173/app/onboarding/organizations', { waitUntil: 'networkidle2' });
    await waitSec(2000);
    const orgPath = path.join(ARTIFACT_DIR, 'onboarding_org_visual.png');
    await page.screenshot({ path: orgPath });
    console.log(`✔ Captured Onboarding Organizations: ${orgPath}`);

    // Find first organization ID in list if present, otherwise default to 1
    const orgId = await page.evaluate(() => {
      // Find first organization ID from tile URL `/app/onboarding/roles?orgId=x`
      const firstTileBtn = document.querySelector('article.cp-org-tile a[href*="orgId="]');
      if (firstTileBtn) {
        const match = firstTileBtn.getAttribute('href').match(/orgId=(\d+)/);
        return match ? match[1] : '1';
      }
      return '1';
    });
    console.log(`✔ Selected Organization ID for subsequent checks: ${orgId}`);

    // 4. Capture Onboarding Roles
    console.log(`Navigating to Onboarding Roles for orgId=${orgId}...`);
    await page.goto(`http://localhost:5173/app/onboarding/roles?orgId=${orgId}`, { waitUntil: 'networkidle2' });
    await waitSec(2000);
    const rolesPath = path.join(ARTIFACT_DIR, 'onboarding_roles_visual.png');
    await page.screenshot({ path: rolesPath });
    console.log(`✔ Captured Onboarding Roles: ${rolesPath}`);

    // 5. Capture Onboarding Nav Items
    console.log(`Navigating to Onboarding Nav Items for orgId=${orgId}...`);
    await page.goto(`http://localhost:5173/app/onboarding/nav?orgId=${orgId}`, { waitUntil: 'networkidle2' });
    await waitSec(2000);
    const navPath = path.join(ARTIFACT_DIR, 'onboarding_nav_visual.png');
    await page.screenshot({ path: navPath });
    console.log(`✔ Captured Onboarding Nav Items: ${navPath}`);

  } catch (e) {
    console.error('Error during visual capture:', e);
  } finally {
    await browser.close();
    console.log('Headless Chrome closed.');
  }
}

run();
