#!/bin/bash
# Test script to simulate WhatsApp sending a message to your webhook

echo "🧪 Testing webhook..."

curl -X POST https://whatscrm-webhook.onrender.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5215512345678",
            "text": {
              "body": "Hola, esto es una prueba del webhook!"
            }
          }]
        }
      }]
    }]
  }'

echo ""
echo "✅ Request sent! Check Render logs for:"
echo "   📥 Webhook POST received:"
echo "   ✅ Message from..."
