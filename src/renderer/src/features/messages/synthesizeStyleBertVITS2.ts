import { Language } from '../constants/settings'

const getLanguageCode = (selectLanguage: string): string => {
  switch (selectLanguage) {
    case 'ja':
      return 'JP'
    case 'en':
      return 'EN'
    case 'zh':
      return 'ZH'
    case 'zh-TW':
      return 'ZH'
    default:
      return 'JP'
  }
}

export async function synthesizeStyleBertVITS2Api(
  message: string,
  stylebertvits2ServerUrl: string,
  stylebertvits2ModelId: string,
  stylebertvits2Style: string,
  selectLanguage: Language
) {
  const languageCode = getLanguageCode(selectLanguage)
  const queryParams = new URLSearchParams({
    text: message,
    model_id: stylebertvits2ModelId,
    style: stylebertvits2Style,
    language: languageCode
  })

  try {
    const voice = await fetch(`${stylebertvits2ServerUrl}/voice?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'audio/wav'
      }
    })

    if (!voice.ok) {
      throw new Error(`サーバーからの応答が異常です。ステータスコード: ${voice.status}`)
    }

    // Buffer.fromの代わりに直接arrayBufferを返す
    return await voice.arrayBuffer()
  } catch (error: any) {
    throw new Error(`APIリクエスト中にエラーが発生しました: ${error.message}`)
  }
}
