import { getAIChatResponseStream } from '../features/chat/aiChatFactory'
import { AIService, AIServiceConfig } from '../features/constants/settings'
import { textsToScreenplay, Message } from '../features/messages/messages'
import { speakCharacter } from '../features/messages/speakCharacter'
import homeStore from '../features/stores/home'
import settingsStore from '../features/stores/settings'

const config = window.api.getConfig()
const difyKey = config.General.Dify_API_Key
const difyUrl = config.General.Dify_API_URL

/**
 * AIからの応答を処理する関数
 * @param currentChatLog ログに残るメッセージの配列
 * @param messages 解答生成に使用するメッセージの配列
 */
export const processAIResponse = async (currentChatLog: Message[], messages: Message[]) => {
  homeStore.setState({ chatProcessing: true })
  let stream

  const ss = settingsStore.getState()
  const hs = homeStore.getState()

  const aiServiceConfig: AIServiceConfig = {
    openai: {
      key: ss.openAiKey || '',
      model: ss.selectAIModel
    },
    anthropic: {
      key: ss.anthropicKey || '',
      model: ss.selectAIModel
    },
    dify: {
      key: ss.difyKey || difyKey,
      url: ss.difyUrl || difyUrl,
      conversationId: ss.difyConversationId || '' // 空文字列をデフォルト値として設定
    }
  }

  try {
    stream = await getAIChatResponseStream(
      ss.selectAIService as AIService,
      messages,
      aiServiceConfig
    )
  } catch (e) {
    console.error(e)
    stream = null
  }

  if (stream == null) {
    homeStore.setState({ chatProcessing: false })
    return
  }

  const reader = stream.getReader()
  let receivedMessage = ''
  let aiTextLog: Message[] = [] // 会話ログ欄で使用
  let tag = ''
  let isCodeBlock = false
  let codeBlockText = ''
  const sentences = new Array<string>() // AssistantMessage欄で使用
  let streamedText = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done && receivedMessage.length === 0) break

      if (value) {
        // 受信したデータに改行コードが含まれているかをログ出力
        console.log('受信データ:', value)
        console.log('改行コードを含む:', value.includes('\n'))

        if (value === '[SEARCHING_START]') {
          homeStore.setState({ isSearchingInformation: true })
          continue
        } else if (value === '[SEARCHING_END]') {
          homeStore.setState({ isSearchingInformation: false })
          continue
        }

        receivedMessage += value
        streamedText += value // ストリームされたテキストを追加

        // streamedTextの内容をログ出力
        console.log('streamedText:', JSON.stringify(streamedText))

        // ストリームされたテキストをリアルタイムで表示（遅延を減らすためにsetTimeoutを使用）
        setTimeout(() => {
          homeStore.setState({ assistantMessage: streamedText })
        }, 0)
      }

      // 返答内容のタグ部分と返答部分を分離
      const tagMatch = receivedMessage.match(/^\[(.*?)\]/)
      if (tagMatch && tagMatch[0]) {
        tag = tagMatch[0]
        receivedMessage = receivedMessage.slice(tag.length)
      }

      // 返答を一文単位で切り出して処理する
      while (receivedMessage.length > 0) {
        const sentenceMatch = receivedMessage.match(/^(.+?[。．.!?！？\n]|.{20,}[、,])/)
        if (sentenceMatch?.[0]) {
          let sentence = sentenceMatch[0]
          // 区切った文字をsentencesに追加
          sentences.push(sentence)
          // 区切った文字の残りでreceivedMessageを更新
          receivedMessage = receivedMessage.slice(sentence.length)

          // 発話不要/不可能な文字列だった場合はスキップ
          if (
            !sentence.includes('```') &&
            !sentence.replace(
              /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
              ''
            )
          ) {
            continue
          }

          // タグと返答を結合（音声再生で使用される）
          let aiText = `${tag} ${sentence}`
          console.log('aiText', aiText)

          if (isCodeBlock && !sentence.includes('```')) {
            codeBlockText += sentence
            continue
          }

          if (sentence.includes('```')) {
            if (isCodeBlock) {
              // コードブロックの終了処理
              const [codeEnd, ...restOfSentence] = sentence.split('```')
              aiTextLog.push({
                role: 'code',
                content: codeBlockText + codeEnd
              })
              aiText += `${tag} ${restOfSentence.join('```') || ''}`

              // AssistantMessage欄の更新
              homeStore.setState({ assistantMessage: sentences.join(' ') })

              codeBlockText = ''
              isCodeBlock = false
            } else {
              // コードブロックの開始処理
              isCodeBlock = true
              ;[aiText, codeBlockText] = aiText.split('```')
            }

            sentence = sentence.replace(/```/g, '')
          }

          const aiTalks = textsToScreenplay([aiText])
          aiTextLog.push({ role: 'assistant', content: sentence })

          // 文ごとに音声を生成 & 再生、返答を表示
          const currentAssistantMessage = sentences.join(' ')
          console.log('メッセージを読み上げます：', sentence)
          speakCharacter(
            aiTalks[0],
            () => {
              homeStore.setState({
                assistantMessage: currentAssistantMessage
              })
              hs.incrementChatProcessingCount()
            },
            () => {
              hs.decrementChatProcessingCount()
            }
          )
        } else {
          // マッチする文がない場合、ループを抜ける
          break
        }
      }

      // ストリームが終了し、receivedMessageが空でない場合の処理
      if (done && receivedMessage.length > 0) {
        // 残りのメッセージを処理
        const aiText = `${tag} ${receivedMessage}`
        const aiTalks = textsToScreenplay([aiText])
        aiTextLog.push({ role: 'assistant', content: receivedMessage })
        sentences.push(receivedMessage)

        const currentAssistantMessage = sentences.join('\n')
        console.log('ストリーム終了時のメッセージを読み上げます')
        speakCharacter(
          aiTalks[0],
          () => {
            homeStore.setState({
              assistantMessage: currentAssistantMessage
            })
            hs.incrementChatProcessingCount()
          },
          () => {
            hs.decrementChatProcessingCount()
          }
        )
        receivedMessage = ''
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    reader.releaseLock()
  }

  // 直前のroleと同じならば、contentを結合し、空のcontentを除外する
  let lastImageUrl = ''
  aiTextLog = aiTextLog
    .reduce((acc: Message[], item: Message) => {
      if (typeof item.content != 'string' && item.content[0] && item.content[1].image_url) {
        lastImageUrl = item.content[1].image_url.url
      }

      const lastItem = acc[acc.length - 1]
      if (lastItem && lastItem.role === item.role) {
        if (typeof item.content != 'string') {
          lastItem.content += ' ' + item.content[0].text
        } else {
          lastItem.content += ' ' + item.content
        }
      } else {
        const text = typeof item.content != 'string' ? item.content[0].text : item.content
        if (lastImageUrl != '') {
          acc.push({
            ...item,
            content: [
              { type: 'text', text: text.trim() },
              { type: 'image_url', image_url: { url: lastImageUrl } }
            ]
          })
          lastImageUrl = ''
        } else {
          acc.push({ ...item, content: text.trim() })
        }
      }
      return acc
    }, [])
    .filter((item) => item.content !== '')

  homeStore.setState({
    chatLog: [...currentChatLog, ...aiTextLog],
    chatProcessing: false,
    isSearchingInformation: false,
    assistantMessage: streamedText // 最終的なストリームテキストを設定
  })
}

/**
 * アシスタントとの会話を行う
 */
export const handleSendChatFn =
  (errors: { NotConnectedToExternalAssistant: string; APIKeyNotEntered: string }) =>
  async (text: string, role?: string) => {
    console.log('handleSendChatFn text', text)
    const newMessage = text

    if (newMessage === null) return

    const ss = settingsStore.getState()
    const hs = homeStore.getState()

    // ChatVRM original mode
    const emptyKeys = [
      ss.selectAIService === 'openai' && !ss.openAiKey,
      ss.selectAIService === 'anthropic' && !ss.anthropicKey,
      ss.selectAIService === 'dify' && !ss.difyKey && !difyKey
    ]
    console.log('emptyKeys', emptyKeys)
    if (emptyKeys.includes(true)) {
      homeStore.setState({ assistantMessage: errors['APIKeyNotEntered'] })
      console.log('set assistantMessage', errors['APIKeyNotEntered'])
      return
    }

    homeStore.setState({ chatProcessing: true, assistantMessage: '' })
    console.log('start chat processing')
    // ユーザーの発言を追加して表示
    const messageLog: Message[] = [
      ...hs.chatLog,
      {
        role: 'user',
        content:
          hs.modalImage &&
          ss.selectAIService === 'openai' &&
          (ss.selectAIModel === 'gpt-4o-mini' ||
            ss.selectAIModel === 'gpt-4o' ||
            ss.selectAIModel === 'gpt-4-turbo')
            ? [
                { type: 'text', text: newMessage },
                { type: 'image_url', image_url: { url: hs.modalImage } }
              ]
            : newMessage
      }
    ]
    if (hs.modalImage) {
      homeStore.setState({ modalImage: '' })
    }
    homeStore.setState({ chatLog: messageLog, assistantMessage: '' })

    // TODO: AIに送信するメッセージの加工、処理がひどいので要修正
    const processedMessageLog = messageLog.map((message) => ({
      role: ['assistant', 'user', 'system'].includes(message.role) ? message.role : 'assistant',
      content:
        typeof message.content === 'string' ||
        (ss.selectAIService === 'openai' &&
          (ss.selectAIModel === 'gpt-4o-mini' ||
            ss.selectAIModel === 'gpt-4o' ||
            ss.selectAIModel === 'gpt-4-turbo'))
          ? message.content
          : message.content[0].text
    }))

    const messages: Message[] = [
      {
        role: 'system',
        content: ss.systemPrompt
      },
      ...processedMessageLog.slice(-10)
    ]

    try {
      await processAIResponse(messageLog, messages)
    } catch (e) {
      console.error(e)
    }

    homeStore.setState({ chatProcessing: false })
  }
