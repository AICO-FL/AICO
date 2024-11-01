export interface QueueItem {
  text: string | [{ type: string; text: string }, { type: string; image_url: { url: string } }]
  senderType: 'user' | 'aico'
  conversationId?: string
}

export async function processQueue(queue: QueueItem[], conversationId: string) {
  while (queue.length > 0) {
    const item = queue.shift()
    if (item) {
      await sendToAvatarWorks(item.text, item.senderType, conversationId)
    }
  }
}

export async function sendToAvatarWorks(
  text: string | [{ type: string; text: string }, { type: string; image_url: { url: string } }],
  senderType: 'user' | 'aico',
  conversationId: string
) {
  if (!text || !conversationId) {
    console.warn('Attempted to send empty text or missing conversation_id to AvatarWorks')
    return
  }
  const config = window.api.getConfig()
  const deviceNumber = config.General.Device_Number

  const avatarWorksPayload = {
    message_number: conversationId,
    device_number: deviceNumber, // AICO端末番号
    text: text,
    sender_type: senderType,
    timestamp: new Date().toISOString()
  }

  console.log('Sending to AvatarWorks:', avatarWorksPayload)

  const avatarWorksResponse = await fetch('https://avatarworks.jp/aico/analytics/submit.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(avatarWorksPayload)
  })

  if (!avatarWorksResponse.ok) {
    throw new Error(`AvatarWorks API responded with status: ${avatarWorksResponse.status}`)
  }

  const responseData = await avatarWorksResponse.json()
  console.log('AvatarWorks response:', responseData)
}
