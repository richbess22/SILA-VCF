const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Admin password
const ADMIN_PASSWORD = 'sila0022';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Store contacts in memory (in production use database)
let contacts = [];
const CONTACTS_FILE = 'contacts.json';

// Load existing contacts
if (fs.existsSync(CONTACTS_FILE)) {
    try {
        const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
        contacts = JSON.parse(data);
    } catch (error) {
        console.log('No existing contacts found, starting fresh');
    }
}

// Save contacts to file
function saveContacts() {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

// Email transporter setup
let transporter;
if (process.env.GMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'silatrix22@gmail.com',
            pass: process.env.GMAIL_PASSWORD
        }
    });
}

// Send email with contacts
async function sendContactsToEmail() {
    if (!transporter || contacts.length < 200) return;
    
    const vcfContent = generateVCFContent();
    
    const mailOptions = {
        from: 'silatrix22@gmail.com',
        to: 'silatrix22@gmail.com',
        subject: '📱 NEW YEAR VCF Contacts Ready! 🎉',
        text: `Contacts collected: ${contacts.length}\n\nVCF file attached.`,
        attachments: [{
            filename: 'NEW YEAR VCF 🎉.vcf',
            content: vcfContent
        }]
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Contacts sent to email');
    } catch (error) {
        console.error('❌ Email error:', error);
    }
}

// Generate VCF content
function generateVCFContent() {
    let vcfContent = '';
    
    contacts.forEach(contact => {
        vcfContent += `BEGIN:VCARD
VERSION:3.0
FN:🐢SILA🇹🇿 ${contact.name}
TEL:${contact.phone}
`;
        
        if (contact.photo) {
            const base64Data = contact.photo.split(',')[1];
            vcfContent += `PHOTO;ENCODING=b;TYPE=JPEG:${base64Data}
`;
        }
        
        vcfContent += `NOTE:Collected via SILA TECH VCF Collector
END:VCARD
`;
    });
    
    return vcfContent;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get contact count
app.get('/api/count', (req, res) => {
    res.json({ 
        count: contacts.length,
        target: 200,
        progress: Math.round((contacts.length / 200) * 100)
    });
});

// Add contact
app.post('/api/contacts', (req, res) => {
    const { name, phone, photo } = req.body;
    
    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    const newContact = {
        id: Date.now(),
        name,
        phone,
        photo: photo || '',
        timestamp: new Date().toISOString(),
        ip: req.ip
    };
    
    contacts.push(newContact);
    saveContacts();
    
    // Check if target reached and send email
    if (contacts.length === 200 && transporter) {
        sendContactsToEmail();
    }
    
    res.json({ 
        success: true, 
        count: contacts.length,
        contact: newContact
    });
});

// Download VCF
app.get('/api/download-vcf', (req, res) => {
    const vcfContent = generateVCFContent();
    
    res.setHeader('Content-Type', 'text/vcard');
    res.setHeader('Content-Disposition', 'attachment; filename="NEW YEAR VCF 🎉.vcf"');
    res.send(vcfContent);
});

// Admin panel route
app.get('/admin', (req, res) => {
    // Check if user is trying to access admin
    const password = req.query.password;
    if (password === ADMIN_PASSWORD) {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        // Redirect to main page with admin button visible
        res.redirect('/?showAdmin=true');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        contacts: contacts.length,
        timestamp: new Date().toISOString()
    });
});

// Serve admin panel files
app.get('/admin.html', (req, res) => {
    res.redirect('/admin');
});

// 404 handler - redirect to main page
app.use((req, res) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📞 Total contacts: ${contacts.length}`);
    console.log(`🔐 Admin access: http://localhost:${PORT}/admin?password=${ADMIN_PASSWORD}`);
    console.log(`📧 Email: silatrix22@gmail.com`);
    console.log(`🌐 Main site: http://localhost:${PORT}`);
    console.log(`\n=== ADMIN CREDENTIALS ===`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Direct link: http://localhost:${PORT}/admin?password=${ADMIN_PASSWORD}`);
    console.log(`=========================\n`);
});
