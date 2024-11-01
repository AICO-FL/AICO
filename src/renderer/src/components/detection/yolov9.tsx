import { useRef, useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as ort from 'onnxruntime-web/webgpu'
import { setHeadDetected } from '../../features/detection/detectionSlice'

import * as Comlink from 'comlink'
import type { YoloWorker } from '../../workers/yolov9.worker'

const MODEL_INPUT_WIDTH = 640
const MODEL_INPUT_HEIGHT = 480

// 色の定義
const classColors = [
  '#00FFFF', // 0: 水色
  '#000000', // 1: 黒
  '#FFFF00', // 2: 黄色
  '#0000FF', // 3: 青
  '#FF0000', // 4: 赤
  '#FFFFFF', // 5: 白
  '#FFFFFF', // 6: 白
  '#008000', // 7: 緑色
  '#FF6347', // 8: トマト色
  '#4682B4', // 9: スチールブルー
  '#32CD32', // 10: ライムグリーン
  '#FFD700', // 11: ゴールド
  '#8A2BE2', // 12: ブルーバイオレット
  '#FF4500', // 13: オレンジレッド
  '#1E90FF', // 14: ドジャーブルー
  '#3CB371', // 15: ミディアムシーグリーン
  '#DAA520', // 16: ゴールデンロッド
  '#9400D3', // 17: ダークバイオレット
  '#FF1493', // 18: ディープピンク
  '#00CED1', // 19: ダークターコイズ
  '#ADFF2F', // 20: グリーンイエロー
  '#FFDAB9', // 21: ピーチパフ
  '#B22222', // 22: ファイアブリック
  '#FF69B4', // 23: ホットピンク
  '#8B0000' // 24: ダークレッド
]

const BOX_COLORS = [
  { color: [216, 67, 21], label: 'Front' },
  { color: [255, 87, 34], label: 'Right-Front' },
  { color: [123, 31, 162], label: 'Right-Side' },
  { color: [255, 193, 7], label: 'Right-Back' },
  { color: [76, 175, 80], label: 'Back' },
  { color: [33, 150, 243], label: 'Left-Back' },
  { color: [156, 39, 176], label: 'Left-Side' },
  { color: [0, 188, 212], label: 'Left-Front' }
]

// 検出結果の型定義
interface DetectionBox {
  classid: number
  score: number
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
  generation: number // -1: Unknown, 0: Adult, 1: Child
  gender: number // -1: Unknown, 0: Male, 1: Female
  handedness: number // -1: Unknown, 0: Left, 1: Right
  headPose: number // -1: Unknown, 0-7: 各方向
  isUsed: boolean // 属性マッチングで使用済みかどうか
}

// IoUを計算する関数
function calculateIoU(
  box1: DetectionBox | Pick<DetectionBox, 'x1' | 'y1' | 'x2' | 'y2'>,
  box2: DetectionBox | Pick<DetectionBox, 'x1' | 'y1' | 'x2' | 'y2'>
): number {
  const interX1 = Math.max(box1.x1, box2.x1)
  const interY1 = Math.max(box1.y1, box2.y1)
  const interX2 = Math.min(box1.x2, box2.x2)
  const interY2 = Math.min(box1.y2, box2.y2)

  if (interX2 <= interX1 || interY2 <= interY1) {
    return 0.0
  }

  const interArea = (interX2 - interX1) * (interY2 - interY1)
  const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1)
  const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1)

  return interArea / Number(box1Area + box2Area - interArea)
}

// 検出ボックスを作成する関数
function createDetectionBox(
  classid: number,
  score: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): DetectionBox {
  // 毎回新しいインスタンスを作成し、isUsedをfalseに初期化
  return {
    classid,
    score,
    x1,
    y1,
    x2,
    y2,
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2,
    generation: -1,
    gender: -1,
    handedness: -1,
    headPose: -1,
    isUsed: false // 必ず初期状態はfalse
  }
}

