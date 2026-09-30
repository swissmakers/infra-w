// Start the client on 127.0.0.1:4173 first, then run yarn screenshots [name ...]
const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');
const sharp = require('sharp');
const { baseURL, chromium, contextOptions, installFixtures, FIXTURE_NOW } = require('../tests/support/ui-fixtures.cjs');

const OUTPUT = path.join(__dirname, '..', 'docs', 'assets', 'screenshots');
const MAX_BYTES = 300 * 1024;
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const STILL = '*, *::before, *::after { caret-color: transparent !important; }';

// the recording player rescales itself shortly after rendering
const settledScreenshot = async page => {
    let previous = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    for (let attempt = 0; attempt < 20; attempt++) {
        await page.waitForTimeout(250);
        const current = await page.screenshot({ animations: 'disabled', caret: 'hide' });
        if (current.equals(previous)) return current;
        previous = current;
    }
    throw new Error('the page did not settle');
};

const openWorkspace = async page => {
    await page.goto(baseURL + '/servers');
    await page.getByRole('heading', { name: 'Infrastructure access' }).waitFor();
    await page.locator('.host-row').first().waitFor();
};

const connectTerminal = async (page, fixture) => {
    fixture.connectionSucceeds = true;
    await openWorkspace(page);
    await page.evaluate(() => document.fonts.load("16px 'JetBrains Mono'"));
    await page.locator('.host-row', { hasText: 'edge-zrh-01' }).click();
    await page.locator('.xterm').getByText('node-exporter').waitFor();
};

const compareFiles = async (page, fixture) => {
    await connectTerminal(page, fixture);
    await page.locator('.server-tab').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'File manager', exact: true }).click();
    const fileManager = page.locator('[data-floating-windows] .file-manager-window');
    await fileManager.locator('.file-item h2', { hasText: 'architecture.svg' }).waitFor();
    const windows = page.locator('[data-floating-windows] .file-preview-window');
    // reduced motion still leaves a tiny transition
    const nextFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const place = async (index, x, y) => {
        const window = windows.nth(index);
        const resize = await window.locator('.floating-window-resize').boundingBox();
        await page.mouse.move(resize.x + 10, resize.y + 10);
        await page.mouse.down();
        await page.mouse.move(resize.x - 170, resize.y - 170, { steps: 4 });
        await page.mouse.up();
        await nextFrame();
        const header = await window.locator('.floating-window-header').boundingBox();
        await page.mouse.move(header.x + 80, header.y + 20);
        await page.mouse.down();
        await page.mouse.move(x + 80, y + 20, { steps: 4 });
        await page.mouse.up();
        await nextFrame();
    };
    await fileManager.locator('.file-item h2', { hasText: 'architecture.svg' }).click();
    await windows.nth(0).locator('img').waitFor();
    await place(0, 820, 470);
    await fileManager.locator('.file-item h2', { hasText: 'topology.svg' }).click();
    await windows.nth(1).locator('img').waitFor();
    await place(1, 150, 470);
    // opening the second file raised the file manager above the first preview
    const first = await windows.nth(0).boundingBox();
    await page.mouse.click(first.x + first.width - 30, first.y + first.height / 2);
    await nextFrame();
    await page.waitForFunction(() => [...document.querySelectorAll('.floating-window img')].every(img => img.complete && img.naturalWidth));
};

const shots = [
    { name: 'workspace-dark', run: openWorkspace },
    { name: 'workspace-light', scheme: 'light', run: openWorkspace },
    { name: 'terminal-dark', run: connectTerminal },
    { name: 'file-manager-dark', run: compareFiles },
    { name: 'file-manager-light', scheme: 'light', run: compareFiles },
    { name: 'snippets-dark', run: async page => {
        await page.goto(baseURL + '/snippets');
        await page.getByText('Listening ports').waitFor();
    } },
    { name: 'audit-replay-dark', run: async page => {
        await page.goto(baseURL + '/audit');
        // the player sizes its terminal once, so the font must be loaded before it opens
        await page.evaluate(() => document.fonts.load("16px 'Fira Code'"));
        await page.getByRole('button', { name: 'Replay session recording' }).first().click();
        await page.getByRole('button', { name: 'Play recording', exact: true }).click();
        await page.getByRole('button', { name: 'Forward 10 seconds', exact: true }).click();
        await page.locator('.recording-display-area').getByText('test is successful', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Play recording', exact: true }).waitFor();
    } },
    { name: 'settings-account-light', scheme: 'light', run: async page => {
        await page.goto(baseURL + '/settings/account');
        await page.locator('.account-page').waitFor();
    } },
    { name: 'settings-ldap-dark', run: async page => {
        await page.goto(baseURL + '/settings/authentication');
        await page.getByRole('button', { name: 'Add LDAP', exact: true }).click();
        await page.getByLabel('Directory domain', { exact: true }).fill('corp.example.com');
        await page.getByRole('button', { name: 'Apply defaults', exact: true }).click();
        if (await page.getByLabel('Host', { exact: true }).inputValue() !== 'ipa.corp.example.com') throw new Error('LDAP preset was not applied');
        await page.locator('.dialog').evaluate(dialog => { dialog.scrollTop = 0; document.activeElement?.blur(); });
    } },
    { name: 'settings-integrations-dark', run: async page => {
        await page.goto(baseURL + '/settings/integrations');
        await page.getByText('NetBox Zurich DC').waitFor();
    } },
    { name: 'login-dark', run: async (page, fixture) => {
        fixture.signedIn = false;
        await page.addInitScript(() => localStorage.removeItem('sessionToken'));
        await page.goto(baseURL + '/');
        await page.getByText('Sign in to your infrastructure workspace.').waitFor();
    } },
    { name: 'mobile-workspace-dark', options: MOBILE, run: openWorkspace },
];

(async () => {
    const selected = process.argv.slice(2);
    const unknown = selected.filter(name => !shots.some(shot => shot.name === name));
    if (unknown.length) throw new Error(`Unknown screenshots: ${unknown.join(', ')}`);
    await mkdir(OUTPUT, { recursive: true });
    // without these flags edges can differ by one color level between runs
    const browser = await chromium.launch({ args: ['--num-raster-threads=1', '--disable-partial-raster', '--force-color-profile=srgb'] });
    const failures = [];
    try {
        for (const shot of shots.filter(shot => !selected.length || selected.includes(shot.name))) {
            const context = await browser.newContext({ ...contextOptions, colorScheme: shot.scheme || 'dark', ...shot.options });
            await context.clock.setFixedTime(FIXTURE_NOW);
            const fixture = await installFixtures(context);
            fixture.user.preferences = { ...fixture.user.preferences, theme: { mode: 'auto' },
                terminal: { cursorBlink: false, fontFamily: "'JetBrains Mono', monospace" } };
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await shot.run(page, fixture);
            await page.mouse.move(0, 0);
            await page.addStyleTag({ content: STILL });
            await page.evaluate(() => document.fonts.ready);
            const png = await settledScreenshot(page);
            const file = path.join(OUTPUT, `${shot.name}.png`);
            const compressed = await sharp(png).png({ palette: true, colors: 256, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer();
            await writeFile(file, compressed);
            if (errors.length) failures.push(`${shot.name}: page errors: ${errors.join('; ')}`);
            if (compressed.length > MAX_BYTES) failures.push(`${shot.name}: ${Math.round(compressed.length / 1024)} KB exceeds ${MAX_BYTES / 1024} KB`);
            console.log(`${shot.name}.png ${Math.round(compressed.length / 1024)} KB`);
            await context.close();
        }
    } finally { await browser.close(); }
    if (failures.length) throw new Error(failures.join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
