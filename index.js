require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// Configuration
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const APP_ID = process.env.APP_ID || 'whatscrm-axel';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MI_TOKEN_SECRETO';

// Firestore REST API base URL
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Helper: Make Firestore REST API request
async function firestoreRequest(path, method = 'GET', body = null) {
    const url = `${FIRESTORE_BASE}${path}?key=${FIREBASE_API_KEY}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Firestore API error (${response.status}):`, errorText);
        throw new Error(`Firestore API error: ${response.status}`);
    }
    return response.json();
}

// Helper: Convert Firestore value to JS value
function firestoreValueToJS(value) {
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue);
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    return null;
}

// Helper: Convert JS value to Firestore value
function jsValueToFirestore(value) {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') return { integerValue: value.toString() };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    return { stringValue: String(value) };
}

// Helper: Get current timestamp
function getTimestamp() {
    return { timestampValue: new Date().toISOString() };
}

// Health check
app.get('/', (req, res) => {
    res.send('WhatsApp Webhook is running! 🚀');
});

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Webhook messages (POST)
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // Log everything that arrives
    console.log('📥 Webhook POST received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
        console.log('✅ WhatsApp Business Account event detected');
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;
            const text = message.text ? message.text.body : "";

            // Get contact name from WhatsApp profile
            const contacts = body.entry[0].changes[0].value.contacts;
            const profileName = contacts && contacts[0] && contacts[0].profile && contacts[0].profile.name
                ? contacts[0].profile.name
                : from; // Use full phone number if no name

            if (!text) {
                res.sendStatus(200);
                return;
            }

            try {
                const leadsPath = `/artifacts/${APP_ID}/public/data/leads`;

                // 1. Query for existing lead by phone
                const queryUrl = `${FIRESTORE_BASE}${leadsPath}:runQuery?key=${FIREBASE_API_KEY}`;
                const queryBody = {
                    structuredQuery: {
                        from: [{ collectionId: 'leads' }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: 'phone' },
                                op: 'EQUAL',
                                value: { stringValue: from }
                            }
                        },
                        limit: 1
                    }
                };

                const queryResponse = await fetch(queryUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(queryBody)
                });

                const queryResults = await queryResponse.json();
                console.log('🔍 Query results:', JSON.stringify(queryResults, null, 2));

                let leadId;
                let leadDocPath;

                // Check if lead exists - fixed the check
                const leadExists = queryResults && queryResults.length > 0 && queryResults[0].document;

                if (!leadExists) {
                    console.log('📝 Creating new lead for', from);

                    // Create new lead with unique ID
                    leadId = `lead_${from.replace(/\+/g, '')}`; // Use phone as ID to prevent duplicates
                    leadDocPath = `${leadsPath}/${leadId}`;

                    // Get next agent for Round Robin
                    const agents = ['demo_agent_juan', 'demo_agent_maria'];
                    const agentNames = ['Vendedor Juan', 'Vendedor María'];

                    // Simple Round Robin: use timestamp to alternate
                    const agentIndex = Math.floor(Date.now() / 1000) % agents.length;

                    const newLeadData = {
                        fields: {
                            name: { stringValue: profileName },
                            phone: { stringValue: from },
                            status: { stringValue: 'nuevo' },
                            unreadCount: { integerValue: '1' },
                            lastMessage: { stringValue: text },
                            lastMessageTime: getTimestamp(),
                            assignedTo: { stringValue: agents[agentIndex] },
                            assignedName: { stringValue: agentNames[agentIndex] }
                        }
                    };

                    await firestoreRequest(leadDocPath, 'PATCH', newLeadData);
                    console.log(`✅ Created lead ${leadId} assigned to ${agentNames[agentIndex]}`);
                } else {
                    console.log('🔄 Updating existing lead');

                    // Update existing lead
                    const existingDoc = queryResults[0].document;
                    leadDocPath = existingDoc.name.split('/documents')[1];
                    leadId = leadDocPath.split('/').pop();

                    const currentUnread = existingDoc.fields.unreadCount ? parseInt(existingDoc.fields.unreadCount.integerValue) : 0;

                    const updateData = {
                        fields: {
                            ...existingDoc.fields,
                            name: { stringValue: profileName }, // Update name in case it changed
                            lastMessage: { stringValue: text },
                            lastMessageTime: getTimestamp(),
                            unreadCount: { integerValue: String(currentUnread + 1) }
                        }
                    };

                    await firestoreRequest(leadDocPath, 'PATCH', updateData);
                    console.log(`✅ Updated lead ${leadId}`);
                }

                // 2. Save message to subcollection
                const messageId = `msg_${Date.now()}`;
                const messagePath = `/artifacts/${APP_ID}/public/data/messages_${leadId}/${messageId}`;

                const messageData = {
                    fields: {
                        text: { stringValue: text },
                        senderId: { stringValue: 'lead' },
                        senderRole: { stringValue: 'lead' },
                        timestamp: getTimestamp(),
                        read: { booleanValue: false }
                    }
                };

                await firestoreRequest(messagePath, 'PATCH', messageData);

                console.log(`✅ Message from ${profileName} (${from}): ${text}`);
            } catch (error) {
                console.error("Error en Firestore:", error);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
});