// 属性のマッチング処理
function matchAttributes(
  baseBox: DetectionBox,
  allBoxes: DetectionBox[],
  targetClassIds: number[],
  attributeType: 'generation' | 'gender' | 'handedness' | 'headPose'
): void {
  if (baseBox[attributeType] !== -1) return

  const validBoxes = allBoxes.filter(
    (box) => targetClassIds.includes(box.classid) && !box.isUsed && box.score >= 0.7
  )

  let mostRelevantBox: DetectionBox | null = null
  let bestIoU = 0.0
  let bestDistance = Infinity

  for (const targetBox of validBoxes) {
    const distance = Math.sqrt(
      Math.pow(baseBox.cx - targetBox.cx, 2) + Math.pow(baseBox.cy - targetBox.cy, 2)
    )

    if (distance <= 10.0) {
      const iou = calculateIoU(baseBox, targetBox)

      // IoUが高いものを優先
      if (iou > bestIoU) {
        mostRelevantBox = targetBox
        bestIoU = iou
        bestDistance = distance
      }
      // IoUが同じ場合は距離が近いものを採用
      else if (iou > 0.0 && iou === bestIoU && distance < bestDistance) {
        mostRelevantBox = targetBox
        bestDistance = distance
      }
    }
  }

  if (mostRelevantBox) {
    const attrValue =
      mostRelevantBox.classid -
      (attributeType === 'headPose'
        ? 8
        : attributeType === 'generation'
          ? 1
          : attributeType === 'gender'
            ? 3
            : attributeType === 'handedness'
              ? 22
              : 0)

    baseBox[attributeType] = attrValue
    mostRelevantBox.isUsed = true
  }
}

// 検出結果の処理
function processDetections(detections: number[], threshold: number): DetectionBox[] {
  const boxes: DetectionBox[] = []

  // スケーリング係数を計算
  const scaleX = 1920 / MODEL_INPUT_WIDTH // 1920はキャンバスの幅
  const scaleY = 1080 / MODEL_INPUT_HEIGHT // 1080はキャンバスの高さ

  // スコアの高いボックスのみを処理
  for (let i = 0; i < detections.length; i += 7) {
    const classid = Math.floor(detections[i + 1])
    const score = detections[i + 2]

    // 属性クラス（1-4, 8-15, 22-23）とそれ以外で異なるしきい値を使用
    const isAttributeClass =
      (classid >= 1 && classid <= 4) ||
      (classid >= 8 && classid <= 15) ||
      (classid >= 22 && classid <= 23)
    const currentThreshold = isAttributeClass ? 0.7 : threshold

    if (score > currentThreshold) {
      // 座標をスケーリング
      const x1 = detections[i + 3] * scaleX
      const y1 = detections[i + 4] * scaleY
      const x2 = detections[i + 5] * scaleX
      const y2 = detections[i + 6] * scaleY
      boxes.push(createDetectionBox(classid, score, x1, y1, x2, y2))
    }
  }

  // スコアでソート（高いものから）
  boxes.sort((a, b) => b.score - a.score)

  // 属性のマッチング処理
  // まずHeadPoseの処理
  for (const box of boxes) {
    if (box.classid === 7) {
      // Head
      matchAttributes(box, boxes, [8, 9, 10, 11, 12, 13, 14, 15], 'headPose')
    }
  }

  // 次にBodyの属性処理
  for (const box of boxes) {
    if (box.classid === 0) {
      // Body
      matchAttributes(box, boxes, [1, 2], 'generation')
      matchAttributes(box, boxes, [3, 4], 'gender')
    }
  }

  // 最後にHandの処理
  for (const box of boxes) {
    if (box.classid === 21) {
      // Hand
      matchAttributes(box, boxes, [22, 23], 'handedness')
    }
  }

  return boxes
}

