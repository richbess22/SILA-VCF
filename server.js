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
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images
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
        console.log(`✅ Loaded ${globalContacts.length} existing contacts`);
    } catch (error) {
        console.log('⚠️ Starting fresh contacts database');
    }
} else {
    console.log('⚠️ No contacts file found, starting fresh');
}

// Save contacts to file
function saveContacts() {
    try {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(globalContacts, null, 2));
        console.log(`💾 Saved ${globalContacts.length} contacts to file`);
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

// ✅ Get REAL global count
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
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ✅ Add contact to GLOBAL collection
app.post('/api/add-contact', (req, res) => {
    try {
        const { name, phone, photo } = req.body;
        
        // Validate inputs
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required'
            });
        }
        
        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '').trim();
        
        // Check if phone already exists
        const existingContact = globalContacts.find(c => 
            c.phone.replace(/\D/g, '') === cleanPhone
        );
        
        if (existingContact) {
            return res.json({
                success: false,
                message: 'This phone number is already registered'
            });
        }
        
        // Create new contact
        const newContact = {
            id: Date.now(),
            name: name.trim(),
            phone: phone.trim(),
            photo: photo || '',
            timestamp: new Date().toISOString(),
            ip: req.ip || 'Unknown'
        };
        
        // Add to global collection
        globalContacts.push(newContact);
        saveContacts();
        
        const newCount = globalContacts.length;
        const targetReached = newCount >= 200;
        
        console.log(`✅ Contact added: ${name} (${phone}) - Total: ${newCount}`);
        
        res.json({
            success: true,
            message: 'Contact added successfully!',
            count: newCount,
            targetReached: targetReached,
            contact: newContact
        });
        
    } catch (error) {
        console.error('❌ Error adding contact:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// ✅ Download VCF file
app.get('/api/download-vcf', (req, res) => {
    try {
        if (globalContacts.length < 200) {
            return res.status(400).json({
                success: false,
                message: 'Need 200 contacts to download. Currently: ' + globalContacts.length
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
                // Remove data URL prefix if present
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
        console.error('❌ Error generating VCF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating VCF file'
        });
    }
});

// ✅ Get all contacts (for admin)
app.get('/api/all-contacts', (req, res) => {
    try {
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
                uniqueIPs: [...new Set(globalContacts.map(c => c.ip))].length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ✅ Simple admin login
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
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ✅ Health check
app.get('/health', (req, res) => {
    res.json({
        status: '✅ ONLINE',
        contacts: globalContacts.length,
        serverTime: new Date().toISOString(),
        version: '1.0.0'
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`📞 Current contacts: ${globalContacts.length}`);
    console.log(`🎯 Target: 200 contacts`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
    console.log(`✅ Test API: http://localhost:${PORT}/api/test`);
    console.log(`✅ Global count: http://localhost:${PORT}/api/global-count`);
});
