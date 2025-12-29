const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Store contacts globally (shared for all users)
let globalContacts = [];
const CONTACTS_FILE = 'contacts.json';
const COUNTER_FILE = 'counter.json';

// Load existing contacts
if (fs.existsSync(CONTACTS_FILE)) {
    try {
        const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
        globalContacts = JSON.parse(data);
    } catch (error) {
        console.log('Starting fresh contacts database');
    }
}

// Save contacts to file
function saveContacts() {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(globalContacts, null, 2));
}

// Get real-time global count
app.get('/api/global-count', (req, res) => {
    res.json({
        count: globalContacts.length,
        target: 200,
        remaining: Math.max(0, 200 - globalContacts.length),
        progress: Math.min(100, Math.round((globalContacts.length / 200) * 100))
    });
});

// Add contact to GLOBAL collection
app.post('/api/add-contact', (req, res) => {
    const { name, phone, photo } = req.body;
    
    if (!name || !phone) {
        return res.status(400).json({
            success: false,
            error: 'Name and phone are required'
        });
    }
    
    // Check if contact already exists (by phone number)
    const existingContact = globalContacts.find(c => c.phone === phone);
    if (existingContact) {
        return res.json({
            success: false,
            message: 'This phone number is already registered'
        });
    }
    
    const newContact = {
        id: Date.now(),
        name: name.trim(),
        phone: phone.trim(),
        photo: photo || '',
        timestamp: new Date().toISOString(),
        ip: req.ip
    };
    
    // Add to GLOBAL collection
    globalContacts.push(newContact);
    saveContacts();
    
    const newCount = globalContacts.length;
    const targetReached = newCount >= 200;
    
    // If target reached, prepare VCF file
    if (targetReached && newCount === 200) {
        console.log(`🎉 TARGET REACHED! 200 contacts collected!`);
    }
    
    res.json({
        success: true,
        message: 'Contact added successfully',
        count: newCount,
        targetReached: targetReached,
        contact: newContact
    });
});

// Download VCF file
app.get('/api/download-vcf', (req, res) => {
    if (globalContacts.length < 200) {
        return res.status(400).json({
            success: false,
            message: 'Target not reached yet (200 contacts required)'
        });
    }
    
    let vcfContent = '';
    
    globalContacts.forEach(contact => {
        vcfContent += `BEGIN:VCARD
VERSION:3.0
FN:${contact.name}
TEL:${contact.phone}
`;
        
        if (contact.photo) {
            const base64Data = contact.photo.split(',')[1] || contact.photo;
            vcfContent += `PHOTO;ENCODING=b;TYPE=JPEG:${base64Data}
`;
        }
        
        vcfContent += `NOTE:Collected via SILA TECH VCF Collector
END:VCARD
`;
    });
    
    res.setHeader('Content-Type', 'text/vcard');
    res.setHeader('Content-Disposition', 'attachment; filename="NEW YEAR VCF 🎉.vcf"');
    res.send(vcfContent);
});

// Get all contacts (for admin)
app.get('/api/all-contacts', (req, res) => {
    res.json({
        success: true,
        contacts: globalContacts,
        total: globalContacts.length,
        stats: {
            today: globalContacts.filter(c => {
                const today = new Date().toDateString();
                return new Date(c.timestamp).toDateString() === today;
            }).length,
            withPhotos: globalContacts.filter(c => c.photo).length,
            uniqueUsers: [...new Set(globalContacts.map(c => c.ip))].length
        }
    });
});

// Admin login (simple)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === 'sila0022') {
        res.json({
            success: true,
            token: 'admin_' + Date.now(),
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid password'
        });
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        contacts: globalContacts.length,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📞 Global contacts: ${globalContacts.length}`);
    console.log(`🎯 Target: 200 contacts`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
});
