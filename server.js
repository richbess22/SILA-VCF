const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('.'));

// Store contacts globally
let globalContacts = [];
const CONTACTS_FILE = 'contacts.json';

// Load existing contacts
if (fs.existsSync(CONTACTS_FILE)) {
    try {
        const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
        globalContacts = JSON.parse(data);
        console.log(`✅ Loaded ${globalContacts.length} contacts from file`);
    } catch (error) {
        console.log('⚠️ Starting fresh contacts database');
    }
}

// Save contacts to file
function saveContacts() {
    try {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(globalContacts, null, 2));
    } catch (error) {
        console.error('❌ Error saving contacts:', error);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ✅ Get global count
app.get('/api/global-count', (req, res) => {
    try {
        res.json({
            success: true,
            count: globalContacts.length,
            target: 200,
            remaining: Math.max(0, 200 - globalContacts.length),
            progress: Math.min(100, Math.round((globalContacts.length / 200) * 100))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ✅ Add contact
app.post('/api/add-contact', (req, res) => {
    try {
        const { name, phone, photo } = req.body;
        
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required'
            });
        }
        
        const cleanPhone = phone.replace(/\D/g, '').trim();
        const existingContact = globalContacts.find(c => 
            c.phone.replace(/\D/g, '') === cleanPhone
        );
        
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
            ip: req.ip || 'Unknown'
        };
        
        globalContacts.push(newContact);
        saveContacts();
        
        const newCount = globalContacts.length;
        
        res.json({
            success: true,
            message: 'Contact added successfully!',
            count: newCount,
            targetReached: newCount >= 200,
            contact: newContact
        });
        
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// ✅ Get all contacts (for admin)
app.get('/api/all-contacts', (req, res) => {
    try {
        // Calculate stats
        const today = new Date().toDateString();
        const todayContacts = globalContacts.filter(c => 
            new Date(c.timestamp).toDateString() === today
        ).length;
        
        const withPhotos = globalContacts.filter(c => c.photo).length;
        
        res.json({
            success: true,
            contacts: globalContacts,
            total: globalContacts.length,
            stats: {
                today: todayContacts,
                withPhotos: withPhotos,
                uniqueIPs: [...new Set(globalContacts.map(c => c.ip))].length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ Download VCF
app.get('/api/download-vcf', (req, res) => {
    try {
        if (globalContacts.length < 200) {
            return res.status(400).json({
                success: false,
                message: 'Need 200 contacts to download. Currently have: ' + globalContacts.length
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
                const base64Data = contact.photo.includes('base64,') 
                    ? contact.photo.split(',')[1] 
                    : contact.photo;
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
        
    } catch (error) {
        console.error('Error generating VCF:', error);
        res.status(500).json({ success: false, message: 'Error generating VCF' });
    }
});

// ✅ Admin login
app.post('/api/admin/login', (req, res) => {
    try {
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
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ Health check
app.get('/health', (req, res) => {
    res.json({
        status: '✅ ONLINE',
        contacts: globalContacts.length,
        serverTime: new Date().toISOString()
    });
});

// ✅ Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Server is working!',
        time: new Date().toISOString()
    });
});

// ✅ Export JSON
app.get('/api/export/json', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="contacts-export.json"');
        res.send(JSON.stringify(globalContacts, null, 2));
    } catch (error) {
        res.status(500).json({ success: false, message: 'Export failed' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`📞 Current contacts: ${globalContacts.length}`);
    console.log(`🌐 Main site: http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`✅ Password: sila0022`);
});