// 描画関連の関数
function determineBoxColor(box: DetectionBox): string {
  if (box.classid === 0) {
    // Body
    if (box.gender === 0) return '#0000FF' // Male
    if (box.gender === 1) return '#FF0000' // Female
    return 'rgb(0,200,255)' // Unknown - 性別未検出時の色
  } else if (box.classid === 7) {
    // Head
    if (box.headPose !== -1) {
      const color = BOX_COLORS[box.headPose].color
      return `rgb(${color[0]},${color[1]},${color[2]})`
    }
    return 'rgb(216,67,21)'
  } else if (box.classid === 21) {
    // Hand
    if (box.handedness === 0) return '#008000' // Left
    if (box.handedness === 1) return '#FF00FF' // Right
    return 'rgb(0,255,0)' // Unknown
  }
  return classColors[box.classid]
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  dashLength: number = 5
): void {
  ctx.beginPath()
  ctx.setLineDash([dashLength, dashLength])
  ctx.strokeStyle = color
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawBox(ctx: CanvasRenderingContext2D, box: DetectionBox, color: string): void {
  const shouldDrawDashed =
    (box.classid === 0 && box.gender === -1) ||
    (box.classid === 7 && box.headPose === -1) ||
    (box.classid === 21 && box.handedness === -1)

  // 座標値のバウンディング
  const x1 = Math.max(0, Math.min(box.x1, ctx.canvas.width))
  const y1 = Math.max(0, Math.min(box.y1, ctx.canvas.height))
  const x2 = Math.max(0, Math.min(box.x2, ctx.canvas.width))
  const y2 = Math.max(0, Math.min(box.y2, ctx.canvas.height))

  ctx.beginPath()

  if (shouldDrawDashed) {
    ctx.lineWidth = 3
    drawDashedLine(ctx, x1, y1, x2, y1, color)
    drawDashedLine(ctx, x2, y1, x2, y2, color)
    drawDashedLine(ctx, x2, y2, x1, y2, color)
    drawDashedLine(ctx, x1, y2, x1, y1, color)
  } else {
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 5
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  }

  ctx.closePath()
}

function drawAttributeText(
  ctx: CanvasRenderingContext2D,
  box: DetectionBox,
  color: string,
  canvasWidth: number
): void {
  const texts: string[] = []

  // 世代と性別のテキスト
  if (box.classid === 0) {
    const generation = box.generation === 0 ? 'Adult' : box.generation === 1 ? 'Child' : ''
    const gender = box.gender === 0 ? 'M' : box.gender === 1 ? 'F' : ''
    if (generation || gender) {
      texts.push(`${generation}(${gender})`)
    }
  }

  // 頭部の向きのテキスト
  if (box.classid === 7 && box.headPose !== -1) {
    texts.push(BOX_COLORS[box.headPose].label)
  }

  // 手の左右のテキスト
  if (box.classid === 21) {
    if (box.handedness === 0) texts.push('L')
    if (box.handedness === 1) texts.push('R')
  }

  if (texts.length > 0) {
    const text = texts.join(' ')
    const x = box.x1 < canvasWidth - 50 ? box.x1 : canvasWidth - 50
    const y = box.y1 > 25 ? box.y1 - 10 : 20

    // 白い縁取り付きでテキストを描画
    ctx.font = '60px Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.strokeText(text, x, y)
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
  }
}

function Yolov9(): JSX.Element {
  const dispatch = useDispatch()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const workerRef = useRef<Comlink.Remote<YoloWorker> | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Workerの初期化
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/yolov9.worker.ts', import.meta.url), {
      type: 'module'
    })

    workerRef.current = Comlink.wrap<YoloWorker>(worker)

    const initModel = async () => {
      try {
        const modelPath = window.api.getYoloModelPath()
        const wasmPaths = window.api.getWasmData()
        const success = await workerRef.current!.loadModel(modelPath, wasmPaths)
        if (success) {
          console.log('モデルのロードが完了しました')
          setIsModelLoaded(true)
        }
      } catch (err) {
        console.error('モデルのロードに失敗:', err)
      }
    }

    initModel()

    return () => {
      worker.terminate()
    }
  }, [])

  // Webカメラの映像を取得
  useEffect(() => {
    // オフスクリーンキャンバスの作成
    offscreenCanvasRef.current = document.createElement('canvas')
    offscreenCanvasRef.current.width = 1920
    offscreenCanvasRef.current.height = 1080

    const startVideoStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 }, // 理想的な幅を指定
            height: { ideal: 1080 } // 理想的な高さを指定
            // optional: { aspectRatio: 16 / 9 }  // アスペクト比を指定することも可能
          }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // メタデータが読み込まれたら再生を開始
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()

            // Webカメラのネイティブ解像度を取得
            const videoTrack = stream.getVideoTracks()[0]
            const settings = videoTrack.getSettings()
            const nativeWidth = settings.width
            const nativeHeight = settings.height

            console.log(`Webカメラのネイティブ解像度: ${nativeWidth}x${nativeHeight}`)
          }
        }
      } catch (err) {
        console.error('Webカメラの取得に失敗しました:', err)
      }
    }

    startVideoStream()
  }, [])

  const preprocessImage = (video: HTMLVideoElement) => {
    const offscreenCanvas = offscreenCanvasRef.current!
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })

    // ビデオフレームをオフスクリーンキャンバスに描画
    ctx?.drawImage(video, 0, 0, MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT)
    const imageData = ctx?.getImageData(0, 0, MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT)
    const { data } = imageData!

    const inputTensor = new Float32Array(1 * 3 * MODEL_INPUT_HEIGHT * MODEL_INPUT_WIDTH)
    let offset = 0

    for (let i = 0; i < data.length; i += 4) {
      inputTensor[offset] = data[i + 2]
      inputTensor[offset + MODEL_INPUT_WIDTH * MODEL_INPUT_HEIGHT] = data[i + 1]
      inputTensor[offset + 2 * MODEL_INPUT_WIDTH * MODEL_INPUT_HEIGHT] = data[i]
      offset++
    }

    return new ort.Tensor('float32', inputTensor, [1, 3, MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH])
  }

  function renderBoundingBoxes(output: any) {
    const canvas = canvasRef.current
    if (!canvas) {
      console.error('キャンバス要素が見つかりません')
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      console.error('キャンバスコンテキストを取得できません')
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const detections = output['batchno_classid_score_x1y1x2y2']?.data
    if (!detections || detections.length === 0) {
      console.warn('推論結果が無効です。')
      return
    }

    const threshold = 0.75
    const boxes = processDetections(detections, threshold)

    // 頭部検出の状態を更新
    const isHeadFound = boxes.some((box) => box.classid === 7)
    dispatch(setHeadDetected(isHeadFound))

    for (const box of boxes) {
      // 描画しないクラスIDを除外
      if (
        (box.classid >= 17 && box.classid <= 24) || // 既存の除外範囲
        (box.classid >= 1 && box.classid <= 4) || // 性別・世代のボックスを除外
        (box.classid >= 8 && box.classid <= 15) // 頭部の向きのボックスを除外
      )
        continue

      const color = determineBoxColor(box)
      drawBox(ctx, box, color)
      drawAttributeText(ctx, box, color, canvas.width)
    }
  }

  const runRealTimeInference = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return

    try {
      // ビデオフレームから直接テンソルを作成
      const inputTensor = preprocessImage(videoRef.current)
      const result = await workerRef.current.runInference(
        inputTensor.data as Float32Array,
        inputTensor.dims
      )
      renderBoundingBoxes({ batchno_classid_score_x1y1x2y2: { data: result } })
    } catch (err) {
      console.error('推論実行エラー:', err)
    }

    requestAnimationFrame(runRealTimeInference)
  }

  const startInference = () => {
    if (isModelLoaded) {
      runRealTimeInference()
    }
  }

  useEffect(() => {
    // Workerからモデルロード完了の通知を受け取ったら
    if (isModelLoaded) {
      startInference()
    }
  }, [isModelLoaded])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      <video
        ref={videoRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', // 親要素に合わせて調整
          height: '100%', // 親要素に合わせて調整
          objectFit: 'cover' // アスペクト比を維持しながらカバー
        }}
      ></video>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', // 親要素に合わせて調整
          height: '100%', // 親要素に合わせて調整
          border: 'none',
          backgroundColor: 'transparent',
          zIndex: 2
        }}
      ></canvas>
    </div>
  )
}

export default Yolov9
